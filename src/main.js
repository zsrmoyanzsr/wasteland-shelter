// 游戏入口: canvas 初始化 / 游戏循环 / 屏幕路由 / 测试钩子

import { createInput } from "./ui/input.js";
import { THEME as T } from "./ui/theme.js";
import { createNewState, SCREEN, addLog } from "./engine/state.js";
import { tickEconomy, offlineSettle } from "./engine/economy.js";
import { facilityStats } from "./content/facilities.js";
import { levelUpSurvivor } from "./content/survivors.js";
import { checkAchievements } from "./content/achievements.js";
import { saveGame, loadGame, hasSave, migrate } from "./engine/save.js";
import { preloadAvatars, getAvatarImage } from "./engine/avatarLoader.js";
import { drawStartScreen } from "./screens/screenStart.js";
import {
  drawTopBar,
  drawBottomNav,
  HUD_TOP_H,
  HUD_BOTTOM_H,
} from "./screens/screenHud.js";
import { drawBaseScreen } from "./screens/screenBase.js";
import { drawMapScreen } from "./screens/screenMap.js";
import { drawRosterScreen } from "./screens/screenRoster.js";
import { drawDispatchScreen, updateExpeditions } from "./screens/screenDispatch.js";
import { drawTasksScreen, updateTasks } from "./screens/screenTasks.js";
import { updatePlayer, updateExplore } from "./engine/worldUpdate.js";
import { updateUnlocks, currentMap, totalDiscovered } from "./content/regions.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// 逻辑分辨率(固定,绘制基于此;CSS 缩放到窗口)
let LOGIC_W = 420;
let LOGIC_H = 760;

let state = createNewState();
let input = createInput(canvas);

// ── 画布尺寸: 响应式 ──
// 窄屏(手机竖屏): 撑满,竖向布局,底部导航
// 宽屏(电脑/平板横屏): 撑满,左侧竖向导航栏 + 更宽敞内容区(双栏感)
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isWide = vw > vh * 0.85;

  // 两种模式都撑满整个窗口(充分利用屏幕)
  LOGIC_W = vw;
  LOGIC_H = vh;
  canvas.style.width = vw + "px";
  canvas.style.height = vh + "px";
  canvas.style.position = "static";
  canvas.style.left = "auto";
  canvas.style.top = "auto";
  canvas.style.transform = "none";
  document.body.style.background = T.bg;
  const app = document.getElementById("app");
  if (app) app.style.cssText = "";

  canvas.width = Math.round(LOGIC_W * dpr);
  canvas.height = Math.round(LOGIC_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.dataset.logicW = String(LOGIC_W);
  canvas.dataset.logicH = String(LOGIC_H);
  canvas.dataset.isWide = isWide ? "1" : "0";
}
window.addEventListener("resize", resize);
resize();

// ── 立绘/头像系统 ──
// 内联 12 张萌系立绘(base64),initAvatars() 同步就绪,零网络零时序依赖
// 外部图(public/avatars/)若有会异步覆盖,无则用内联
import { initAvatars } from "./engine/avatarLoader.js";
initAvatars(); // 启动立刻初始化,Image 同步创建

function assignAvatars() {
  for (const s of state.survivors) {
    s.avatarImg = getAvatarImage(s.id, s.name);
  }
  if (state.radio.candidate) {
    state.radio.candidate.avatarImg = getAvatarImage(
      state.radio.candidate.id,
      state.radio.candidate.name
    );
  }
}
// 暴露给 screen: 给单个幸存者分配头像
window.__assignAvatar = function (survivor) {
  if (survivor) survivor.avatarImg = getAvatarImage(survivor.id, survivor.name);
};
// 暴露给 screen: 幸存者升级(加技能)
window.__levelUp = levelUpSurvivor;
// 外部图异步加载完后,重新分配一次(让用户丢的图生效),并清掉初始分配(可能用的是内联图)
preloadAvatars().then(() => {
  assignAvatars();
});

// ── 测试钩子: render_game_to_text ──
window.render_game_to_text = function () {
  const W = LOGIC_W;
  const H = LOGIC_H;
  const payload = {
    note: "坐标系: 原点(0,0)在canvas左上角,x向右增大,y向下增大。逻辑分辨率随窗口变,见 meta。",
    meta: { logicW: W, logicH: H, dpr: Math.min(window.devicePixelRatio || 1, 2) },
    screen: state.screen,
    tab: state.tab,
    day: state.day,
    time: Math.floor(state.time),
    resources: {
      food: Math.floor(state.res.food),
      water: Math.floor(state.res.water),
      parts: Math.floor(state.res.parts),
      power: Math.floor(state.res.power),
      meds: Math.floor(state.res.meds),
      scrap: Math.floor(state.res.scrap),
    },
    population: state.survivors.filter((s) => s.busy !== "dead").length,
    survivors: state.survivors.map((s) => ({
      id: s.id,
      name: s.name,
      prof: s.profName,
      level: s.level,
      health: Math.floor(s.health),
      assigned: s.assigned,
      busy: s.busy,
    })),
    facilities: state.base.facilities.map((f) => ({
      type: f.type,
      level: f.level,
      assigned: (f.assigned || []).length,
    })),
    expeditions: state.expeditions.map((e) => ({
      id: e.id,
      region: e.regionName,
      state: e.state,
      progress: e.state === "running" ? Math.min(1, (state.time - e.startAt) / e.duration) : 1,
      members: e.members.length,
    })),
    map: {
      current: state.maps.current,
      currentName: currentMap(state)?.name || "",
      player: { x: Math.floor(state.player.x), y: Math.floor(state.player.y) },
      totalDiscovered: totalDiscovered(state),
      unlockedMaps: Object.keys(state.maps.list).filter((id) => state.maps.list[id].unlocked),
      allMaps: Object.keys(state.maps.list),
    },
    tasks: state.tasks.map((t) => ({ id: t.id, done: t.done, claimed: t.claimed })),
    modal: state.modal ? state.modal.type : null,
    floatCount: state.floats.length,
  };
  return JSON.stringify(payload);
};

// ── 测试钩子: advanceTime ──
// 推进游戏时间(毫秒),驱动 tick。Playwright 用此确定性步进
// 内部按 60fps 切片,每步传秒为单位的 dt
window.advanceTime = function (ms) {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  const dtSec = 1 / 60;
  for (let i = 0; i < steps; i++) {
    update(dtSec);
  }
  render();
};

// ── 开始游戏 ──
function startNewGame() {
  state = createNewState();
  state.screen = SCREEN.BASE;
  state.tab = SCREEN.BASE;
  state.lastTickAt = Date.now();
  addLog(state, "避难所重建开始。先确保食物与水源。", T.primary);
  assignAvatars(); // 给初始角色分配立绘
  saveGame(state);
}

function continueGame() {
  const loaded = loadGame(); // loadGame 内部已做完整迁移+默认合并+rng重建+验证
  if (loaded) {
    state = loaded;
    state.screen = SCREEN.BASE;
    state.tab = SCREEN.BASE;
    state.modal = null; // 读档不恢复弹窗
    assignAvatars(); // 存档无 avatarImg(不可序列化),重新分配
    // 离线结算
    const result = offlineSettle(state, Date.now());
    if (result && result.offlineSec > 10) {
      addLog(state, `离线 ${formatDuration(result.offlineSec)},资源已结算。`, T.accent);
    }
    saveGame(state);
  } else {
    startNewGame();
  }
}

function formatDuration(sec) {
  if (sec < 60) return `${Math.floor(sec)}秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟`;
  return `${(sec / 3600).toFixed(1)}小时`;
}

// ── 更新逻辑 ──
let saveAccumulator = 0;
function update(dt) {
  // 开始屏特殊处理
  if (state.screen === SCREEN.START) {
    if (state._newGameRequested) {
      state._newGameRequested = false;
      startNewGame();
      input.endFrame();
      return;
    }
    if (state._loadRequested) {
      state._loadRequested = false;
      continueGame();
      input.endFrame();
      return;
    }
    input.endFrame();
    return;
  }

  // 时间推进
  const scaledDt = dt * (state.speed || 1);
  state.time += scaledDt;
  // 天数: 每 120 秒一天
  state.day = Math.floor(state.time / 120) + 1;
  state.timeOfDay = (state.time % 120) / 120;

  // 键盘快捷键
  if (input.keysPressed.has("KeyF")) toggleFullscreen();
  if (input.keysPressed.has("Escape") && state.modal) state.modal = null;

  // 经济 tick
  tickEconomy(state, scaledDt);

  // 无线电冷却
  if (state.radio.cooldown > 0) {
    state.radio.cooldown = Math.max(0, state.radio.cooldown - scaledDt);
  }

  // 各屏幕更新
  updatePlayer(state, scaledDt);
  updateExplore(state);
  updateUnlocks(state);
  updateExpeditions(state, scaledDt);
  updateTasks(state);
  checkAchievements(state);
  updateRaid(state, scaledDt);

  // 浮动文字
  for (const f of state.floats) {
    f.life -= scaledDt;
    f.y += f.vy * scaledDt;
  }
  state.floats = state.floats.filter((f) => f.life > 0);

  // 自动存档(每 5 秒)
  saveAccumulator += scaledDt;
  if (saveAccumulator > 5) {
    saveAccumulator = 0;
    state.lastTickAt = Date.now();
    saveGame(state);
  }

  input.endFrame();
}

// 袭击计时(简化)
function updateRaid(state, dt) {
  state.raid.timer -= dt;
  if (state.raid.timer <= 0) {
    state.raid.timer = 600 + Math.random() * 400;
    triggerRaid(state);
  }
}

function triggerRaid(state) {
  // 防御值总和
  let defense = 0;
  for (const f of state.base.facilities) {
    if (f.type === "wall") {
      const s = facilityStats(f.type, f.level);
      defense += s.defense;
    }
  }
  const pop = state.survivors.filter((s) => !s.busy).length;
  const totalDef = defense + pop * 2;
  const attack = 8 + state.day * 1.5 + Math.random() * 10;
  if (totalDef >= attack) {
    addLog(state, `抵御了一次掠夺者袭击! 防御 ${Math.floor(totalDef)} vs 攻击 ${Math.floor(attack)}`, T.primary);
  } else {
    // 失败: 损失资源
    const loss = Math.min(state.res.scrap * 0.3, 15);
    state.res.scrap = Math.max(0, state.res.scrap - loss);
    state.res.food = Math.max(0, state.res.food - 5);
    addLog(state, `袭击突破防线! 损失 ${Math.floor(loss)} 废铁。建造围墙可防御。`, T.danger);
  }
}

// ── 渲染 ──
function render() {
  const W = LOGIC_W;
  const H = LOGIC_H;
  // 清屏
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, W, H);

  if (state.screen === SCREEN.START) {
    drawStartScreen(ctx, state, input, W, H);
    return;
  }

  // 模态激活时屏蔽背景屏幕点击(防穿透): 临时把 pressed 置 false
  // 模态的绘制移到所有背景之后(见 render 末尾),使用真实 pressed
  const modalActive = !!state.modal;
  const realPressed = input.pointer.pressed; // 保存真实点击
  if (modalActive) input.pointer.pressed = false;

  // 内容屏幕
  switch (state.screen) {
    case SCREEN.BASE:
      drawBaseScreen(ctx, state, input, W, H);
      break;
    case SCREEN.MAP:
      drawMapScreen(ctx, state, input, W, H);
      break;
    case SCREEN.ROSTER:
      drawRosterScreen(ctx, state, input, W, H);
      break;
    case SCREEN.DISPATCH:
      drawDispatchScreen(ctx, state, input, W, H);
      break;
    case SCREEN.TASKS:
      drawTasksScreen(ctx, state, input, W, H);
      break;
  }

  // HUD 始终在最上(除开始屏)。模态激活时导航也不响应点击
  if (modalActive) input.pointer.pressed = false;
  drawTopBar(ctx, state, W);
  drawBottomNav(ctx, state, input, W, H);

  // 模态绘制: 恢复真实 pressed,模态在最顶层处理点击
  if (modalActive) {
    input.pointer.pressed = realPressed;
    drawActiveModal(ctx, state, input, W, H);
    input.pointer.pressed = false; // 消费,避免泄漏到下一帧背景
  }

  // 浮动文字(最顶层)
  drawFloats(ctx, state);
}

// 绘制当前激活的模态(根据类型路由到对应屏幕的模态绘制)
import {
  drawUpgradeModal as _drawUpgrade,
  drawBuildModal as _drawBuild,
  drawMapSelectModal as _drawMapSelect,
  drawBaseUpgradeModal as _drawBaseUpgrade,
} from "./screens/screenBase.js";
import { drawAssignModal as _drawAssign, drawDetailModal as _drawDetail } from "./screens/screenRoster.js";
import {
  drawTeamModal as _drawTeam,
  drawEventModal as _drawEvent,
  drawResultModal as _drawResult,
} from "./screens/screenDispatch.js";
import { drawRecruitModal as _drawRecruit } from "./screens/screenTasks.js";
import { drawExploreEventModal as _drawExploreEvent } from "./screens/screenExploreEvent.js";

function drawActiveModal(ctx, state, ui, W, H) {
  const m = state.modal;
  if (!m) return;
  switch (state.screen) {
    case SCREEN.BASE:
      if (m.type === "upgradeFacility") _drawUpgrade(ctx, ui, state, W, H);
      else if (m.type === "buildFacility") _drawBuild(ctx, ui, state, W, H);
      else if (m.type === "mapSelect") _drawMapSelect(ctx, ui, state, W, H);
      else if (m.type === "baseUpgrade") _drawBaseUpgrade(ctx, ui, state, W, H);
      break;
    case SCREEN.ROSTER:
      if (m.type === "survivorDetail") _drawDetail(ctx, ui, state, W, H);
      else if (m.type === "assignSurvivor") _drawAssign(ctx, ui, state, W, H);
      break;
    case SCREEN.MAP:
      if (m.type === "exploreEvent") _drawExploreEvent(ctx, ui, state, W, H);
      break;
    case SCREEN.DISPATCH:
      if (m.type === "formTeam") _drawTeam(ctx, ui, state, W, H);
      else if (m.type === "event") _drawEvent(ctx, ui, state, W, H);
      else if (m.type === "expeditionResult") _drawResult(ctx, ui, state, W, H);
      break;
    case SCREEN.TASKS:
      if (m.type === "recruitConfirm") _drawRecruit(ctx, ui, state, W, H);
      break;
  }
}

function drawFloats(ctx, state) {
  for (const f of state.floats) {
    const a = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = a;
    setFontSmall(ctx, T.fontMd, "700");
    ctx.fillStyle = f.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}
function setFontSmall(ctx, size, weight) {
  ctx.font = `${weight} ${size}px ${T.fontFamily}`;
}

// 全屏切换 (f 键)
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen && el.requestFullscreen().catch(() => {});
    state.fullscreen = true;
  } else {
    document.exitFullscreen && document.exitFullscreen().catch(() => {});
    state.fullscreen = false;
  }
}
document.addEventListener("fullscreenchange", () => {
  state.fullscreen = !!document.fullscreenElement;
  resize();
});

// ── 游戏循环(真实时间) ──
// 注意顺序: 先 render 后 update。
// 即时模式 UI 在 render 中读取 pointer.pressed 触发点击,
// update 随后处理状态变更并 endFrame() 重置 pressed。
let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); // 上限 100ms 避免卡顿后大跳
  lastFrame = now;
  render();
  update(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── 暴露给测试的全局调试入口 ──
window.__game = {
  get state() {
    return state;
  },
  get input() {
    return input;
  },
  resetGame() {
    startNewGame();
  },
};
