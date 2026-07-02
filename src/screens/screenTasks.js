// 任务屏幕 + 无线电招募
import { THEME as T, RESOURCES } from "../ui/theme.js";
import {
  fillRoundRect,
  panelGradient,
  text,
  icon,
  inRect,
  button,
  fmtNum,
  clipRound,
  setFont,
  rgba,
} from "../ui/ui.js";
import { contentRect } from "./screenHud.js";
import { taskDef, TASK_DEFS } from "../content/tasks.js";
import { generateSurvivor, populationCap, PERKS } from "../content/survivors.js";
import { addLog, addFloat, getResCap } from "../engine/state.js";
import { drawAvatar } from "../ui/avatar.js";
import { totalDiscovered } from "../content/regions.js";
import { ACHIEVEMENT_DEFS, achievementDef, rebuildProgress } from "../content/achievements.js";
import { markRecruited } from "../engine/guide.js";

const _rebuildProgress = rebuildProgress;
const _achDef = achievementDef;

// 每帧检查任务完成
export function updateTasks(state) {
  for (const t of state.tasks) {
    if (t.done) continue;
    const def = taskDef(t.id);
    if (!def) continue;
    const ok = checkTask(state, def);
    if (ok) {
      t.done = true;
      addLog(state, `任务完成: ${def.name}! 前往「任务」领取奖励。`, T.accent);
    }
  }
}

function checkTask(state, def) {
  switch (def.type) {
    case "facility_level": {
      const f = state.base.facilities.find((x) => x.type === def.target.type);
      return f && f.level >= def.target.level;
    }
    case "facility_type":
      return state.base.facilities.some((f) => f.type === def.target);
    case "population":
      return state.survivors.filter((s) => s.busy !== "dead").length >= def.target;
    case "discover":
      return totalDiscovered(state) >= def.target;
    case "expeditions":
      return state.stats.expeditionsDone >= def.target;
    default:
      return false;
  }
}

export function drawTasksScreen(ctx, state, ui, W, H) {
  const cr = contentRect(W, H);
  text(ctx, "📜 任务 & 成就", 16, cr.y + 8, { size: T.fontLg, color: T.text, weight: "700" });
  // 重建进度条
  const rp = _rebuildProgress(state);
  const pbX = 16, pbY = cr.y + 34, pbW = cr.w - 32;
  fillRoundRect(ctx, pbX, pbY, pbW, 18, 9, T.bg);
  fillRoundRect(ctx, pbX, pbY, Math.max(18, pbW * rp), 18, 9, T.primary);
  text(ctx, `重建进度 ${Math.floor(rp * 100)}%`, pbX + pbW / 2, pbY + 9, {
    size: T.fontXs, color: "#fff", align: "center", baseline: "middle", weight: "700",
  });

  // 无线电招募区
  let yy = cr.y + 62;
  drawRadioPanel(ctx, ui, state, 12, yy, cr.w - 24, 110);
  yy += 122;

  // 任务列表(可滚动)
  text(ctx, "📋 任务", 16, yy, { size: T.fontSm, color: T.text, weight: "700" });
  yy += 22;
  const listH = Math.min(180, (cr.y + cr.h) - yy - 150);
  const tasksTotal = state.tasks.length * 66;
  let yOff = state._taskScroll || 0;
  const maxScroll = Math.max(0, tasksTotal - listH);
  if (inRect(ui.pointer.x, ui.pointer.y, 12, yy, cr.w - 24, listH)) {
    const wheel = ui.consumeWheel ? ui.consumeWheel() : 0;
    if (wheel) yOff += wheel * 0.4;
  }
  yOff = Math.max(0, Math.min(maxScroll, yOff));
  state._taskScroll = yOff;
  clipRound(ctx, 12, yy, cr.w - 24, listH, T.radius, () => {
    let cy = yy - yOff;
    for (const t of state.tasks) {
      drawTaskCard(ctx, ui, state, t, 12, cy, cr.w - 24, 60);
      cy += 66;
    }
  });
  yy += listH + 8;

  // 成就列表
  text(ctx, "🏆 成就", 16, yy, { size: T.fontSm, color: T.text, weight: "700" });
  yy += 22;
  clipRound(ctx, 12, yy, cr.w - 24, (cr.y + cr.h) - yy - 8, T.radius, () => {
    let cx = 16, cy = yy;
    const cardW = (cr.w - 32 - 8) / 2;
    let i = 0;
    for (const arec of state.achievements) {
      const adef = _achDef(arec.id);
      if (!adef) continue;
      drawAchievementCard(ctx, ui, state, adef, arec, cx, cy, cardW, 56);
      i++;
      if (i % 2 === 0) { cx = 16; cy += 62; } else { cx = 16 + cardW + 8; }
    }
  });

  // 招募确认模态由 main.js 集中绘制(防点击穿透)
}

// 无线电面板
function drawRadioPanel(ctx, ui, state, x, y, w, h) {
  panelGradient(ctx, x, y, w, h, T.radius);
  icon(ctx, "📡", x + 36, y + 38, 32);
  text(ctx, "无线电招募", x + 70, y + 14, { size: T.fontMd, color: T.text, weight: "700" });
  const pop = state.survivors.filter((s) => s.busy !== "dead").length;
  const cap = populationCap(state.base.level);
  const full = pop >= cap;
  text(ctx, full ? "避难所已满员,升级基地扩容" : "搜寻废土上的幸存者信号", x + 70, y + 36, {
    size: T.fontXs,
    color: T.textDim,
  });

  // 冷却/按钮
  if (state.radio.candidate) {
    // 有候选人
    const c = state.radio.candidate;
    icon(ctx, c.profIcon, x + 70, y + 64, 18);
    text(ctx, `${c.name} (${c.profName}) 想要加入!`, x + 86, y + 56, {
      size: T.fontSm,
      color: T.primary,
      weight: "600",
    });
    if (button(ctx, ui, x + w - 130, y + 52, 116, 32, "查看 ➜", {
      fontSize: T.fontXs,
      disabled: full,
    })) {
      state.modal = { type: "recruitConfirm" };
    }
  } else {
    // 冷却中
    const cd = state.radio.cooldown;
    if (cd > 0) {
      const r = 1 - cd / 60;
      fillRoundRect(ctx, x + 70, y + 60, 140, 12, 6, T.bg);
      fillRoundRect(ctx, x + 70, y + 60, 140 * r, 12, 6, T.info);
      text(ctx, `搜寻中... ${Math.ceil(cd)}s`, x + 140, y + 66, {
        size: T.fontXs,
        color: "#fff",
        align: "center",
        baseline: "middle",
        weight: "600",
      });
    } else {
      if (button(ctx, ui, x + w - 130, y + 52, 116, 32, "📡 搜寻信号", {
        fontSize: T.fontXs,
        disabled: full,
      })) {
        // 启动搜寻
        state.radio.cooldown = 60;
        // 50% 概率找到候选人
        if (Math.random() < 0.6) {
          const cand = generateSurvivor(1, Math.random, state.nextSurvivorId);
          if (window.__assignAvatar) window.__assignAvatar(cand);
          state.radio.candidate = cand;
        }
      }
    }
  }
}

// 任务卡片
function drawTaskCard(ctx, ui, state, t, x, y, w, h) {
  const def = taskDef(t.id);
  if (!def) return;
  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    T.radiusSm,
    T.panel,
    t.done ? (t.claimed ? T.panelLine : T.accent) : T.panelLine,
    t.done && !t.claimed ? 2 : 1
  );
  // 状态图标
  const stIcon = t.claimed ? "✅" : t.done ? "🎁" : "⭕";
  icon(ctx, stIcon, x + 22, y + 24, 18);
  text(ctx, def.name, x + 44, y + 12, { size: T.fontSm, color: T.text, weight: "700" });
  text(ctx, def.desc, x + 44, y + 32, { size: T.fontXs, color: T.textDim });
  // 奖励
  let rw = "";
  for (const k in def.reward) {
    const r = RESOURCES[k];
    if (r) rw += `${r.icon}${def.reward[k]} `;
  }
  text(ctx, `奖励: ${rw.trim()}`, x + 44, y + 50, { size: T.fontXs, color: T.accent, weight: "600" });

  // 领取按钮
  if (t.done && !t.claimed) {
    if (button(ctx, ui, x + w - 76, y + h / 2 - 16, 64, 32, "领取", {
      fontSize: T.fontXs,
      color: T.accent,
      glow: true,
    })) {
      // 发奖(容量口径统一用 getResCap,含基地等级加成)
      for (const k in def.reward) {
        const cap = getResCap(state, k);
        state.res[k] = Math.min(cap, (state.res[k] || 0) + def.reward[k]);
      }
      t.claimed = true;
      addFloat(state, x + w / 2, y, "奖励已领取!", T.accent);
      addLog(state, `领取奖励: ${def.name}`, T.accent);
    }
  }
}

// 招募确认模态
export function drawRecruitModal(ctx, ui, state, W, H) {
  drawBackdrop(ctx, W, H);
  const c = state.radio.candidate;
  if (!c) {
    state.modal = null;
    return;
  }
  const mw = 340;
  const mh = 360;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.primary, 2);

  // 大头像(招募候选人)
  drawAvatar(ctx, mx + mw / 2, my + 50, 38, c);
  text(ctx, c.name, mx + mw / 2, my + 100, {
    size: T.fontLg,
    color: T.text,
    align: "center",
    weight: "700",
  });
  text(ctx, `${c.profName} · Lv.${c.level}`, mx + mw / 2, my + 122, {
    size: T.fontSm,
    color: T.textDim,
    align: "center",
  });

  // 特长
  let yy = my + 150;
  text(ctx, "特长:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 22;
  if (c.perks) {
    for (const pid of c.perks) {
      const pk = PERKS[pid];
      if (!pk) continue;
      icon(ctx, pk.icon, mx + 40, yy + 8, 16);
      text(ctx, pk.name, mx + 56, yy, { size: T.fontSm, color: T.text, weight: "600" });
      text(ctx, pk.desc, mx + 56, yy + 16, { size: T.fontXs, color: T.textMute });
      yy += 36;
    }
  }

  // 按钮
  const by = my + mh - 56;
  if (button(ctx, ui, mx + 24, by, 140, 42, "✅ 接纳", { fontSize: T.fontSm, glow: true })) {
    state.survivors.push(c);
    state.nextSurvivorId = Math.max(state.nextSurvivorId, c.id + 1);
    state.stats.survivorsRecruited++;
    markRecruited(state); // 引导埋点
    // 分配头像(若有外部图)
    if (window.__assignAvatar) window.__assignAvatar(c);
    addLog(state, `${c.name} (${c.profName}) 加入了避难所!`, T.primary);
    addFloat(state, W / 2, my, `${c.name} 加入!`, T.primary);
    state.radio.candidate = null;
    state.radio.cooldown = 60;
    state.modal = null;
  }
  if (button(ctx, ui, mx + mw - 164, by, 140, 42, "❌ 拒绝", {
    fontSize: T.fontSm,
    color: T.panelHi,
    textColor: T.text,
  })) {
    state.radio.candidate = null;
    state.radio.cooldown = 60;
    state.modal = null;
  }
}

function drawBackdrop(ctx, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
}

// 成就卡片(显示进度+领取)
function drawAchievementCard(ctx, ui, state, adef, arec, x, y, w, h) {
  const done = arec.done;
  const claimed = arec.claimed;
  const prog = adef.progress(state);
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  fillRoundRect(ctx, x, y, w, h, T.radiusSm,
    hover && done && !claimed ? T.panelHi : T.panel,
    done && !claimed ? T.accent : T.panelLine, done && !claimed ? 2 : 1);
  if (claimed) ctx.globalAlpha = 0.5;
  icon(ctx, adef.icon, x + 22, y + h / 2, 20);
  text(ctx, adef.name, x + 44, y + 8, { size: T.fontSm, color: T.text, weight: "600" });
  text(ctx, adef.desc, x + 44, y + 26, { size: T.fontXs, color: T.textMute });
  // 进度条
  const pbx = x + 44, pby = y + h - 14, pbw = w - 90;
  fillRoundRect(ctx, pbx, pby, pbw, 6, 3, T.bg);
  fillRoundRect(ctx, pbx, pby, pbw * Math.min(1, prog), 6, 3, claimed ? T.textMute : T.primary);
  // 领取按钮
  if (done && !claimed) {
    fillRoundRect(ctx, x + w - 42, y + h / 2 - 12, 34, 24, 6, T.accent);
    text(ctx, "领", x + w - 25, y + h / 2, {
      size: T.fontXs, color: "#0e1016", align: "center", baseline: "middle", weight: "700",
    });
    if (hover && ui.pointer.pressed) {
      // 发奖(容量口径统一用 getResCap)
      for (const k in adef.reward) {
        const cap = getResCap(state, k);
        state.res[k] = Math.min(cap, (state.res[k] || 0) + adef.reward[k]);
      }
      arec.claimed = true;
      addLog(state, `成就达成: ${adef.name}!`, T.accent);
      addFloat(state, x + w / 2, y, "成就达成!", T.accent);
      ui.pointer.pressed = false;
    }
  } else if (claimed) {
    icon(ctx, "✅", x + w - 22, y + h / 2, 16);
  }
  ctx.globalAlpha = 1;
}
