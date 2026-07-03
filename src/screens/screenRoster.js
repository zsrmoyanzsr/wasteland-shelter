// 居民屏幕: 幸存者列表 + 详情 + 分配到设施
import { THEME as T } from "../ui/theme.js";
import {
  fillRoundRect,
  panelGradient,
  text,
  textTrunc,
  icon,
  inRect,
  button,
  fmtNum,
  clipRound,
  setFont,
  progressBar,
} from "../ui/ui.js";
import { contentRect } from "./screenHud.js";
import { PERKS, populationCap } from "../content/survivors.js";
import { FACILITY_TYPES, facilityStats } from "../content/facilities.js";
import { drawAvatar } from "../ui/avatar.js";
import { survivorTier as survivorTierCached, getEquippedArtifacts as getEquippedArtsCached, unequipArtifact as unequipArtifactCached } from "../engine/artifactEngine.js";
import { artifactDef as artifactDefCached, ARTIFACT_TIERS as ARTIFACT_TIERS_CACHED } from "../content/artifacts.js";

export function drawRosterScreen(ctx, state, ui, W, H) {
  const cr = contentRect(W, H);
  const ox = cr.x; // 内容区x偏移(宽屏侧栏右侧)

  const pop = state.survivors.filter((s) => s.busy !== "dead").length;
  const cap = populationCap(state.base.level);
  text(ctx, "🧑 幸存者名册", ox + 16, cr.y + 8, { size: T.fontLg, color: T.text, weight: "700" });
  text(ctx, `${pop}/${cap} 人 · 升级基地可扩容`, ox + 16, cr.y + 34, {
    size: T.fontSm,
    color: T.textDim,
  });

  // 列表(可滚动: 鼠标滚轮)
  const listX = ox + 12;
  const listY = cr.y + 62;
  const listW = cr.w - 24;
  const listH = cr.h - 62;
  const cardH = 96;
  const gap = 8;
  const totalH = state.survivors.length * (cardH + gap);

  let yOffset = state._rosterScroll || 0;
  const maxScroll = Math.max(0, totalH - listH);
  // 滚轮 + 触摸拖拽
  if (inRect(ui.pointer.x, ui.pointer.y, listX, listY, listW, listH)) {
    const wheel = ui.consumeWheel ? ui.consumeWheel() : 0;
    const drag = ui.consumeDragScroll ? ui.consumeDragScroll() : 0;
    yOffset += wheel * 0.5 + drag;
  }
  yOffset = Math.max(0, Math.min(maxScroll, yOffset));
  state._rosterScroll = yOffset;

  clipRound(ctx, listX, listY, listW, listH, T.radius, () => {
    let yy = listY - yOffset;
    state.survivors.forEach((s) => {
      if (yy + cardH > listY - 10 && yy < listY + listH + 10) {
        drawSurvivorCard(ctx, ui, state, s, listX, yy, listW, cardH);
      }
      yy += cardH + gap;
    });
  });

  // 滚动条(溢出时显示)
  if (maxScroll > 0) {
    const trackX = listX + listW - 6;
    const trackH = listH;
    fillRoundRect(ctx, trackX, listY, 3, trackH, 1.5, T.panelLine);
    const thumbH = Math.max(30, (listH / totalH) * trackH);
    const thumbY = listY + (yOffset / maxScroll) * (trackH - thumbH);
    fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 1.5, T.textDim);
  }

  // 模态由 main.js 集中绘制(防点击穿透)
}

function drawSurvivorCard(ctx, ui, state, s, x, y, w, h) {
  const dead = s.busy === "dead";
  const busy = s.busy === "expedition";
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  fillRoundRect(ctx, x, y, w, h, T.radius, T.panel, hover ? T.primary : T.panelLine, hover ? 2 : 1);

  if (dead) ctx.globalAlpha = 0.4;

  // 头像(程序化绘制女性角色 / 或外部立绘图)
  drawAvatar(ctx, x + 34, y + 38, 24, s);

  // 名字 + 职业(名字截断防溢出,清理换行符防渲染异常)
  const safeName = String(s.name || "").replace(/[\r\n]+/g, " ");
  textTrunc(ctx, safeName, x + 68, y + 12, w - 148, { size: T.fontMd, color: T.text, weight: "700" });
  text(ctx, `${s.profName} · Lv.${s.level}`, x + 68, y + 32, {
    size: T.fontSm,
    color: T.textDim,
  });
  // 特长
  let perkStr = "";
  if (s.perks) {
    for (const pid of s.perks) {
      const pk = PERKS[pid];
      if (pk) perkStr += pk.icon + " ";
    }
  }
  text(ctx, perkStr.trim() || "—", x + 68, y + 50, { size: T.fontSm, color: T.accent });

  // 状态条: HP
  const barW = w - 80;
  const hpRatio = s.health / s.maxHealth;
  // 血量条三档变色: 健康(绿)/轻伤(橙)/重伤(红)
  const hpColor = s.health < 30 ? T.danger : s.health < 60 ? T.accent : T.primary;
  progressBar(ctx, x + 68, y + 68, barW, 8, hpRatio, { color: hpColor });
  // 虚弱标识
  const weakTag = s.health < 30 ? "🩸重伤" : s.health < 60 ? "💢轻伤" : "";
  text(ctx, `❤️${Math.floor(s.health)} ${weakTag}  🍖${Math.floor(s.hunger)}  😊${Math.floor(s.mood)}`, x + 68, y + 78, {
    size: T.fontXs,
    color: s.health < 30 ? T.danger : s.health < 60 ? T.accent : T.textDim,
  });

  // 状态徽标
  if (busy) {
    fillRoundRect(ctx, x + w - 56, y + 10, 46, 18, 9, T.info);
    text(ctx, "派遣中", x + w - 33, y + 19, {
      size: T.fontXs,
      color: "#fff",
      align: "center",
      weight: "700",
    });
  } else if (s.assigned) {
    const fac = state.base.facilities.find((f) => f.id === s.assigned);
    if (fac) {
      const def = FACILITY_TYPES[fac.type];
      fillRoundRect(ctx, x + w - 70, y + 10, 60, 18, 9, T.primaryDark);
      text(ctx, `${def.icon}工作中`, x + w - 40, y + 19, {
        size: T.fontXs,
        color: "#fff",
        align: "center",
        weight: "700",
      });
    }
  }

  // 点击打开详情
  if (hover && ui.pointer.pressed && !dead && !busy) {
    state.modal = { type: "survivorDetail", survivorId: s.id };
    ui.pointer.pressed = false;
  }

  ctx.globalAlpha = 1;
}

// 详情模态
export function drawDetailModal(ctx, ui, state, W, H) {
  drawBackdrop(ctx, W, H);
  const s = state.survivors.find((x) => x.id === state.modal.survivorId);
  if (!s) {
    state.modal = null;
    return;
  }
  const mw = 360;
  const mh = 480;
  const mx = (W - mw) / 2;
  const my = Math.max(20, (H - mh) / 2);
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.panelLine, 2);

  // 头部(大头像)
  drawAvatar(ctx, mx + 50, my + 46, 30, s);
  text(ctx, s.name, mx + 90, my + 24, { size: T.fontLg, color: T.text, weight: "700" });
  text(ctx, `${s.profName} · Lv.${s.level}`, mx + 90, my + 50, {
    size: T.fontSm,
    color: T.textDim,
  });

  // 特长
  let yy = my + 92;
  text(ctx, "特长:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 22;
  if (s.perks && s.perks.length) {
    for (const pid of s.perks) {
      const pk = PERKS[pid];
      if (!pk) continue;
      icon(ctx, pk.icon, mx + 36, yy + 8, 16);
      text(ctx, pk.name, mx + 52, yy, { size: T.fontSm, color: T.text, weight: "600" });
      text(ctx, pk.desc, mx + 52, yy + 16, { size: T.fontXs, color: T.textMute });
      yy += 38;
    }
  } else {
    text(ctx, "无", mx + 36, yy, { size: T.fontSm, color: T.textMute });
    yy += 22;
  }

  // 技能值(影响设施产出/事件)
  yy += 6;
  text(ctx, "技能:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 20;
  const skillIcons = { medical: "💉", craft: "🔧", scavenge: "🎒", combat: "⚔️", farm: "🌾", social: "💬" };
  const skillNames = { medical: "医疗", craft: "工艺", scavenge: "搜刮", combat: "战斗", farm: "种植", social: "社交" };
  if (s.skills) {
    let sx = mx + 24;
    let sy = yy;
    let drawn = 0;
    for (const k of ["farm", "craft", "medical", "combat", "scavenge", "social"]) {
      const v = s.skills[k] || 0;
      if (v <= 0) continue;
      text(ctx, `${skillIcons[k]||k}${skillNames[k]||k} ${v}`, sx, sy, {
        size: T.fontXs, color: v >= 3 ? T.accent : T.textDim, weight: v >= 3 ? "600" : "400",
      });
      sx += 78;
      drawn++;
      if (drawn % 3 === 0) { sx = mx + 24; sy += 16; }
    }
    yy = sy + (drawn % 3 === 0 ? 16 : 22);
  }

  // 状态
  yy += 4;
  text(ctx, "状态:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 22;
  drawStatRow(ctx, mx + 24, yy, "❤️ 生命", Math.floor(s.health), s.maxHealth, T.primary);
  yy += 26;
  drawStatRow(ctx, mx + 24, yy, "🍖 饱食", Math.floor(s.hunger), 100, T.accent);
  yy += 26;
  drawStatRow(ctx, mx + 24, yy, "😊 心情", Math.floor(s.mood), 100, T.purple);

  // 当前工作
  yy += 30;
  const fac = s.assigned ? state.base.facilities.find((f) => f.id === s.assigned) : null;
  if (fac) {
    const def = FACILITY_TYPES[fac.type];
    text(ctx, `正在: ${def.icon} ${def.name}`, mx + 24, yy, {
      size: T.fontSm,
      color: T.primary,
      weight: "600",
    });
  } else {
    text(ctx, "当前空闲", mx + 24, yy, { size: T.fontSm, color: T.textDim });
  }

  // 神器装备区
  yy += 26;
  const maxSlots = survivorTierCached(state, s);
  const equippedArts = getEquippedArtsCached(state, s.id);
  text(ctx, `✨ 神器 (${equippedArts.length}/${maxSlots}):`, mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 20;
  for (let si = 0; si < maxSlots; si++) {
    const artId = equippedArts[si];
    const slotHover = inRect(ui.pointer.x, ui.pointer.y, mx + 24, yy, mw - 48, 32);
    if (artId) {
      const aDef = artifactDefCached(artId);
      const tDef = aDef ? ARTIFACT_TIERS_CACHED[aDef.tier] : null;
      fillRoundRect(ctx, mx + 24, yy, mw - 48, 32, T.radiusSm, tDef ? "rgba(240,169,59,0.1)" : T.panel, tDef?.color || T.panelLine, 1);
      icon(ctx, aDef?.icon || "❓", mx + 44, yy + 16, 16);
      text(ctx, aDef?.name || "未知", mx + 60, yy + 8, { size: T.fontXs, color: tDef?.color || T.text, weight: "600" });
      text(ctx, `[${tDef?.name || ""}]`, mx + mw - 60, yy + 8, { size: 10, color: tDef?.color || T.textMute, align: "right" });
      if (slotHover && ui.pointer.pressed) { unequipArtifactCached(state, s, si); ui.pointer.pressed = false; }
    } else {
      fillRoundRect(ctx, mx + 24, yy, mw - 48, 32, T.radiusSm, T.bg, T.panelLine, 1);
      text(ctx, "空槽位 (点击仓库装备)", mx + 44, yy + 10, { size: T.fontXs, color: T.textMute });
      if (slotHover && ui.pointer.pressed) { state.modal = { type: "artifactSelect", survivorId: s.id, slotIndex: si }; ui.pointer.pressed = false; }
    }
    yy += 36;
  }

  // 按钮: 分配工作 + 解雇(并排)
  const by = my + mh - 56;
  const canFire = s.busy !== "expedition" && state.survivors.filter(x => x.busy !== "dead").length > 1;
  if (button(ctx, ui, mx + 24, by, (mw - 48) * 0.65, 40, fac ? "🔁 重新分配" : "👷 分配工作", {
    fontSize: T.fontSm,
    disabled: s.busy === "expedition",
  })) {
    state.modal = { type: "assignSurvivor", survivorId: s.id };
  }
  if (button(ctx, ui, mx + 24 + (mw - 48) * 0.65 + 8, by, (mw - 48) * 0.35 - 8, 40, "🚪 解雇", {
    fontSize: T.fontSm,
    color: T.panelHi,
    textColor: T.danger,
    disabled: !canFire,
  })) {
    state.modal = { type: "fireConfirm", survivorId: s.id };
  }
  if (button(ctx, ui, mx + mw - 60, my + 12, 36, 30, "✕", {
    fontSize: T.fontMd,
    color: T.panelHi,
    textColor: T.text,
  })) {
    state.modal = null;
  }
}

function drawStatRow(ctx, x, y, label, val, max, color) {
  text(ctx, label, x, y, { size: T.fontXs, color: T.textDim });
  text(ctx, `${val}/${max}`, x + 200, y, {
    size: T.fontXs,
    color: T.text,
    align: "right",
    weight: "600",
  });
  progressBar(ctx, x + 60, y + 2, 130, 8, val / max, { color });
}

// 分配模态: 选择设施
export function drawAssignModal(ctx, ui, state, W, H) {
  drawBackdrop(ctx, W, H);
  const s = state.survivors.find((x) => x.id === state.modal.survivorId);
  if (!s) {
    state.modal = null;
    return;
  }
  const mw = 340;
  const mh = 360;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.panelLine, 2);
  text(ctx, `分配 ${s.name}`, mx + mw / 2, my + 22, {
    size: T.fontMd,
    color: T.text,
    align: "center",
    weight: "700",
  });

  // 空闲选项
  let yy = my + 50;
  if (assignOption(ctx, ui, mx + 20, yy, mw - 40, 46, "🚶", "空闲", "不分配工作,可派遣探索", s.assigned === null)) {
    if (s.assigned) {
      const old = state.base.facilities.find((f) => f.id === s.assigned);
      if (old) old.assigned = (old.assigned || []).filter((id) => id !== s.id);
      s.assigned = null;
    }
    state.modal = null;
  }
  yy += 54;

  // 设施列表
  for (const fac of state.base.facilities) {
    const def = FACILITY_TYPES[fac.type];
    const stats = facilityStats(fac.type, fac.level);
    const full = (fac.assigned || []).length >= stats.jobs && !(fac.assigned || []).includes(s.id);
    const assigned = s.assigned === fac.id;
    const desc = `${(fac.assigned || []).length}/${stats.jobs} 人${def.perk && s.perks && s.perks.includes(def.perk) ? " · ⭐特长匹配" : ""}`;
    if (assignOption(ctx, ui, mx + 20, yy, mw - 40, 46, def.icon, def.name, desc, assigned, full)) {
      // 移出旧设施
      if (s.assigned) {
        const old = state.base.facilities.find((f) => f.id === s.assigned);
        if (old) old.assigned = (old.assigned || []).filter((id) => id !== s.id);
      }
      if (!full) {
        fac.assigned = [...(fac.assigned || []), s.id];
        s.assigned = fac.id;
      }
      state.modal = null;
    }
    yy += 54;
    if (yy > my + mh - 60) break;
  }

  // 关闭
  if (button(ctx, ui, mx + mw - 60, my + 12, 36, 30, "✕", {
    fontSize: T.fontMd,
    color: T.panelHi,
    textColor: T.text,
  })) {
    state.modal = null;
  }
}

function assignOption(ctx, ui, x, y, w, h, ic, label, desc, active, disabled) {
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    T.radiusSm,
    active ? rgba(T.primary, 0.18) : hover ? T.panelHi : T.panelAlt,
    active ? T.primary : T.panelLine,
    active ? 2 : 1
  );
  icon(ctx, ic, x + 22, y + h / 2, 22);
  text(ctx, label, x + 44, y + 10, { size: T.fontSm, color: T.text, weight: "600" });
  text(ctx, desc, x + 44, y + 28, { size: T.fontXs, color: T.textMute });
  if (disabled && !active) {
    text(ctx, "已满", x + w - 12, y + h / 2, {
      size: T.fontXs,
      color: T.danger,
      align: "right",
      baseline: "middle",
    });
  }
  return hover && ui.pointer.pressed && !disabled;
}

import { rgba as _rgba } from "../ui/ui.js";
function rgba(hex, a) {
  return _rgba(hex, a);
}

function drawBackdrop(ctx, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);
}

// 解雇确认模态
export function drawFireConfirmModal(ctx, ui, state, W, H) {
  const m = state.modal;
  const s = state.survivors.find(x => x.id === m.survivorId);
  if (!s) { state.modal = null; return; }
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  const mw = 320, mh = 240;
  const mx = (W - mw) / 2, my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.danger, 2);
  icon(ctx, "🚪", mx + mw / 2, my + 36, 30);
  text(ctx, `解雇 ${s.name}?`, mx + mw / 2, my + 62, { size: T.fontLg, color: T.text, align: "center", weight: "700" });
  text(ctx, `${s.profName} Lv.${s.level} 将永久离开避难所。`, mx + mw / 2, my + 88, { size: T.fontXs, color: T.textDim, align: "center" });
  text(ctx, "其装备的神器会放回仓库。此操作不可撤销。", mx + mw / 2, my + 106, { size: T.fontXs, color: T.danger, align: "center" });
  const by = my + mh - 52;
  if (button(ctx, ui, mx + 24, by, 130, 40, "确认解雇", { fontSize: T.fontSm, color: T.danger, glow: true })) {
    // 归还装备
    if (state.equipment?.equipped?.[s.id]) {
      const eq = state.equipment.equipped[s.id];
      for (const slot of ["slot0", "slot1"]) {
        if (eq[slot]) state.equipment.storage.push(eq[slot]);
      }
      delete state.equipment.equipped[s.id];
    }
    // 从设施移除分配
    if (s.assigned) {
      const fac = state.base.facilities.find(f => f.id === s.assigned);
      if (fac) fac.assigned = fac.assigned.filter(id => id !== s.id);
    }
    // 移除幸存者
    state.survivors = state.survivors.filter(x => x.id !== s.id);
    addLog(state, `${s.name} 离开了避难所。`, "#9aa1b0");
    state.modal = null;
  }
  if (button(ctx, ui, mx + mw - 154, by, 130, 40, "取消", { fontSize: T.fontSm, color: T.panelHi, textColor: T.text })) {
    state.modal = null;
  }
}
