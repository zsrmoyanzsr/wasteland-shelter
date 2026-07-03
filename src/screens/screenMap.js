// 大地图屏幕(网格版): 多地图切换 + 网格探索 + 迷雾 + 传送门
import { THEME as T } from "../ui/theme.js";
import {
  fillRoundRect,
  text,
  icon,
  inRect,
  rgba,
  roundRect,
} from "../ui/ui.js";

// 加载地图装饰图标(AI生成,放在已揭示/已踏足的格子上)
const TILE_ICONS = ["ruins", "tree", "rock", "crater", "cache"].map((name) => {
  const img = new Image();
  img.src = import.meta.env.BASE_URL + "img/tiles/" + name + ".png";
  return img;
});
// 预解码
TILE_ICONS.forEach((img) => { if (img.decode) img.decode().catch(() => {}); });
// 每格固定显示哪个装饰(基于坐标hash,稳定不闪)
function tileIconIndex(gx, gy, mapId) {
  let h = 0;
  const s = mapId + ":" + gx + "," + gy;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  return ((h >>> 0) % 100) / 100; // 0..1
}
import { contentRect } from "./screenHud.js";
import { getHeroImage } from "../engine/avatarLoader.js";
import { markExplored } from "../engine/guide.js";
import { landmarkDef as landmarkDefCached } from "../content/landmarks.js";
import {
  currentMap,
  mapPixelSize,
  CELL_PX,
  CELL,
  poiInfo,
  gridToWorld,
  worldToGrid,
} from "../content/regions.js";

let camX = 0;
let camY = 0;
let _lastMapId = null; // 切换地图时重置摄像机

export function drawMapScreen(ctx, state, ui, W, H) {
  const cr = contentRect(W, H);
  const vw = cr.w;
  const vh = cr.h;
  const map = currentMap(state);
  if (!map) return;
  markExplored(state); // 进入地图屏即标记已探索(引导用)
  const size = mapPixelSize(map);

  if (_lastMapId !== state.maps.current) {
    camX = state.player.x - vw / 2;
    camY = state.player.y - vh / 2;
    _lastMapId = state.maps.current;
  }

  const targetCamX = state.player.x - vw / 2;
  const targetCamY = state.player.y - vh / 2;
  camX += (targetCamX - camX) * 0.12;
  camY += (targetCamY - camY) * 0.12;
  camX = Math.max(-40, Math.min(size.w - vw + 40, camX));
  camY = Math.max(-40, Math.min(size.h - vh + 40, camY));

  const w2s = (wx, wy) => ({ x: wx - camX + cr.x, y: wy - camY + cr.y });

  ctx.save();
  ctx.beginPath();
  ctx.rect(cr.x, cr.y, vw, vh);
  ctx.clip();

  const g = ctx.createLinearGradient(0, cr.y, 0, cr.y + vh);
  g.addColorStop(0, map.bgGradTop);
  g.addColorStop(1, map.bgGradBot);
  ctx.fillStyle = g;
  ctx.fillRect(cr.x, cr.y, vw, vh);

  const padding = 4;
  const minGx = Math.max(0, Math.floor(camX / CELL_PX));
  const maxGx = Math.min(map.gridW - 1, Math.floor((camX + vw) / CELL_PX));
  const minGy = Math.max(0, Math.floor(camY / CELL_PX));
  const maxGy = Math.min(map.gridH - 1, Math.floor((camY + vh) / CELL_PX));
  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const idx = gy * map.gridW + gx;
      const cellState = map.cells[idx];
      const w = gridToWorld(gx, gy);
      const s = w2s(w.x, w.y);
      const px = s.x - CELL_PX / 2 + padding / 2;
      const py = s.y - CELL_PX / 2 + padding / 2;
      const psz = CELL_PX - padding;
      if (cellState === CELL.HIDDEN) {
        roundRect(ctx, px, py, psz, psz, 8);
        ctx.fillStyle = "rgba(6,8,14,0.95)";
        ctx.fill();
        ctx.fillStyle = "rgba(70,75,90,0.5)";
        ctx.font = `${Math.floor(psz * 0.5)}px ${T.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", px + psz / 2, py + psz / 2 + 1);
        ctx.strokeStyle = "rgba(20,24,34,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (cellState === CELL.REVEALED) {
        roundRect(ctx, px, py, psz, psz, 8);
        ctx.fillStyle = rgba(map.accent, 0.22);
        ctx.fill();
        ctx.strokeStyle = rgba(map.accent, 0.55);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        drawTileIcon(ctx, gx, gy, state.maps.current, px, py, psz, 0.35);
      } else {
        roundRect(ctx, px, py, psz, psz, 8);
        ctx.fillStyle = rgba(map.accent, 0.5);
        ctx.fill();
        ctx.strokeStyle = map.accent;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        drawTileIcon(ctx, gx, gy, state.maps.current, px, py, psz, 0.7);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.floor(psz * 0.32)}px ${T.fontFamily}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("✓", px + 3, py + 1);
      }
    }
  }

  for (const poi of map.pois) {
    if (!poi.discovered) continue;
    const info = poiInfo(poi.type);
    const w = gridToWorld(poi.gx, poi.gy);
    const ps = w2s(w.x, w.y);
    if (!inView(ps, cr, 50)) continue;
    ctx.beginPath();
    ctx.arc(ps.x, ps.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = rgba(info.color, 0.3);
    ctx.fill();
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    icon(ctx, info.icon, ps.x, ps.y - 1, 22);
    text(ctx, info.name, ps.x, ps.y + 24, { size: T.fontXs, color: "#fff", align: "center", weight: "700" });
  }

  const ew = gridToWorld(map.entry.gx, map.entry.gy);
  const es = w2s(ew.x, ew.y);
  if (inView(es, cr, 40)) {
    ctx.beginPath();
    ctx.arc(es.x, es.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = rgba(T.primary, 0.2);
    ctx.fill();
    ctx.strokeStyle = T.primary;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    icon(ctx, "🌀", es.x, es.y, 18);
    text(ctx, "传送点", es.x, es.y + 22, { size: T.fontXs, color: T.primary, align: "center", weight: "700" });
  }

  // 地标渲染(已发现的显示图标,已领取的显示✓)
  if (map.landmarks) {
    for (const lm of map.landmarks) {
      const cellIdx = lm.gy * map.gridW + lm.gx;
      const cellState = map.cells[cellIdx];
      if (cellState === CELL.HIDDEN) continue; // 迷雾中不显示
      const lw = gridToWorld(lm.gx, lm.gy);
      const ls = w2s(lw.x, lw.y);
      if (!inView(ls, cr, 40)) continue;
      const lmDef = landmarkDefCached(lm.type);
      if (!lmDef) continue;
      // 已领取: 灰色✓; 已发现未领取: 彩色图标; 未发现(刚揭示): 隐藏(等踩到)
      if (lm.claimed) {
        ctx.globalAlpha = 0.4;
        icon(ctx, "✓", ls.x, ls.y, 18);
        ctx.globalAlpha = 1;
      } else if (cellState === CELL.VISITED) {
        // 已踏足但未claim(不该发生,防御性)→ 显示问号
        icon(ctx, lmDef.icon, ls.x, ls.y, 16);
      }
      // REVEALED 状态不显示(等玩家踩上去才触发)
    }
  }

  const tp = w2s(state.player.tx, state.player.ty);
  const dist = Math.hypot(state.player.tx - state.player.x, state.player.ty - state.player.y);
  if (dist > 5) {
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = T.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const pp = w2s(state.player.x, state.player.y);
  const heroImg = getHeroImage();
  const PR = 22;
  const lowHp = state.player.health < 30;
  const moving = dist > 5;
  const pulse = moving || lowHp ? Math.sin(state.time * 4) * 0.5 + 0.5 : 0.4;
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, PR + 6, 0, Math.PI * 2);
  ctx.fillStyle = rgba(lowHp ? "#e0584e" : T.primary, 0.15 + pulse * 0.2);
  ctx.fill();
  if (heroImg && heroImg.complete && heroImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, PR, 0, Math.PI * 2);
    ctx.clip();
    const sc = Math.max((PR * 2) / heroImg.naturalWidth, (PR * 2) / heroImg.naturalHeight);
    const dw = heroImg.naturalWidth * sc;
    const dh = heroImg.naturalHeight * sc;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(heroImg, pp.x - dw / 2, pp.y - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, PR - 4, 0, Math.PI * 2);
    ctx.fillStyle = T.primary;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, PR, 0, Math.PI * 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  text(ctx, "指挥官", pp.x, pp.y + PR + 8, { size: T.fontXs, color: "#fff", align: "center", weight: "700" });

  ctx.restore();

  fillRoundRect(ctx, cr.x, cr.y, vw, 52, 0, "rgba(17,19,26,0.9)");
  text(ctx, `${map.icon} ${map.name}`, cr.x + 14, cr.y + 10, { size: T.fontMd, color: T.text, weight: "700" });
  const visited = countVisited(map);
  const total = map.gridW * map.gridH;
  text(ctx, `探索 ${visited}/${total} · POI ${map.discoveredCount}`, cr.x + 14, cr.y + 32, { size: T.fontXs, color: T.textDim });
  const hpRatio = state.player.health / state.player.maxHealth;
  const st = state.player.stamina / state.player.maxStamina;
  const barX = cr.x + vw - 200;
  fillRoundRect(ctx, barX, cr.y + 8, 90, 11, 5, T.bg);
  fillRoundRect(ctx, barX, cr.y + 8, Math.max(11, 90 * hpRatio), 11, 5, hpRatio < 0.3 ? T.danger : "#e0584e");
  text(ctx, `❤${Math.floor(state.player.health)}`, barX + 45, cr.y + 13, { size: 10, color: "#fff", align: "center", baseline: "middle", weight: "700" });
  fillRoundRect(ctx, barX, cr.y + 24, 90, 14, 7, T.bg);
  fillRoundRect(ctx, barX, cr.y + 24, 90 * st, 14, 7, st < 0.2 ? T.danger : T.primary);
  text(ctx, `⚡${Math.floor(state.player.stamina)}`, barX + 45, cr.y + 31, { size: T.fontXs, color: "#fff", align: "center", baseline: "middle", weight: "700" });
  if (buttonSimple(ctx, ui, cr.x + vw - 96, cr.y + 10, 86, 32, "🏠 营地")) {
    state.screen = "base";
    state.tab = "base";
    ui.pointer.pressed = false;
  }

  const tipY = cr.y + vh - 36;
  fillRoundRect(ctx, cr.x, tipY, vw, 36, 0, "rgba(17,19,26,0.85)");
  text(ctx, "👆 点击格子行走 · 踏入未知格触发事件 · 🌀传送点可回营地", cr.x + vw / 2, tipY + 18, { size: T.fontSm, color: T.textDim, align: "center", baseline: "middle" });

  if (ui.pointer.pressed && inRect(ui.pointer.x, ui.pointer.y, cr.x, cr.y + 52, vw, vh - 88) && !state.modal) {
    const wx = ui.pointer.x - cr.x + camX;
    const wy = ui.pointer.y - cr.y + camY;
    const tg = worldToGrid(wx, wy);
    if (tg.gx >= 0 && tg.gy >= 0 && tg.gx < map.gridW && tg.gy < map.gridH) {
      const w = gridToWorld(tg.gx, tg.gy);
      state.player.tx = w.x;
      state.player.ty = w.y;
    }
    ui.pointer.pressed = false;
  }
}

function countVisited(map) {
  let n = 0;
  for (let i = 0; i < map.cells.length; i++) if (map.cells[i] === CELL.VISITED) n++;
  return n;
}

function buttonSimple(ctx, ui, x, y, w, h, label) {
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  fillRoundRect(ctx, x, y, w, h, 8, hover ? T.panelHi : T.panel, T.panelLine, 1);
  text(ctx, label, x + w / 2, y + h / 2, { size: T.fontSm, color: T.text, align: "center", baseline: "middle", weight: "600" });
  return hover && ui.pointer.pressed;
}

function inView(s, cr, margin) {
  return s.x > cr.x - margin && s.x < cr.x + cr.w + margin && s.y > cr.y - margin && s.y < cr.y + cr.h + margin;
}

function drawTileIcon(ctx, gx, gy, mapId, px, py, psz, alpha) {
  const hash = tileIconIndex(gx, gy, mapId);
  if (hash >= 0.6) return;
  const idx = Math.floor(hash / 0.6 * TILE_ICONS.length);
  const img = TILE_ICONS[idx];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.globalAlpha = alpha;
    const iconSize = psz * 0.65;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, px + (psz - iconSize) / 2, py + (psz - iconSize) / 2, iconSize, iconSize);
    ctx.globalAlpha = 1;
  }
}
