// 程序化女性角色头像绘制
// 基于 survivor 的稳定属性(id/name)生成确定性的外貌:脸型/肤色/发型发色/五官/表情
// 风格: 扁平 + 轻微二次元感(大眼、小嘴、柔和肤色),与游戏整体统一
// 同时支持外部图片: 若 survivor.avatarImg 指向已加载的 Image,优先绘制图片

import { roundRect } from "./ui.js";

// 调色板
const SKIN_TONES = [
  "#ffe0d0", "#f8d0b0", "#f0c0a0", "#e0b090", "#d0a080", "#c09070",
];
const HAIR_COLORS = [
  "#2a1a1a", "#4a2818", "#6b3a1a", "#8b5a2b", // 黑/棕系
  "#c9a86a", "#e0c14a", "#f5d76e", // 金/棕黄
  "#b07060", "#9b5a5a", // 红棕
  "#7b4ba0", "#5a7bd5", "#6ab0a0", // 异色(紫/蓝/绿)二次元感
];
const EYE_COLORS = ["#5a3a2a", "#4a6a8a", "#3a6a5a", "#6a4a6a", "#2a4a6a"];
const BG_COLORS = [
  "#4a3a5a", "#3a4a6a", "#5a4a3a", "#3a5a4a", "#5a3a4a", "#4a4a5a", "#6a4a3a",
];

// 简单确定性 hash → [0,1)
function hash01(str, salt) {
  let h = (salt | 0) ^ 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}

// 发型绘制(几种扁平发型)
function drawHair(ctx, cx, cy, size, style, color) {
  ctx.fillStyle = color;
  switch (style) {
    case 0: // 长直发(及肩)
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.05, size * 0.62, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      // 刘海
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.35, size * 0.5, size * 0.28, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 1: // 双马尾
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.05, size * 0.58, size * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      // 两侧马尾
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.55, cy + size * 0.1, size * 0.18, size * 0.4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.55, cy + size * 0.1, size * 0.18, size * 0.4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // 刘海
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.32, size * 0.46, size * 0.24, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 2: // 短发/波波头
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.12, size * 0.56, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.3, size * 0.48, size * 0.26, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 3: // 高马尾(单)
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.08, size * 0.55, size * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      // 顶部马尾束
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.62, size * 0.2, size * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.3, size * 0.46, size * 0.24, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 4: // 中分长卷
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.6, size * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      // 中分线
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.5);
      ctx.lineTo(cx, cy - size * 0.1);
      ctx.stroke();
      break;
  }
}

// 眼睛(二次元大眼)
function drawEye(ctx, ex, ey, size, eyeColor, look) {
  // 眼白
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(ex, ey, size * 0.1, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // 虹膜
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.ellipse(ex + look, ey + size * 0.02, size * 0.085, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // 瞳孔
  ctx.fillStyle = "#1a1010";
  ctx.beginPath();
  ctx.ellipse(ex + look, ey + size * 0.02, size * 0.045, size * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  // 高光
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(ex + look - size * 0.02, ey - size * 0.04, size * 0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + look + size * 0.03, ey + size * 0.05, size * 0.012, 0, Math.PI * 2);
  ctx.fill();
  // 上眼线
  ctx.strokeStyle = "#2a1a1a";
  ctx.lineWidth = Math.max(1.5, size * 0.012);
  ctx.beginPath();
  ctx.moveTo(ex - size * 0.1, ey - size * 0.13);
  ctx.quadraticCurveTo(ex, ey - size * 0.16, ex + size * 0.1, ey - size * 0.13);
  ctx.stroke();
}

// 主绘制: 在 (cx,cy) 中心,半径 size 画一个圆形女性头像
// survivor: 含 id,name; 也可含 avatarImg(Image|null)
export function drawAvatar(ctx, cx, cy, size, survivor) {
  ctx.save();
  // 圆形裁剪
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.clip();

  // 若有外部图片,优先绘制图片(cover 填充)
  if (survivor && survivor.avatarImg && survivor.avatarImg.complete && survivor.avatarImg.naturalWidth > 0) {
    const img = survivor.avatarImg;
    const scale = Math.max((size * 2) / img.naturalWidth, (size * 2) / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
    // 圆形描边
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  // 程序化绘制
  const seed = String((survivor && survivor.id) || "x") + ((survivor && survivor.name) || "");
  const bg = BG_COLORS[Math.floor(hash01(seed, 1) * BG_COLORS.length)];
  const skin = SKIN_TONES[Math.floor(hash01(seed, 2) * SKIN_TONES.length)];
  const hair = HAIR_COLORS[Math.floor(hash01(seed, 3) * HAIR_COLORS.length)];
  const eyeColor = EYE_COLORS[Math.floor(hash01(seed, 4) * EYE_COLORS.length)];
  const hairStyle = Math.floor(hash01(seed, 5) * 5);
  const blush = hash01(seed, 6) > 0.4;
  const smile = hash01(seed, 7);
  const lookDir = (hash01(seed, 8) - 0.5) * size * 0.04;

  // 背景渐变
  const g = ctx.createRadialGradient(cx, cy - size * 0.2, size * 0.2, cx, cy, size * 1.3);
  g.addColorStop(0, bg);
  g.addColorStop(1, shade(bg, 0.6));
  ctx.fillStyle = g;
  ctx.fillRect(cx - size, cy - size, size * 2, size * 2);

  // 后发(脖子后的头发)
  ctx.fillStyle = shade(hair, 0.85);
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.15, size * 0.62, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 脖子
  ctx.fillStyle = shade(skin, 0.92);
  ctx.fillRect(cx - size * 0.18, cy + size * 0.55, size * 0.36, size * 0.4);

  // 脸(椭圆)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.05, size * 0.45, size * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头发(盖在脸上方)
  drawHair(ctx, cx, cy, size, hairStyle, hair);

  // 耳朵(部分发型露出)
  if (hairStyle === 2 || hairStyle === 3) {
    ctx.fillStyle = shade(skin, 0.95);
    ctx.beginPath();
    ctx.ellipse(cx - size * 0.44, cy + size * 0.1, size * 0.07, size * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + size * 0.44, cy + size * 0.1, size * 0.07, size * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 眉毛
  ctx.strokeStyle = shade(hair, 0.7);
  ctx.lineWidth = Math.max(1.5, size * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.2, cy - size * 0.05);
  ctx.quadraticCurveTo(cx - size * 0.13, cy - size * 0.1, cx - size * 0.07, cy - size * 0.06);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.07, cy - size * 0.06);
  ctx.quadraticCurveTo(cx + size * 0.13, cy - size * 0.1, cx + size * 0.2, cy - size * 0.05);
  ctx.stroke();

  // 眼睛
  drawEye(ctx, cx - size * 0.16, cy + size * 0.08, size, eyeColor, lookDir);
  drawEye(ctx, cx + size * 0.16, cy + size * 0.08, size, eyeColor, lookDir);

  // 鼻子(小)
  ctx.strokeStyle = shade(skin, 0.8);
  ctx.lineWidth = Math.max(1, size * 0.01);
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.15);
  ctx.lineTo(cx - size * 0.02, cy + size * 0.24);
  ctx.stroke();

  // 嘴(微笑/中性)
  ctx.strokeStyle = "#b05050";
  ctx.lineWidth = Math.max(1.5, size * 0.02);
  ctx.lineCap = "round";
  ctx.beginPath();
  const mouthY = cy + size * 0.36;
  const mouthCurve = size * 0.04 * (smile * 1.5);
  ctx.moveTo(cx - size * 0.09, mouthY);
  ctx.quadraticCurveTo(cx, mouthY + mouthCurve, cx + size * 0.09, mouthY);
  ctx.stroke();

  // 腮红
  if (blush) {
    ctx.fillStyle = "rgba(255,150,150,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx - size * 0.26, cy + size * 0.25, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + size * 0.26, cy + size * 0.25, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // 圆形描边(裁剪外)
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.stroke();
}

function shade(hex, f) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) * f);
  const g = Math.round(parseInt(m[2], 16) * f);
  const b = Math.round(parseInt(m[3], 16) * f);
  return `rgb(${r},${g},${b})`;
}
