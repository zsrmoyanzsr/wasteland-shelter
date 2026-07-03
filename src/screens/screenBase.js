// 基地屏幕: 设施网格 + 建造菜单 + 升级 + 居民分配入口
import { THEME as T, RESOURCES } from "../ui/theme.js";
import {
  fillRoundRect,
  panelGradient,
  text,
  textTrunc,
  textCenter,
  icon,
  inRect,
  button,
  fmtNum,
  clipRound,
  setFont,
  roundRect,
} from "../ui/ui.js";
import { contentRect } from "./screenHud.js";
import { FACILITY_TYPES, buildableTypes, facilityStats, upgradeCost } from "../content/facilities.js";
import { addFloat, addLog } from "../engine/state.js";
import { markBuilt } from "../engine/guide.js";
import { drawGuideBanner } from "../ui/guideBanner.js";
import * as _StateMod from "../engine/state.js";
import { populationCap } from "../content/survivors.js";
import * as _RegionsMod from "../content/regions.js";

const CATS = [
  { id: "survival", label: "生存", icon: "🌱" },
  { id: "production", label: "生产", icon: "⚙️" },
  { id: "defense", label: "防御", icon: "🛡️" },
  { id: "special", label: "特殊", icon: "✨" },
];

export function drawBaseScreen(ctx, state, ui, W, H) {
  const cr = contentRect(W, H);
  const ox = cr.x; // 内容区x偏移(宽屏=96侧栏右侧,窄屏=0)
  const pad = 16; // 内容左/右边距

  // 标题(字号略小避免和下方等级按钮挤)
  text(ctx, "🏠 避难所基地", ox + pad, cr.y + 6, { size: T.fontMd, color: T.text, weight: "700" });
  // 基地等级(可点升级) — 下移到 cr.y+30 避免和标题底部重叠
  const lvHover = inRect(ui.pointer.x, ui.pointer.y, ox + pad, cr.y + 32, 150, 24);
  fillRoundRect(ctx, ox + pad - 2, cr.y + 30, 154, 26, T.radiusSm, lvHover ? T.panelHi : T.panel, T.accent, lvHover ? 2 : 1);
  text(ctx, `⬆ 主基地 Lv.${state.base.level} ${state.base.level < 5 ? "(升级)" : "(满级)"}`, ox + pad + 4, cr.y + 37, {
    size: T.fontSm, color: state.base.level < 5 ? T.accent : T.textDim, weight: "700",
  });
  if (lvHover && ui.pointer.pressed && state.base.level < 5) {
    state.modal = { type: "baseUpgrade" };
    ui.pointer.pressed = false;
  }

  // 引导横幅(有提示才占位,无则返回0)
  const guideH = drawGuideBanner(ctx, ui, state, ox + pad - 2, cr.y + 58, cr.w - pad * 2 + 2);

  // 外出探索入口(紧凑横幅)
  const exploreY = cr.y + 58 + guideH;
  drawExploreEntry(ctx, ui, state, ox + pad, exploreY, cr.w - pad * 2, 52);

  // 已建设施网格 + 建造面板: 统一放进可滚动区域,避免内容多时被底部导航遮挡
  const scrollY = exploreY + 60;
  text(ctx, "已建设施", ox + pad, scrollY, { size: T.fontMd, color: T.text, weight: "600" });
  const scrollBoxY = scrollY + 22;
  const scrollBoxH = cr.y + cr.h - scrollBoxY - 8; // 内容区底部,不侵入导航栏

  const facs = state.base.facilities;
  const cardW = Math.min(220, (cr.w - pad * 2 - 12) / 2);
  const cardH = 96;

  // 先算总内容高度(设施网格 + 建造面板)
  const facRows = Math.ceil(facs.length / 2);
  const facTotalH = facRows * (cardH + 8);
  const buildPanelH = 38 + Math.ceil(7 / Math.max(3, Math.floor((cr.w - 20) / 100))) * (96 + 8) + 16;
  const contentTotalH = facTotalH + 20 + buildPanelH;
  const maxScroll = Math.max(0, contentTotalH - scrollBoxH);

  // 滚轮 + 触摸拖拽滚动
  if (inRect(ui.pointer.x, ui.pointer.y, ox + pad - 4, scrollBoxY, cr.w - pad * 2 + 8, scrollBoxH)) {
    const wheel = ui.consumeWheel ? ui.consumeWheel() : 0;
    const drag = ui.consumeDragScroll ? ui.consumeDragScroll() : 0;
    if (wheel || drag) state._baseScroll = Math.max(0, Math.min(maxScroll, (state._baseScroll || 0) + wheel * 0.5 + drag));
  }
  const yOff = state._baseScroll || 0;

  clipRound(ctx, ox + pad - 4, scrollBoxY, cr.w - pad * 2 + 8, scrollBoxH, T.radius, () => {
    let gx = ox + pad;
    let gy = scrollBoxY - yOff;
    facs.forEach((fac) => {
      if (gx + cardW > ox + cr.w - pad) {
        gx = ox + pad;
        gy += cardH + 8;
      }
      drawFacilityCard(ctx, ui, state, fac, gx, gy, cardW, cardH);
      gx += cardW + 10;
    });
    // 建造面板紧跟设施网格之后
    const buildY = gy + cardH + 20;
    drawBuildPanel(ctx, ui, state, ox + 16, buildY, cr.w - 32, buildPanelH);
  });

  // 滚动条(溢出时)
  if (maxScroll > 0) {
    const trackX = ox + cr.w - 8;
    fillRoundRect(ctx, trackX, scrollBoxY, 3, scrollBoxH, 1.5, T.panelLine);
    const thumbH = Math.max(30, (scrollBoxH / contentTotalH) * scrollBoxH);
    const thumbY = scrollBoxY + (yOff / maxScroll) * (scrollBoxH - thumbH);
    fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 1.5, T.textDim);
  }

  // 模态由 main.js 集中绘制(防点击穿透)
}

// 基地升级模态
export function drawBaseUpgradeModal(ctx, ui, state, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  const { baseUpgradeCost, MAX_BASE_LEVEL, getResCap } = _stateMod();
  const cur = state.base.level;
  const next = cur + 1;
  const maxed = cur >= MAX_BASE_LEVEL;
  const cost = maxed ? {} : baseUpgradeCost(cur);
  const mw = 340, mh = 360;
  const mx = (W - mw) / 2, my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.accent, 2);

  icon(ctx, "🏛️", mx + mw / 2, my + 40, 34);
  text(ctx, `主基地 Lv.${cur}${maxed ? "" : " → Lv." + next}`, mx + mw / 2, my + 70, {
    size: T.fontLg, color: T.text, align: "center", weight: "700",
  });

  // 升级效果说明
  let yy = my + 100;
  text(ctx, "升级效果:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 22;
  const popCap = _popCapFn();
  const effects = [
    `👥 人口上限 ${popCap(cur)} → ${popCap(next)}`,
    `📦 各资源容量 +30 (现${getResCap(state, "food")})`,
    `🏗️ 解锁更多发展可能`,
  ];
  for (const e of effects) {
    text(ctx, "• " + e, mx + 30, yy, { size: T.fontSm, color: T.primary });
    yy += 20;
  }

  // 成本
  if (!maxed) {
    yy += 8;
    text(ctx, "消耗:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
    yy += 22;
    const canAfford = canAffordCost(state.res, cost);
    text(ctx, costStr(cost), mx + 30, yy, {
      size: T.fontSm, color: canAfford ? T.accent : T.danger, weight: "600",
    });
  }

  // 按钮
  const by = my + mh - 56;
  if (!maxed) {
    if (button(ctx, ui, mx + 24, by, 130, 42, "确认升级", {
      fontSize: T.fontSm, disabled: !canAffordCost(state.res, cost), glow: canAffordCost(state.res, cost),
    })) {
      spendCost(state.res, cost);
      state.base.level = next;
      addFloat(state, W / 2, my, `主基地 Lv.${next}!`, T.accent);
      addLog(state, `主基地升级到 Lv.${next}! 人口与容量提升。`, T.accent);
      state.modal = null;
    }
  }
  if (button(ctx, ui, mx + (maxed ? 24 : mw - 154), by, 130, 42, maxed ? "已达满级" : "取消", {
    fontSize: T.fontSm, color: maxed ? T.panelHi : T.panelHi, textColor: maxed ? T.textMute : T.text, disabled: maxed,
  })) {
    state.modal = null;
  }
}

// 外出探索入口横幅
function drawExploreEntry(ctx, ui, state, x, y, w, h) {
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    T.radius,
    hover ? T.panelHi : T.panel,
    T.info,
    hover ? 2 : 1
  );
  icon(ctx, "🗺️", x + 28, y + h / 2, 26);
  text(ctx, "外出探索", x + 56, y + 9, { size: T.fontSm, color: T.text, weight: "700" });
  // 统计:已解锁地图数 + 全局发现数
  const unlocked = Object.values(state.maps.list).filter((m) => m.unlocked).length;
  const totalMaps = Object.keys(state.maps.list).length;
  const totalDiscovered = _regions(state).totalDiscovered(state); // totalDiscovered 是函数,需调用
  text(ctx, `已解锁 ${unlocked}/${totalMaps} 地图 · 探索 ${totalDiscovered} 地点`, x + 56, y + 30, {
    size: T.fontXs,
    color: T.textDim,
  });
  text(ctx, "前往 →", x + w - 14, y + h / 2, {
    size: T.fontXs,
    color: T.info,
    align: "right",
    baseline: "middle",
    weight: "700",
  });
  if (hover && ui.pointer.pressed) {
    state.modal = { type: "mapSelect" };
    ui.pointer.pressed = false;
  }
}

// 地图选择模态(网格状卡片)
export function drawMapSelectModal(ctx, ui, state, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);

  const maps = _regions(state).allMaps(state);
  const mw = Math.min(420, W - 32);
  const mh = Math.min(500, H - 80);
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.panelLine, 2);
  text(ctx, "🗺️ 选择探索地图", mx + mw / 2, my + 24, {
    size: T.fontLg,
    color: T.text,
    align: "center",
    weight: "700",
  });
  text(ctx, "满足条件可解锁新地图,资源/进度不同", mx + mw / 2, my + 50, {
    size: T.fontXs,
    color: T.textMute,
    align: "center",
  });

  // 卡片列表(每张地图一行)
  const cardW = mw - 40;
  const cardH = 68;
  let cy = my + 70;
  for (const { def, runtime } of maps) {
    if (cy + cardH > my + mh - 50) break;
    drawMapCard(ctx, ui, state, def, runtime, mx + 20, cy, cardW, cardH);
    cy += cardH + 8;
  }

  // 关闭
  const cHover = inRect(ui.pointer.x, ui.pointer.y, mx + mw - 44, my + 10, 32, 30);
  if (cHover && ui.pointer.pressed) {
    state.modal = null;
    ui.pointer.pressed = false;
  }
  text(ctx, "✕", mx + mw - 28, my + 26, {
    size: T.fontMd,
    color: cHover ? T.text : T.textMute,
    align: "center",
    baseline: "middle",
  });
}

function drawMapCard(ctx, ui, state, def, runtime, x, y, w, h) {
  const locked = !runtime.unlocked;
  const isCurrent = state.maps.current === def.id;
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  const accent = locked ? T.textMute : def.accent;
  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    T.radiusSm,
    hover && !locked ? T.panelHi : T.panelAlt,
    isCurrent ? T.primary : accent,
    isCurrent ? 2 : 1
  );
  // 图标
  icon(ctx, locked ? "🔒" : def.icon, x + 30, y + h / 2, 26);
  text(ctx, def.name, x + 60, y + 12, { size: T.fontMd, color: T.text, weight: "700" });
  if (locked) {
    const desc = _regions(state).unlockDesc(state, def);
    text(ctx, `解锁: ${desc}`, x + 60, y + 34, { size: T.fontXs, color: T.textMute });
  } else {
    const visited = countVisited(runtime);
    const total = def.gridW * def.gridH;
    text(ctx, `${def.desc}`, x + 60, y + 32, { size: T.fontXs, color: T.textDim });
    text(ctx, `探索 ${visited}/${total} · POI ${runtime.discoveredCount}/${runtime.pois.length}`, x + 60, y + 48, {
      size: T.fontXs,
      color: T.textMute,
    });
  }
  // 右侧按钮
  if (!locked) {
    fillRoundRect(ctx, x + w - 64, y + h / 2 - 16, 52, 32, 8, isCurrent ? T.panelHi : T.primary);
    text(ctx, isCurrent ? "当前" : "前往", x + w - 38, y + h / 2, {
      size: T.fontXs,
      color: isCurrent ? T.textDim : "#0e1016",
      align: "center",
      baseline: "middle",
      weight: "700",
    });
  }
  if (hover && ui.pointer.pressed && !locked && !isCurrent) {
    _regions(state).travelToMap(state, def.id);
    addLog(state, `传送至 ${def.name}`, def.accent);
    state.modal = null;
    ui.pointer.pressed = false;
  }
}

function countVisited(map) {
  let n = 0;
  for (let i = 0; i < map.cells.length; i++) if (map.cells[i] === 2) n++;
  return n;
}

// 延迟获取 regions 模块(避免循环 import)
let _regionsMod = null;
function _regions(state) {
  if (!_regionsMod) _regionsMod = _RegionsMod;
  return _regionsMod;
}
// state 模块函数(基地升级用)
function _stateMod() { return _StateMod; }
function _popCapFn() { return populationCap; }

function HUD_BOTTOM_H_OVERLAP(buildY, H) {
  return Math.max(80, H - buildY - 76);
}

// 设施卡片
function drawFacilityCard(ctx, ui, state, fac, x, y, w, h) {
  const def = FACILITY_TYPES[fac.type];
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  fillRoundRect(ctx, x, y, w, h, T.radius, T.panel, hover ? T.primary : T.panelLine, hover ? 2 : 1);

  // 图标
  icon(ctx, def.icon, x + 28, y + 30, 30);
  // 名称 + 等级
  text(ctx, def.name, x + 54, y + 14, { size: T.fontMd, color: T.text, weight: "700" });
  fillRoundRect(ctx, x + 54, y + 36, 42, 18, 9, T.primaryDark);
  text(ctx, `Lv.${fac.level}`, x + 75, y + 40, {
    size: T.fontXs,
    color: "#fff",
    align: "center",
    weight: "700",
  });
  // 居民分配
  const assigned = (fac.assigned || []).filter(
    (id) => state.survivors.find((s) => s.id === id)
  );
  const stats = facilityStats(fac.type, fac.level);
  text(ctx, `👥 ${assigned.length}/${stats.jobs}`, x + w - 12, y + 16, {
    size: T.fontXs,
    color: T.textDim,
    align: "right",
  });

  // 产出信息
  let infoY = y + 62;
  const prod = facilityStats(fac.type, fac.level);
  let prodText = "";
  for (const k in prod.produces) {
    const r = RESOURCES[k];
    if (r) prodText += `${r.icon}+${(prod.produces[k]).toFixed(1)}/s `;
  }
  text(ctx, prodText.trim() || "—", x + 12, infoY, {
    size: T.fontXs,
    color: T.primary,
    weight: "600",
  });
  let consText = "";
  for (const k in prod.consumes) {
    const r = RESOURCES[k];
    if (r) consText += `${r.icon}-${(prod.consumes[k]).toFixed(2)}/s `;
  }
  if (consText) {
    text(ctx, consText.trim(), x + 12, infoY + 16, {
      size: T.fontXs,
      color: T.textMute,
    });
  }

  // 升级按钮
  const maxed = fac.level >= def.maxLevel;
  const cost = upgradeCost(fac.type, fac.level);
  const canAfford = canAffordCost(state.res, cost);
  const btnW = w - 24;
  if (
    button(
      ctx,
      ui,
      x + 12,
      y + h - 30,
      btnW,
      26,
      maxed ? "已满级" : `升级 ${costStr(cost)}`,
      {
        fontSize: T.fontXs,
        fontWeight: "600",
        color: maxed ? T.panelHi : canAfford ? T.primary : T.danger,
        textColor: maxed ? T.textMute : "#0e1016",
        radius: T.radiusSm,
        disabled: maxed || !canAfford,
      }
    )
  ) {
    state.modal = { type: "upgradeFacility", facId: fac.id };
  }
}

// 建造面板(底部)
function drawBuildPanel(ctx, ui, state, x, y, w, h) {
  panelGradient(ctx, x, y, w, h, T.radius);
  text(ctx, "🏗️ 建造新设施", x + 14, y + 12, {
    size: T.fontMd,
    color: T.text,
    weight: "700",
  });

  // 网格卡片(自动换行,容纳所有设施)
  const types = buildableTypes();
  const cardW = 92;
  const cardH = 96;
  const gap = 8;
  const perRow = Math.max(3, Math.floor((w - 20) / (cardW + gap)));
  const startY = y + 38;
  let cx = x + 14;
  let cy = startY;
  types.forEach((t, idx) => {
    // 换行
    if (cx + cardW > x + w - 8) {
      cx = x + 14;
      cy += cardH + gap;
    }
    const def = FACILITY_TYPES[t.type];
    const cost = upgradeCost(t.type, 1);
    const canAfford = canAffordCost(state.res, cost);
    const hover = inRect(ui.pointer.x, ui.pointer.y, cx, cy, cardW, cardH);
    fillRoundRect(
      ctx,
      cx,
      cy,
      cardW,
      cardH,
      T.radiusSm,
      hover ? T.panelHi : T.panel,
      canAfford ? T.panelLine : T.danger,
      1
    );
    icon(ctx, t.icon, cx + cardW / 2, cy + 22, 24);
    text(ctx, t.name, cx + cardW / 2, cy + 44, {
      size: T.fontXs,
      color: T.text,
      align: "center",
      weight: "600",
    });
    text(ctx, costStr(cost), cx + cardW / 2, cy + 62, {
      size: T.fontXs,
      color: canAfford ? T.accent : T.danger,
      align: "center",
    });
    text(ctx, t.catLabel, cx + cardW / 2, cy + 78, {
      size: 10,
      color: T.textMute,
      align: "center",
    });
    if (hover && ui.pointer.pressed && canAfford) {
      state.modal = { type: "buildFacility", facilityType: t.type };
      ui.pointer.pressed = false;
    }
    cx += cardW + gap;
  });
}

// 升级确认模态
export function drawUpgradeModal(ctx, ui, state, W, H) {
  drawModalBackdrop(ctx, W, H);
  const fac = state.base.facilities.find((f) => f.id === state.modal.facId);
  if (!fac) {
    state.modal = null;
    return;
  }
  const def = FACILITY_TYPES[fac.type];
  const mw = 340;
  const mh = 280;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.panelLine, 2);

  icon(ctx, def.icon, mx + mw / 2, my + 40, 34);
  text(ctx, `${def.name}  Lv.${fac.level} → Lv.${fac.level + 1}`, mx + mw / 2, my + 70, {
    size: T.fontMd,
    color: T.text,
    align: "center",
    weight: "700",
  });

  const cost = upgradeCost(fac.type, fac.level);
  const canAfford = canAffordCost(state.res, cost);
  // 对比产出
  const cur = facilityStats(fac.type, fac.level);
  const next = facilityStats(fac.type, fac.level + 1);
  let yy = my + 104;
  text(ctx, "升级效果:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 22;
  for (const k in next.produces) {
    const r = RESOURCES[k];
    const c = cur.produces[k] || 0;
    const n = next.produces[k] || 0;
    text(ctx, `${r.icon} ${c.toFixed(2)} → ${n.toFixed(2)}/s`, mx + 24, yy, {
      size: T.fontSm,
      color: T.primary,
    });
    yy += 20;
  }

  text(ctx, `消耗: ${costStr(cost)}`, mx + 24, yy + 4, {
    size: T.fontSm,
    color: canAfford ? T.accent : T.danger,
    weight: "600",
  });

  const by = my + mh - 56;
  if (button(ctx, ui, mx + 24, by, 130, 40, "确认升级", {
    fontSize: T.fontSm,
    disabled: !canAfford,
  })) {
    spendCost(state.res, cost);
    fac.level += 1;
    addFloat(state, W / 2, my, `${def.icon} Lv.${fac.level}`, T.primary);
    addLog(state, `${def.name} 升级到 Lv.${fac.level}`, T.primary);
    state.stats.facilitiesBuilt += 1;
    state.modal = null;
  }
  if (button(ctx, ui, mx + mw - 154, by, 130, 40, "取消", {
    fontSize: T.fontSm,
    color: T.panelHi,
    textColor: T.text,
  })) {
    state.modal = null;
  }
}

// 建造确认模态
export function drawBuildModal(ctx, ui, state, W, H) {
  drawModalBackdrop(ctx, W, H);
  const type = state.modal.facilityType;
  const def = FACILITY_TYPES[type];
  const mw = 340;
  const mh = 300;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.panelLine, 2);

  icon(ctx, def.icon, mx + mw / 2, my + 40, 34);
  text(ctx, `建造 ${def.name}`, mx + mw / 2, my + 70, {
    size: T.fontLg,
    color: T.text,
    align: "center",
    weight: "700",
  });
  // 描述(换行)
  clipRound(ctx, mx + 20, my + 96, mw - 40, 70, T.radiusSm, () => {
    const lines = wrapLines(ctx, def.desc, mw - 48, T.fontSm);
    lines.forEach((l, i) =>
      text(ctx, l, mx + 24, my + 100 + i * 18, { size: T.fontSm, color: T.textDim })
    );
  });

  const cost = upgradeCost(type, 1);
  const canAfford = canAffordCost(state.res, cost);
  const stats = facilityStats(type, 1);
  let yy = my + 176;
  let prodText = "产出: ";
  for (const k in stats.produces) {
    const r = RESOURCES[k];
    prodText += `${r.icon}+${stats.produces[k].toFixed(2)} `;
  }
  text(ctx, prodText, mx + 24, yy, { size: T.fontSm, color: T.primary, weight: "600" });
  yy += 22;
  text(ctx, `消耗: ${costStr(cost)}`, mx + 24, yy, {
    size: T.fontSm,
    color: canAfford ? T.accent : T.danger,
    weight: "600",
  });

  const by = my + mh - 56;
  if (button(ctx, ui, mx + 24, by, 130, 40, "确认建造", {
    fontSize: T.fontSm,
    disabled: !canAfford,
  })) {
    spendCost(state.res, cost);
    const newId = (state.base.facilities.reduce((m, f) => Math.max(m, f.id), 0) || 0) + 1;
    state.base.facilities.push({ id: newId, type, level: 1, assigned: [] });
    addFloat(state, W / 2, my, `${def.icon} 已建造`, T.primary);
    addLog(state, `建造了 ${def.name}`, T.primary);
    state.stats.facilitiesBuilt += 1;
    markBuilt(state); // 引导埋点
    state.modal = null;
  }
  if (button(ctx, ui, mx + mw - 154, by, 130, 40, "取消", {
    fontSize: T.fontSm,
    color: T.panelHi,
    textColor: T.text,
  })) {
    state.modal = null;
  }
}

// ── 工具 ──
export function canAffordCost(res, cost) {
  for (const k in cost) {
    if ((res[k] || 0) < cost[k]) return false;
  }
  return true;
}

export function spendCost(res, cost) {
  for (const k in cost) {
    res[k] = (res[k] || 0) - cost[k];
  }
}

export function costStr(cost) {
  const map = { scrap: "🔩", parts: "⚙️", food: "🍖", water: "💧", power: "⚡", meds: "💊" };
  let s = "";
  for (const k in cost) s += `${map[k] || k}${cost[k]} `;
  return s.trim();
}

function drawModalBackdrop(ctx, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);
}

function wrapLines(ctx, str, maxWidth, size) {
  setFont(ctx, size, "400");
  const out = [];
  let cur = "";
  for (const ch of str) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) {
      out.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}
