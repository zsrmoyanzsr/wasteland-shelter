// 设施定义与初始设施
// 每种设施有类型/名称/图标/产出/消耗/成本/解锁条件/居民加成

// 设施类型定义(模板)
export const FACILITY_TYPES = {
  farm: {
    type: "farm",
    name: "辐射农场",
    icon: "🌾",
    desc: "种植变异作物,稳定产出食物。前期产能有限需派遣补充,升级后成为食物主力。",
    category: "survival",
    catLabel: "生存",
    maxLevel: 5,
    base: {
      produces: { food: 0.35 }, // lv1 弱(前期靠派遣),升级后 growth 高反超
      consumes: { water: 0.1 },
      jobs: 2,
    },
    growth: 1.75, // 拉高:lv1=0.35, lv3≈1.07, lv5≈3.3
    cost: (lvl) => ({ scrap: 10 + lvl * 8, parts: 4 + lvl * 3 }),
    perk: "farmer",
  },
  well: {
    type: "well",
    name: "净水装置",
    icon: "🚰",
    desc: "过滤辐射水,产出净水。前期产能有限,升级后产量大幅提升。",
    category: "survival",
    catLabel: "生存",
    maxLevel: 5,
    base: { produces: { water: 0.3 }, consumes: {}, jobs: 1 },
    growth: 1.75,
    cost: (lvl) => ({ scrap: 8 + lvl * 6, parts: 3 + lvl * 2 }),
    perk: "engineer",
  },
  workshop: {
    type: "workshop",
    name: "工坊",
    icon: "🔧",
    desc: "将废铁加工为零件。零件是建造与升级的关键。",
    category: "production",
    catLabel: "生产",
    maxLevel: 5,
    base: { produces: { parts: 0.25 }, consumes: { scrap: 0.4, power: 0.1 }, jobs: 2 },
    growth: 1.55,
    cost: (lvl) => ({ scrap: 12 + lvl * 8, parts: 5 + lvl * 4 }),
    perk: "engineer",
  },
  generator: {
    type: "generator",
    name: "发电机",
    icon: "🔋",
    desc: "燃烧废料发电,为高级设施供能。",
    category: "production",
    catLabel: "生产",
    maxLevel: 5,
    base: { produces: { power: 0.6 }, consumes: { scrap: 0.2 }, jobs: 1 },
    growth: 1.6,
    cost: (lvl) => ({ scrap: 10 + lvl * 6, parts: 6 + lvl * 4 }),
    perk: "engineer",
  },
  scrapyard: {
    type: "scrapyard",
    name: "废料场",
    icon: "♻️",
    desc: "派居民分拣废墟残骸,稳定产出废铁。废铁是建造与升级的关键建材。",
    category: "production",
    catLabel: "生产",
    maxLevel: 5,
    base: { produces: { scrap: 0.35 }, consumes: { power: 0.08 }, jobs: 2 },
    growth: 1.55,
    cost: (lvl) => ({ scrap: 8 + lvl * 5, parts: 3 + lvl * 2 }),
    perk: "engineer",
  },
  medbay: {
    type: "medbay",
    name: "医疗室",
    icon: "🏥",
    desc: "生产药品,治疗伤员。受伤居民在此恢复更快。",
    category: "special",
    catLabel: "特殊",
    maxLevel: 5,
    base: { produces: { meds: 0.12 }, consumes: { power: 0.08, water: 0.1 }, jobs: 1 },
    growth: 1.6,
    cost: (lvl) => ({ scrap: 14 + lvl * 8, parts: 8 + lvl * 5 }),
    perk: "doctor",
  },
  wall: {
    type: "wall",
    name: "防御围墙",
    icon: "🛡️",
    desc: "抵御丧尸与掠夺者袭击。等级越高,袭击损失越小。",
    category: "defense",
    catLabel: "防御",
    maxLevel: 5,
    base: { defense: 10 },
    growth: 1.8,
    cost: (lvl) => ({ scrap: 15 + lvl * 10, parts: 3 + lvl * 2 }),
    perk: null,
  },
  greenhouse: {
    type: "greenhouse",
    name: "温室大棚",
    icon: "🏡",
    desc: "高级农业生产设施,不受辐射影响。食物产出比普通农场更高,但建造昂贵。",
    category: "survival",
    catLabel: "生存",
    maxLevel: 5,
    base: { produces: { food: 0.5 }, consumes: { water: 0.15, power: 0.05 }, jobs: 2 },
    growth: 1.7,
    cost: (lvl) => ({ scrap: 18 + lvl * 10, parts: 8 + lvl * 5 }),
    perk: "farmer",
  },
  watchtower: {
    type: "watchtower",
    name: "瞭望塔",
    icon: "🗼",
    desc: "提前预警来袭威胁,并产出少量电力(风力发电)。降低威胁伤害,辅助防御。",
    category: "defense",
    catLabel: "防御",
    maxLevel: 5,
    base: { produces: { power: 0.2 }, defense: 5 },
    growth: 1.6,
    cost: (lvl) => ({ scrap: 12 + lvl * 8, parts: 5 + lvl * 3 }),
    perk: "guardian",
  },
  armory: {
    type: "armory",
    name: "军械工坊",
    icon: "⚒️",
    desc: "专门生产武器零件的高级工坊。零件产出比普通工坊更高,消耗废铁也更少。",
    category: "production",
    catLabel: "生产",
    maxLevel: 5,
    base: { produces: { parts: 0.35 }, consumes: { scrap: 0.25, power: 0.05 }, jobs: 2 },
    growth: 1.6,
    cost: (lvl) => ({ scrap: 20 + lvl * 12, parts: 6 + lvl * 4 }),
    perk: "engineer",
  },
};

// 计算设施某等级的产出/消耗/工作位
export function facilityStats(type, level) {
  const def = FACILITY_TYPES[type];
  if (!def) return null;
  const m = Math.pow(def.growth, level - 1);
  const stats = {
    produces: {},
    consumes: {},
    jobs: def.base.jobs,
    defense: 0,
  };
  for (const k in def.base.produces) stats.produces[k] = def.base.produces[k] * m;
  for (const k in def.base.consumes) stats.consumes[k] = def.base.consumes[k] * m;
  if (def.base.defense) stats.defense = def.base.defense * m;
  return stats;
}

// 升级成本(当前为 level 级,升到 level+1 的成本)
export function upgradeCost(type, level) {
  const def = FACILITY_TYPES[type];
  return def.cost(level);
}

// 初始设施(开局已建成)
export function createInitialFacilities() {
  return [
    { id: 1, type: "farm", level: 1, x: 0, y: 0, assigned: [] },
    { id: 2, type: "well", level: 1, x: 0, y: 0, assigned: [] },
  ];
}

// 可建造的设施类型列表(按分类)
export function buildableTypes() {
  return Object.values(FACILITY_TYPES).map((f) => ({
    type: f.type,
    name: f.name,
    icon: f.icon,
    desc: f.desc,
    category: f.category,
    catLabel: f.catLabel,
  }));
}
