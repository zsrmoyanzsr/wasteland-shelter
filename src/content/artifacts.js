// 神器系统: 稀有/独一无二/有故事感的强大装备
// 设计: 18种神器,每种存档内唯一(获得后不再掉落)
// 等级: C(常见强力) / B(稀有) / A(史诗) / S(传说级,改变游戏体验)
// 获取: 远征/探索稀有掉落,危险越高概率越大
// 装备: 人物按综合属性评级决定1或2槽;神器自带等级门槛

export const ARTIFACT_TIERS = {
  C: { id: "C", name: "精良", color: "#4caf87", dropWeight: 10, minDanger: 1 },
  B: { id: "B", name: "稀有", color: "#5b9bd5", dropWeight: 5, minDanger: 2 },
  A: { id: "A", name: "史诗", color: "#9b7bd4", dropWeight: 2, minDanger: 3 },
  S: { id: "S", name: "传说", color: "#f0a93b", dropWeight: 0.5, minDanger: 4 },
};

// 18种神器(每种独一无二,存档内只能获得1个)
export const ARTIFACTS = {
  // ── C级(精良,危险1+地图可掉) ──
  art_lucky_coin: {
    id: "art_lucky_coin", tier: "C", name: "幸运硬币", icon: "🪙",
    desc: "一枚核战前的金币,带来好运。全派遣资源产出+15%。",
    slot: "any", stat: { allDispatch: 0.15 }, minLevel: 1,
  },
  art_old_map: {
    id: "art_old_map", tier: "C", name: "探险者地图", icon: "🗺️",
    desc: "标注了隐藏宝藏的旧地图。探索事件好结果概率+20%。",
    slot: "any", stat: { exploreLuck: 0.2 }, minLevel: 1,
  },
  art_sharp_knife: {
    id: "art_sharp_knife", tier: "C", name: "精钢匕首", icon: "🔪",
    desc: "永不生锈的精钢武器。装备者 combat+5,scavenge+3。",
    slot: "any", stat: { combat: 5, scavenge: 3 }, minLevel: 1,
  },
  art_med_kit: {
    id: "art_med_kit", tier: "C", name: "军用医疗箱", icon: "🧰",
    desc: "完整的战地医疗套件。装备者 medical+5,探索受伤减半。",
    slot: "any", stat: { medical: 5, exploreDefense: 0.5 }, minLevel: 1,
  },
  art_water_filter: {
    id: "art_water_filter", tier: "C", name: "纳米净水器", icon: "💧",
    desc: "核战前的纳米过滤技术。装备者 farm+5,基地净水产出+20%。",
    slot: "any", stat: { farm: 5, facilityBoost: { well: 0.2 } }, minLevel: 1,
  },

  // ── B级(稀有,危险2+) ──
  art_night_vision: {
    id: "art_night_vision", tier: "B", name: "夜视仪", icon: "🥽",
    desc: "军用夜视装备,黑暗中无所遁形。scavenge+8,探索事件密度+50%。",
    slot: "any", stat: { scavenge: 8, exploreDensity: 0.5 }, minLevel: 3,
  },
  art_power_gauntlet: {
    id: "art_power_gauntlet", tier: "B", name: "动力拳套", icon: "✊",
    desc: "外骨骼动力拳,徒手碎钢铁。combat+10,派遣战斗必胜小型敌人。",
    slot: "any", stat: { combat: 10, dispatchWinSmall: true }, minLevel: 3,
  },
  art_rad_suit: {
    id: "art_rad_suit", tier: "B", name: "防辐射服", icon: "🦺",
    desc: "完整的防化服。装备者免疫辐射,health上限+20。",
    slot: "any", stat: { maxHealth: 20, radImmune: true }, minLevel: 3,
  },
  art_radio_set: {
    id: "art_radio_set", tier: "B", name: "军用无线电台", icon: "📻",
    desc: "远程通讯设备。招募冷却减半,social+6。",
    slot: "any", stat: { social: 6, recruitCooldownMult: 0.5 }, minLevel: 3,
  },

  // ── A级(史诗,危险3+工厂) ──
  art_plasma_core: {
    id: "art_plasma_core", tier: "A", name: "等离子核心", icon: "💠",
    desc: "无限能源的等离子反应堆。全基地电力产出+50%,craft+8。",
    slot: "any", stat: { craft: 8, facilityBoost: { generator: 0.5 } }, minLevel: 5,
  },
  art_gene_serum: {
    id: "art_gene_serum", tier: "A", name: "基因强化血清", icon: "🧬",
    desc: "重塑基因的神秘药剂。装备者全技能+5,health上限+40。",
    slot: "any", stat: { allSkills: 5, maxHealth: 40 }, minLevel: 5,
  },
  art_stealth_cloak: {
    id: "art_stealth_cloak", tier: "A", name: "光学迷彩", icon: "👻",
    desc: "让你几乎隐形。派遣事件坏结果概率-40%,scavenge+10。",
    slot: "any", stat: { scavenge: 10, dispatchBadLuckReduce: 0.4 }, minLevel: 5,
  },
  art_ancient_tome: {
    id: "art_ancient_tome", tier: "A", name: "失落的知识之书", icon: "📖",
    desc: "记载核战前科技的古籍。科技研发成本-30%,全技能+3。",
    slot: "any", stat: { allSkills: 3, techCostMult: 0.7 }, minLevel: 5,
  },

  // ── S级(传说,危险4+军事禁区,改变游戏) ──
  art_ark_key: {
    id: "art_ark_key", tier: "S", name: "方舟之钥", icon: "🗝️",
    desc: "传说中方舟的启动钥匙,拥有它的人将被铭记。全属性+8,解锁隐藏结局。",
    slot: "any", stat: { allSkills: 8, maxHealth: 60, unlockEnding: "truth" }, minLevel: 8,
  },
  art_phoenix_feather: {
    id: "art_phoenix_feather", tier: "S", name: "凤凰之羽", icon: "🪶",
    desc: "永不熄灭的火焰之羽。装备者战斗不会阵亡,全属性+6。",
    slot: "any", stat: { allSkills: 6, immortality: true }, minLevel: 8,
  },
  art_void_crystal: {
    id: "art_void_crystal", tier: "S", name: "虚空水晶", icon: "🔮",
    desc: "蕴含维度力量的水晶。全资源产出+30%,转生时保留。",
    slot: "any", stat: { allDispatch: 0.3, prestigeKeep: true }, minLevel: 8,
  },
  art_eternal_flame: {
    id: "art_eternal_flame", tier: "S", name: "永恒之火", icon: "🔥",
    desc: "文明之火的最后余烬。基地全设施产出+25%,food消耗-30%。",
    slot: "any", stat: { allFacilityBoost: 0.25, foodConsumeMult: 0.7 }, minLevel: 8,
  },
};

// 获取神器定义
export function artifactDef(id) {
  return ARTIFACTS[id] || null;
}

// 获取等级定义
export function tierDef(tier) {
  return ARTIFACT_TIERS[tier] || null;
}

// 所有神器id列表(用于唯一性检查)
export const ALL_ARTIFACT_IDS = Object.keys(ARTIFACTS);

// 按等级分组
export function artifactsByTier(tier) {
  return Object.values(ARTIFACTS).filter((a) => a.tier === tier);
}
