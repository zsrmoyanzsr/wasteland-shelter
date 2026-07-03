// HUD: 顶部资源条 + 底部导航栏
// 即时模式: 每帧重绘

import { THEME as T, RESOURCES, RESOURCE_ORDER } from "../ui/theme.js";
import {
  fillRoundRect,
  text,
  textTrunc,
  icon,
  inRect,
  fmtNum,
  panelGradient,
  setFont,
  rgba,
} from "../ui/ui.js";
import { SCREEN } from "../engine/state.js";
import { populationCap } from "../content/survivors.js";

const NAV_ITEMS = [
  { screen: SCREEN.BASE, label: "基地", icon: "🏠" },
  { screen: SCREEN.MAP, label: "地图", icon: "🗺️" },
  { screen: SCREEN.ROSTER, label: "居民", icon: "🧑" },
  { screen: SCREEN.DISPATCH, label: "派遣", icon: "🚀" },
  { screen: SCREEN.TASKS, label: "任务", icon: "📜" },
];

// 顶部资源条高度
export const HUD_TOP_H = 56;
// 底部导航高度(窄屏用)
export const HUD_BOTTOM_H = 68;
// 宽屏左侧导航栏宽度
export const SIDEBAR_W = 96;

// 是否宽屏布局(左侧栏)
export function isWideLayout() {
  return document.querySelector("canvas")?.dataset.isWide === "1";
}

// 计算内容区域
// 窄屏: 扣除顶部条+底部导航,内容占满宽度
// 宽屏: 扣除顶部条+左侧栏,内容从侧栏右侧开始,底部留16px呼吸空间(无底部导航天然留白)
export function contentRect(W, H) {
  if (isWideLayout()) {
    return {
      x: SIDEBAR_W,
      y: HUD_TOP_H,
      w: W - SIDEBAR_W,
      h: H - HUD_TOP_H - 16, // 宽屏无底部导航,主动留底部留白避免内容贴屏幕底
    };
  }
  return {
    x: 0,
    y: HUD_TOP_H,
    w: W,
    h: H - HUD_TOP_H - HUD_BOTTOM_H,
  };
}

// 绘制顶部资源条
export function drawTopBar(ctx, state, W) {
  const wide = isWideLayout();
  const barX = wide ? SIDEBAR_W : 0;
  const barW = wide ? W - SIDEBAR_W : W;
  // 背景
  panelGradient(ctx, barX, 0, barW, HUD_TOP_H, 0);
  // 分隔线
  fillRoundRect(ctx, barX, HUD_TOP_H - 2, barW, 2, 0, T.panelLine);

  // 左侧: 天数 + 人口 (宽屏从侧栏右侧开始)
  const pop = state.survivors.filter((s) => s.busy !== "dead").length;
  const cap = populationCap(state.base.level);
  let x = barX + 14;
  text(ctx, `第 ${state.day} 天`, x, 10, { size: T.fontSm, color: T.textDim, weight: "600" });
  text(ctx, `👥 ${pop}/${cap}`, x, 28, { size: T.fontSm, color: T.text, weight: "600" });
  x += 72;

  // 资源芯片(自适应宽度)
  const chipW = Math.min(78, (barX + barW - x - 8) / RESOURCE_ORDER.length);
  for (const key of RESOURCE_ORDER) {
    const r = RESOURCES[key];
    if (!r) continue;
    const val = Math.floor(state.res[key] || 0);
    const capv = state.resCap[key] || 0;
    const low = val < capv * 0.15;
    fillRoundRect(ctx, x, 8, chipW - 4, 40, T.radiusSm, T.panel, T.panelLine, 1);
    icon(ctx, r.icon, x + 16, 28, 18);
    text(ctx, fmtNum(val), x + 30, 14, {
      size: T.fontSm,
      color: low ? T.danger : T.text,
      weight: "700",
    });
    text(ctx, fmtNum(capv), x + 30, 32, { size: T.fontXs, color: T.textMute });
    x += chipW;
    if (x + chipW > barX + barW - 8) break;
  }
}

// 绘制导航(宽屏=左侧竖栏,窄屏=底部横栏)
export function drawBottomNav(ctx, state, ui, W, H) {
  if (isWideLayout()) {
    drawSidebar(ctx, state, ui, W, H);
  } else {
    drawBottomBar(ctx, state, ui, W, H);
  }
}

// 宽屏: 左侧竖向导航栏
function drawSidebar(ctx, state, ui, W, H) {
  // 侧栏背景(从顶到底)
  panelGradient(ctx, 0, 0, SIDEBAR_W, H, 0);
  fillRoundRect(ctx, SIDEBAR_W - 2, 0, 2, H, 0, T.panelLine);

  // 顶部 logo 区
  icon(ctx, "☢️", SIDEBAR_W / 2, 30, 24);
  text(ctx, "废土", SIDEBAR_W / 2, 52, { size: 10, color: T.accent, align: "center", weight: "700" });

  // 导航项(竖向排列)
  const itemH = 72;
  const startY = 90;
  for (let i = 0; i < NAV_ITEMS.length; i++) {
    const item = NAV_ITEMS[i];
    const iy = startY + i * itemH;
    const active = state.tab === item.screen;
    const hover = inRect(ui.pointer.x, ui.pointer.y, 0, iy, SIDEBAR_W, itemH);

    // 激活高亮(左侧竖条 + 背景色块)
    if (active) {
      fillRoundRect(ctx, 0, iy + 6, 4, itemH - 12, 2, T.primary);
      fillRoundRect(ctx, 8, iy + 6, SIDEBAR_W - 16, itemH - 12, T.radiusSm, rgba(T.primary, 0.12));
    } else if (hover) {
      fillRoundRect(ctx, 8, iy + 6, SIDEBAR_W - 16, itemH - 12, T.radiusSm, T.panelHi);
    }
    const ic = active ? T.primary : hover ? T.text : T.textDim;
    icon(ctx, item.icon, SIDEBAR_W / 2, iy + itemH / 2 - 8, active ? 26 : 24);
    setFont(ctx, T.fontXs, "600");
    ctx.fillStyle = ic;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(item.label, SIDEBAR_W / 2, iy + itemH / 2 + 14);

    // 红点
    const badgeX = SIDEBAR_W / 2 + 18;
    const badgeY = iy + itemH / 2 - 14;
    if (item.screen === SCREEN.TASKS && state.tasks.some((t) => t.done && !t.claimed)) {
      ctx.beginPath(); ctx.arc(badgeX, badgeY, 5, 0, Math.PI * 2); ctx.fillStyle = T.danger; ctx.fill();
    }
    if (item.screen === SCREEN.DISPATCH && state.expeditions.some((e) => e.state === "done")) {
      ctx.beginPath(); ctx.arc(badgeX, badgeY, 5, 0, Math.PI * 2); ctx.fillStyle = T.accent; ctx.fill();
    }

    if (hover && ui.pointer.pressed) {
      state.tab = item.screen;
      state.screen = item.screen;
      ui.pointer.pressed = false;
    }
  }
}

// 窄屏: 底部横向导航栏
function drawBottomBar(ctx, state, ui, W, H) {
  const y = H - HUD_BOTTOM_H;
  panelGradient(ctx, 0, y, W, HUD_BOTTOM_H, 0);
  fillRoundRect(ctx, 0, y, W, 2, 0, T.panelLine);

  const itemW = W / NAV_ITEMS.length;
  for (let i = 0; i < NAV_ITEMS.length; i++) {
    const item = NAV_ITEMS[i];
    const ix = i * itemW;
    const active = state.tab === item.screen;
    const hover = inRect(ui.pointer.x, ui.pointer.y, ix, y, itemW, HUD_BOTTOM_H);

    if (active) {
      fillRoundRect(ctx, ix + itemW * 0.3, y + 4, itemW * 0.4, 3, 2, T.primary);
    }
    const ic = active ? T.primary : hover ? T.text : T.textDim;
    icon(ctx, item.icon, ix + itemW / 2, y + 26, active ? 24 : 22);
    setFont(ctx, T.fontXs, "600");
    ctx.fillStyle = ic;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(item.label, ix + itemW / 2, y + 46);

    if (item.screen === SCREEN.TASKS) {
      const claimable = state.tasks.some((t) => t.done && !t.claimed);
      if (claimable) {
        ctx.beginPath(); ctx.arc(ix + itemW / 2 + 16, y + 14, 5, 0, Math.PI * 2); ctx.fillStyle = T.danger; ctx.fill();
      }
    }
    if (item.screen === SCREEN.DISPATCH) {
      const doneExp = state.expeditions.some((e) => e.state === "done");
      if (doneExp) {
        ctx.beginPath(); ctx.arc(ix + itemW / 2 + 16, y + 14, 5, 0, Math.PI * 2); ctx.fillStyle = T.accent; ctx.fill();
      }
    }
    if (hover && ui.pointer.pressed) {
      state.tab = item.screen;
      state.screen = item.screen;
      ui.pointer.pressed = false;
    }
  }
}
