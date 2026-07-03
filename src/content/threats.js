// 威胁系统: 辐射风暴/瘟疫/大规模入侵/寒潮
// 设计原则: 威胁消耗道具(止血包/抗生素/辐射清除剂)应对,不致死不软锁
// 不应对的惩罚: 扣资源/全员掉血(但到1不下,自动恢复)/心情大降 — 可恢复,不致命

export const THREATS = {
  radiation_storm: {
    id: "radiation_storm",
    name: "辐射风暴",
    icon: "☢️",
    desc: "一场辐射风暴席卷避难所!所有居民受到辐射伤害。",
    color: "#7cc36b",
    // 应对道具: 辐射清除剂(每人消耗1个可完全防护)
    counterItem: "radaway",
    counterPerPerson: 1,
    counterText: "使用辐射清除剂(每人1个)",
    // 不应对的惩罚: 全员掉血(到1不下),消耗 meds
    penalty: { type: "health", amount: 25, floor: 1, resCost: { meds: 3 } },
    penaltyText: "全员受到辐射伤害(-25生命),药品损失3",
    // 触发条件: 随机,后期更多
    minDay: 8,
    weight: 3,
  },
  plague: {
    id: "plague",
    name: "神秘瘟疫",
    icon: "🦠",
    desc: "一种致命瘟疫在避难所蔓延!居民纷纷病倒。",
    color: "#e0588e",
    counterItem: "antibiotic",
    counterPerPerson: 1,
    counterText: "使用抗生素治疗(每人1个)",
    penalty: { type: "health", amount: 35, floor: 1, resCost: { meds: 5 } },
    penaltyText: "瘟疫肆虐(-35生命),医疗物资损失5",
    minDay: 15,
    weight: 2,
  },
  invasion: {
    id: "invasion",
    name: "大规模入侵",
    icon: "⚔️",
    desc: "一支武装掠夺者军团正在进攻避难所!",
    color: "#e0584e",
    counterItem: "stimpack",
    counterPerPerson: 1,
    counterText: "发放兴奋剂御敌(每人1个)",
    penalty: { type: "resource", resCost: { scrap: 30, food: 20 } },
    penaltyText: "掠夺者洗劫避难所(损失30废铁+20食物)",
    minDay: 10,
    weight: 3,
  },
  cold_wave: {
    id: "cold_wave",
    name: "极寒寒潮",
    icon: "🥶",
    desc: "气温骤降,避难所急需保暖物资!",
    color: "#5b9bd5",
    counterItem: "bandage",
    counterPerPerson: 1,
    counterText: "使用止血包御寒(每人1个)",
    penalty: { type: "health", amount: 20, floor: 1, resCost: { power: 10 } },
    penaltyText: "严寒侵袭(-20生命),电力消耗激增",
    minDay: 6,
    weight: 2,
  },
};

// 按当前天数筛选可触发的威胁
export function availableThreats(state) {
  return Object.values(THREATS).filter((t) => state.day >= t.minDay);
}

// 加权随机选一个威胁
export function rollThreat(rng, state) {
  const avail = availableThreats(state);
  if (avail.length === 0) return null;
  const total = avail.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const t of avail) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return avail[0];
}

// 计算应对所需道具总数(按当前存活居民数)
export function counterCost(state, threat) {
  const pop = state.survivors.filter((s) => s.busy !== "dead").length;
  return { item: threat.counterItem, amount: pop * threat.counterPerPerson };
}
