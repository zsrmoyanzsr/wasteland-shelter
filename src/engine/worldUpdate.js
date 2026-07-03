// 世界更新: 主角移动 + 网格探索 + 事件触发
import {
  currentMap,
  revealCellAndNeighbors,
  checkPoiDiscovery,
  worldToGrid,
  mapPixelSize,
  CELL_PX,
  CELL,
  updateUnlocks,
} from "../content/regions.js";
import { rollExploreEvent } from "../content/exploreEvents.js";
import { addLog, addFloat } from "./state.js";
import { THEME as T } from "../ui/theme.js";
import { landmarkDef, BLUEPRINT_REWARDS } from "../content/landmarks.js";
import { addItems } from "./inventory.js";
import { grantArtifact } from "./artifactEngine.js";
import { generateSurvivor } from "../content/survivors.js";

// 确定性hash: 同一格子+地图永远返回同一值(0..1),用于决定是否有事件
// 设计: 每3x3区块(~9格)里,hash<0.33的格约占3个 → ~33%密度
function cellEventHash(gx, gy, mapId) {
  let h = 0;
  const s = mapId + ":" + gx + "," + gy;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

// 更新主角位置(向目标点移动,网格地图内)
export function updatePlayer(state, dt) {
  // 探索事件模态打开时,主角暂停移动
  if (state.modal && state.modal.type === "exploreEvent") return;

  const p = state.player;
  const map = currentMap(state);
  if (!map) return;

  // 重伤(health<=0)时缓慢自动回血(营地静养),不能移动
  if (p.health <= 0) {
    p.health = Math.min(p.maxHealth, p.health + 3 * dt);
    p.stamina = Math.min(p.maxStamina, p.stamina + 5 * dt);
    return;
  }

  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    const step = Math.min(dist, p.moveSpeed * dt);
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
    // 移动消耗体力
    p.stamina = Math.max(0, p.stamina - 1.2 * dt);
  } else {
    // 静止恢复体力+微量回血
    p.stamina = Math.min(p.maxStamina, p.stamina + 4 * dt);
    p.health = Math.min(p.maxHealth, p.health + 0.5 * dt);
  }
}

// 探索更新: 踏足新格 → 揭示相邻 + 触发事件 + 发现 POI
export function updateExplore(state) {
  const map = currentMap(state);
  if (!map) return;
  const p = state.player;

  // 主角当前所在格
  const { gx, gy } = worldToGrid(p.x, p.y);
  if (gx < 0 || gy < 0 || gx >= map.gridW || gy >= map.gridH) return;

  // 揭示当前格 + 相邻,检测是否首次踏足
  const result = revealCellAndNeighbors(map, gx, gy);

  // 发现 POI(主角正好踏上 POI 格)
  const foundPois = checkPoiDiscovery(map, gx, gy);
  for (const fp of foundPois) {
    const info = POI_INFO(fp.type);
    addLog(state, `发现: ${info.name} ${info.icon}! 现在可以派遣探索了。`, T.info);
    addFloat(state, p.x, p.y - 30, `发现 ${info.name}!`, T.info);
    updateUnlocks(state); // 发现可能解锁新地图
  }

  // 发现地标(踩到地标格 → 立即触发独有奖励)
  if (map.landmarks) {
    for (const lm of map.landmarks) {
      if (!lm.claimed && lm.gx === gx && lm.gy === gy) {
        lm.claimed = true;
        triggerLandmark(state, lm, state.maps.current, p);
      }
    }
  }

  // 首次踏足该格 → 按"分组分布"规则决定是否触发(~15%密度,大地图不烦)
  if (result.newlyVisited && !state.modal && !state._exploreCooldown) {
    // hash(gx,gy,mapId) → 0..1,< 0.15 则触发(约15%,大地图约7格触发1次)
    const eventHash = cellEventHash(gx, gy, state.maps.current);
    if (eventHash < 0.15) {
      // 侦察兵(scavenger)在场 → 提升好事件概率
      const hasScout = state.survivors.some((s) => s.busy !== "dead" && s.perks && s.perks.includes("scavenger"));
      const hasSocial = state.survivors.some((s) => s.busy !== "dead" && (s.skills.social || 0) >= 2);
      const preferGood = hasScout || hasSocial;
      const ev = rollExploreEvent(Math.random, preferGood, state._lastEventId);
      state._lastEventId = ev.id;
      state.modal = {
        type: "exploreEvent",
        eventId: ev.id,
        mapId: state.maps.current,
        gx,
        gy,
      };
    }
    state._exploreCooldown = true;
  }
  // 离开该格后清除冷却(下次进新格可再触发)
  if (state._lastExploreGx !== gx || state._lastExploreGy !== gy) {
    state._exploreCooldown = false;
    state._lastExploreGx = gx;
    state._lastExploreGy = gy;
  }
}

import { poiInfo as POI_INFO } from "../content/regions.js";

// 地标发现触发: 按类型给予独有奖励
function triggerLandmark(state, lm, mapId, player) {
  const def = landmarkDef(lm.type);
  if (!def) return;
  addFloat(state, player.x, player.y - 30, `${def.icon} ${def.name}!`, def.color);
  switch (lm.type) {
    case "blueprint": {
      // 解锁特殊建筑图纸
      const bpId = BLUEPRINT_REWARDS[mapId] || "auto_farm";
      if (!state.blueprints.includes(bpId)) {
        state.blueprints.push(bpId);
        addLog(state, `${def.icon} 发现建筑图纸! 可建造新设施了。`, def.color);
      } else {
        // 已有图纸→给材料补偿
        addItems(state, { alloy: 3, circuit: 2 });
        addLog(state, `${def.icon} 图纸重复,获得稀有材料补偿。`, def.color);
      }
      break;
    }
    case "vein": {
      // 资源矿脉: 给大量基础资源
      addItems(state, { screw: 5, cloth: 3 });
      state.res.scrap = Math.min(state.resCap.scrap || 100, state.res.scrap + 20);
      addLog(state, `${def.icon} 发现资源矿脉! 获得20废铁+稀有材料。`, def.color);
      break;
    }
    case "shelter": {
      // 招募高级幸存者
      const newSv = generateSurvivor(3, Math.random, state.nextSurvivorId++);
      if (window.__assignAvatar) window.__assignAvatar(newSv);
      state.survivors.push(newSv);
      state.stats.survivorsRecruited++;
      addLog(state, `${def.icon} 在隐藏避难所发现 ${newSv.name} (${newSv.profName})! 加入了队伍。`, def.color);
      break;
    }
    case "altar": {
      // 全队+1随机技能
      const skills = ["medical", "craft", "scavenge", "combat", "farm", "social"];
      const chosen = skills[Math.floor(Math.random() * skills.length)];
      for (const s of state.survivors) {
        if (s.busy === "dead") continue;
        s.skills[chosen] = Math.min(10, (s.skills[chosen] || 0) + 1);
      }
      addLog(state, `${def.icon} 神秘祭坛的力量! 全队${chosen}+1。`, def.color);
      break;
    }
    case "signal": {
      // 给蓝图碎片+稀有物品
      addItems(state, { blueprint: 1, circuit: 3, cell: 2 });
      addLog(state, `${def.icon} 信号塔传来坐标! 获得蓝图碎片和稀有材料。`, def.color);
      break;
    }
    case "treasure": {
      // 宝箱: 稀有物品+蓝图碎片
      addItems(state, { blueprint: 1, alloy: 2, fiber: 2, lens: 1 });
      addLog(state, `${def.icon} 发现宝箱! 内含稀有材料和蓝图碎片。`, def.color);
      break;
    }
    case "gene": {
      // 基因舱: 大量化学剂+蓝图碎片
      addItems(state, { chem: 5, blueprint: 1, antibiotic: 1 });
      addLog(state, `${def.icon} 基因舱开启! 获得生物材料和蓝图碎片。`, def.color);
      break;
    }
    case "crater": {
      // 核弹坑: 大量稀有材料+小概率神器
      addItems(state, { alloy: 4, cell: 3, blueprint: 1 });
      if (Math.random() < 0.3) grantArtifact(state, "A", Math.random);
      addLog(state, `${def.icon} 核弹坑中找到稀有材料!`, def.color);
      break;
    }
  }
}

// 旧函数名兼容(main.js 可能引用)—— 指向 updateExplore
export const updateMapFog = updateExplore;
