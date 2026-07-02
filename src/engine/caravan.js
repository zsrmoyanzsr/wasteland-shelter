// 流浪商队: 稀有到访的交易系统
// 设计: 每6-9游戏天(720-1080秒)到访一次,在场有限时间,带3个高价值方案。
// 智能生成: 用玩家富余资源换稀缺资源,解决后期爆仓 + 增加决策。
// 汇率偏高(贵但值得),让玩家在关键时刻才交易。

import { addLog, addFloat, getResCap } from "./state.js";
import { THEME as T } from "../ui/theme.js";

// 资源分档(用于汇率计算): 低档→高档交易需要更多低档资源
// 富余档(易产): food/water/scrap | 中间档: power | 稀缺档(难产/需求高): parts/meds
const RARITY = {
  food: 1, water: 1, scrap: 1,   // 富余
  power: 2,                      // 中间
  parts: 3, meds: 3,             // 稀缺
};
// 相对于基准(food=1)的价值权重。跨档交易按价值守恒 + 商队加价
const VALUE = {
  food: 1.0, water: 1.0, scrap: 1.0,
  power: 1.8,
  parts: 3.0, meds: 3.2,
};

// 商队加价倍率: 玩家付出价值 = 获得价值 × 加价(贵30-50%)
const MARKUP = 1.4;

// 到访间隔(秒): 6-9 游戏天(1天=120秒 → 720-1080秒)
function nextArrival() {
  return 720 + Math.random() * 360;
}
// 在场时长(秒): 2-3 游戏天(240-360秒),给玩家足够时间决定
const STAY_DURATION = 300;

// 每帧更新(照抄 updateRaid 模式)
export function updateCaravan(state, dt) {
  const c = state.caravan;
  if (!c) return;
  if (c.here) {
    // 在场倒计时
    c.leaveTimer -= dt;
    if (c.leaveTimer <= 0) {
      departCaravan(state, false);
    }
    return;
  }
  // 未到场: 倒计时到访
  c.timer -= dt;
  if (c.timer <= 0) {
    arriveCaravan(state);
  }
}

// 商队到访
export function arriveCaravan(state) {
  const c = state.caravan;
  c.here = true;
  c.leaveTimer = STAY_DURATION;
  c.offers = generateOffers(state);
  // 只在没有其它模态时自动弹出(避免覆盖玩家正在处理的紧急事件)
  if (!state.modal) {
    state.modal = { type: "trade" };
  }
  addLog(state, "🛒 一支流浪商队抵达避难所!带来稀缺物资的交易。(限时)", T.accent);
}

// 商队离开(playerInitiated=true 表示玩家主动送走)
export function departCaravan(state, playerInitiated) {
  const c = state.caravan;
  c.here = false;
  c.offers = [];
  c.timer = nextArrival();
  if (playerInitiated) {
    addLog(state, "商队离开了,期待下次相遇。", T.textDim);
  } else if (c.leaveTimer <= 0) {
    addLog(state, "商队停留时间已到,启程离去。", T.textDim);
  }
  // 若交易模态正开着,关掉它
  if (state.modal && state.modal.type === "trade") {
    state.modal = null;
  }
}

// 智能生成3个交易方案: 用玩家富余资源换稀缺资源
function generateOffers(state) {
  const rng = Math.random;
  const offers = [];
  // 玩家各资源持有量(用于判断富余/稀缺)
  const res = state.res;
  // 候选"付出"资源: 玩家持有较多的(按持有量排序,取前几名)
  const giveCandidates = Object.keys(res)
    .filter((k) => res[k] >= 5) // 至少有5个才考虑作为付出
    .sort((a, b) => res[b] - res[a]);
  // 候选"获得"资源: 优先稀缺档(parts/meds),其次中间(power)
  const getCandidates = ["parts", "meds", "power", "scrap"];

  const usedGive = new Set();
  for (let i = 0; i < 3; i++) {
    // 付出资源: 优先选没用过的富余资源(让3个方案多样化),实在不够才重复
    const givePool = giveCandidates.length > 0 ? giveCandidates : ["food", "water"];
    let giveRes = givePool.find((k) => !usedGive.has(k));
    if (!giveRes) giveRes = givePool[i % givePool.length] || "food";
    usedGive.add(giveRes);
    // 获得资源: 随机稀缺物(避免和付出相同)
    const getPool = getCandidates.filter((k) => k !== giveRes);
    const getRes = getPool[Math.floor(rng() * getPool.length)] || "parts";
    offers.push(generateOffer(rng, giveRes, getRes));
  }
  return offers;
}

// 生成单个方案: 按价值守恒 + 商队加价算数量
function generateOffer(rng, giveRes, getRes) {
  // 目标: 玩家获得 1-4 单位稀缺资源(数量随稀缺度,parts/meds少给)
  const getAmt = getRes === "parts" || getRes === "meds"
    ? 1 + Math.floor(rng() * 3)   // 1-3
    : 2 + Math.floor(rng() * 4);  // power/scrap 2-5
  // 付出数量 = 获得×价值 / 付出价值 × 加价,向上取整
  const rawGive = (getAmt * VALUE[getRes]) / VALUE[giveRes] * MARKUP;
  let giveAmt = Math.max(2, Math.round(rawGive));
  // 轻微随机波动(±15%)
  giveAmt = Math.max(2, Math.round(giveAmt * (0.85 + rng() * 0.3)));
  return {
    give: { [giveRes]: giveAmt },
    get: { [getRes]: getAmt },
    taken: false,
  };
}

// 执行交易(玩家点"交易"按钮)
export function takeOffer(state, offerIndex) {
  const c = state.caravan;
  if (!c || !c.here || !c.offers[offerIndex]) return false;
  const offer = c.offers[offerIndex];
  if (offer.taken) return false;
  // 验证资源足够付出
  for (const k in offer.give) {
    if ((state.res[k] || 0) < offer.give[k]) return false;
  }
  // 扣除付出资源
  for (const k in offer.give) {
    state.res[k] = Math.max(0, (state.res[k] || 0) - offer.give[k]);
  }
  // 增加获得资源(带上限)
  for (const k in offer.get) {
    const cap = getResCap(state, k);
    state.res[k] = Math.min(cap, (state.res[k] || 0) + offer.get[k]);
  }
  offer.taken = true;
  // 反馈
  const giveStr = Object.entries(offer.give).map(([k, v]) => `${v}${k}`).join("+");
  const getStr = Object.entries(offer.get).map(([k, v]) => `${v}${k}`).join("+");
  addLog(state, `交易完成: 付出 ${giveStr},获得 ${getStr}。`, T.primary);
  return true;
}

// 暴露给测试
export const _internals = { VALUE, MARKUP, generateOffer, generateOffers, nextArrival, STAY_DURATION };
