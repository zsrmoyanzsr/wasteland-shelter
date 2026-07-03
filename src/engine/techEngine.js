// 科技研发引擎: 检查可否研发 + 扣除消耗 + 应用效果
import { TECH_TREE, techLevelDef } from "../content/tech.js";
import { canAffordItems, spendItems } from "./inventory.js";
import { addLog } from "./state.js";

// 检查能否研发某分支下一级(资源+物品够,且未满级)
export function canResearch(state, branch) {
  const next = techLevelDef(branch, state.tech?.[branch] || 0);
  if (!next) return { ok: false, reason: "已满级" };
  // 检查基础资源
  for (const k in next.cost.res) {
    if ((state.res[k] || 0) < next.cost.res[k]) return { ok: false, reason: `${k}不足` };
  }
  // 检查物品(过滤数量为0的,即不需要)
  const itemCost = {};
  for (const k in next.cost.items) {
    if (next.cost.items[k] > 0) itemCost[k] = next.cost.items[k];
  }
  if (!canAffordItems(state, itemCost)) return { ok: false, reason: "材料不足" };
  return { ok: true, next };
}

// 执行研发(假设已通过 canResearch)
export function doResearch(state, branch) {
  const check = canResearch(state, branch);
  if (!check.ok) return false;
  const next = check.next;
  // 扣基础资源
  for (const k in next.cost.res) {
    state.res[k] = Math.max(0, (state.res[k] || 0) - next.cost.res[k]);
  }
  // 扣物品
  for (const k in next.cost.items) {
    if (next.cost.items[k] > 0) spendItems(state, { [k]: next.cost.items[k] });
  }
  // 升级
  state.tech[branch] = next.level;
  const tree = TECH_TREE[branch];
  addLog(state, `🔬 科技突破: ${tree.name} · ${next.name}! ${next.effect}`, "#e0588e");
  // 结局检查: 升满级时触发对应结局
  if (next.unlocksEnding && !state.prestige.unlockedEndings.includes(next.unlocksEnding)) {
    state.prestige.unlockedEndings.push(next.unlocksEnding);
    state.modal = { type: "ending", endingId: next.unlocksEnding };
    addLog(state, `🏆 达成结局! ${next.unlocksEnding}`, "#f0a93b");
  }
  return true;
}
