// 开始屏幕: 标题 + 开始/继续按钮 + 简介
import { THEME as T } from "../ui/theme.js";
import { fillRoundRect, text, textCenter, button, icon, panelGradient } from "../ui/ui.js";
import { hasSave } from "../engine/save.js";

export function drawStartScreen(ctx, state, ui, W, H) {
  // 渐变背景
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, T.bgGradTop);
  g.addColorStop(1, T.bgGradBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 远景废墟剪影(简单几何)
  ctx.fillStyle = "rgba(60,65,80,0.4)";
  for (let i = 0; i < 6; i++) {
    const bx = (i / 6) * W + 20;
    const bw = W / 8;
    const bh = 40 + (i % 3) * 30;
    ctx.fillRect(bx, H - 120 - bh, bw, bh);
    // 窗户
    ctx.fillStyle = "rgba(240,169,59,0.15)";
    for (let wy = 0; wy < bh - 20; wy += 22) {
      for (let wx = 0; wx < bw - 16; wx += 20) {
        if ((wx + wy + i) % 3 === 0) ctx.fillRect(bx + wx + 6, H - 120 - bh + wy + 6, 8, 8);
      }
    }
    ctx.fillStyle = "rgba(60,65,80,0.4)";
  }

  // 标题面板
  const pw = Math.min(440, W - 40);
  const ph = 360;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2 - 20;
  fillRoundRect(ctx, px, py, pw, ph, T.radiusLg, "rgba(31,35,46,0.92)", T.panelLine, 1);

  // 标题
  icon(ctx, "☢️", W / 2, py + 56, 44);
  text(ctx, "废土避难所", W / 2, py + 96, {
    size: 30,
    color: T.text,
    align: "center",
    weight: "800",
  });
  text(ctx, "WASTELAND  SHELTER", W / 2, py + 134, {
    size: 11,
    color: T.accent,
    align: "center",
    weight: "600",
  });

  // 简介框
  const introY = py + 168;
  fillRoundRect(ctx, px + 24, introY, pw - 48, 76, T.radiusSm, T.bg, T.panelLine, 1);
  const lines = [
    "核灾之后,你接管了一座避难所。",
    "招募幸存者,派遣他们探索废土,",
    "收集资源,建设堡垒,在末日中生存。",
  ];
  lines.forEach((l, i) => {
    text(ctx, l, W / 2, introY + 14 + i * 20, {
      size: T.fontSm,
      color: T.textDim,
      align: "center",
    });
  });

  // 按钮
  const bw = pw - 60;
  const bx = (W - bw) / 2;
  const continueExists = hasSave();
  let by = py + ph - 84;
  if (continueExists) {
    if (button(ctx, ui, bx, by, bw, 46, "▶  继续游戏", { fontSize: T.fontMd })) {
      state._loadRequested = true;
    }
    by -= 54;
    if (button(ctx, ui, bx, by, bw, 38, "新建游戏(覆盖存档)", {
      fontSize: T.fontSm,
      color: T.panelHi,
      textColor: T.textDim,
    })) {
      state._newGameRequested = true;
    }
  } else {
    if (button(ctx, ui, bx, by, bw, 50, "▶  开始新游戏", { fontSize: T.fontLg, glow: true })) {
      state._newGameRequested = true;
    }
  }

  // 底部提示
  text(ctx, "H5 经营 · 招募/派遣/建设/挂机", W / 2, H - 24, {
    size: T.fontXs,
    color: T.textMute,
    align: "center",
  });
}
