// 经济系统: 每 tick 资源产出/消耗 + 离线结算
// 产出受设施等级 + 分配居民(特长加成)影响
// 消耗: 设施运转消耗(电力/废铁等) + 居民每日消耗(食物/水)

import { facilityStats, FACILITY_TYPES } from "../content/facilities.js";
import { populationCap } from "../content/survivors.js";
import { addLog, getResCap } from "./state.js";

// 计算某设施的净产出(考虑居民与特长)
export function facilityProduction(state, fac) {
  const stats = facilityStats(fac.type, fac.level);
  const def = FACILITY_TYPES[fac.type];
  const assigned = (fac.assigned || [])
    .map((id) => state.survivors.find((s) => s.id === id))
    .filter(Boolean);

  // 居民加成: 每个分配的居民 +30% 产出; 有对应特长 +50%; 技能值额外加成
  // 技能 → 设施映射: farm→farm技能, workshop→craft, well→farm(种植水利), generator→craft, medbay→medical
  const skillMap = { farm: "farm", workshop: "craft", well: "farm", generator: "craft", medbay: "medical" };
  const facilitySkill = skillMap[fac.type];
  let mult = 0; // 加成倍率(0=无人工作,产能打折)
  if (assigned.length > 0) {
    mult = 0.4 + assigned.length * 0.3; // 基础有人工作 0.4 起
    if (def.perk) {
      for (const s of assigned) {
        if (s.perks && s.perks.includes(def.perk)) mult += 0.5;
      }
    }
    // 技能值加成: 每点技能 +5% 产出
    if (facilitySkill) {
      for (const s of assigned) {
        const sv = s.skills[facilitySkill] || 0;
        mult += sv * 0.05;
      }
    }
    // 重伤(health<30)的居民工作效率减半
    let healthPenalty = 0;
    for (const s of assigned) {
      if (s.health < 30) healthPenalty += 0.15; // 每个重伤居民 -15%
    }
    mult = Math.max(0.2, mult - healthPenalty);
    mult = Math.min(mult, 2.5);
  } else {
    mult = 0.35; // 无人值守,低产出(半自动),但不至于完全停摆
  }

  const produces = {};
  const consumes = {};
  for (const k in stats.produces) produces[k] = stats.produces[k] * mult;
  for (const k in stats.consumes) consumes[k] = stats.consumes[k]; // 消耗不打折

  return { produces, consumes, jobs: stats.jobs, assigned: assigned.length, mult };
}

// 全基地每秒净资源变化
export function tickEconomy(state, dt) {
  const delta = { food: 0, water: 0, parts: 0, power: 0, meds: 0, scrap: 0 };

  // 设施产出
  for (const fac of state.base.facilities) {
    const { produces, consumes } = facilityProduction(state, fac);
    // 检查消耗是否够(电力/废铁不足时产能减半)
    let canRun = true;
    for (const k in consumes) {
      if (state.res[k] < consumes[k] * dt) {
        canRun = false;
        break;
      }
    }
    const eff = canRun ? 1 : 0.5;
    for (const k in produces) delta[k] += produces[k] * eff;
    for (const k in consumes) delta[k] -= consumes[k] * eff;
  }

  // 居民每日消耗(食物/水): 游戏内 1 天 = 120 秒
  // 注意: delta 是"每秒速率",最后统一 * dt 应用,所以这里用每秒消耗量
  // 计入非死亡居民(派遣中的仍驻扎基地,照常消耗)
  const pop = state.survivors.filter((s) => s.busy !== "dead").length;
  const foodConsumePerSec = (pop * 3) / 120; // 每人每天 3 食物 → 每秒
  const waterConsumePerSec = (pop * 2.5) / 120;
  delta.food -= foodConsumePerSec;
  delta.water -= waterConsumePerSec;

  // 应用到资源(带容量上限,容量随基地等级提升)
  for (const k in delta) {
    state.res[k] += delta[k] * dt;
    const cap = getResCap(state, k);
    state.res[k] = Math.max(0, Math.min(cap, state.res[k]));
  }

  // 居民饥饿/口渴/心情更新(传每日等效量供需求计算)
  updateSurvivorNeeds(state, dt, {
    foodConsume: foodConsumePerSec * dt,
    waterConsume: waterConsumePerSec * dt,
  });

  // 资源不足的负面效果已在 updateSurvivorNeeds 处理

  // 医疗治疗: 医疗室(medbay)分配的伤员自动回血,消耗药品
  healInMedbay(state, dt);

  return delta;
}

// 医疗室治疗: 分配在 medbay 的受伤幸存者回血(消耗 meds)
function healInMedbay(state, dt) {
  for (const fac of state.base.facilities) {
    if (fac.type !== "medbay") continue;
    const assigned = (fac.assigned || [])
      .map((id) => state.survivors.find((s) => s.id === id))
      .filter((s) => s && s.busy !== "dead");
    // 是否有医生(治疗更快)
    const hasDoctor = assigned.some((s) => s.perks && s.perks.includes("doctor"));
    const healRate = (hasDoctor ? 4 : 2) * dt; // 每秒回血量
    const medsCost = 0.05 * dt * assigned.length; // 每个伤员消耗药品
    if (state.res.meds <= 0) continue; // 无药不能治
    for (const s of assigned) {
      if (s.health >= s.maxHealth) continue;
      s.health = Math.min(s.maxHealth, s.health + healRate);
      state.res.meds = Math.max(0, state.res.meds - medsCost / assigned.length);
    }
  }
}

// 更新幸存者需求状态
// 关键平衡: hunger 应与食物供给联动 —— 有食物时回升(已通过经济层扣除消耗),
// 食物短缺时加速下降并扣血。修复点: 旧版 hunger 即使食物满仓也线性归零。
function updateSurvivorNeeds(state, dt, { foodConsume, waterConsume }) {
  const foodShort = state.res.food <= 0.5;
  const dayFrac = dt / 120;
  for (const s of state.survivors) {
    if (s.busy === "dead") continue;
    // 饱食度: 有食物供给时回升(吃饭),食物短缺时加速下降
    if (foodShort) {
      s.hunger -= 14 * dayFrac; // 缺粮: 加速饥饿(原6+8)
    } else {
      s.hunger += 8 * dayFrac;  // 有粮: 饱食度回升(每天+8,慢于消耗确保仍需持续产粮)
    }
    s.hunger = Math.max(0, Math.min(100, s.hunger));
    // 心情受饥饿/健康影响
    let moodDelta = 0;
    if (s.hunger < 30) moodDelta -= 5 * dayFrac;
    if (s.health < 40) moodDelta -= 4 * dayFrac;
    if (s.hunger > 60 && s.health > 60) moodDelta += 1 * dayFrac;
    s.mood = Math.max(0, Math.min(100, s.mood + moodDelta));
    // 严重饥饿扣血
    if (s.hunger <= 0) s.health -= 4 * dayFrac;
    s.health = Math.max(0, Math.min(s.maxHealth, s.health));
  }
}

// 离线结算: 根据 lastTickAt 与当前时间差,按有限速率结算产出
export function offlineSettle(state, nowMs) {
  const offlineMs = Math.max(0, nowMs - state.lastTickAt);
  if (offlineMs < 5000) return 0; // 不足5秒不结算
  // 离线产出上限: 8 小时(避免挂机过久爆资源)
  const cappedSec = Math.min(offlineMs / 1000, 8 * 3600);
  // 用经济函数结算,但效率打 0.8 折(离线略低于在线)
  const eff = 0.8;
  // 临时保存原 dt, 以 1 秒为单位循环
  let totalDelta = { food: 0, water: 0, parts: 0, power: 0, meds: 0, scrap: 0 };
  const steps = Math.min(60, Math.floor(cappedSec)); // 最多算 60 步,每步代表 cappedSec/60 秒
  const stepSec = cappedSec / steps;
  for (let i = 0; i < steps; i++) {
    const delta = tickEconomy(state, stepSec * eff);
    for (const k in delta) totalDelta[k] += delta[k] * stepSec * eff;
  }
  state.lastTickAt = nowMs;
  state.time += cappedSec;
  // 居民在医疗室恢复一点生命(在线/离线通用)
  return { offlineSec: cappedSec, totalDelta };
}
