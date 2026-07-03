// 装备制造与穿戴引擎
import { EQUIP_BLUEPRINTS, isBlueprintUnlocked, craftEquip } from "../content/equipment.js";
import { canAffordItems, spendItems } from "./inventory.js";
import { addLog } from "./state.js";

// 制造装备(扣材料+加到仓库)
export function doCraft(state, bpId) {
  const bp = EQUIP_BLUEPRINTS[bpId];
  if (!bp || !isBlueprintUnlocked(state, bpId)) return { ok: false, reason: "未解锁" };
  // 检查基础资源
  for (const k in bp.cost.res) {
    if ((state.res[k] || 0) < bp.cost.res[k]) return { ok: false, reason: `${k}不足` };
  }
  // 检查物品
  if (!canAffordItems(state, bp.cost.items)) return { ok: false, reason: "材料不足" };
  // 扣除
  for (const k in bp.cost.res) state.res[k] = Math.max(0, (state.res[k] || 0) - bp.cost.res[k]);
  spendItems(state, bp.cost.items);
  // 制造
  const inst = craftEquip(state, bpId);
  if (!inst) return { ok: false, reason: "制造失败" };
  if (!state.equipment.storage) state.equipment.storage = [];
  state.equipment.storage.push(inst);
  addLog(state, `🔧 制造了 ${bp.icon} ${bp.name}`, "#f0a93b");
  return { ok: true, inst };
}

// 穿戴装备(给幸存者)
export function equipItem(state, survivor, inst) {
  if (!inst || !survivor) return false;
  if (!state.equipment.equipped) state.equipment.equipped = {};
  const sid = survivor.id;
  if (!state.equipment.equipped[sid]) state.equipment.equipped[sid] = {};
  const slot = inst.slot;
  // 卸下旧装备(放回仓库)
  const old = state.equipment.equipped[sid][slot];
  if (old) state.equipment.storage.push(old);
  // 穿新装备(从仓库移除)
  state.equipment.storage = state.equipment.storage.filter((e) => e.uid !== inst.uid);
  state.equipment.equipped[sid][slot] = inst;
  return true;
}

// 卸下装备(放回仓库)
export function unequipItem(state, survivor, slot) {
  const sid = survivor.id;
  const cur = state.equipment.equipped?.[sid]?.[slot];
  if (!cur) return false;
  state.equipment.storage.push(cur);
  delete state.equipment.equipped[sid][slot];
  return true;
}

// 获取幸存者装备总属性加成(用于派遣/战斗)
export function getEquipStats(state, survivorId) {
  const equipped = state.equipment?.equipped?.[survivorId];
  if (!equipped) return {};
  const stats = {};
  for (const slot of ["weapon", "armor", "accessory"]) {
    const e = equipped[slot];
    if (e?.stat) for (const k in e.stat) stats[k] = (stats[k] || 0) + e.stat[k];
  }
  return stats;
}
