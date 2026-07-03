// 科技树: 3条线(防御/生产/生物)×5级
// 消耗后期爆仓的资源 + 物品,提供永久增益,解决"后期没事做+资源爆仓"
// 每级解锁:新设施/能力/被动加成

export const TECH_TREE = {
  // 🛡️ 防御科技线: 减少袭击损失 → 自动防御 → 力场
  defense: {
    id: "defense",
    name: "防御工程",
    icon: "🛡️",
    desc: "强化避难所防御,减少袭击损失,最终建立力场护盾。",
    color: "#5b9bd5",
    levels: [
      {
        level: 1, name: "加固围墙",
        cost: { res: { scrap: 50, power: 20 }, items: { alloy: 2, screw: 5 } },
        effect: "袭击损失减半",
        bonus: { raidLossMult: 0.5 },
      },
      {
        level: 2, name: "哨戒炮塔",
        cost: { res: { scrap: 80, power: 40, parts: 30 }, items: { alloy: 4, circuit: 3, barrel: 2 } },
        effect: "袭击自动击退小型入侵",
        bonus: { raidAutoRepel: true },
      },
      {
        level: 3, name: "预警雷达",
        cost: { res: { scrap: 100, power: 60, parts: 50 }, items: { circuit: 5, lens: 3 } },
        effect: "提前预警,袭击准备时间+1天",
        bonus: { raidWarning: true },
      },
      {
        level: 4, name: "能量护盾",
        cost: { res: { scrap: 150, power: 100, parts: 80 }, items: { cell: 5, circuit: 8, alloy: 6 } },
        effect: "无视普通袭击",
        bonus: { raidImmune: true },
      },
      {
        level: 5, name: "力场穹顶",
        cost: { res: { scrap: 250, power: 200, parts: 150 }, items: { cell: 10, alloy: 12, blueprint: 1 } },
        effect: "完全免疫所有袭击(终极防御)",
        bonus: { raidTotalImmune: true },
        unlocksEnding: "warlord",
      },
    ],
  },

  // ⚡ 生产科技线: 自动化 → 核聚变 → 物质复制(消耗爆仓资源)
  production: {
    id: "production",
    name: "工业革命",
    icon: "⚡",
    desc: "自动化生产,解决资源爆仓,最终实现物质复制。",
    color: "#e0c14a",
    levels: [
      {
        level: 1, name: "自动灌溉",
        cost: { res: { food: 50, water: 50, parts: 20 }, items: { screw: 5, circuit: 2 } },
        effect: "农场/净水无人值守效率翻倍(0.35→0.7)",
        bonus: { idleProdMult: 2 },
      },
      {
        level: 2, name: "废料回收",
        cost: { res: { scrap: 80, parts: 40, power: 30 }, items: { alloy: 3, circuit: 4 } },
        effect: "工坊产零件不再消耗废铁",
        bonus: { workshopFreeScrap: true },
      },
      {
        level: 3, name: "核聚变发电",
        cost: { res: { scrap: 100, parts: 60, power: 50 }, items: { cell: 4, circuit: 6, alloy: 4 } },
        effect: "所有设施电力消耗归零",
        bonus: { freePower: true },
      },
      {
        level: 4, name: "基因作物",
        cost: { res: { food: 150, water: 150, parts: 80 }, items: { chem: 6, cloth: 4 } },
        effect: "农场产量+100%,居民食物消耗减半",
        bonus: { farmBoost: 2, popFoodConsumeMult: 0.5 },
      },
      {
        level: 5, name: "物质复制器",
        cost: { res: { food: 250, water: 250, parts: 150, power: 150 }, items: { cell: 8, circuit: 10, blueprint: 1 } },
        effect: "解锁物质复制设施:消耗电力产出任意资源",
        bonus: { unlockReplicator: true },
        unlocksEnding: "civilization",
      },
    ],
  },

  // 🧬 生物科技线: 抗辐射 → 基因强化 → 克隆人
  bio: {
    id: "bio",
    name: "生命科学",
    icon: "🧬",
    desc: "强化幸存者,治疗疾病,最终实现克隆与方舟计划。",
    color: "#e0588e",
    levels: [
      {
        level: 1, name: "辐射抗性",
        cost: { res: { meds: 20, water: 40, food: 40 }, items: { chem: 3, cloth: 3 } },
        effect: "居民辐射伤害减半",
        bonus: { radResist: 0.5 },
      },
      {
        level: 2, name: "强化疗法",
        cost: { res: { meds: 40, power: 30, parts: 30 }, items: { chem: 5, antibiotic: 0 } },
        effect: "医疗室治疗速度翻倍,重伤阈值降至20",
        bonus: { medbayBoost: 2, heavyInjuryThreshold: 20 },
      },
      {
        level: 3, name: "基因强化",
        cost: { res: { meds: 60, food: 80, parts: 50 }, items: { chem: 8, stimpack: 0 } },
        effect: "所有居民最大生命+30,技能上限+2",
        bonus: { maxHealthBonus: 30, skillCapBonus: 2 },
      },
      {
        level: 4, name: "克隆技术",
        cost: { res: { meds: 100, power: 80, parts: 100 }, items: { chem: 12, cell: 5, circuit: 6 } },
        effect: "解锁克隆舱:复制最强幸存者",
        bonus: { unlockClone: true },
      },
      {
        level: 5, name: "方舟计划",
        cost: { res: { meds: 200, food: 200, power: 150 }, items: { chem: 20, cell: 10, blueprint: 1 } },
        effect: "建造方舟,带领精英离开废土",
        bonus: { unlockArk: true },
        unlocksEnding: "science",
      },
    ],
  },
};

// 获取某科技线当前可升级的级别(已升级的跳过)
export function techLevelDef(branch, currentLevel) {
  const tree = TECH_TREE[branch];
  if (!tree) return null;
  const next = currentLevel + 1;
  if (next > tree.levels.length) return null; // 已满级
  return tree.levels[next - 1];
}

// 获取科技线定义
export function techBranch(branch) {
  return TECH_TREE[branch] || null;
}

// 汇总当前所有科技加成(合并所有已解锁级别的bonus)
export function collectTechBonuses(state) {
  const bonuses = {};
  for (const branch of ["defense", "production", "bio"]) {
    const lvl = state.tech?.[branch] || 0;
    const tree = TECH_TREE[branch];
    if (!tree) continue;
    for (let i = 0; i < lvl; i++) {
      const lvDef = tree.levels[i];
      if (lvDef?.bonus) Object.assign(bonuses, lvDef.bonus);
    }
  }
  return bonuses;
}
