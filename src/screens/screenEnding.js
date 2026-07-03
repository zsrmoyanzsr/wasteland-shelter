// 结局画面: 全屏沉浸式结局展示
import { THEME as T } from "../ui/theme.js";
import { fillRoundRect, text, icon, button, clipRound } from "../ui/ui.js";
import { ENDINGS } from "../content/endings.js";

export function drawEndingModal(ctx, ui, state, W, H) {
  const m = state.modal;
  const ending = ENDINGS[m.endingId];
  if (!ending) { state.modal = null; return; }

  // 全屏渐变背景(结局色调)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, ending.color);
  g.addColorStop(0.3, "#11131a");
  g.addColorStop(1, "#0a0c12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  // 大图标
  icon(ctx, ending.icon, cx, H * 0.18, 60);
  // "结局达成"
  text(ctx, "结局达成", cx, H * 0.28, { size: T.fontSm, color: ending.color, align: "center", weight: "600" });
  // 结局名称
  text(ctx, ending.name, cx, H * 0.33, { size: T.fontXxl, color: T.text, align: "center", weight: "800" });
  // 副标题
  text(ctx, ending.title, cx, H * 0.40, { size: T.fontMd, color: ending.color, align: "center", weight: "600" });

  // 描述(居中换行)
  const descY = H * 0.46;
  clipRound(ctx, W * 0.08, descY, W * 0.84, H * 0.28, T.radiusLg, () => {
    ctx.font = `400 ${T.fontSm}px ${T.fontFamily}`;
    ctx.fillStyle = T.textDim;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    // 按宽度换行
    const maxW = W * 0.78;
    let line = "", ly = descY + 16;
    for (const ch of ending.desc) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, ly);
        ly += 22;
        line = ch;
      } else { line = test; }
    }
    if (line) ctx.fillText(line, cx, ly);
  });

  // 统计
  const statY = H * 0.78;
  const stats = [
    `第 ${state.day} 天`,
    `${state.survivors.filter(s => s.busy !== "dead").length} 名幸存者`,
    `基地 Lv.${state.base.level}`,
    `${state.prestige.unlockedEndings.length}/4 结局`,
  ];
  text(ctx, stats.join("  ·  "), cx, statY, { size: T.fontXs, color: T.textMute, align: "center" });

  // 世代传承提示
  if (state.prestige.unlockedEndings.length === 1) {
    text(ctx, "🎉 首次达成结局! 下一周目获得 +5% 永久产出加成", cx, statY + 22, {
      size: T.fontXs, color: T.accent, align: "center", weight: "600",
    });
  }

  // 按钮: 继续游戏 / 回到主菜单
  const by = H - 70;
  if (button(ctx, ui, cx - 130, by, 120, 40, "继续游戏", { fontSize: T.fontSm, color: T.panelHi, textColor: T.text })) {
    state.modal = null;
  }
  if (button(ctx, ui, cx + 10, by, 120, 40, "回到标题", { fontSize: T.fontSm })) {
    // 世代传承: 更新 bonusMult(每达成一个结局+5%)
    const endings = state.prestige.unlockedEndings.length;
    state.prestige.bonusMult = endings * 0.05;
    state.prestige.generation = Math.max(state.prestige.generation, 2); // 至少第2代
    state.screen = "start";
    state.modal = null;
  }
}
