// 头像加载系统 (v2: 内联 base64,零网络零时序依赖)
// 12 张萌系女性立绘已内联在 avatars_inlined.js,启动即同步就绪
// 同时仍支持外部图: public/avatars/*.png (manifest.json 列出),有则覆盖

import { INLINED_AVATARS, HERO_AVATAR } from "../content/avatars_inlined.js";

let _images = []; // 已就绪的 Image 数组(内联图同步创建,外部图异步补充)
let _loaded = false;
let _heroImage = null; // 主角立绘

// 从 base64 同步创建 Image(立即可用)
function imageFromDataUrl(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  // base64 data URL 解码极快,complete 通常在下一 tick 即 true
  return img;
}

// 初始化: 把内联图全部转成 Image(同步),外部图异步补充
export function initAvatars() {
  if (_loaded) return;
  _loaded = true;
  // 内联图: 同步创建
  const keys = Object.keys(INLINED_AVATARS);
  _images = keys.map((k) => imageFromDataUrl(INLINED_AVATARS[k]));
  // 主角立绘(内联同步)
  if (HERO_AVATAR) _heroImage = imageFromDataUrl(HERO_AVATAR);
  // 预解码所有内联图,确保第一次渲染时 complete=true
  for (const img of _images) {
    if (img.decode) img.decode().catch(() => {});
  }
  if (_heroImage && _heroImage.decode) _heroImage.decode().catch(() => {});
  // 外部图: 异步尝试加载,成功则覆盖(可选)
  loadExternalAvatars();
}

async function loadExternalAvatars() {
  try {
    // BASE_URL: vite 注入,本地为 './',GitHub Pages 为 '/wasteland-shelter/'
    const base = import.meta.env.BASE_URL;
    const resp = await fetch(base + "avatars/manifest.json");
    if (!resp.ok) return;
    const list = await resp.json();
    if (!Array.isArray(list) || list.length === 0) return;
    // 外部图存在则替换内联图(让用户能覆盖)
    const ext = await Promise.all(
      list.map((name) => loadImage(base + "avatars/" + name))
    );
    const ok = ext.filter((img) => img && img.naturalWidth > 0);
    if (ok.length > 0) _images = ok;
    // 外部主角立绘(若有则覆盖)
    const heroExt = await loadImage(base + "avatars/hero.png");
    if (heroExt && heroExt.naturalWidth > 0) _heroImage = heroExt;
  } catch {
    /* 忽略,用内联图 */
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// 兼容旧接口: 返回 Promise
export async function preloadAvatars() {
  initAvatars();
  // 等一帧让 data URL 解码
  await new Promise((r) => setTimeout(r, 16));
  return;
}

// 给幸存者分配确定性头像
export function getAvatarImage(id, name) {
  if (_images.length === 0) initAvatars();
  if (_images.length === 0) return null;
  const seed = String(id) + (name || "");
  let h = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  const idx = (h >>> 0) % _images.length;
  return _images[idx];
}

export function hasAvatarImages() {
  if (!_loaded) initAvatars();
  return _images.length > 0;
}

// 主角立绘(指挥官)
export function getHeroImage() {
  if (!_loaded) initAvatars();
  return _heroImage;
}
