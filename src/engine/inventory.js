// 背包系统: state.inventory 的增删查,带堆叠上限
import { itemDef } from "../content/items.js";

// 给玩家添加物品 {物品id: 数量}
export function addItem(state, itemId, amount = 1) {
  if (!state.inventory) state.inventory = {};
  const def = itemDef(itemId);
  if (!def) return false;
  const cap = def.stack || 99;
  state.inventory[itemId] = Math.min(cap, (state.inventory[itemId] || 0) + amount);
  return true;
}

// 批量添加(用于派遣/事件掉落) {物品id: 数量}
export function addItems(state, items) {
  if (!state.inventory) state.inventory = {};
  for (const id in items) addItem(state, id, items[id]);
}

// 消耗物品(返回是否成功,不够则不动)
export function removeItem(state, itemId, amount = 1) {
  if (!state.inventory) return false;
  const have = state.inventory[itemId] || 0;
  if (have < amount) return false;
  state.inventory[itemId] = have - amount;
  if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
  return true;
}

// 检查是否拥有指定物品及数量
export function hasItem(state, itemId, amount = 1) {
  return (state.inventory?.[itemId] || 0) >= amount;
}

// 检查能否支付一组物品需求 {物品id: 数量}
export function canAffordItems(state, cost) {
  for (const id in cost) {
    if (!hasItem(state, id, cost[id])) return false;
  }
  return true;
}

// 扣除一组物品(假设已通过 canAffordItems 检查)
export function spendItems(state, cost) {
  for (const id in cost) removeItem(state, id, cost[id]);
}

// 背包总物品种数(用于UI显示)
export function inventoryCount(state) {
  return state.inventory ? Object.keys(state.inventory).filter((k) => state.inventory[k] > 0).length : 0;
}

// 使用消耗品(返回效果描述或null)
export function useConsumable(state, itemId, survivor) {
  const def = itemDef(itemId);
  if (!def || def.cat !== "consumable" || !def.use) return null;
  if (!removeItem(state, itemId, 1)) return null;
  const use = def.use;
  if (use.type === "heal" && survivor) {
    const before = survivor.health;
    survivor.health = Math.min(survivor.maxHealth, survivor.health + use.amount);
    return { text: `${def.icon} ${survivor.name} 恢复了 ${Math.floor(survivor.health - before)} 点生命`, type: "heal" };
  }
  // cure/buff 由战斗系统处理,这里返回定义
  return { text: `${def.icon} ${def.name} 已准备`, type: use.type, def: use };
}
