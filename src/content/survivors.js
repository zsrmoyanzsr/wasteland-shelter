// 幸存者内容: 职业 / 特长 / 姓名 / 生成器 / 初始队伍
// 每个幸存者独一无二: 职业 + 特长 + 等级 + 状态

export const PROFESSIONS = [
  { id: "doctor", name: "医生", icon: "🩺", perks: ["doctor"], baseSkill: "medical", stat: { medical: 3 } },
  { id: "engineer", name: "工程师", icon: "🛠️", perks: ["engineer"], baseSkill: "craft", stat: { craft: 3 } },
  { id: "scout", name: "侦察兵", icon: "🧭", perks: ["scavenger"], baseSkill: "scavenge", stat: { scavenge: 3 } },
  { id: "soldier", name: "士兵", icon: "🪖", perks: ["guardian"], baseSkill: "combat", stat: { combat: 3 } },
  { id: "farmer", name: "农夫", icon: "🌱", perks: ["farmer"], baseSkill: "farm", stat: { farm: 3 } },
  { id: "trader", name: "商人", icon: "💰", perks: ["negotiator"], baseSkill: "social", stat: { social: 3 } },
];

export const PERKS = {
  farmer: { id: "farmer", name: "种植大师", icon: "🌾", desc: "在农场工作产量+50%" },
  engineer: { id: "engineer", name: "巧手", icon: "🔧", desc: "生产设施效率+30%" },
  doctor: { id: "doctor", name: "妙手回春", icon: "💊", desc: "医疗室效率+50%,探索治疗+" },
  scavenger: { id: "scavenger", name: "搜刮大师", icon: "🎒", desc: "探索资源收益+25%" },
  negotiator: { id: "negotiator", name: "谈判专家", icon: "🤝", desc: "事件好结果概率+" },
  guardian: { id: "guardian", name: "守护者", icon: "🛡️", desc: "战斗减伤,防御加成" },
};

const FIRST_NAMES = [
  "老张","阿强","林夏","苏晚","陈默","杰克","艾米","凯尔","莫言","雷诺",
  "安娜","维克","米拉","周游","唐尼","索拉","卡尔","薇拉","洛奇","南希",
];
const NICKNAMES = ["铁手","夜鹰","灰狼","残月","独狼","火种","锈牙","沉默","拾荒者","老兵"];

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// 简单 seeded rng (mulberry32)
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 生成一个幸存者
export function generateSurvivor(level = 1, rng = Math.random, id = null) {
  const prof = pick(PROFESSIONS, rng);
  // 1-2 个特长
  const perkCount = rng() < 0.4 ? 2 : 1;
  const perks = [];
  const pool = [prof.perks[0]];
  if (rng() < 0.3) pool.push(pick(["scavenger", "negotiator", "guardian", "engineer"], rng));
  const allPerkIds = [...new Set([...prof.perks, ...pool])];
  for (let i = 0; i < perkCount && i < allPerkIds.length; i++) {
    perks.push(allPerkIds[i]);
  }

  const name = rng() < 0.5 ? pick(FIRST_NAMES, rng) : pick(NICKNAMES, rng);

  // 属性
  const skills = { medical: 0, craft: 0, scavenge: 0, combat: 0, farm: 0, social: 0 };
  const profSkill = prof.baseSkill;
  skills[profSkill] = 1 + Math.floor(rng() * 3) + Math.floor(level / 2);
  // 随机第二技能
  const others = Object.keys(skills).filter((k) => k !== profSkill);
  const second = pick(others, rng);
  skills[second] = 1 + Math.floor(rng() * 2);

  return {
    id: id != null ? id : Math.floor(rng() * 1e9),
    name,
    profession: prof.id,
    profName: prof.name,
    profIcon: prof.icon,
    perks,
    level,
    xp: 0,
    xpNeed: xpForLevel(level),
    skills,
    // 状态
    health: 100,
    maxHealth: 100,
    hunger: 80, // 0..100, 越低越饿
    mood: 75, // 0..100
    assigned: null, // 分配到的设施 id (null=空闲)
    busy: null, // 'expedition' 派遣中 / null
  };
}

export function xpForLevel(level) {
  return 50 + level * 30;
}

// 幸存者升级: 等级+1, 主技能+1(基于职业), 上限10
const PROF_MAIN_SKILL = {
  doctor: "medical", engineer: "craft", scout: "scavenge",
  soldier: "combat", farmer: "farm", trader: "social",
};
export function levelUpSurvivor(s) {
  s.level += 1;
  s.xpNeed = xpForLevel(s.level);
  // 主技能 +1
  const mainSkill = PROF_MAIN_SKILL[s.profession];
  if (mainSkill && s.skills) {
    s.skills[mainSkill] = Math.min(10, (s.skills[mainSkill] || 0) + 1);
  }
  // 升满5级时偶尔+1随机副技能
  if (s.level % 3 === 0 && s.skills) {
    const others = Object.keys(s.skills).filter((k) => k !== mainSkill);
    const pick = others[Math.floor(Math.random() * others.length)];
    if (pick) s.skills[pick] = Math.min(10, (s.skills[pick] || 0) + 1);
  }
}

// 初始队伍: 2 人
export function createInitialSurvivors() {
  const rng = makeRng(20240601);
  return [
    generateSurvivor(1, rng, 1),
    generateSurvivor(1, rng, 2),
  ];
}

// 居民上限 = 2 + 主基地等级 * 2
export function populationCap(baseLevel) {
  return 2 + baseLevel * 2;
}
