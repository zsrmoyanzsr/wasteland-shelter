// 开始屏幕: 标题 + 开始/继续按钮 + 简介 + 存档码导入导出
import { THEME as T } from "../ui/theme.js";
import { fillRoundRect, text, textCenter, button, icon, panelGradient, clipRound } from "../ui/ui.js";
import { hasSave } from "../engine/save.js";
import { exportSaveCode, importSaveCode } from "../engine/cloudSave.js";
import { saveGame } from "../engine/save.js";

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

  // 存档码: 导出/导入(跨设备转移进度)
  const saveRowY = py + ph - 28;
  if (button(ctx, ui, bx, saveRowY, bw / 2 - 6, 26, "📤 导出存档", {
    fontSize: T.fontXs, color: T.panelHi, textColor: T.textDim,
  })) {
    handleExport(state);
  }
  if (button(ctx, ui, bx + bw / 2 + 6, saveRowY, bw / 2 - 6, 26, "📥 导入存档", {
    fontSize: T.fontXs, color: T.panelHi, textColor: T.textDim,
  })) {
    handleImport(state);
  }

  // 底部提示
  text(ctx, "H5 经营 · 招募/派遣/建设/挂机", W / 2, H - 24, {
    size: T.fontXs,
    color: T.textMute,
    align: "center",
  });

  // 导出码显示模态
  if (state._exportCode) drawExportCodeModal(ctx, ui, state, W, H);
}

// 导出处理: 生成存档码,尝试复制到剪贴板,弹模态显示
async function handleExport(state) {
  // 导出当前游戏状态(如果有存档从localStorage读,否则用当前state)
  const cur = window.__game?.state || state;
  if (!cur || !cur.res) {
    alert("还没有游戏进度可导出,请先开始游戏。");
    return;
  }
  try {
    const code = await exportSaveCode(cur);
    state._exportCode = code;
    // 尝试自动复制到剪贴板
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(
        () => console.log("存档码已复制到剪贴板"),
        () => {} // 复制失败也不影响,玩家可手动从模态复制
      );
    }
  } catch (e) {
    alert("导出失败: " + e.message);
  }
}

// 导入处理: prompt 粘贴存档码,校验后写入
async function handleImport(state) {
  const code = prompt("请粘贴存档码(以 WS- 开头):", "");
  if (!code) return;
  try {
    const imported = await importSaveCode(code);
    // 写入 localStorage 让 loadGame 读取,然后请求重新加载
    const payload = { version: imported.version, savedAt: Date.now(), state: imported };
    // cells 需转成 __u8 格式(serializeState 那样的)
    localStorage.setItem("wasteland_shelter_save_v2", JSON.stringify({
      version: imported.version, savedAt: Date.now(),
      state: JSON.parse(JSON.stringify(imported, (k, v) => v instanceof Uint8Array ? { __u8: Array.from(v) } : v)),
    }));
    alert("存档导入成功!点击「继续游戏」恢复进度。");
    // 刷新页面让游戏重新加载存档
    setTimeout(() => location.reload(), 800);
  } catch (e) {
    alert("导入失败: " + e.message);
  }
}

// 导出码显示模态(玩家可手动复制)
function drawExportCodeModal(ctx, ui, state, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  const mw = Math.min(380, W - 32);
  const mh = 320;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.primary, 2);
  icon(ctx, "📤", mx + mw / 2, my + 36, 30);
  text(ctx, "你的存档码", mx + mw / 2, my + 64, { size: T.fontLg, color: T.text, align: "center", weight: "700" });
  text(ctx, navigator.clipboard ? "已复制到剪贴板,也可手动复制下方文本" : "请复制下方文本保存", mx + mw / 2, my + 88, {
    size: T.fontXs, color: T.textDim, align: "center",
  });
  // 存档码显示框(可滚动/换行)
  const codeY = my + 110;
  const codeH = 140;
  fillRoundRect(ctx, mx + 20, codeY, mw - 40, codeH, T.radiusSm, T.bg, T.panelLine, 1);
  clipRound(ctx, mx + 24, codeY + 6, mw - 48, codeH - 12, T.radiusSm, () => {
    ctx.font = `400 ${T.fontXs}px monospace`;
    ctx.fillStyle = T.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    // 按字符宽度换行显示
    const code = state._exportCode;
    const maxW = mw - 56;
    let line = "", ly = codeY + 10;
    for (const ch of code) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, mx + 28, ly);
        ly += 16;
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, mx + 28, ly);
  });
  // 提示
  text(ctx, "换设备时:打开游戏 → 导入存档 → 粘贴此码", mx + mw / 2, my + mh - 56, {
    size: T.fontXs, color: T.accent, align: "center", weight: "600",
  });
  // 关闭按钮
  if (button(ctx, ui, mx + mw / 2 - 60, my + mh - 40, 120, 32, "关闭", { fontSize: T.fontSm })) {
    state._exportCode = null;
  }
}
