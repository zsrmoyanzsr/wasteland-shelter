// 派遣屏幕: 选已发现区域 + 组队 + 实时倒计时 + 回报/事件抉择
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
  progressBar,
  rgba,
} from "../ui/ui.js";
import { contentRect } from "./screenHud.js";
import { POI_TYPES, poiInfo, allDiscoveredPois, getMap, currentMap } from "../content/regions.js";
import { PERKS } from "../content/survivors.js";
import { rollEvent } from "../content/events.js";
import { makeRng, generateSurvivor } from "../content/survivors.js";
import { addLog, addFloat, SCREEN } from "../engine/state.js";
import { markDispatched } from "../engine/guide.js";
import { rollItemDrops } from "../content/items.js";
import { itemDef } from "../content/items.js";
import { addItems } from "../engine/inventory.js";
import { getEquipStats } from "../engine/equipEngine.js";
import { rollArtifactDrop, grantArtifact, getArtifactStats } from "../engine/artifactEngine.js";
import { artifactDef as artifactDefCached, ARTIFACT_TIERS as ARTIFACT_TIERS_CACHED } from "../content/artifacts.js";
import { drawGuideBanner } from "../ui/guideBanner.js";

// 派遣持续时间(秒): 远的(danger高)明显更久,形成"刷近快速 vs 赌远高回报"取舍
// danger1=37s(近) 2=73s 3=133s 4=217s(远)
function expDuration(danger) {
  return 25 + danger * danger * 12;
}

export function drawDispatchScreen(ctx, state, ui, W, H) {
  const cr = contentRect(W, H);

  // 自动打开: 有待处理事件/结果的探索时,弹出模态(避免玩家错过)
  if (!state.modal) {
    const eventExp = state.expeditions.find((e) => e.state === "event");
    if (eventExp) {
      state.modal = { type: "event", expId: eventExp.id };
    } else {
      const doneExp = state.expeditions.find((e) => e.state === "done");
      if (doneExp) state.modal = { type: "expeditionResult", expId: doneExp.id };
    }
  }

  const ox = cr.x; // 内容区x偏移(宽屏侧栏右侧)
  text(ctx, "🚀 派遣探索", ox + 16, cr.y + 8, { size: T.fontLg, color: T.text, weight: "700" });
  const disc = allDiscoveredPois(state);
  text(ctx, `已发现 ${disc.length} 个地点可探索`, ox + 16, cr.y + 34, {
    size: T.fontSm,
    color: T.textDim,
  });

  // 引导横幅
  const guideH = drawGuideBanner(ctx, ui, state, ox + 14, cr.y + 56, cr.w - 28);

  // 列表区: 进行中 + 完成 + 可派遣区域,整体放进可滚动容器,避免溢出被导航栏遮挡
  const listBoxY = cr.y + 62 + guideH;
  const listBoxH = cr.y + cr.h - listBoxY - 8;

  // 滚轮
  if (inRect(ui.pointer.x, ui.pointer.y, ox + 12, listBoxY, cr.w - 24, listBoxH)) {
    const wheel = ui.consumeWheel ? ui.consumeWheel() : 0;
    const drag = ui.consumeDragScroll ? ui.consumeDragScroll() : 0;
    if (wheel || drag) state._dispatchScroll = Math.max(0, (state._dispatchScroll || 0) + wheel * 0.5 + drag);
  }

  const running = state.expeditions.filter((e) => e.state !== "done");
  const done = state.expeditions.filter((e) => e.state === "done");

  // 计算总内容高度用于滚动上限
  let totalH = 0;
  if (running.length) totalH += 22 + running.length * 70;
  if (done.length) totalH += 28 + done.length * 62;
  totalH += 32;
  if (disc.length === 0) totalH += 80;
  else totalH += disc.length * 84;
  const maxScroll = Math.max(0, totalH - listBoxH);
  state._dispatchScroll = Math.min(state._dispatchScroll || 0, maxScroll);
  const yOff = state._dispatchScroll || 0;

  clipRound(ctx, ox + 12, listBoxY, cr.w - 24, listBoxH, T.radius, () => {
    let yy = listBoxY - yOff;
    if (running.length) {
      text(ctx, "进行中", ox + 16, yy, { size: T.fontSm, color: T.info, weight: "700" });
      yy += 22;
      for (const e of running) {
        drawExpeditionCard(ctx, ui, state, e, ox + 12, yy, cr.w - 24, 64);
        yy += 70;
      }
    }
    if (done.length) {
      yy += 6;
      text(ctx, "✅ 探索完成(点击查看)", ox + 16, yy, { size: T.fontSm, color: T.accent, weight: "700" });
      yy += 22;
      for (const e of done) {
        drawExpeditionCard(ctx, ui, state, e, ox + 12, yy, cr.w - 24, 56, true);
        yy += 62;
      }
    }
    yy += 8;
    text(ctx, "📍 可探索区域", ox + 16, yy, { size: T.fontSm, color: T.textDim, weight: "700" });
    yy += 24;

    if (disc.length === 0) {
      fillRoundRect(ctx, 12, yy, cr.w - 24, 80, T.radius, T.panel, T.panelLine, 1);
      icon(ctx, "🌫️", cr.w / 2, yy + 30, 28);
      text(ctx, "尚未发现任何地点", cr.w / 2, yy + 56, {
        size: T.fontSm, color: T.textDim, align: "center",
      });
      text(ctx, "前往「地图」行走探索,揭开迷雾", cr.w / 2, yy + 72, {
        size: T.fontXs, color: T.textMute, align: "center",
      });
      return;
    }
    // POI 卡片
    let cy = yy;
    for (const poi of disc) {
      drawRegionCard(ctx, ui, state, poi, ox + 12, cy, cr.w - 24, 78);
      cy += 84;
    }
  });

  // 滚动条
  if (maxScroll > 0) {
    const trackX = ox + cr.w - 8;
    fillRoundRect(ctx, trackX, listBoxY, 3, listBoxH, 1.5, T.panelLine);
    const thumbH = Math.max(30, (listBoxH / totalH) * listBoxH);
    const thumbY = listBoxY + (yOff / maxScroll) * (listBoxH - thumbH);
    fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 1.5, T.textDim);
  }

  // 模态由 main.js 集中绘制(防点击穿透)
}

// 进行中/完成的探索卡片
function drawExpeditionCard(ctx, ui, state, e, x, y, w, h, isDone) {
  const info = poiInfo(e.regionType) || { icon: "❓", name: e.regionName || "未知", danger: 1 };
  fillRoundRect(ctx, x, y, w, h, T.radiusSm, T.panel, isDone ? T.accent : T.panelLine, isDone ? 2 : 1);
  icon(ctx, info.icon, x + 26, y + h / 2, 24);
  text(ctx, e.regionName || info.name, x + 52, y + 12, { size: T.fontSm, color: T.text, weight: "700" });
  text(ctx, `${e.members.length}人 · ${e.state === "done" ? "已归来" : "探索中"}`, x + 52, y + 30, {
    size: T.fontXs,
    color: T.textDim,
  });

  if (e.state === "running") {
    const elapsed = state.time - e.startAt;
    const prog = Math.min(1, elapsed / e.duration);
    progressBar(ctx, x + 52, y + 46, w - 70, 8, prog, { color: T.info });
    const remain = Math.max(0, e.duration - elapsed); // 剩余秒数,不为负
    text(ctx, `${Math.ceil(remain)}s`, x + w - 14, y + h / 2, {
      size: T.fontXs,
      color: T.text,
      align: "right",
      baseline: "middle",
      weight: "600",
    });
  } else if (e.state === "done") {
    // 点击查看
    const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
    fillRoundRect(ctx, x + w - 70, y + 10, 58, 22, 11, T.accent);
    text(ctx, "查看 ➜", x + w - 41, y + 21, {
      size: T.fontXs,
      color: "#0e1016",
      align: "center",
      weight: "700",
    });
    if (hover && ui.pointer.pressed) {
      state.modal = { type: "expeditionResult", expId: e.id };
      ui.pointer.pressed = false;
    }
  }
}

// 区域卡片(可派遣入口)
function drawRegionCard(ctx, ui, state, poi, x, y, w, h) {
  const info = poiInfo(poi.type) || { icon: "📦", name: "未知地点", color: T.textMute, danger: 1, rewards: {} };
  const hover = inRect(ui.pointer.x, ui.pointer.y, x, y, w, h);
  fillRoundRect(ctx, x, y, w, h, T.radiusSm, hover ? T.panelHi : T.panel, info.color, hover ? 2 : 1);
  // 图标圆
  ctx.beginPath();
  ctx.arc(x + 30, y + h / 2, 20, 0, Math.PI * 2);
  ctx.fillStyle = rgba(info.color, 0.2);
  ctx.fill();
  icon(ctx, info.icon, x + 30, y + h / 2, 22);
  text(ctx, info.name, x + 60, y + 12, { size: T.fontMd, color: T.text, weight: "700" });
  text(ctx, "★".repeat(info.danger) + ` 危险${info.danger}`, x + 60, y + 34, {
    size: T.fontXs,
    color: T.accent,
  });
  // 主要产出(按 rewards 范围取该区域可能产出的资源图标)
  let loot = "";
  for (const k in info.rewards) {
    const r = RESOURCES[k];
    if (r) loot += r.icon + " ";
  }
  text(ctx, `产出 ${looot(loot)}`, x + 60, y + 50, { size: T.fontXs, color: T.primary });
  // 时长
  text(ctx, `${expDuration(info.danger)}s`, x + w - 14, y + 14, {
    size: T.fontXs,
    color: T.textDim,
    align: "right",
  });
  // 派遣: 允许空闲 + 分配中的幸存者(组队时自动从原设施调离),重伤/派遣中除外
  const freeCount = state.survivors.filter((s) => !s.busy && s.busy !== "dead" && s.health >= 30).length;
  const can = freeCount > 0;
  fillRoundRect(ctx, x + w - 70, y + h - 30, 58, 22, 11, can ? T.primary : T.panelHi);
  text(ctx, can ? "派遣 ➜" : "无人", x + w - 41, y + h - 19, {
    size: T.fontXs,
    color: can ? "#0e1016" : T.textMute,
    align: "center",
    weight: "700",
  });
  if (hover && ui.pointer.pressed) {
    if (can) {
      state.modal = { type: "formTeam", poi };
    } else {
      // 无可派人手时给明确提示,避免玩家不知道为何卡住
      addLog(state, "没有可派遣的幸存者。重伤(血<30)需先在医疗室治疗,或升级基地增加人口。", T.danger);
      addFloat(state, x + w / 2, y, "暂无可派人手", T.danger);
    }
    ui.pointer.pressed = false;
  }
}

function looot(s) {
  return s.trim() || "—";
}

// 组队模态
export function drawTeamModal(ctx, ui, state, W, H) {
  drawBackdrop(ctx, W, H);
  // 从所有地图的 POI 中查找(带 mapId)
  const poi = state.modal.poi;
  if (!poi) {
    state.modal = null;
    return;
  }
  const info = poiInfo(poi.type);
  const mw = 360;
  const mh = 440;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.panelLine, 2);

  icon(ctx, info.icon, mx + mw / 2, my + 40, 32);
  text(ctx, info.name, mx + mw / 2, my + 68, {
    size: T.fontLg,
    color: T.text,
    align: "center",
    weight: "700",
  });
  text(ctx, `危险 ${info.danger} · 时长 ${expDuration(info.danger)}s`, mx + mw / 2, my + 94, {
    size: T.fontSm,
    color: T.textDim,
    align: "center",
  });

  // 已选队伍
  if (!state.modal.team) state.modal.team = [];
  const team = state.modal.team;
  text(ctx, `选择队员 (${team.length}/4)`, mx + 24, my + 118, {
    size: T.fontSm,
    color: T.textDim,
    weight: "600",
  });

  // 可选幸存者: 空闲 + 工作中均可(工作中者出发时自动从原设施调离),重伤/派遣中除外
  const free = state.survivors.filter((s) => !s.busy && s.busy !== "dead" && s.health >= 30);
  let yy = my + 142;
  clipRound(ctx, mx + 20, yy, mw - 40, 200, T.radiusSm, () => {
    let cy = yy;
    if (free.length === 0) {
      text(ctx, "没有可派遣的幸存者", mx + mw / 2, cy + 20, {
        size: T.fontSm,
        color: T.textMute,
        align: "center",
      });
      text(ctx, "(重伤需先治疗,所有人都已派遣中?)", mx + mw / 2, cy + 40, {
        size: T.fontXs,
        color: T.textMute,
        align: "center",
      });
    }
    for (const s of free) {
      if (cy > yy + 200) break;
      const sel = team.includes(s.id);
      const hover = inRect(ui.pointer.x, ui.pointer.y, mx + 22, cy, mw - 44, 44);
      fillRoundRect(
        ctx,
        mx + 22,
        cy,
        mw - 44,
        44,
        T.radiusSm,
        sel ? rgba(T.primary, 0.2) : hover ? T.panelHi : T.panelAlt,
        sel ? T.primary : T.panelLine,
        sel ? 2 : 1
      );
      icon(ctx, s.profIcon, mx + 40, cy + 22, 20);
      text(ctx, s.name, mx + 60, cy + 8, { size: T.fontSm, color: T.text, weight: "600" });
      // 标注工作中者(出发时自动调离)
      const workTag = s.assigned ? " · 工作中" : "";
      text(ctx, `${s.profName} Lv.${s.level} ❤️${Math.floor(s.health)}${workTag}`, mx + 60, cy + 24, {
        size: T.fontXs,
        color: s.assigned ? T.accent : T.textDim,
      });
      // 特长
      if (s.perks) {
        let ps = "";
        for (const pid of s.perks) {
          const pk = PERKS[pid];
          if (pk) ps += pk.icon;
        }
        text(ctx, ps, mx + mw - 36, cy + 22, {
          size: T.fontSm,
          color: T.accent,
          align: "right",
          baseline: "middle",
        });
      }
      // 选中标记
      if (sel) {
        text(ctx, "✓", mx + mw - 30, cy + 22, {
          size: T.fontMd,
          color: T.primary,
          weight: "700",
          baseline: "middle",
        });
      }
      if (hover && ui.pointer.pressed) {
        if (sel) {
          state.modal.team = team.filter((id) => id !== s.id);
        } else if (team.length < 4) {
          state.modal.team = [...team, s.id];
        }
        ui.pointer.pressed = false;
      }
      cy += 48;
    }
  });

  // 出发按钮
  const by = my + mh - 56;
  if (
    button(ctx, ui, mx + 24, by, mw - 48, 42, team.length > 0 ? `🚀 出发 (${team.length}人)` : "至少选 1 人", {
      fontSize: T.fontMd,
      disabled: team.length === 0,
      glow: team.length > 0,
    })
  ) {
    launchExpedition(state, poi, team.map((id) => state.survivors.find((s) => s.id === id)));
    addLog(state, `派遣 ${team.length} 人前往 ${info.name}`, T.info);
    state.modal = null;
  }
  if (button(ctx, ui, mx + mw - 60, my + 12, 36, 30, "✕", {
    fontSize: T.fontMd,
    color: T.panelHi,
    textColor: T.text,
  })) {
    state.modal = null;
  }
}

// 启动探索
function launchExpedition(state, poi, members) {
  const info = poiInfo(poi.type);
  markDispatched(state); // 引导埋点
  const id = state.nextExpeditionId++;
  const duration = expDuration(info.danger);
  const exp = {
    id,
    regionId: poi.id,
    mapId: poi.mapId || state.maps.current,
    mapName: poi.mapName || currentMap(state)?.name || "",
    regionType: poi.type,
    regionName: info.name,
    members: members.map((m) => m.id),
    startAt: state.time,
    duration,
    state: "running",
    rng: makeRng((Date.now() + id * 7919) % 1e9), // 确定性种子
    event: null,
    rewards: {},
  };
  state.expeditions.push(exp);
  // 标记成员忙碌,并从原设施调离(派遣期间设施不再计其产能)
  for (const m of members) {
    if (m.assigned) {
      const f = state.base.facilities.find((fac) => fac.id === m.assigned);
      if (f) f.assigned = (f.assigned || []).filter((id) => id !== m.id);
      m.assigned = null;
    }
    m.busy = "expedition";
  }
}

// 每帧更新探索(到时间结算事件)
export function updateExpeditions(state, dt) {
  for (const e of state.expeditions) {
    if (e.state !== "running") continue;
    const elapsed = state.time - e.startAt;
    if (elapsed >= e.duration) {
      // 结算: 先生成事件(若有),否则直接产出
      settleExpedition(state, e);
    }
  }
}

// 公共: 派遣结算收尾 —— 释放成员、加经验、计派遣次数、设状态
// 抽出此函数统一两个分支(有事件 resolveEvent / 无事件 settleExpedition)的收尾,
// 避免再次出现某分支漏写 busy=null 或 expeditionsDone++ 的 bug(原 Bug2)
function finishExpedition(state, e, memberXp) {
  const members = e.members.map((id) => state.survivors.find((s) => s.id === id)).filter(Boolean);
  for (const m of members) {
    m.busy = null;
    if (memberXp) {
      m.xp += memberXp;
      while (m.xp >= m.xpNeed) {
        m.xp -= m.xpNeed;
        if (window.__levelUp) window.__levelUp(m);
        else { m.level += 1; m.xpNeed = xpForLevelLocal(m.level); }
      }
    }
  }
  if (e.state !== "done") {
    e.state = "done";
    state.stats.expeditionsDone++;
  }
}

// 资源 → 影响它的技能/特长映射(组队策略: 派对应职业去对应POI收益更高)
// 每种资源由特定技能/特长加成: perk 有则大加,技能点数额外小加
const REWARD_SKILL = {
  parts:   { perk: "engineer",  skill: "craft",    perkBonus: 0.5, perSkill: 0.05 },
  meds:    { perk: "doctor",    skill: "medical",  perkBonus: 0.5, perSkill: 0.05 },
  scrap:   { perk: "guardian",  skill: "combat",   perkBonus: 0.4, perSkill: 0.04 },
  power:   { perk: "negotiator",skill: "social",   perkBonus: 0.3, perSkill: 0.04 },
  food:    { perk: "scavenger", skill: "scavenge", perkBonus: 0.3, perSkill: 0.04 },
  water:   { perk: "scavenger", skill: "scavenge", perkBonus: 0.3, perSkill: 0.04 },
};

function settleExpedition(state, e) {
  const info = poiInfo(e.regionType);
  // 容错: regionType 无效(老存档/数据污染)时直接结束派遣,避免 info.danger 解引用崩溃
  if (!info) {
    console.warn("[dispatch] 无效 regionType:", e.regionType, ",强制结束派遣", e.id);
    finishExpedition(state, e, 10);
    return;
  }
  const members = e.members.map((id) => state.survivors.find((s) => s.id === id)).filter(Boolean);
  const rng = e.rng;

  // ① 全局侦察兵加成(全资源 +25%)
  const scavMult = members.some((m) => m.perks && m.perks.includes("scavenger")) ? 1.25 : 1;
  // ② 远 POI 产出倍率: danger 越高产出越好(1.0/1.3/1.6/1.9)
  const qualityMult = 1 + (info.danger - 1) * 0.3;
  // ②b 虚弱惩罚: 队员平均health影响产出(轻伤-15%,重伤-40%)
  // 体现"虚弱的人派出去收获少"的合理性
  const avgHp = members.length > 0 ? members.reduce((s, m) => s + (m.health || 0), 0) / members.length : 100;
  let weakMult = 1;
  if (avgHp < 30) weakMult = 0.6; // 重伤(不应出现因为不能派遣,但防御性)
  else if (avgHp < 60) weakMult = 0.85; // 轻伤 -15%

  // ③ 按资源类型算属性加成(组队策略核心)
  const baseRewards = {};
  for (const k in info.rewards) {
    const [lo, hi] = info.rewards[k];
    let amt = lo + rng() * (hi - lo);
    amt *= scavMult * qualityMult * weakMult;
    // 该资源对应的技能/特长加成
    const rs = REWARD_SKILL[k];
    if (rs) {
      let bonus = 0;
      for (const m of members) {
        const hasPerk = m.perks && m.perks.includes(rs.perk);
        const skillVal = (m.skills && m.skills[rs.skill]) || 0;
        if (hasPerk) bonus += rs.perkBonus;
        bonus += skillVal * rs.perSkill;
        // 装备属性加成
        const eqStat = getEquipStats(state, m.id);
        if (eqStat[rs.skill]) bonus += eqStat[rs.skill] * rs.perSkill;
      }
      amt *= 1 + bonus;
    }
    const rounded = Math.round(amt);
    if (rounded > 0) baseRewards[k] = rounded;
  }
  e.rewards = baseRewards;

  // ④ 物品掉落(派遣获取物品的核心途径):按POI类型随机掉落材料/组件/消耗品
  e.itemDrops = rollItemDrops(rng, e.regionType);

  // ⑤ 神器掉落(极稀有): 按danger算概率+等级,存档唯一
  const artifactTier = rollArtifactDrop(rng, info.danger);
  e.artifactDrop = null;
  if (artifactTier) {
    e.artifactDrop = grantArtifact(state, artifactTier, rng);
  }

  // 70% 概率触发事件
  if (rng() < 0.7) {
    e.event = rollEvent(rng);
    e.state = "event"; // 等待玩家抉择
  } else {
    // 直接完成(无事件): 发奖后统一收尾
    applyRewards(state, baseRewards);
    if (e.itemDrops) addItems(state, e.itemDrops);
    finishExpedition(state, e, 20); // 释放成员 + 20XP + 计数
  }
}

function applyRewards(state, rewards) {
  for (const k in rewards) {
    const cap = state.resCap[k] || Infinity;
    // 带下限保护: 负 reward(惩罚)不会让资源变负;正 reward 不超容量
    state.res[k] = Math.max(0, Math.min(cap, (state.res[k] || 0) + rewards[k]));
    if (k === "food") state.stats.totalFood += rewards[k];
    if (k === "parts") state.stats.totalParts += rewards[k];
  }
}

// 事件抉择模态
export function drawEventModal(ctx, ui, state, W, H) {
  drawBackdrop(ctx, W, H);
  const e = state.expeditions.find((x) => x.id === state.modal.expId);
  if (!e || !e.event) {
    state.modal = null;
    return;
  }
  const ev = e.event;
  const mw = 360;
  const mh = 320;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.accent, 2);

  icon(ctx, "❓", mx + mw / 2, my + 36, 28);
  text(ctx, "途中遭遇", mx + mw / 2, my + 58, {
    size: T.fontXs,
    color: T.accent,
    align: "center",
    weight: "700",
  });
  // 事件文本(换行)
  const lines = wrap(ctx, ev.text, mw - 48, T.fontSm);
  let yy = my + 84;
  for (const l of lines) {
    text(ctx, l, mx + 24, yy, { size: T.fontSm, color: T.text });
    yy += 20;
  }
  // 选项
  yy += 8;
  const ctx_obj = makeEventCtx(state, e);
  for (let i = 0; i < ev.choices.length; i++) {
    const c = ev.choices[i];
    const hover = inRect(ui.pointer.x, ui.pointer.y, mx + 24, yy, mw - 48, 50);
    fillRoundRect(
      ctx,
      mx + 24,
      yy,
      mw - 48,
      50,
      T.radiusSm,
      hover ? T.panelHi : T.panelAlt,
      hover ? T.primary : T.panelLine,
      hover ? 2 : 1
    );
    text(ctx, c.label, mx + 36, yy + 10, { size: T.fontSm, color: T.text, weight: "600" });
    text(ctx, c.desc, mx + 36, yy + 28, { size: T.fontXs, color: T.textMute });
    if (hover && ui.pointer.pressed) {
      resolveEvent(state, e, c, ctx_obj);
      ui.pointer.pressed = false;
    }
    yy += 56;
  }
}

function makeEventCtx(state, e) {
  const members = e.members.map((id) => state.survivors.find((s) => s.id === id)).filter(Boolean);
  return {
    rng: e.rng,
    members,
    hasPerk: (pid) => members.some((m) => m.perks && m.perks.includes(pid)),
    combatScore: () => {
      let s = 0;
      for (const m of members) s += (m.skills.combat || 0) + (m.level > 2 ? 1 : 0);
      if (members.some((m) => m.perks && m.perks.includes("guardian"))) s += 2;
      return s;
    },
  };
}

function resolveEvent(state, e, choice, ctxObj) {
  const result = choice.resolve(ctxObj);
  // 合并奖励
  if (result.rewards) {
    for (const k in result.rewards) {
      e.rewards[k] = (e.rewards[k] || 0) + result.rewards[k];
    }
  }
  // 队伍效果
  if (result.teamEffect) {
    const members = e.members.map((id) => state.survivors.find((s) => s.id === id)).filter(Boolean);
    for (const m of members) {
      if (result.teamEffect.health) {
        m.health = Math.max(0, Math.min(m.maxHealth, m.health + result.teamEffect.health));
      }
      if (result.teamEffect.mood) {
        m.mood = Math.max(0, Math.min(100, m.mood + result.teamEffect.mood));
      }
    }
  }
  // 招募新成员
  if (result.recruit) {
    const newS = generateSurvivor(1, e.rng, state.nextSurvivorId++);
    if (window.__assignAvatar) window.__assignAvatar(newS);
    state.survivors.push(newS);
    addLog(state, `${newS.name} (${newS.profName}) 加入了队伍!`, T.primary);
    state.stats.survivorsRecruited++;
  }
  if (result.log) addLog(state, result.log.text, result.log.color);

  // 结算完成: applyRewards 已带 Math.max(0) 下限保护(负 reward 不会让资源变负)
  applyRewards(state, e.rewards);
  if (e.itemDrops) addItems(state, e.itemDrops);
  finishExpedition(state, e, 25); // 释放成员 + 25XP + 计数 + 设 done
  state.modal = { type: "expeditionResult", expId: e.id, justResolved: true };
}

// 探索结果模态
export function drawResultModal(ctx, ui, state, W, H) {
  drawBackdrop(ctx, W, H);
  const e = state.expeditions.find((x) => x.id === state.modal.expId);
  if (!e) {
    state.modal = null;
    return;
  }
  const info = poiInfo(e.regionType);
  const mw = 340;
  const mh = 340;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  fillRoundRect(ctx, mx, my, mw, mh, T.radiusLg, T.panel, T.primary, 2);

  icon(ctx, "📦", mx + mw / 2, my + 40, 32);
  text(ctx, "探索完成!", mx + mw / 2, my + 70, {
    size: T.fontLg,
    color: T.primary,
    align: "center",
    weight: "700",
  });
  text(ctx, `${info.icon} ${info.name}`, mx + mw / 2, my + 96, {
    size: T.fontSm,
    color: T.textDim,
    align: "center",
  });

  // 战利品
  let yy = my + 124;
  text(ctx, "战利品:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 26;
  const rewardKeys = Object.keys(e.rewards).filter((k) => e.rewards[k] !== 0);
  if (rewardKeys.length === 0) {
    text(ctx, "(无显著收获)", mx + 24, yy, { size: T.fontSm, color: T.textMute });
    yy += 24;
  } else {
    for (const k of rewardKeys) {
      const r = RESOURCES[k];
      const v = e.rewards[k];
      icon(ctx, r.icon, mx + 40, yy + 10, 18);
      text(ctx, `${r.label} ${v > 0 ? "+" : ""}${v}`, mx + 60, yy, {
        size: T.fontSm,
        color: v > 0 ? T.primary : T.danger,
        weight: "600",
      });
      yy += 28;
    }
  }

  // 物品掉落显示
  const itemKeys = e.itemDrops ? Object.keys(e.itemDrops).filter((k) => e.itemDrops[k] > 0) : [];
  if (itemKeys.length > 0) {
    for (const k of itemKeys) {
      const it = itemDef(k);
      if (!it) continue;
      icon(ctx, it.icon, mx + 40, yy + 10, 18);
      text(ctx, `${it.name} ×${e.itemDrops[k]}`, mx + 60, yy, {
        size: T.fontSm, color: T.accent, weight: "600",
      });
      yy += 24;
    }
  }

  // 神器掉落(醒目显示)
  if (e.artifactDrop) {
    const aDef = artifactDefCached(e.artifactDrop);
    const tDef = aDef ? ARTIFACT_TIERS_CACHED[aDef.tier] : null;
    if (aDef && tDef) {
      fillRoundRect(ctx, mx + 20, yy, mw - 40, 50, T.radiusSm, "rgba(240,169,59,0.15)", tDef.color, 2);
      icon(ctx, aDef.icon, mx + 44, yy + 25, 24);
      text(ctx, `${aDef.name} [${tDef.name}]`, mx + 70, yy + 8, { size: T.fontSm, color: tDef.color, weight: "700" });
      text(ctx, aDef.desc.slice(0, 24), mx + 70, yy + 26, { size: 10, color: T.textMute });
      yy += 56;
    }
  }

  // 队伍状态
  yy += 8;
  text(ctx, "队伍状态:", mx + 24, yy, { size: T.fontSm, color: T.textDim, weight: "600" });
  yy += 22;
  for (const id of e.members) {
    const m = state.survivors.find((s) => s.id === id);
    if (!m) continue;
    icon(ctx, m.profIcon, mx + 40, yy + 8, 16);
    text(ctx, `${m.name} ❤️${Math.floor(m.health)} 😊${Math.floor(m.mood)} +25xp`, mx + 58, yy, {
      size: T.fontXs,
      color: T.textDim,
    });
    yy += 20;
  }

  // 关闭 / 移除
  const by = my + mh - 52;
  if (button(ctx, ui, mx + 24, by, mw - 48, 40, "确认", { fontSize: T.fontSm })) {
    // 从列表移除已查看的
    state.expeditions = state.expeditions.filter((x) => x.id !== e.id);
    state.modal = null;
  }
}

function drawBackdrop(ctx, W, H) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
}

function wrap(ctx, str, maxWidth, size) {
  setFont(ctx, size, "400");
  const out = [];
  let cur = "";
  for (const ch of str) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) {
      out.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function xpForLevelLocal(level) {
  return 50 + level * 30;
}
