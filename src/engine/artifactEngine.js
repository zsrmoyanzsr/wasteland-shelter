// 神器掉落与穿戴引擎
// 核心: 存档唯一性(每种神器只能获得1个) + 等级概率(危险越高S级概率越大)
import { ARTIFACTS, ARTIFACT_TIERS, ALL_ARTIFACT_IDS, artifactDef } from "../content/artifacts.js";
import { addLog } from "./state.js";

// 计算人物综合属性评级 → 决定神器槽位数(1或2)
// 评级规则: 6技能总和 ≥ 25 或 等级≥5 → 2槽, 否则 1槽
export function survivorTier(state, survivor) {
  if (!survivor || !survivor.skills) return 1;
  const totalSkills = Object.values(survivor.skills).reduce((s, v) => s + (v || 0), 0);
  // 转生加成也提升槽位(高代角色更强)
  const prestigeBonus = state.prestige?.generation > 1 ? 2 : 0;
  if (totalSkills + prestigeBonus >= 25 || survivor.level >= 5) return 2;
  return 1;
}

// 获取人物已装备的神器
export function getEquippedArtifacts(state, survivorId) {
  const equipped = state.equipment?.equipped?.[survivorId];
  if (!equipped) return [];
  // equipped 是 {slot0: artifactId, slot1: artifactId} 或直接数组
  const result = [];
  for (const slot of ["slot0", "slot1"]) {
    if (equipped[slot]) result.push(equipped[slot]);
  }
  return result;
}

// 获取人物已装备神器的合并属性
export function getArtifactStats(state, survivorId) {
  const ids = getEquippedArtifacts(state, survivorId);
  const stats = {};
  for (const id of ids) {
    const def = artifactDef(id);
    if (def?.stat) {
      for (const k in def.stat) {
        // 数值型属性累加,布尔型取或
        if (typeof def.stat[k] === "number") stats[k] = (stats[k] || 0) + def.stat[k];
        else if (def.stat[k] === true) stats[k] = true;
      }
    }
  }
  return stats;
}

// 穿戴神器(返回是否成功)
export function equipArtifact(state, survivor, artifactId) {
  if (!survivor || !artifactDef(artifactId)) return { ok: false, reason: "无效" };
  // 检查仓库里有没有这个神器
  if (!state.equipment?.storage?.includes(artifactId)) return { ok: false, reason: "仓库无此神器" };
  // 检查神器等级门槛
  const def = artifactDef(artifactId);
  if (survivor.level < def.minLevel) return { ok: false, reason: `需等级${def.minLevel}+` };
  // 检查槽位数
  const maxSlots = survivorTier(state, survivor);
  const cur = getEquippedArtifacts(state, survivor.id);
  if (cur.length >= maxSlots) return { ok: false, reason: `槽位已满(${maxSlots})` };
  // 穿戴
  if (!state.equipment.equipped[survivor.id]) state.equipment.equipped[survivor.id] = {};
  const slotKey = cur.length === 0 ? "slot0" : "slot1";
  state.equipment.equipped[survivor.id][slotKey] = artifactId;
  // 从仓库移除
  state.equipment.storage = state.equipment.storage.filter((id) => id !== artifactId);
  return { ok: true };
}

// 卸下神器(放回仓库)
export function unequipArtifact(state, survivor, slotIndex) {
  const slotKey = `slot${slotIndex}`;
  const id = state.equipment?.equipped?.[survivor.id]?.[slotKey];
  if (!id) return false;
  state.equipment.storage.push(id);
  delete state.equipment.equipped[survivor.id][slotKey];
  return true;
}

// 检查神器是否已获得(存档唯一性)
export function hasArtifact(state, artifactId) {
  // 在仓库或已装备里找
  if (state.equipment?.storage?.includes(artifactId)) return true;
  const equipped = state.equipment?.equipped || {};
  for (const sid in equipped) {
    if (equipped[sid]?.slot0 === artifactId || equipped[sid]?.slot1 === artifactId) return true;
  }
  return false;
}

// 获取所有未获得的神器id(可掉落的)
export function unownedArtifacts(state) {
  return ALL_ARTIFACT_IDS.filter((id) => !hasArtifact(state, id));
}

// 派遣/探索神器掉落
// 概率: base 5%, danger每+1概率翻倍, 远POI更高
// 等级: 按danger决定能掉的最高等级,加权随机
export function rollArtifactDrop(rng, danger) {
  // 基础掉落概率: danger1=3%, 2=6%, 3=10%, 4=15%
  const dropChance = 0.03 * Math.pow(2, danger - 1) + (danger - 1) * 0.01;
  if (rng() > dropChance) return null;
  // 确定等级: danger越高,高级神器概率越大
  // 权重: C=10, B=5(danger2+), A=2(danger3+), S=0.5(danger4+)
  const tiers = [];
  for (const [tier, def] of Object.entries(ARTIFACT_TIERS)) {
    if (danger >= def.minDanger) {
      tiers.push({ tier, weight: def.dropWeight });
    }
  }
  if (tiers.length === 0) return null;
  const totalWeight = tiers.reduce((s, t) => s + t.weight, 0);
  let r = rng() * totalWeight;
  let chosenTier = tiers[0].tier;
  for (const t of tiers) {
    r -= t.weight;
    if (r <= 0) { chosenTier = t.tier; break; }
  }
  // 该等级的随机一个神器(调用方负责唯一性过滤)
  return chosenTier;
}

// 实际给予神器(过滤已拥有的,从该等级未拥有的随机选一个)
export function grantArtifact(state, tier, rng) {
  const unowned = unownedArtifacts(state).filter((id) => ARTIFACTS[id].tier === tier);
  if (unowned.length === 0) return null; // 该等级全收齐了
  const chosen = unowned[Math.floor(rng() * unowned.length)];
  if (!state.equipment.storage) state.equipment.storage = [];
  state.equipment.storage.push(chosen);
  const def = ARTIFACTS[chosen];
  const tDef = ARTIFACT_TIERS[tier];
  addLog(state, `✨ 发现神器! ${def.icon} ${def.name} [${tDef.name}] ${def.desc}`, tDef.color);
  return chosen;
}
