// 多地图系统: 每张地图是 N×M 网格,带 POI(可派遣点)、迷雾、解锁条件
// 主角在格子上移动,踏入未探索格触发探索事件(见 exploreEvents.js)

// 每格状态
export const CELL = {
  HIDDEN: 0, // 未探索(迷雾)
  REVEALED: 1, // 已揭示(可见但未踏足)
  VISITED: 2, // 已踏足
};

// 网格每格像素(渲染用)
export const CELL_PX = 56;

// POI 类型(沿用旧定义,供派遣系统使用)
export const POI_TYPES = {
  hospital: {
    type: "hospital",
    name: "废弃医院",
    icon: "🏥",
    color: "#e0588e",
    danger: 2,
    desc: "曾是人满为患的避难所,如今只剩药品与低语。",
    rewards: { meds: [3, 7], parts: [0, 3], scrap: [4, 9] },
  },
  town: {
    type: "town",
    name: "辐射小镇",
    icon: "🏚️",
    color: "#c9a86a",
    danger: 1,
    desc: "废弃的街道与商铺,废铁与零件的宝库。",
    rewards: { scrap: [7, 14], parts: [1, 4], food: [1, 4] },
  },
  factory: {
    type: "factory",
    name: "锈蚀工厂",
    icon: "🏭",
    color: "#9aa1b0",
    danger: 3,
    desc: "重型机械与危险废料,零件与蓝图产地。",
    rewards: { parts: [3, 8], scrap: [5, 11], power: [0, 3] },
  },
  military: {
    type: "military",
    name: "军事哨所",
    icon: "🪖",
    color: "#5b9bd5",
    danger: 4,
    desc: "封锁的军事区,藏有稀缺武器与电力设备。",
    rewards: { parts: [4, 9], scrap: [6, 13], power: [2, 6], meds: [1, 4] },
  },
  cache: {
    type: "cache",
    name: "物资储藏点",
    icon: "📦",
    color: "#f0a93b",
    danger: 1,
    desc: "幸存者藏匿的补给箱。",
    rewards: { food: [2, 5], water: [2, 5], scrap: [3, 7] },
  },
};

export function poiInfo(type) {
  return POI_TYPES[type] || null;
}

// 地图定义模板(解锁前不含 cells/pois 运行时数据)
const MAP_DEFS = [
  {
    id: "home",
    name: "营地废墟",
    icon: "🏠",
    desc: "你的避难所周边。相对安全,适合初步探索。",
    gridW: 8,
    gridH: 7,
    bgColor: "#2a3326",
    bgGradTop: "#313a2c",
    bgGradBot: "#222a1f",
    accent: "#4caf87",
    gridLineColor: "rgba(120,150,110,0.12)",
    entry: { gx: 0, gy: 3 }, // 主角进入位置
    unlock: { type: "free" },
    pois: [
      { type: "cache", gx: 5, gy: 1 },
      { type: "cache", gx: 2, gy: 5 },
    ],
    eventRate: 0.5, // 踏足未探索格触发事件概率(教学区低)
  },
  {
    id: "town",
    name: "郊区小镇",
    icon: "🏚️",
    desc: "废弃的居民区与商铺。废铁与食物丰富。",
    gridW: 10,
    gridH: 9,
    bgColor: "#332a1f",
    bgGradTop: "#3a3026",
    bgGradBot: "#291f16",
    accent: "#c9a86a",
    gridLineColor: "rgba(150,130,90,0.12)",
    entry: { gx: 0, gy: 4 },
    unlock: { type: "free" },
    pois: [
      { type: "town", gx: 4, gy: 2 },
      { type: "town", gx: 7, gy: 6 },
      { type: "cache", gx: 2, gy: 7 },
    ],
    eventRate: 0.6,
  },
  {
    id: "hospital",
    name: "废弃医院",
    icon: "🏥",
    desc: "阴森的医院,药品丰富但危险。需要先在郊区有所发现。",
    gridW: 10,
    gridH: 9,
    bgColor: "#2a1f28",
    bgGradTop: "#332630",
    bgGradBot: "#221620",
    accent: "#e0588e",
    gridLineColor: "rgba(180,90,130,0.12)",
    entry: { gx: 0, gy: 4 },
    unlock: { type: "discover", mapId: "town", count: 1 },
    pois: [
      { type: "hospital", gx: 5, gy: 3 },
      { type: "hospital", gx: 8, gy: 6 },
      { type: "cache", gx: 3, gy: 7 },
    ],
    eventRate: 0.65,
  },
  {
    id: "factory",
    name: "辐射工厂",
    icon: "🏭",
    desc: "重型工业区,零件与电力产地。辐射较强。",
    gridW: 11,
    gridH: 10,
    bgColor: "#1f262a",
    bgGradTop: "#262e33",
    bgGradBot: "#161c20",
    accent: "#9aa1b0",
    gridLineColor: "rgba(150,160,170,0.12)",
    entry: { gx: 0, gy: 5 },
    unlock: { type: "resource", res: "parts", amount: 30 },
    pois: [
      { type: "factory", gx: 5, gy: 4 },
      { type: "factory", gx: 9, gy: 7 },
      { type: "cache", gx: 3, gy: 8 },
    ],
    eventRate: 0.65,
  },
  {
    id: "military",
    name: "军事禁区",
    icon: "🪖",
    desc: "封锁的军事区,最危险也最富饶。需丰富经验方可进入。",
    gridW: 12,
    gridH: 10,
    bgColor: "#1f2630",
    bgGradTop: "#262e3a",
    bgGradBot: "#161c26",
    accent: "#5b9bd5",
    gridLineColor: "rgba(90,130,180,0.12)",
    entry: { gx: 0, gy: 5 },
    unlock: { type: "compound", conditions: [
      { type: "expeditions", count: 3 },
      { type: "discover", mapId: "hospital", count: 1 },
    ] },
    pois: [
      { type: "military", gx: 6, gy: 4 },
      { type: "military", gx: 10, gy: 7 },
      { type: "cache", gx: 3, gy: 2 },
    ],
    eventRate: 0.7,
  },
];

// 创建所有地图的运行时实例
export function createMaps() {
  const list = {};
  for (const def of MAP_DEFS) {
    const total = def.gridW * def.gridH;
    list[def.id] = {
      ...def,
      cells: new Uint8Array(total), // 全部 HIDDEN
      pois: def.pois.map((p, i) => ({ ...p, id: i + 1, discovered: false })),
      discoveredCount: 0,
      unlocked: def.unlock.type === "free",
    };
    // 入口格预标记为已踏足(避免开局/传送立即触发事件)
    const rt = list[def.id];
    const eIdx = def.entry.gy * def.gridW + def.entry.gx;
    rt.cells[eIdx] = CELL.VISITED;
    // 揭示入口周围
    revealCellAndNeighbors(rt, def.entry.gx, def.entry.gy);
  }
  return { current: "home", list };
}

// 获取当前地图
export function currentMap(state) {
  return state.maps.list[state.maps.current];
}

// 获取指定地图
export function getMap(state, id) {
  return state.maps.list[id];
}

// 全部地图定义(含锁定状态,用于地图选择 UI)
export function allMaps(state) {
  return MAP_DEFS.map((def) => ({
    def,
    runtime: state.maps.list[def.id],
  }));
}

// 解锁条件检查
export function checkUnlock(state, mapDef) {
  const u = mapDef.unlock;
  return evalCondition(state, u);
}

function evalCondition(state, cond) {
  if (!cond) return true;
  switch (cond.type) {
    case "free":
      return true;
    case "resource":
      return (state.res[cond.res] || 0) >= cond.amount;
    case "discover": {
      const m = state.maps.list[cond.mapId];
      return m && m.discoveredCount >= cond.count;
    }
    case "expeditions":
      return state.stats.expeditionsDone >= cond.count;
    case "compound":
      return cond.conditions.every((c) => evalCondition(state, c));
    default:
      return true;
  }
}

// 解锁条件文字描述
export function unlockDesc(state, mapDef) {
  const u = mapDef.unlock;
  if (u.type === "free") return "已解锁";
  if (u.type === "resource") {
    const have = Math.floor(state.res[u.res] || 0);
    return `${u.amount} ${RES_LABEL[u.res] || u.res} (现${have})`;
  }
  if (u.type === "discover") {
    const m = state.maps.list[u.mapId];
    const have = m ? m.discoveredCount : 0;
    return `在${state.maps.list[u.mapId]?.name || ""}发现${u.count}地点 (现${have})`;
  }
  if (u.type === "expeditions") {
    return `完成${u.count}次派遣 (现${state.stats.expeditionsDone})`;
  }
  if (u.type === "compound") {
    return u.conditions.map((c) => unlockDesc(state, { unlock: c })).join(" 且 ");
  }
  return "";
}

const RES_LABEL = { parts: "⚙️", scrap: "🔩", food: "🍖", water: "💧", power: "⚡", meds: "💊" };

// 每帧检查并解锁地图(满足条件自动解锁)
export function updateUnlocks(state) {
  for (const def of MAP_DEFS) {
    const rt = state.maps.list[def.id];
    if (!rt.unlocked && checkUnlock(state, def)) {
      rt.unlocked = true;
    }
  }
}

// 全局已发现 POI 列表(供派遣系统)
export function allDiscoveredPois(state) {
  const out = [];
  for (const id in state.maps.list) {
    const m = state.maps.list[id];
    if (!m.unlocked) continue;
    for (const p of m.pois) {
      if (p.discovered) out.push({ ...p, mapId: id, mapName: m.name });
    }
  }
  return out;
}

// 全局已发现总数(供任务系统)
export function totalDiscovered(state) {
  let n = 0;
  for (const id in state.maps.list) {
    n += state.maps.list[id].discoveredCount;
  }
  return n;
}

// 坐标转换: 网格 → 世界像素(地图内)
export function gridToWorld(gx, gy) {
  return { x: gx * CELL_PX + CELL_PX / 2, y: gy * CELL_PX + CELL_PX / 2 };
}

// 世界像素 → 网格
export function worldToGrid(x, y) {
  return { gx: Math.floor(x / CELL_PX), gy: Math.floor(y / CELL_PX) };
}

// 揭示主角所在格 + 相邻格(踏足时调用)
export function revealCellAndNeighbors(map, gx, gy) {
  const setCell = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= map.gridW || cy >= map.gridH) return;
    const idx = cy * map.gridW + cx;
    if (map.cells[idx] === CELL.HIDDEN) {
      map.cells[idx] = CELL.REVEALED;
    }
  };
  // 越界保护
  if (gx < 0 || gy < 0 || gx >= map.gridW || gy >= map.gridH) {
    return { newlyVisited: false };
  }
  const idx = gy * map.gridW + gx;
  // 记录是否首次踏足(无论之前是 HIDDEN 还是 REVEALED)
  const newlyVisited = map.cells[idx] !== CELL.VISITED;
  // 踏足格直接 VISITED
  map.cells[idx] = CELL.VISITED;
  // 揭示上下左右(必须放在 return 之前,否则首次踏足时相邻格永远不揭示)
  setCell(gx + 1, gy);
  setCell(gx - 1, gy);
  setCell(gx, gy + 1);
  setCell(gx, gy - 1);
  return { newlyVisited };
}

// 检查 POI 是否已被踏足发现(在 VISITED 格上)
export function checkPoiDiscovery(map, gx, gy) {
  const found = [];
  for (const p of map.pois) {
    if (!p.discovered && p.gx === gx && p.gy === gy) {
      p.discovered = true;
      map.discoveredCount++;
      found.push(p);
    }
  }
  return found;
}

// 切换地图(传送): 主角放到目标地图入口格,预标记入口避免即触发事件
export function travelToMap(state, mapId) {
  const map = state.maps.list[mapId];
  if (!map || !map.unlocked) return false;
  state.maps.current = mapId;
  const w = gridToWorld(map.entry.gx, map.entry.gy);
  state.player.x = w.x;
  state.player.y = w.y;
  state.player.tx = w.x;
  state.player.ty = w.y;
  revealCellAndNeighbors(map, map.entry.gx, map.entry.gy);
  const eIdx = map.entry.gy * map.gridW + map.entry.gx;
  map.cells[eIdx] = CELL.VISITED;
  state._exploreCooldown = true;
  state._lastExploreGx = map.entry.gx;
  state._lastExploreGy = map.entry.gy;
  return true;
}

// 老存档兼容: 单 map → maps 结构
export function migrateOldMap(state) {
  if (state.maps) return; // 已是新结构
  state.maps = createMaps();
}

// 返回地图世界像素尺寸(摄像机边界用)
export function mapPixelSize(map) {
  return { w: map.gridW * CELL_PX, h: map.gridH * CELL_PX };
}
