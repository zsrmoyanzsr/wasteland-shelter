// 科技树模态 + 背包查看模态
// 科技树: 显示3条线×5级,点击研发(消耗资源+物品)
// 背包: 显示所有物品分类
import { THEME as T, RESOURCES } from "../ui/theme.js";
import { fillRoundRect, text, icon, inRect, button, setFont, rgba, clipRound } from "../ui/ui.js";
import { TECH_TREE, techLevelDef } from "../content/tech.js";
import { ITEMS, ITEM_CATS, itemDef } from "../content/items.js";
import { canResearch, doResearch } from "../engine/techEngine.js";
import { canAffordItems } from "../engine/inventory.js";
import { ARTIFACTS, ARTIFACT_TIERS, artifactDef } from "../content/artifacts.js";
import { equipArtifact } from "../engine/artifactEngine.js";

// 科技树模态
export function drawTechTreeModal(ctx, ui, state, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  const mw = Math.min(400, W - 24);
  const mh = Math.min(600, H - 40);
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, "#e0588e", 2);
  icon(ctx, "🔬", mx + mw / 2, my + 34, 30);
  text(ctx, "研究中心", mx + mw / 2, my + 60, { size: T.fontLg, color: T.text, align: "center", weight: "700" });
  text(ctx, "消耗资源与材料,研发永久增益科技", mx + mw / 2, my + 80, { size: T.fontXs, color: T.textDim, align: "center" });

  // 3条科技线(纵向滚动)
  const listY = my + 100;
  const listH = mh - 100 - 56;
  // 滚动
  if (inRect(ui.pointer.x, ui.pointer.y, mx, listY, mw, listH)) {
    const wheel = ui.consumeWheel ? ui.consumeWheel() : 0;
    const drag = ui.consumeDragScroll ? ui.consumeDragScroll() : 0;
    if (wheel || drag) state._techScroll = Math.max(0, (state._techScroll || 0) + wheel * 0.5 + drag);
  }
  const branches = Object.values(TECH_TREE);
  // 每个分支卡片高度: 标题40 + 5级×56 + 间距 = 330,3个=990
  const cardH = 40 + 5 * 52 + 16;
  const totalH = branches.length * (cardH + 12);
  const maxScroll = Math.max(0, totalH - listH);
  state._techScroll = Math.min(state._techScroll || 0, maxScroll);
  const yOff = state._techScroll || 0;

  clipRound(ctx, mx + 8, listY, mw - 16, listH, T.radiusSm, () => {
    let cy = listY - yOff;
    for (const branch of branches) {
      drawTechBranch(ctx, ui, state, branch, mx + 12, cy, mw - 24, cardH);
      cy += cardH + 12;
    }
  });

  // 滚动条
  if (maxScroll > 0) {
    const trackX = mx + mw - 8;
    fillRoundRect(ctx, trackX, listY, 3, listH, 1.5, T.panelLine);
    const thumbH = Math.max(30, (listH / totalH) * listH);
    const thumbY = listY + (yOff / maxScroll) * (listH - thumbH);
    fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 1.5, T.textDim);
  }

  // 关闭
  if (button(ctx, ui, mx + mw / 2 - 60, my + mh - 44, 120, 34, "关闭", { fontSize: T.fontSm })) {
    state.modal = null;
  }
}

function drawTechBranch(ctx, ui, state, branch, x, y, w, h) {
  // 分支标题
  fillRoundRect(ctx, x, y, w, 36, T.radiusSm, T.panelAlt, branch.color, 1);
  icon(ctx, branch.icon, x + 22, y + 18, 20);
  text(ctx, branch.name, x + 44, y + 8, { size: T.fontMd, color: T.text, weight: "700" });
  text(ctx, branch.desc, x + 44, y + 24, { size: 10, color: T.textMute });
  // 当前等级
  const curLv = state.tech?.[branch.id] || 0;
  text(ctx, `Lv.${curLv}/5`, x + w - 12, y + 14, { size: T.fontXs, color: branch.color, align: "right", weight: "700" });

  // 5个级别
  for (let i = 0; i < 5; i++) {
    const lv = i + 1;
    const ly = y + 40 + i * 52;
    const lvDef = branch.levels[i];
    const unlocked = curLv >= lv;
    const available = curLv === lv - 1; // 下一级(可研发)
    drawTechLevel(ctx, ui, state, branch, lvDef, lv, unlocked, available, x + 4, ly, w - 8, 48);
  }
}

function drawTechLevel(ctx, ui, state, branch, lvDef, lv, unlocked, available, x, y, w, h) {
  const dim = unlocked;
  if (dim) ctx.globalAlpha = 0.6;
  const border = unlocked ? branch.color : available ? T.primary : T.panelLine;
  fillRoundRect(ctx, x, y, w, h, T.radiusSm, unlocked ? rgba(branch.color, 0.1) : T.panel, border, available ? 2 : 1);

  if (unlocked) {
    icon(ctx, "✅", x + 16, y + h / 2, 16);
    text(ctx, lvDef.name, x + 34, y + 8, { size: T.fontSm, color: T.text, weight: "600" });
    text(ctx, lvDef.effect, x + 34, y + 24, { size: T.fontXs, color: T.textMute });
    ctx.globalAlpha = 1;
    return;
  }

  if (!available) {
    // 锁定(需先研发上一级)
    icon(ctx, "🔒", x + 16, y + h / 2, 16);
    text(ctx, lvDef.name, x + 34, y + 8, { size: T.fontSm, color: T.textMute, weight: "600" });
    text(ctx, "需先研发上一级", x + 34, y + 24, { size: T.fontXs, color: T.textMute });
    return;
  }

  // 可研发: 显示名称+效果+成本+研发按钮
  icon(ctx, branch.icon, x + 16, y + h / 2, 16);
  text(ctx, `Lv.${lv} ${lvDef.name}`, x + 34, y + 6, { size: T.fontSm, color: T.text, weight: "700" });
  text(ctx, lvDef.effect, x + 34, y + 22, { size: 10, color: T.primary });

  // 成本(紧凑)
  let costStr = "";
  for (const k in lvDef.cost.res) costStr += `${RESOURCES[k]?.icon || k}${lvDef.cost.res[k]} `;
  for (const k in lvDef.cost.items) if (lvDef.cost.items[k] > 0) costStr += `${itemDef(k)?.icon || k}${lvDef.cost.items[k]} `;
  // 检查能否负担
  const check = canResearch(state, branch.id);
  // 研发按钮
  const btnW = 56, btnH = 22;
  const btnX = x + w - btnW - 8;
  const btnY = y + h - btnH - 6;
  const btnHover = inRect(ui.pointer.x, ui.pointer.y, btnX, btnY, btnW, btnH);
  fillRoundRect(ctx, btnX, btnY, btnW, btnH, T.radiusSm, check.ok ? (btnHover ? T.primary : rgba(T.primary, 0.85)) : T.panelHi);
  text(ctx, "研发", btnX + btnW / 2, btnY + btnH / 2, {
    size: T.fontXs, color: check.ok ? "#0e1016" : T.textMute, align: "center", baseline: "middle", weight: "700",
  });
  // 成本显示在按钮左侧
  text(ctx, costStr.trim(), btnX - 8, y + h - 18, {
    size: 10, color: check.ok ? T.accent : T.danger, align: "right", weight: "600",
  });
  if (btnHover && ui.pointer.pressed && check.ok) {
    doResearch(state, branch.id);
    ui.pointer.pressed = false;
  }
}

// 背包查看模态
export function drawInventoryModal(ctx, ui, state, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  const mw = Math.min(380, W - 24);
  const mh = Math.min(520, H - 40);
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.accent, 2);
  icon(ctx, "🎒", mx + mw / 2, my + 32, 28);
  text(ctx, "背包", mx + mw / 2, my + 56, { size: T.fontLg, color: T.text, align: "center", weight: "700" });

  // 按分类显示物品(网格)
  const listY = my + 84;
  const listH = mh - 84 - 56;
  if (inRect(ui.pointer.x, ui.pointer.y, mx, listY, mw, listH)) {
    const wheel = ui.consumeWheel ? ui.consumeWheel() : 0;
    const drag = ui.consumeDragScroll ? ui.consumeDragScroll() : 0;
    if (wheel || drag) state._invScroll = Math.max(0, (state._invScroll || 0) + wheel * 0.5 + drag);
  }
  const inv = state.inventory || {};
  const ownedIds = Object.keys(inv).filter((k) => inv[k] > 0);
  // 按分类分组
  const catOrder = ["material", "consumable", "component", "special"];
  let totalH = 0;
  const groups = [];
  for (const cat of catOrder) {
    const items = ownedIds.filter((id) => ITEMS[id]?.cat === cat);
    if (items.length === 0) continue;
    const catLabel = ITEM_CATS[cat];
    const rows = Math.ceil(items.length / 3);
    groups.push({ cat, label: catLabel, items, height: 28 + rows * 56 });
    totalH += 28 + rows * 56 + 8;
  }
  if (groups.length === 0) totalH = 60;
  const maxScroll = Math.max(0, totalH - listH);
  state._invScroll = Math.min(state._invScroll || 0, maxScroll);
  const yOff = state._invScroll || 0;

  clipRound(ctx, mx + 8, listY, mw - 16, listH, T.radiusSm, () => {
    if (groups.length === 0) {
      text(ctx, "背包是空的", mx + mw / 2, listY + 30, { size: T.fontSm, color: T.textMute, align: "center" });
      text(ctx, "派遣探索可获得材料与物品", mx + mw / 2, listY + 50, { size: T.fontXs, color: T.textMute, align: "center" });
      return;
    }
    let cy = listY - yOff;
    const cardW = (mw - 40) / 3;
    for (const g of groups) {
      icon(ctx, g.label.icon, mx + 20, cy + 12, 16);
      text(ctx, g.label.name, mx + 38, cy + 6, { size: T.fontSm, color: T.textDim, weight: "600" });
      cy += 28;
      let cx = mx + 14;
      for (let i = 0; i < g.items.length; i++) {
        if (cx + cardW > mx + mw - 14) { cx = mx + 14; cy += 56; }
        const id = g.items[i];
        const it = ITEMS[id];
        fillRoundRect(ctx, cx, cy, cardW - 6, 48, T.radiusSm, T.panelAlt, T.panelLine, 1);
        icon(ctx, it.icon, cx + 18, cy + 18, 18);
        text(ctx, it.name, cx + 34, cy + 8, { size: 10, color: T.text, weight: "600" });
        text(ctx, "×" + inv[id], cx + 34, cy + 26, { size: T.fontXs, color: T.accent, weight: "700" });
        cx += cardW;
      }
      cy += 64;
    }
  });

  // 滚动条
  if (maxScroll > 0) {
    const trackX = mx + mw - 8;
    fillRoundRect(ctx, trackX, listY, 3, listH, 1.5, T.panelLine);
    const thumbH = Math.max(30, (listH / totalH) * listH);
    const thumbY = listY + (yOff / maxScroll) * (listH - thumbH);
    fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 1.5, T.textDim);
  }

  if (button(ctx, ui, mx + mw / 2 - 60, my + mh - 44, 120, 34, "关闭", { fontSize: T.fontSm })) {
    state.modal = null;
  }
}

// 神器选择模态(居民详情点空槽时弹,从仓库选神器装备)
export function drawArtifactSelectModal(ctx, ui, state, W, H) {
  const m = state.modal;
  const survivor = state.survivors.find((s) => s.id === m.survivorId);
  if (!survivor) { state.modal = null; return; }
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  const mw = Math.min(360, W - 24);
  const mh = Math.min(500, H - 40);
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, "#f0a93b", 2);
  icon(ctx, "✨", mx + mw / 2, my + 30, 26);
  text(ctx, `给 ${survivor.name} 选择神器`, mx + mw / 2, my + 52, { size: T.fontMd, color: T.text, align: "center", weight: "700" });
  const listY = my + 76;
  const listH = mh - 76 - 56;
  if (inRect(ui.pointer.x, ui.pointer.y, mx, listY, mw, listH)) {
    const wheel = ui.consumeWheel ? ui.consumeWheel() : 0;
    const drag = ui.consumeDragScroll ? ui.consumeDragScroll() : 0;
    if (wheel || drag) state._artSelScroll = Math.max(0, (state._artSelScroll || 0) + wheel * 0.5 + drag);
  }
  const storage = (state.equipment?.storage || []).filter((id) => {
    const def = artifactDef(id);
    return def && survivor.level >= def.minLevel;
  });
  const itemH = 56;
  const totalH = storage.length * (itemH + 6);
  const maxScroll = Math.max(0, totalH - listH);
  state._artSelScroll = Math.min(state._artSelScroll || 0, maxScroll);
  const yOff = state._artSelScroll || 0;
  clipRound(ctx, mx + 8, listY, mw - 16, listH, T.radiusSm, () => {
    if (storage.length === 0) {
      text(ctx, "仓库无可用神器", mx + mw / 2, listY + 30, { size: T.fontSm, color: T.textMute, align: "center" });
      text(ctx, "派遣到危险区域可获得神器", mx + mw / 2, listY + 50, { size: T.fontXs, color: T.textMute, align: "center" });
      return;
    }
    let cy = listY - yOff;
    for (const artId of storage) {
      const def = artifactDef(artId);
      const tDef = ARTIFACT_TIERS[def.tier];
      const hover = inRect(ui.pointer.x, ui.pointer.y, mx + 12, cy, mw - 24, itemH);
      fillRoundRect(ctx, mx + 12, cy, mw - 24, itemH, T.radiusSm, hover ? T.panelHi : T.panel, tDef.color, hover ? 2 : 1);
      icon(ctx, def.icon, mx + 36, cy + itemH / 2, 22);
      text(ctx, def.name, mx + 60, cy + 8, { size: T.fontSm, color: tDef.color, weight: "700" });
      text(ctx, `[${tDef.name}]`, mx + mw - 24, cy + 8, { size: 10, color: tDef.color, align: "right" });
      text(ctx, def.desc.slice(0, 22), mx + 60, cy + 28, { size: 10, color: T.textMute });
      text(ctx, `需等级${def.minLevel}+`, mx + 60, cy + 42, { size: 10, color: survivor.level >= def.minLevel ? T.primary : T.danger });
      if (hover && ui.pointer.pressed) {
        equipArtifact(state, survivor, artId);
        state.modal = null;
        ui.pointer.pressed = false;
      }
      cy += itemH + 6;
    }
  });
  if (maxScroll > 0) {
    const trackX = mx + mw - 8;
    fillRoundRect(ctx, trackX, listY, 3, listH, 1.5, T.panelLine);
    const thumbH = Math.max(30, (listH / totalH) * listH);
    const thumbY = listY + (yOff / maxScroll) * (listH - thumbH);
    fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 1.5, T.textDim);
  }
  if (button(ctx, ui, mx + mw / 2 - 60, my + mh - 44, 120, 34, "取消", { fontSize: T.fontSm })) {
    state.modal = null;
  }
}

// 威胁事件模态(辐射风暴/瘟疫/大规模入侵/寒潮)
// 玩家选择: 用道具应对(消耗止血包/抗生素/辐射清除剂) 或 硬扛(掉血但不死)
import { THREATS as THREATS_DEF, counterCost as threatCounterCost } from "../content/threats.js";
import { canCounter as threatCanCounter, doCounter as threatDoCounter, doEndure as threatDoEndure } from "../engine/threatEngine.js";
import { itemDef as threatItemDef } from "../content/items.js";

export function drawThreatModal(ctx, ui, state, W, H) {
  const m = state.modal;
  const threat = THREATS_DEF[m.threatId];
  if (!threat) { state.modal = null; return; }
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, W, H);
  const mw = Math.min(360, W - 24);
  const mh = 360;
  const mx = (W - mw) / 2;
  const my = Math.max(16, (H - mh) / 2);
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, threat.color, 2);

  // 标题
  icon(ctx, threat.icon, mx + mw / 2, my + 38, 34);
  text(ctx, threat.name, mx + mw / 2, my + 68, { size: T.fontLg, color: threat.color, align: "center", weight: "700" });
  text(ctx, threat.desc, mx + mw / 2, my + 92, { size: T.fontXs, color: T.textDim, align: "center" });

  // 应对选项: 显示需要的道具
  const cost = threatCounterCost(state, threat);
  const itemD = threatItemDef(cost.item);
  const haveCount = state.inventory?.[cost.item] || 0;
  const canCount = threatCanCounter(state, threat.id);
  yy = my + 120;
  fillRoundRect(ctx, mx + 20, yy, mw - 40, 70, T.radiusSm, T.panelAlt, canCount ? "#4caf87" : T.panelLine, canCount ? 2 : 1);
  icon(ctx, itemD?.icon || "📦", mx + 44, yy + 35, 24);
  text(ctx, threat.counterText, mx + 72, yy + 12, { size: T.fontSm, color: T.text, weight: "600" });
  text(ctx, `需要 ${cost.amount} 个 (已有 ${haveCount})`, mx + 72, yy + 32, {
    size: T.fontXs, color: canCount ? T.primary : T.danger,
  });
  text(ctx, `→ 成功抵御,无损失`, mx + 72, yy + 50, { size: 10, color: T.primary });
  // 应对按钮(道具足够才可点)
  const counterHover = inRect(ui.pointer.x, ui.pointer.y, mx + 20, yy, mw - 40, 70);
  if (counterHover && ui.pointer.pressed && canCount) {
    threatDoCounter(state, threat.id);
    state.modal = null;
    ui.pointer.pressed = false;
  }

  // 硬扛选项
  yy += 82;
  fillRoundRect(ctx, mx + 20, yy, mw - 40, 70, T.radiusSm, T.panelAlt, T.danger, 1);
  icon(ctx, "💢", mx + 44, yy + 35, 24);
  text(ctx, "硬扛过去", mx + 72, yy + 12, { size: T.fontSm, color: T.text, weight: "600" });
  text(ctx, threat.penaltyText, mx + 72, yy + 32, { size: T.fontXs, color: T.danger });
  text(ctx, "→ 全员心情-15(不致死)", mx + 72, yy + 50, { size: 10, color: T.textMute });
  const endureHover = inRect(ui.pointer.x, ui.pointer.y, mx + 20, yy, mw - 40, 70);
  if (endureHover && ui.pointer.pressed) {
    threatDoEndure(state, threat.id);
    state.modal = null;
    ui.pointer.pressed = false;
  }

  // 提示
  text(ctx, "居民生命最低降到1,绝不致死 — 但不及时治疗会虚弱", mx + mw / 2, my + mh - 24, {
    size: 10, color: T.textMute, align: "center",
  });
}
