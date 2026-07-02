// 探索事件模态: 主角在地图踏入未知格触发
// resolve 返回 {log, rewards, stamina, health, mood, _radioBoost}
import { THEME as T } from "../ui/theme.js";
import { fillRoundRect, text, icon, inRect, setFont, rgba } from "../ui/ui.js";
import { EXPLORE_EVENTS } from "../content/exploreEvents.js";
import { addLog, addFloat } from "../engine/state.js";

// 应用事件结果
function applyExploreResult(state, result, W, H) {
  if (result.rewards) {
    for (const k in result.rewards) {
      const cap = state.resCap[k] || Infinity;
      state.res[k] = Math.max(0, Math.min(cap, (state.res[k] || 0) + result.rewards[k]));
    }
  }
  // 主角体力
  if (result.stamina) {
    state.player.stamina = Math.max(0, Math.min(state.player.maxStamina, state.player.stamina + result.stamina));
  }
  // 主角生命
  if (result.health) {
    state.player.health = Math.max(0, Math.min(state.player.maxHealth, state.player.health + result.health));
  }
  // 全基地居民心情
  if (result.mood) {
    for (const s of state.survivors) {
      if (s.busy === "dead") continue;
      s.mood = Math.max(0, Math.min(100, s.mood + result.mood));
    }
  }
  // 无线电加速招募
  if (result._radioBoost && state.radio.cooldown > 0) {
    state.radio.cooldown = Math.floor(state.radio.cooldown / 2);
  }
  if (result.log) {
    addLog(state, result.log.text, result.log.color || T.textDim);
    addFloat(state, W / 2, H / 2 - 40, result.log.text, result.log.color || T.primary);
  }
}

// 构建事件 ctx
function makeExploreCtx(state) {
  return {
    rng: Math.random,
    res: state.res,
    stamina: state.player.stamina,
    health: state.player.health,
    hasPerk: (pid) => state.survivors.some((s) => s.busy !== "dead" && s.perks && s.perks.includes(pid)),
    perkLevel: (pid) => {
      // 返回该特长居民的对应技能最高等级
      const perkSkill = { guardian: "combat", scavenger: "scavenge", engineer: "craft", doctor: "medical", farmer: "farm", negotiator: "social" };
      const skill = perkSkill[pid];
      if (!skill) return 0;
      let max = 0;
      for (const s of state.survivors) {
        if (s.busy !== "dead" && s.perks && s.perks.includes(pid)) {
          max = Math.max(max, s.skills[skill] || 0);
        }
      }
      return max;
    },
  };
}

// 绘制探索事件模态(动态高度)
export function drawExploreEventModal(ctx, ui, state, W, H) {
  const m = state.modal;
  if (!m || m.type !== "exploreEvent") return;
  const ev = EXPLORE_EVENTS.find((e) => e.id === m.eventId);
  if (!ev) { state.modal = null; return; }

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  const mw = 360;
  const borderColor = ev.kind === "bad" ? T.danger : ev.kind === "neutral" ? T.info : T.primary;
  const headerIcon = ev.kind === "bad" ? "⚠️" : ev.kind === "neutral" ? "❓" : "✨";
  const headerText = ev.kind === "bad" ? "意外状况" : ev.kind === "neutral" ? "需要抉择" : "意外发现";

  // 动态计算高度: 头部72 + 文本行数*20 + 10 + 选项数*62 + 底部24
  const lines = wrap(ctx, ev.text, mw - 48, T.fontSm);
  const mh = 72 + lines.length * 20 + 18 + ev.choices.length * 62 + 24;
  const mx = (W - mw) / 2;
  const my = Math.max(20, (H - mh) / 2);
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, borderColor, 2);

  icon(ctx, headerIcon, mx + mw / 2, my + 34, 28);
  text(ctx, headerText, mx + mw / 2, my + 56, {
    size: T.fontXs, color: borderColor, align: "center", weight: "700",
  });

  let yy = my + 78;
  for (const l of lines) {
    text(ctx, l, mx + 24, yy, { size: T.fontSm, color: T.text });
    yy += 20;
  }

  yy += 8;
  const ctxObj = makeExploreCtx(state);
  for (const c of ev.choices) {
    const hover = inRect(ui.pointer.x, ui.pointer.y, mx + 24, yy, mw - 48, 56);
    fillRoundRect(ctx, mx + 24, yy, mw - 48, 56, T.radiusSm,
      hover ? T.panelHi : T.panelAlt, hover ? borderColor : T.panelLine, hover ? 2 : 1);
    text(ctx, c.label, mx + 36, yy + 12, { size: T.fontSm, color: T.text, weight: "600" });
    text(ctx, c.desc, mx + 36, yy + 32, { size: T.fontXs, color: T.textMute });
    if (hover && ui.pointer.pressed) {
      const result = c.resolve(ctxObj);
      applyExploreResult(state, result, W, H);
      state.modal = null;
      ui.pointer.pressed = false;
    }
    yy += 62;
  }

  // 关闭(✕)
  const closeHover = inRect(ui.pointer.x, ui.pointer.y, mx + mw - 44, my + 8, 32, 30);
  if (closeHover && ui.pointer.pressed) { state.modal = null; ui.pointer.pressed = false; }
  text(ctx, "✕", mx + mw - 28, my + 24, {
    size: T.fontMd, color: closeHover ? T.text : T.textMute, align: "center", baseline: "middle",
  });
}

function wrap(ctx, str, maxWidth, size) {
  setFont(ctx, size, "400");
  const out = [];
  let cur = "";
  for (const ch of str) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) { out.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
