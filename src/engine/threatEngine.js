// 威胁引擎: 触发/应对/惩罚应用
// 核心: 消耗道具应对;不应对则扣资源/掉血(到floor不下,不致死)
import { THREATS, rollThreat, counterCost } from "../content/threats.js";
import { hasItem, removeItem } from "./inventory.js";
import { addLog } from "./state.js";
import { getResCap } from "./state.js";

// 触发威胁(定时器到期调用): 随机选一个,弹模态
export function triggerThreat(state) {
  const threat = rollThreat(Math.random, state);
  if (!threat) return;
  state._activeThreat = threat.id;
  // 不覆盖正在进行的模态(如探索事件)
  if (!state.modal) {
    state.modal = { type: "threat", threatId: threat.id };
  }
  addLog(state, `${threat.icon} 警报: ${threat.name}! ${threat.desc}`, threat.color);
}

// 检查能否应对(道具够不够)
export function canCounter(state, threatId) {
  const threat = THREATS[threatId];
  if (!threat) return false;
  const cost = counterCost(state, threat);
  return hasItem(state, cost.item, cost.amount);
}

// 执行应对: 消耗道具,无惩罚
export function doCounter(state, threatId) {
  const threat = THREATS[threatId];
  if (!threat || !canCounter(state, threatId)) return false;
  const cost = counterCost(state, threat);
  removeItem(state, cost.item, cost.amount);
  addLog(state, `${threat.icon} 成功抵御了${threat.name}! 消耗${cost.amount}个道具。`, "#4caf87");
  state._activeThreat = null;
  return true;
}

// 执行硬扛(不应对): 应用惩罚但不致死
export function doEndure(state, threatId) {
  const threat = THREATS[threatId];
  if (!threat) return;
  const p = threat.penalty;
  if (p.type === "health") {
    // 全员掉血,但到floor(1)不下,绝不致死
    for (const s of state.survivors) {
      if (s.busy === "dead") continue;
      s.health = Math.max(p.floor || 1, s.health - p.amount);
    }
    addLog(state, `${threat.icon} ${threat.penaltyText}`, "#e0584e");
  } else if (p.type === "resource") {
    // 扣资源(带上限保护)
    for (const k in p.resCost) {
      const cap = getResCap(state, k);
      state.res[k] = Math.max(0, (state.res[k] || 0) - p.resCost[k]);
    }
    addLog(state, `${threat.icon} ${threat.penaltyText}`, "#e0584e");
  }
  // 额外资源消耗(health型惩罚也附带资源消耗)
  if (p.resCost && p.type === "health") {
    for (const k in p.resCost) {
      state.res[k] = Math.max(0, (state.res[k] || 0) - p.resCost[k]);
    }
  }
  // 心情全员下降(灾难心理影响)
  for (const s of state.survivors) {
    if (s.busy === "dead") continue;
    s.mood = Math.max(0, s.mood - 15);
  }
  state._activeThreat = null;
}

// 威胁定时器(类似袭击): 每12-18天触发一次威胁
export function updateThreat(state, dt) {
  if (state._activeThreat) return; // 有威胁待处理,不触发新的
  if (!state.threat) state.threat = { timer: 1440 }; // 首次12天
  state.threat.timer -= dt;
  if (state.threat.timer <= 0) {
    state.threat.timer = 1440 + Math.random() * 720; // 12-18天
    triggerThreat(state);
  }
}
