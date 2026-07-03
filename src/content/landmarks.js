// 地图特殊地标: 踩到立即获得独有奖励(蓝图/增益/资源/招募)
// 和POI不同: POI是派遣点(可重复),地标是一次性发现奖励
// 每张地图放2-4个,危险越高放越稀有的

export const LANDMARK_TYPES = {
  blueprint: {
    id: "blueprint", icon: "📐", name: "废弃图纸", color: "#f0a93b",
    desc: "一张核战前的建筑图纸,发现后解锁特殊建筑。",
  },
  vein: {
    id: "vein", icon: "⛲", name: "资源矿脉", color: "#7cc36b",
    desc: "丰富的地下资源矿脉,发现后该地图POI产出永久+15%。",
  },
  shelter: {
    id: "shelter", icon: "🏚️", name: "隐藏避难所", color: "#5b9bd5",
    desc: "一个不为人知的避难所,里面有一名高级幸存者等待加入。",
  },
  altar: {
    id: "altar", icon: "⛩️", name: "神秘祭坛", color: "#9b7bd4",
    desc: "古老的祭坛散发着能量,触碰后全队永久提升1点随机技能。",
  },
  signal: {
    id: "signal", icon: "🌐", name: "信号塔", color: "#e0c14a",
    desc: "一座仍在运作的信号塔,可能指向未知区域。",
  },
  treasure: {
    id: "treasure", icon: "💎", name: "宝箱", color: "#e0588e",
    desc: "一个封存的宝箱,内含稀有物品和蓝图碎片。",
  },
  gene: {
    id: "gene", icon: "🧬", name: "基因舱", color: "#4caf87",
    desc: "核战前的基因储存舱,含有珍贵的生物科技资料。",
  },
  crater: {
    id: "crater", icon: "☢️", name: "核弹坑", color: "#e0584e",
    desc: "一个巨大的核弹坑,辐射中蕴含稀有材料。",
  },
};

// 每张地图的地标配置(type + 相对坐标)
// 坐标基于各地图gridW/gridH,放在探索价值高的位置
export const MAP_LANDMARKS = {
  home: [
    { type: "blueprint", gx: 9, gy: 2 },
    { type: "vein", gx: 4, gy: 7 },
  ],
  town: [
    { type: "shelter", gx: 11, gy: 3 },
    { type: "vein", gx: 3, gy: 8 },
    { type: "treasure", gx: 12, gy: 9 },
  ],
  hospital: [
    { type: "altar", gx: 10, gy: 3 },
    { type: "blueprint", gx: 3, gy: 9 },
    { type: "gene", gx: 12, gy: 8 },
  ],
  factory: [
    { type: "blueprint", gx: 12, gy: 3 },
    { type: "treasure", gx: 4, gy: 10 },
    { type: "signal", gx: 13, gy: 9 },
  ],
  military: [
    { type: "crater", gx: 13, gy: 4 },
    { type: "altar", gx: 4, gy: 11 },
    { type: "treasure", gx: 14, gy: 10 },
    { type: "gene", gx: 8, gy: 3 },
  ],
  sewer: [
    { type: "vein", gx: 11, gy: 3 },
    { type: "shelter", gx: 3, gy: 8 },
    { type: "blueprint", gx: 12, gy: 9 },
  ],
  lab: [
    { type: "gene", gx: 12, gy: 4 },
    { type: "altar", gx: 3, gy: 10 },
    { type: "treasure", gx: 13, gy: 9 },
  ],
  bunker: [
    { type: "crater", gx: 13, gy: 4 },
    { type: "blueprint", gx: 5, gy: 11 },
    { type: "signal", gx: 14, gy: 10 },
    { type: "treasure", gx: 9, gy: 3 },
  ],
};

// 蓝图地标解锁的特殊建筑id(随机或按地图分配)
export const BLUEPRINT_REWARDS = {
  home: "auto_farm",        // 自动化农场
  town: "auto_farm",
  hospital: "bio_lab",      // 生物实验室
  factory: "hydro_gen",     // 水力发电机
  sewer: "hydro_gen",
  lab: "bio_lab",
  bunker: "antimatter",     // 反物质反应堆
  military: "antimatter",
};

// 给地图实例注入landmarks(在createMaps时调用)
export function injectLandmarks(mapsList) {
  for (const mapId in mapsList) {
    const defs = MAP_LANDMARKS[mapId];
    if (!defs) continue;
    mapsList[mapId].landmarks = defs.map((lm, i) => ({
      type: lm.type,
      gx: lm.gx,
      gy: lm.gy,
      claimed: false,
    }));
  }
}

// 地标定义查找
export function landmarkDef(type) {
  return LANDMARK_TYPES[type] || null;
}
