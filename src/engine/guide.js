// 新手引导: 基于游戏进度判断该提示什么,轻量横幅式
// 设计原则: 只在玩家"卡住/不知下一步"时出现,完成对应行动即消失,可手动关闭
// 不做强制弹窗教程,不打断已上手的玩家

import { allDiscoveredPois } from "../content/regions.js";

// 返回当前应显示的引导提示,或 null
// 提示按优先级排序,只返回最高优先级的一条
export function currentGuide(state) {
  const g = state.guide;
  if (!g) return null;

  // 提示1: 还没探索过 → 引导去地图 (最高优先,开局核心动作)
  if (!g.explored && !isDismissed(g, "go_explore")) {
    return {
      id: "go_explore",
      icon: "🗺️",
      title: "前往地图探索",
      desc: "点基地页「外出探索」,在地图上点击格子行走,揭开迷雾可发现可派遣地点。",
      targetScreen: "base",
    };
  }

  // 提示2: 发现了POI但没派遣过 → 引导派遣
  if (g.explored && !g.dispatched && allDiscoveredPois(state).length > 0 && !isDismissed(g, "go_dispatch")) {
    return {
      id: "go_dispatch",
      icon: "🚀",
      title: "发起首次派遣",
      desc: "在「派遣」页选已发现的地点组队出发,获取资源与新成员。",
      targetScreen: "dispatch",
    };
  }

  // 提示3: 食物即将耗尽 → 警告建农场/分配
  if (state.res.food < 20 && !isDismissed(g, "low_food")) {
    return {
      id: "low_food",
      icon: "⚠️",
      title: "食物告急",
      desc: "建造或升级辐射农场,并分配居民工作,否则幸存者会饿伤。",
      targetScreen: "base",
    };
  }

  // 提示4: 还没建过新设施且资源够 → 鼓励建设
  if (!g.built && state.res.scrap >= 20 && state.res.parts >= 8 && !isDismissed(g, "go_build")) {
    return {
      id: "go_build",
      icon: "🏗️",
      title: "建造新设施",
      desc: "资源已够,在基地页建造工坊/发电机等设施,扩大产能。",
      targetScreen: "base",
    };
  }

  return null;
}

function isDismissed(g, id) {
  return Array.isArray(g.dismissed) && g.dismissed.includes(id);
}

// 关闭某条提示(玩家点 ✕)
export function dismissGuide(state, id) {
  if (!state.guide) return;
  if (!Array.isArray(state.guide.dismissed)) state.guide.dismissed = [];
  if (!state.guide.dismissed.includes(id)) state.guide.dismissed.push(id);
}

// —— 里程碑更新: 各系统在对应操作成功时调用 ——

// 玩家进入地图屏或踏足新格
export function markExplored(state) {
  if (state.guide) state.guide.explored = true;
}
// 玩家发起派遣
export function markDispatched(state) {
  if (state.guide) state.guide.dispatched = true;
}
// 玩家建造新设施(非初始2个)
export function markBuilt(state) {
  if (state.guide) state.guide.built = true;
}
// 玩家招募新幸存者
export function markRecruited(state) {
  if (state.guide) state.guide.recruited = true;
}
