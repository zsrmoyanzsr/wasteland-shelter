// 引导横幅: 在内容区顶部显示当前提示,可手动关闭
// 轻量、非阻塞(不像模态那样挡住操作),玩家可无视它继续游戏
import { THEME as T } from "./theme.js";
import { fillRoundRect, text, icon, inRect } from "./ui.js";
import { currentGuide, dismissGuide } from "../engine/guide.js";

// 绘制引导横幅,返回所占高度(无提示返回0)
// 放在内容区 (x, y) 处,宽度 w
export function drawGuideBanner(ctx, ui, state, x, y, w) {
  const g = currentGuide(state);
  if (!g) return 0;
  // 只在目标屏或全局提示(无 targetScreen)时显示,避免在不相关屏打扰
  if (g.targetScreen && state.screen !== g.targetScreen) return 0;

  const h = 56;
  const pad = 10;
  // 背景(暖色调高亮,引人注意但不刺眼)
  fillRoundRect(ctx, x, y, w, h, T.radius, "rgba(240,169,59,0.12)", T.accent, 1.5);
  icon(ctx, g.icon, x + 26, y + h / 2, 24);
  text(ctx, g.title, x + 50, y + 10, { size: T.fontSm, color: T.accent, weight: "700" });
  // 描述(单行省略,避免过长)
  let desc = g.desc;
  ctx.font = `400 ${T.fontXs}px ${T.fontFamily}`;
  while (ctx.measureText(desc).width > w - 90 && desc.length > 4) desc = desc.slice(0, -2) + "…";
  text(ctx, desc, x + 50, y + 30, { size: T.fontXs, color: T.textDim });

  // 关闭按钮 ✕
  const closeX = x + w - 26;
  const closeHover = inRect(ui.pointer.x, ui.pointer.y, x + w - 38, y + 8, 28, 28);
  if (closeHover) {
    fillRoundRect(ctx, x + w - 38, y + 8, 28, 28, T.radiusSm, T.panelHi);
  }
  text(ctx, "✕", closeX, y + h / 2, {
    size: T.fontSm, color: closeHover ? T.text : T.textMute,
    align: "center", baseline: "middle", weight: "600",
  });
  if (closeHover && ui.pointer.pressed) {
    dismissGuide(state, g.id);
    ui.pointer.pressed = false;
  }
  return h + pad;
}
