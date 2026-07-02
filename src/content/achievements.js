// 成就系统: 基于累计统计(state.stats)判定的长期目标,完成给奖励
// 与一次性任务不同,成就追踪累计进度,给中后期持续动力

import { totalDiscovered } from "./regions.js";

export const ACHIEVEMENT_DEFS = [
  {
    id: "first_survivor",
    name: "招募新血",
    desc: "招募第 3 名幸存者",
    icon: "🤝",
    check: (st) => st.survivors.filter((s) => s.busy !== "dead").length >= 3,
    progress: (st) => Math.min(1, st.survivors.filter((s) => s.busy !== "dead").length / 3),
    reward: { food: 20, water: 20 },
  },
  {
    id: "squad_leader",
    name: "小队领袖",
    desc: "招募 5 名幸存者",
    icon: "👥",
    check: (st) => st.survivors.filter((s) => s.busy !== "dead").length >= 5,
    progress: (st) => Math.min(1, st.survivors.filter((s) => s.busy !== "dead").length / 5),
    reward: { parts: 15, meds: 5 },
  },
  {
    id: "architect",
    name: "建筑师",
    desc: "建造 4 座设施",
    icon: "🏗️",
    check: (st) => st.base.facilities.length >= 4,
    progress: (st) => Math.min(1, st.base.facilities.length / 4),
    reward: { scrap: 25, parts: 10 },
  },
  {
    id: "veteran_explorer",
    name: "老兵探险家",
    desc: "完成 5 次派遣探索",
    icon: "🎖️",
    check: (st) => st.stats.expeditionsDone >= 5,
    progress: (st) => Math.min(1, st.stats.expeditionsDone / 5),
    reward: { parts: 12, power: 8 },
  },
  {
    id: "cartographer",
    name: "制图师",
    desc: "在地图上发现 5 个地点",
    icon: "🗺️",
    check: (st) => totalDiscovered(st) >= 5,
    progress: (st) => Math.min(1, totalDiscovered(st) / 5),
    reward: { scrap: 15, parts: 8 },
  },
  {
    id: "cartographer2",
    name: "废土丈量者",
    desc: "发现 12 个地点",
    icon: "🧭",
    check: (st) => totalDiscovered(st) >= 12,
    progress: (st) => Math.min(1, totalDiscovered(st) / 12),
    reward: { parts: 20, meds: 8 },
  },
  {
    id: "world_explorer",
    name: "废土行者",
    desc: "解锁全部 5 张地图",
    icon: "🌍",
    check: (st) => Object.values(st.maps.list).filter((m) => m.unlocked).length >= 5,
    progress: (st) => Object.values(st.maps.list).filter((m) => m.unlocked).length / 5,
    reward: { parts: 25, scrap: 30 },
  },
  {
    id: "base_upgrade",
    name: "扩张基地",
    desc: "主基地升级到 Lv.3",
    icon: "🏛️",
    check: (st) => st.base.level >= 3,
    progress: (st) => Math.max(0, Math.min(1, (st.base.level - 1) / 2)),
    reward: { scrap: 20, parts: 15 },
  },
  {
    id: "survivor",
    name: "末日幸存者",
    desc: "存活到第 10 天",
    icon: "📅",
    check: (st) => st.day >= 10,
    progress: (st) => Math.min(1, st.day / 10),
    reward: { food: 30, water: 30 },
  },
  {
    id: "tycoon",
    name: "废土大亨",
    desc: "同时拥有 100+ 废铁和 50+ 零件",
    icon: "💎",
    check: (st) => st.res.scrap >= 100 && st.res.parts >= 50,
    progress: (st) => Math.min(st.res.scrap / 100, st.res.parts / 50),
    reward: { power: 15, meds: 10 },
  },
];

export function createInitialAchievements() {
  return ACHIEVEMENT_DEFS.map((d) => ({ id: d.id, claimed: false }));
}

// 重建进度%: 综合(基地等级/人口/探索/派遣/成就)的整体进度
export function rebuildProgress(state) {
  let p = 0;
  // 基地等级 (0-25%)
  p += Math.min(1, (state.base.level - 1) / 4) * 0.25;
  // 人口 (0-20%)
  const pop = state.survivors.filter((s) => s.busy !== "dead").length;
  p += Math.min(1, pop / 8) * 0.2;
  // 设施数 (0-15%)
  p += Math.min(1, state.base.facilities.length / 8) * 0.15;
  // 探索发现 (0-20%)
  p += Math.min(1, totalDiscovered(state) / 15) * 0.2;
  // 派遣次数 (0-10%)
  p += Math.min(1, state.stats.expeditionsDone / 10) * 0.1;
  // 成就完成 (0-10%)
  const achDone = state.achievements ? state.achievements.filter((a) => a.claimed).length : 0;
  p += (achDone / ACHIEVEMENT_DEFS.length) * 0.1;
  return Math.min(1, p);
}

// 检查成就完成状态(返回新完成的id列表)
export function checkAchievements(state) {
  const newly = [];
  for (const def of ACHIEVEMENT_DEFS) {
    const rec = state.achievements.find((a) => a.id === def.id);
    if (!rec || rec.claimed) continue;
    if (def.check(state)) {
      // 标记可领取(不加 claimed,等玩家领)
      if (!rec.done) { rec.done = true; newly.push(def.id); }
    }
  }
  return newly;
}

export function achievementDef(id) {
  return ACHIEVEMENT_DEFS.find((a) => a.id === id);
}
