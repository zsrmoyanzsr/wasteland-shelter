// 物品系统: 材料/消耗品/装备组件/特殊品
// 物品是所有上层系统(科技树/装备/任务)的地基
// 获取: 派遣掉落 + 探索事件 + 商队购买 + 拆解
// 消耗: 制造装备 + 研发科技 + 完成任务 + 战斗使用

export const ITEMS = {
  // ── 材料(建造/科技用) ──
  screw: { id: "screw", name: "螺丝", icon: "🔩", desc: "基础机械零件,建造与制造的基础材料。", cat: "material", stack: 999 },
  circuit: { id: "circuit", name: "电路板", icon: "💠", desc: "精密电子元件,科技研发与高级装备用。", cat: "material", stack: 999 },
  cloth: { id: "cloth", name: "布料", icon: "🧵", desc: "废旧织物,制作护甲与绷带的材料。", cat: "material", stack: 999 },
  chem: { id: "chem", name: "化学剂", icon: "🧪", desc: "危险化学品,生物科技与药品的关键原料。", cat: "material", stack: 999 },
  alloy: { id: "alloy", name: "合金", icon: "⛓️", desc: "高强度合金,高级装备与防御工事的核心。", cat: "material", stack: 999 },

  // ── 消耗品(战斗/治疗) ──
  bandage: { id: "bandage", name: "止血包", icon: "🩹", desc: "战斗或事件中使用,立即恢复一名幸存者40点生命。", cat: "consumable", stack: 99, use: { type: "heal", amount: 40 } },
  antibiotic: { id: "antibiotic", name: "抗生素", icon: "💊", desc: "治疗瘟疫与重伤,恢复60生命并清除疾病状态。", cat: "consumable", stack: 99, use: { type: "heal", amount: 60 } },
  radaway: { id: "radaway", name: "辐射清除剂", icon: "☢️", desc: "清除辐射污染,防止辐射持续扣血。", cat: "consumable", stack: 99, use: { type: "cure", status: "radiation" } },
  stimpack: { id: "stimpack", name: "兴奋剂", icon: "💉", desc: "战斗中临时+20战斗力,持续整场战斗。", cat: "consumable", stack: 99, use: { type: "buff", stat: "combat", amount: 20 } },

  // ── 装备组件(制造装备用) ──
  barrel: { id: "barrel", name: "枪管", icon: "🔫", desc: "武器核心组件,制造枪械类装备。", cat: "component", stack: 99 },
  lens: { id: "lens", name: "精密镜头", icon: "🔍", desc: "瞄准与观测组件,制造精密武器/配饰。", cat: "component", stack: 99 },
  cell: { id: "cell", name: "能量电池", icon: "🔋", desc: "能量来源,制造能量武器与动力护甲。", cat: "component", stack: 99 },
  fiber: { id: "fiber", name: "防弹纤维", icon: "🧶", desc: "高级防护材料,制造护甲的核心。", cat: "component", stack: 99 },

  // ── 特殊品(转生/任务/隐藏) ──
  blueprint: { id: "blueprint", name: "蓝图碎片", icon: "📜", desc: "古老的技术蓝图碎片,集齐可解锁隐藏科技或揭示真相。", cat: "special", stack: 99 },
  relic: { id: "relic", name: "避难所信物", icon: "🔮", desc: "转生时获得的永恒信物,可兑换特殊能力。下一代保留。", cat: "special", stack: 99 },
  artifact: { id: "artifact", name: "神秘文物", icon: "🗿", desc: "核战前的未知文物,用途不明,或许与结局有关。", cat: "special", stack: 99 },
};

// 物品分类标签
export const ITEM_CATS = {
  material: { id: "material", name: "材料", icon: "📦" },
  consumable: { id: "consumable", name: "消耗品", icon: "💊" },
  component: { id: "component", name: "组件", icon: "🔧" },
  special: { id: "special", name: "特殊", icon: "✨" },
};

// 按分类获取物品列表
export function itemsByCategory(cat) {
  return Object.values(ITEMS).filter((it) => it.cat === cat);
}

// 获取物品定义
export function itemDef(id) {
  return ITEMS[id] || null;
}

// 派遣掉落表: 按POI类型,每种POI可能掉落的物品+概率+数量
export const POI_ITEM_DROPS = {
  town: [
    { id: "screw", chance: 0.5, amt: [1, 3] },
    { id: "cloth", chance: 0.3, amt: [1, 2] },
    { id: "bandage", chance: 0.2, amt: [1, 1] },
  ],
  hospital: [
    { id: "chem", chance: 0.4, amt: [1, 2] },
    { id: "antibiotic", chance: 0.3, amt: [1, 1] },
    { id: "radaway", chance: 0.2, amt: [1, 1] },
  ],
  factory: [
    { id: "circuit", chance: 0.4, amt: [1, 2] },
    { id: "barrel", chance: 0.25, amt: [1, 1] },
    { id: "alloy", chance: 0.2, amt: [1, 2] },
  ],
  military: [
    { id: "alloy", chance: 0.4, amt: [1, 3] },
    { id: "cell", chance: 0.3, amt: [1, 2] },
    { id: "fiber", chance: 0.25, amt: [1, 1] },
    { id: "blueprint", chance: 0.1, amt: [1, 1] },
    { id: "stimpack", chance: 0.2, amt: [1, 1] },
  ],
  cache: [
    { id: "screw", chance: 0.3, amt: [1, 2] },
    { id: "cloth", chance: 0.3, amt: [1, 2] },
    { id: "bandage", chance: 0.25, amt: [1, 1] },
    { id: "blueprint", chance: 0.05, amt: [1, 1] },
  ],
  supply: [
    { id: "screw", chance: 0.4, amt: [1, 3] },
    { id: "bandage", chance: 0.35, amt: [1, 2] },
    { id: "cloth", chance: 0.3, amt: [1, 3] },
    { id: "stimpack", chance: 0.15, amt: [1, 1] },
  ],
  lab: [
    { id: "chem", chance: 0.45, amt: [1, 3] },
    { id: "circuit", chance: 0.35, amt: [1, 2] },
    { id: "antibiotic", chance: 0.25, amt: [1, 1] },
    { id: "blueprint", chance: 0.1, amt: [1, 1] },
    { id: "radaway", chance: 0.2, amt: [1, 1] },
  ],
};

// 随机生成派遣物品掉落
export function rollItemDrops(rng, regionType) {
  const drops = POI_ITEM_DROPS[regionType];
  if (!drops) return {};
  const result = {};
  for (const d of drops) {
    if (rng() < d.chance) {
      const amt = d.amt[0] + Math.floor(rng() * (d.amt[1] - d.amt[0] + 1));
      if (amt > 0) result[d.id] = (result[d.id] || 0) + amt;
    }
  }
  return result;
}
