// 任务与成就系统: 引导玩家一步步发展
// 任务类型: build(建造N个某设施) / recruit(招募N人) / explore(完成N次派遣) / discover(发现N个POI) / resource(积累资源)

export const TASK_DEFS = [
  {
    id: "t_build_farm",
    name: "稳固食物来源",
    desc: "建造或升级一座农场到 2 级",
    type: "facility_level",
    target: { type: "farm", level: 2 },
    reward: { parts: 5, water: 10 },
  },
  {
    id: "t_recruit_3",
    name: "扩大队伍",
    desc: "招募第 3 名幸存者",
    type: "population",
    target: 3,
    reward: { food: 15, meds: 3 },
  },
  {
    id: "t_discover_2",
    name: "开拓视野",
    desc: "在大地图上发现 2 个新地点",
    type: "discover",
    target: 2,
    reward: { parts: 6, scrap: 10 },
  },
  {
    id: "t_first_explore",
    name: "初次远征",
    desc: "完成一次派遣探索",
    type: "expeditions",
    target: 1,
    reward: { food: 10, parts: 4 },
  },
  {
    id: "t_build_defense",
    name: "加固防线",
    desc: "建造一座防御围墙",
    type: "facility_type",
    target: "wall",
    reward: { parts: 8, scrap: 5 },
  },
  {
    id: "t_recruit_5",
    name: "初具规模",
    desc: "招募第 5 名幸存者",
    type: "population",
    target: 5,
    reward: { parts: 10, meds: 5, scrap: 15 },
  },
  {
    id: "t_explore_5",
    name: "老兵队伍",
    desc: "完成 5 次派遣探索",
    type: "expeditions",
    target: 5,
    reward: { parts: 12, power: 8 },
  },
];

export function createInitialTasks() {
  return TASK_DEFS.map((d) => ({
    id: d.id,
    done: false,
    claimed: false,
  }));
}

export function taskDef(id) {
  return TASK_DEFS.find((t) => t.id === id);
}
