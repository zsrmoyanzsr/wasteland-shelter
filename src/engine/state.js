// 中心游戏状态
// 设计: 单一 state 对象,纯数据,所有系统读写它
// 存档时整体序列化到 localStorage

import { createInitialSurvivors } from "../content/survivors.js";
import { createInitialFacilities } from "../content/facilities.js";
import { createMaps, currentMap, gridToWorld, CELL_PX } from "../content/regions.js";
import { createInitialTasks } from "../content/tasks.js";
import { createInitialAchievements } from "../content/achievements.js";

// 顶部导航屏幕
export const SCREEN = {
  START: "start",
  BASE: "base",
  MAP: "map",
  ROSTER: "roster",
  DISPATCH: "dispatch",
  TASKS: "tasks",
};

// 存档版本号: 每次结构性改动(加字段/改结构)时 +1
// 老存档读档时会按 migrations 链逐步升级到此版本
export const CURRENT_VERSION = 3;

export function createNewState() {
  const st = {
    // 元信息
    version: CURRENT_VERSION,
    createdAt: Date.now(),
    lastTickAt: Date.now(), // 上次 tick 真实时间(用于离线结算)

    // 当前屏幕
    screen: SCREEN.START,
    prevScreen: SCREEN.BASE,
    tab: SCREEN.BASE, // 底部导航高亮

    // 游戏内时间(秒)。游戏内 1 天 = 120 秒现实时间
    time: 0, // 经过的总游戏秒
    day: 1,
    timeOfDay: 0.3, // 0..1 一天内进度,影响昼夜色调
    speed: 1, // 时间流速倍率(测试用)

    // 资源(前期精简: 只给基础生存物资,parts/scrap 少量,meds/power 靠派遣/建造获得)
    res: {
      food: 30,
      water: 30,
      parts: 8,
      power: 0,
      meds: 0,
      scrap: 15,
    },
    resCap: {
      food: 100,
      water: 100,
      parts: 100,
      power: 50,
      meds: 50,
      scrap: 100,
    },

    // 基地等级(影响人口上限/资源容量,通过 baseLevelCap 动态计算实际容量)

    // 基地
    base: {
      level: 1, // 主基地等级,影响居民上限/可建设施
      facilities: createInitialFacilities(), // 见 facilities.js
    },

    // 幸存者
    survivors: createInitialSurvivors(),
    nextSurvivorId: 100,

    // 无线电招募
    radio: {
      candidate: null, // 当前可招募的候选人(Survivor|null)
      cooldown: 0, // 下次可招募倒计时(秒)
    },

    // 多地图系统 & 主角
    maps: createMaps(),
    player: {
      x: 0, // 当前地图内的世界像素坐标(下方修正到入口格)
      y: 0,
      tx: 0, // 目标点(点击移动)
      ty: 0,
      moveSpeed: 110, // 像素/秒
      stamina: 100,
      maxStamina: 100,
      health: 100, // 主角生命(探索事件可扣,0=重伤回营静养,不死)
      maxHealth: 100,
    },

    // 派遣任务
    expeditions: [], // {id, regionId, members:[ids], startAt, duration, state:'running'|'returning'|'done', rewards, event}
    nextExpeditionId: 1,

    // 任务 & 成就
    tasks: createInitialTasks(),

    // 成就(累计型,基于stats判定)
    achievements: createInitialAchievements(),

    // 统计(用于成就/平衡)
    stats: {
      totalFood: 0,
      totalWater: 0,
      totalParts: 0,
      expeditionsDone: 0,
      survivorsRecruited: 0,
      facilitiesBuilt: 0,
    },

    // 通知/事件日志(最近 N 条)
    log: [], // {t, text, color}

    // 浮动文字反馈(数字跳动)
    floats: [], // {x,y,text,color,life,maxLife,vy}

    // 当前弹窗(模态)。null 或 {type, data}
    modal: null,

    // 全屏切换
    fullscreen: false,

    // 简单的袭击事件计时
    raid: {
      timer: 600, // 距下次袭击(秒)
      threat: 0, // 威胁值 0..1
    },

    // 新手引导: 记录玩家已完成的里程碑,据此显示提示
    guide: {
      explored: false,     // 是否进过地图探索
      dispatched: false,   // 是否发起过派遣
      built: false,        // 是否建造过设施(非初始)
      recruited: false,    // 是否招募过幸存者
      dismissed: [],       // 已关闭的提示 id(不再弹)
    },

    // 流浪商队: 稀有到访的交易系统(每6-9游戏天到访一次,带3个高价值方案)
    caravan: {
      timer: 720, // 首次到访倒计时(秒);到访后重置为 720+random*360 (6-9天)
      here: false, // 商队是否在场
      leaveTimer: 0, // 在场剩余时间(秒),到点自动离开
      offers: [], // 当前交易方案 [{give:{资源:量}, get:{资源:量}, taken:false}]
    },
  };
  // 主角初始位置 = home 地图入口格中心
  const homeMap = currentMap(st);
  if (homeMap) {
    const w = gridToWorld(homeMap.entry.gx, homeMap.entry.gy);
    st.player.x = w.x;
    st.player.y = w.y;
    st.player.tx = w.x;
    st.player.ty = w.y;
  }

  // 预分配初始幸存者到初始设施,确保开局产能为正(农场/净水有人工作)
  if (st.survivors.length >= 2 && st.base.facilities.length >= 2) {
    const farm = st.base.facilities.find((f) => f.type === "farm");
    const well = st.base.facilities.find((f) => f.type === "well");
    if (farm) {
      farm.assigned = [st.survivors[0].id];
      st.survivors[0].assigned = farm.id;
    }
    if (well) {
      well.assigned = [st.survivors[1].id];
      st.survivors[1].assigned = well.id;
    }
  }
  return st;
}

// 添加日志
export function addLog(state, text, color) {
  state.log.unshift({ t: state.time, text, color: color || "#9aa1b0" });
  if (state.log.length > 30) state.log.length = 30;
}

// 添加浮动数字反馈
export function addFloat(state, x, y, text, color) {
  state.floats.push({ x, y, text, color: color || "#7cc36b", life: 1.2, maxLife: 1.2, vy: -40 });
  if (state.floats.length > 40) state.floats.shift();
}

// 基地等级影响资源容量: 每级 +30 (基础100)
export function getResCap(state, key) {
  const base = state.resCap[key] || 100;
  return base + (state.base.level - 1) * 30;
}

// 基地升级成本(当前 level → level+1)
export function baseUpgradeCost(level) {
  return {
    scrap: 20 + level * 15,
    parts: 10 + level * 8,
    food: 10 + level * 5,
  };
}

// 基地最大等级
export const MAX_BASE_LEVEL = 5;

// ── 默认值模板(供存档迁移补全缺失字段) ──
// 嵌套对象的默认值,mergeDefaults 用这些给老存档的缺失字段补值,避免 NPE/NaN
export const DEFAULTS = {
  // 资源(与 createNewState 保持一致;前期精简)
  res: { food: 30, water: 30, parts: 8, power: 0, meds: 0, scrap: 15 },
  resCap: { food: 100, water: 100, parts: 100, power: 50, meds: 50, scrap: 100 },
  // 统计(注意:每个子字段都要补,否则解锁条件/成就 NaN)
  stats: {
    totalFood: 0, totalWater: 0, totalParts: 0,
    expeditionsDone: 0, survivorsRecruited: 0, facilitiesBuilt: 0,
  },
  // 主角
  player: {
    x: 0, y: 0, tx: 0, ty: 0, moveSpeed: 110,
    stamina: 100, maxStamina: 100, health: 100, maxHealth: 100,
  },
  // 无线电
  radio: { candidate: null, cooldown: 0 },
  // 袭击
  raid: { timer: 600, threat: 0 },
  // 新手引导(mergeDefaults 补全)
  guide: { explored: false, dispatched: false, built: false, recruited: false, dismissed: [] },
  // 流浪商队(mergeDefaults 补全)
  caravan: { timer: 720, here: false, leaveTimer: 0, offers: [] },
  // 单个幸存者的可缺失字段默认值
  survivor: {
    perks: [],
    skills: { medical: 0, craft: 0, scavenge: 0, combat: 0, farm: 0, social: 0 },
    health: 100, maxHealth: 100, hunger: 80, mood: 75,
    assigned: null, busy: null, xp: 0, level: 1,
  },
  // 单个设施的可缺失字段
  facility: { level: 1, assigned: [] },
  // 单个 expedition 的可缺失字段
  expedition: { members: [], rewards: {}, event: null, state: "done" },
};

