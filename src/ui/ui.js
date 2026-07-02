// 即时模式 UI 绘制原语
// 所有函数直接在传入的 ctx 上绘制,返回交互信息(命中/悬停)
// 布局通过共享 ctx.__layout 栈管理(简单版:手动传 rect)

import { THEME as T } from "./theme.js";

// ── 基础形状 ──────────────────────────────────────────

export function roundRect(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  r = Math.max(0, r);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth) {
  roundRect(ctx, x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }
}

// 渐变面板背景(顶到底)
export function panelGradient(ctx, x, y, w, h, r) {
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, T.panelAlt);
  g.addColorStop(1, T.panel);
  ctx.fillStyle = g;
  ctx.fill();
}

// ── 文本 ─────────────────────────────────────────────

// 设置字体
export function setFont(ctx, size, weight = "400") {
  ctx.font = `${weight} ${size}px ${T.fontFamily}`;
}

// 单行文本(返回实际绘制宽度)
export function text(ctx, str, x, y, opts = {}) {
  setFont(ctx, opts.size || T.fontSm, opts.weight || "400");
  ctx.fillStyle = opts.color || T.text;
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = opts.baseline || "top";
  ctx.fillText(String(str), x, y);
  return ctx.measureText(String(str)).width;
}

// 带省略的截断文本
export function textTrunc(ctx, str, x, y, maxWidth, opts = {}) {
  setFont(ctx, opts.size || T.fontSm, opts.weight || "400");
  let s = String(str);
  if (ctx.measureText(s).width <= maxWidth) {
    return text(ctx, s, x, y, opts);
  }
  while (s.length > 0 && ctx.measureText(s + "…").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return text(ctx, s + "…", x, y, opts);
}

// 中文/英文混合的粗略换行
export function textWrap(ctx, str, x, y, maxWidth, lineHeight, opts = {}) {
  setFont(ctx, opts.size || T.fontSm, opts.weight || "400");
  ctx.fillStyle = opts.color || T.text;
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = opts.baseline || "top";
  let lineY = y;
  const paragraphs = String(str).split("\n");
  for (const para of paragraphs) {
    let cur = "";
    for (const ch of para) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
        ctx.fillText(cur, x, lineY);
        lineY += lineHeight;
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) {
      ctx.fillText(cur, x, lineY);
      lineY += lineHeight;
    }
  }
  return lineY - y; // 返回总高度
}

// 居中文字于矩形
export function textCenter(ctx, str, rx, ry, rw, rh, opts = {}) {
  setFont(ctx, opts.size || T.fontSm, opts.weight || "400");
  ctx.fillStyle = opts.color || T.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(str), rx + rw / 2, ry + rh / 2 + (opts.dy || 0));
}

// Emoji 图标(大号)
export function icon(ctx, emoji, x, y, size, opts = {}) {
  setFont(ctx, size, "400");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  ctx.fillText(emoji, x, y);
  ctx.globalAlpha = 1;
}

// ── 交互元素 ─────────────────────────────────────────

// 点是否在矩形内
export function inRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

// 按钮(即时模式)。ui 是 {pointer:{x,y,down,pressed}} 的引用
// 返回 true 当且仅当本次点击命中按钮(单次触发)
export function button(ctx, ui, x, y, w, h, label, opts = {}) {
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  const disabled = opts.disabled;
  const baseColor = opts.color || T.primary;
  let fill = baseColor;
  if (disabled) {
    fill = T.panelHi;
  } else if (hover) {
    fill = shade(baseColor, hover ? 1.12 : 1);
  }
  fillRoundRect(ctx, x, y, w, h, opts.radius || T.radiusSm, fill);
  if (opts.glow && hover && !disabled) {
    ctx.save();
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 12;
    fillRoundRect(ctx, x, y, w, h, opts.radius || T.radiusSm, fill);
    ctx.restore();
  }
  setFont(ctx, opts.fontSize || T.fontMd, opts.fontWeight || "600");
  ctx.fillStyle = disabled ? T.textMute : opts.textColor || "#0e1016";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(label), x + w / 2, y + h / 2);
  // 触发:按下时悬停命中
  const clicked = hover && ui.pointer.pressed && !disabled;
  return clicked;
}

// 图标按钮(Emoji + 可选文字)
export function iconButton(ctx, ui, x, y, w, h, emoji, opts = {}) {
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  const disabled = opts.disabled;
  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    opts.radius || T.radiusSm,
    disabled ? T.panel : hover ? T.panelHi : T.panelAlt,
    opts.stroke || T.panelLine,
    1
  );
  icon(ctx, emoji, x + w / 2, y + h / 2 - (opts.label ? 6 : 0), opts.iconSize || 22);
  if (opts.label) {
    text(ctx, opts.label, x + w / 2, y + h - 14, {
      size: T.fontXs,
      color: disabled ? T.textMute : T.textDim,
      align: "center",
    });
  }
  const clicked = hover && ui.pointer.pressed && !disabled;
  return clicked;
}

// 进度条
export function progressBar(ctx, x, y, w, h, ratio, opts = {}) {
  ratio = Math.max(0, Math.min(1, ratio));
  fillRoundRect(ctx, x, y, w, h, h / 2, T.bg);
  if (ratio > 0) {
    const col = opts.color || T.primary;
    fillRoundRect(ctx, x, y, Math.max(h, w * ratio), h, h / 2, col);
  }
  if (opts.label) {
    text(ctx, opts.label, x + w / 2, y + h / 2, {
      size: opts.fontSize || T.fontXs,
      color: opts.labelColor || T.text,
      align: "center",
      baseline: "middle",
      weight: "600",
    });
  }
}

// 资源徽标: 图标 + 数值 + 可选增量
export function resourceChip(ctx, icon, value, x, y, w, h, opts = {}) {
  fillRoundRect(ctx, x, y, w, h, T.radiusSm, T.panel, T.panelLine, 1);
  icon_draw(ctx, icon, x + h * 0.55, y + h / 2, h * 0.6);
  text(ctx, fmtNum(value), x + h * 0.95, y + h / 2, {
    size: opts.size || T.fontSm,
    color: opts.color || T.text,
    baseline: "middle",
    weight: "600",
  });
}

// 小图标别名(避免与上方 icon 函数名冲突的内部用)
function icon_draw(ctx, emoji, x, y, size) {
  setFont(ctx, size, "400");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x, y);
}

// ── 工具 ─────────────────────────────────────────────

// 数字格式化: 大数转 k/M
export function fmtNum(n) {
  n = Math.floor(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

// 颜色变亮/变暗(简单 RGB 缩放),factor>1 变亮
export function shade(hex, factor) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

export function rgba(hex, a) {
  const c = hexToRgb(hex);
  return c ? `rgba(${c.r},${c.g},${c.b},${a})` : hex;
}

// 圆角裁剪辅助: 执行 fn 内容裁剪到圆角矩形内
export function clipRound(ctx, x, y, w, h, r, fn) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  fn();
  ctx.restore();
}
