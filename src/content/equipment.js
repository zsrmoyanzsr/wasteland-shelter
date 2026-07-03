// 装备系统: 武器/护甲/配饰,4稀有度,影响派遣属性
// 装备由蓝图(科技解锁)+材料(物品系统)+工坊制造

export const RARITY = {
  common: { id: "common", name: "普通", color: "#9aa1b0", mult: 1.0 },
  fine: { id: "fine", name: "精良", color: "#4caf87", mult: 1.5 },
  rare: { id: "rare", name: "稀有", color: "#5b9bd5", mult: 2.2 },
  legendary: { id: "legendary", name: "传说", color: "#f0a93b", mult: 3.5 },
};

// 装备蓝图(配方): 科技解锁后可在工坊制造
export const EQUIP_BLUEPRINTS = {
  // 武器(加 combat/scavenge)
  weapon_pipe: { id: "weapon_pipe", slot: "weapon", name: "铁管手枪", icon: "🔫", rarity: "common", stat: { combat: 3 }, cost: { items: { barrel: 1, screw: 3 }, res: { scrap: 10 } }, tech: { defense: 1 } },
  weapon_rifle: { id: "weapon_rifle", slot: "weapon", name: "步枪", icon: "🏹", rarity: "fine", stat: { combat: 6, scavenge: 2 }, cost: { items: { barrel: 2, lens: 1, screw: 5 }, res: { scrap: 25, parts: 10 } }, tech: { defense: 2 } },
  weapon_laser: { id: "weapon_laser", slot: "weapon", name: "激光枪", icon: "✨", rarity: "rare", stat: { combat: 12, scavenge: 3 }, cost: { items: { cell: 2, lens: 2, circuit: 3 }, res: { scrap: 40, parts: 25, power: 20 } }, tech: { defense: 4 } },
  weapon_plasma: { id: "weapon_plasma", slot: "weapon", name: "等离子炮", icon: "🌟", rarity: "legendary", stat: { combat: 25, scavenge: 5 }, cost: { items: { cell: 5, circuit: 5, alloy: 3 }, res: { scrap: 80, parts: 50, power: 40 } }, tech: { defense: 5 } },

  // 护甲(加 防御/health)
  armor_cloth: { id: "armor_cloth", slot: "armor", name: "布甲", icon: "🥼", rarity: "common", stat: { defense: 2, health: 10 }, cost: { items: { cloth: 3, screw: 2 }, res: { scrap: 8 } }, tech: {} },
  armor_leather: { id: "armor_leather", slot: "armor", name: "皮甲", icon: "🧥", rarity: "fine", stat: { defense: 5, health: 20 }, cost: { items: { cloth: 5, alloy: 1 }, res: { scrap: 20, parts: 8 } }, tech: { defense: 1 } },
  armor_combat: { id: "armor_combat", slot: "armor", name: "战斗装甲", icon: "🦺", rarity: "rare", stat: { defense: 12, health: 40 }, cost: { items: { fiber: 3, alloy: 3, circuit: 2 }, res: { scrap: 50, parts: 30 } }, tech: { defense: 3 } },
  armor_power: { id: "armor_power", slot: "armor", name: "动力装甲", icon: "🤖", rarity: "legendary", stat: { defense: 25, health: 80, combat: 5 }, cost: { items: { cell: 4, fiber: 5, alloy: 6 }, res: { scrap: 100, parts: 60, power: 50 } }, tech: { defense: 5 } },

  // 配饰(加 技能/特殊)
  acc_scope: { id: "acc_scope", slot: "accessory", name: "瞄准镜", icon: "🔭", rarity: "fine", stat: { scavenge: 4, combat: 2 }, cost: { items: { lens: 2, screw: 3 }, res: { scrap: 15, parts: 5 } }, tech: { production: 1 } },
  acc_rad: { id: "acc_rad", slot: "accessory", name: "辐射计", icon: "📡", rarity: "rare", stat: { medical: 6, scavenge: 2 }, cost: { items: { circuit: 3, lens: 1, chem: 2 }, res: { scrap: 30, parts: 15 } }, tech: { bio: 2 } },
  acc_charm: { id: "acc_charm", slot: "accessory", name: "领袖徽章", icon: "🎖️", rarity: "rare", stat: { social: 8, farm: 3 }, cost: { items: { alloy: 2, circuit: 2 }, res: { scrap: 35, parts: 20 } }, tech: { production: 3 } },
  acc_relic: { id: "acc_relic", slot: "accessory", name: "永恒信物", icon: "🔮", rarity: "legendary", stat: { combat: 5, medical: 5, scavenge: 5, social: 5, farm: 5, craft: 5 }, cost: { items: { cell: 3, alloy: 4, blueprint: 1 }, res: { scrap: 60, parts: 40 } }, tech: { bio: 4 } },
};

// 检查蓝图是否解锁(科技条件满足)
export function isBlueprintUnlocked(state, bpId) {
  const bp = EQUIP_BLUEPRINTS[bpId];
  if (!bp) return false;
  for (const branch in bp.tech) {
    if ((state.tech?.[branch] || 0) < bp.tech[branch]) return false;
  }
  return true;
}

// 获取所有已解锁的蓝图
export function unlockedBlueprints(state) {
  return Object.values(EQUIP_BLUEPRINTS).filter((bp) => isBlueprintUnlocked(state, bp.id));
}

// 制造装备(扣材料,返回装备实例)
export function craftEquip(state, bpId) {
  const bp = EQUIP_BLUEPRINTS[bpId];
  if (!bp || !isBlueprintUnlocked(state, bpId)) return null;
  // 检查材料(在 craftEngine 里做 canAfford,这里假设已检查)
  // 生成装备实例
  const inst = {
    uid: Date.now() + Math.floor(Math.random() * 1000), // 唯一实例id
    bpId: bp.id,
    slot: bp.slot,
    name: bp.name,
    icon: bp.icon,
    rarity: bp.rarity,
    stat: { ...bp.stat },
  };
  return inst;
}
