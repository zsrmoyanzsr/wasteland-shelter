// 流浪商队交易模态: 全局模态(任何屏都能弹),展示3个高价值方案
import { THEME as T, RESOURCES } from "../ui/theme.js";
import { fillRoundRect, text, icon, inRect, button, rgba } from "../ui/ui.js";
import { takeOffer, departCaravan } from "../engine/caravan.js";

// 资源图标+数量显示
function resChip(ctx, resKey, amt, cx, cy, dim) {
  const r = RESOURCES[resKey];
  if (!r) return;
  icon(ctx, r.icon, cx - 14, cy, 18);
  text(ctx, `×${amt}`, cx + 6, cy, {
    size: T.fontSm,
    color: dim ? T.textMute : T.text,
    baseline: "middle",
    weight: "700",
  });
}

export function drawTradeModal(ctx, ui, state, W, H) {
  const c = state.caravan;
  // 商队不在场(已离开/状态异常)→ 关闭模态
  if (!c || !c.here) {
    state.modal = null;
    return;
  }
  // 半透明遮罩
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  const mw = Math.min(380, W - 24);
  const mh = 420;
  const mx = (W - mw) / 2;
  const my = Math.max(16, (H - mh) / 2);
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.accent, 2);

  // 标题
  icon(ctx, "🛒", mx + mw / 2, my + 38, 34);
  text(ctx, "流浪商队", mx + mw / 2, my + 68, {
    size: T.fontLg, color: T.text, align: "center", weight: "700",
  });
  text(ctx, "稀缺物资 · 限时交易", mx + mw / 2, my + 90, {
    size: T.fontXs, color: T.accent, align: "center", weight: "600",
  });

  // 剩余时间提示
  const remainDays = (c.leaveTimer / 120).toFixed(1);
  text(ctx, `停留剩余约 ${remainDays} 天`, mx + mw / 2, my + 110, {
    size: T.fontXs, color: T.textMute, align: "center",
  });

  // 3个交易方案(纵向排列)
  const offerY = my + 130;
  const offerH = 70;
  const offerGap = 8;
  for (let i = 0; i < c.offers.length; i++) {
    drawOffer(ctx, ui, state, c.offers[i], mx + 16, offerY + i * (offerH + offerGap), mw - 32, offerH);
  }

  // 底部: 离开按钮
  const by = my + mh - 56;
  if (button(ctx, ui, mx + 24, by, mw - 48, 42, "👋 送商队离开", {
    fontSize: T.fontSm,
    color: T.panelHi,
    textColor: T.text,
  })) {
    departCaravan(state, true);
  }
}

function drawOffer(ctx, ui, state, offer, x, y, w, h) {
  const canAfford = Object.entries(offer.give).every(([k, v]) => (state.res[k] || 0) >= v);
  const dim = offer.taken;
  if (dim) ctx.globalAlpha = 0.45;

  // 方案卡片背景
  fillRoundRect(ctx, x, y, w, h, T.radiusSm, T.panelAlt, offer.taken ? T.textMute : (canAfford ? T.primary : T.panelLine), 1);

  // 中线: 付出 | ⇄ | 获得
  const cy = y + h / 2;
  // 付出(左)
  const giveKey = Object.keys(offer.give)[0];
  resChip(ctx, giveKey, offer.give[giveKey], x + 60, cy, dim || !canAfford);
  text(ctx, "付出", x + 60, y + 10, {
    size: 10, color: T.textMute, align: "center", weight: "600",
  });
  // 交换箭头
  icon(ctx, "⇄", x + w / 2, cy, 18);
  // 获得(右)
  const getKey = Object.keys(offer.get)[0];
  resChip(ctx, getKey, offer.get[getKey], x + w - 60, cy, dim);
  text(ctx, "获得", x + w - 60, y + 10, {
    size: 10, color: T.accent, align: "center", weight: "600",
  });

  // 交易按钮(右下角内嵌)或已交易标记
  if (offer.taken) {
    icon(ctx, "✅", x + w - 24, y + h - 14, 14);
  } else {
    const btnW = 56, btnH = 24;
    const btnX = x + w - btnW - 8;
    const btnY = y + h - btnH - 6;
    const btnHover = inRect(ui.pointer.x, ui.pointer.y, btnX, btnY, btnW, btnH);
    fillRoundRect(ctx, btnX, btnY, btnW, btnH, T.radiusSm,
      canAfford ? (btnHover ? T.primary : rgba(T.primary, 0.85)) : T.panelHi);
    text(ctx, "交易", btnX + btnW / 2, btnY + btnH / 2, {
      size: T.fontXs,
      color: canAfford ? "#0e1016" : T.textMute,
      align: "center",
      baseline: "middle",
      weight: "700",
    });
    if (btnHover && ui.pointer.pressed && canAfford) {
      takeOffer(state, state.caravan.offers.indexOf(offer));
      ui.pointer.pressed = false;
    }
  }
  ctx.globalAlpha = 1;
}
