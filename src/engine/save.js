// 存档系统 v2: 版本化 + 有序迁移 + 深度默认值合并 + 备份 + 完整性自检
// 设计目标: 以后加新字段/新内容(物品等),老存档永不丢、永不崩
//
// 加新版本的流程(以后用):
//   1. 在 state.js 的 createNewState 加新字段默认值
//   2. 提升 CURRENT_VERSION (如 2→3)
//   3. 在下面 migrations 加 migrations[3] = (s) => { /* 老存档补新字段 */ }
//   完成。老存档读档时自动: 备份→逐步迁移→合并默认→验证

import { createMaps, CELL } from "../content/regions.js";
import { createInitialAchievements } from "../content/achievements.js";
import { createInitialTasks } from "../content/tasks.js";
import { createInitialFacilities } from "../content/facilities.js";
import { CURRENT_VERSION, DEFAULTS } from "./state.js";
import { makeRng } from "../content/survivors.js";

const SAVE_KEY = "wasteland_shelter_save_v2";
const BACKUP_KEY = "wasteland_shelter_save_v2_backup";
const LEGACY_KEY = "wasteland_shelter_save_v1"; // 老版本存档 key

// ── 版本迁移链 ──
// 每个 migrations[N] 把版本 N-1 的存档升级到 N
// 读档时按顺序应用 migrations[oldVer+1 .. CURRENT_VERSION]
const migrations = {
  // v1 → v2: 加入 health/achievements/skills/maps 等新字段
  2: (s) => {
    // 老 v1 是单 map 结构,丢弃重建为多地图
    if (s.map && !s.maps) {
      delete s.map;
    }
    // player.health (v1 无此字段)
    if (s.player) {
      if (s.player.health == null) s.player.health = 100;
      if (s.player.maxHealth == null) s.player.maxHealth = 100;
    }
    // 重建 maps 结构(若缺失)
    if (!s.maps) s.maps = createMaps();
    s.version = 2;
    // 注: 深度字段(survivor.skills 等)由 mergeDefaults 统一补,这里只做版本特定逻辑
  },
  // v2 → v3: 加入 流浪商队(caravan)字段
  3: (s) => {
    if (!s.caravan) s.caravan = { timer: 720, here: false, leaveTimer: 0, offers: [] };
    s.version = 3;
  },
  // v3 → v4: 加入 物品/背包系统
  4: (s) => {
    if (!s.inventory) s.inventory = {};
    s.version = 4;
  },
  // v4 → v5: 加入 科技树
  5: (s) => {
    if (!s.tech) s.tech = { defense: 0, production: 0, bio: 0 };
    s.version = 5;
  },
  // v5 → v6: 加入 装备系统 + 转生
  6: (s) => {
    if (!s.equipment) s.equipment = { equipped: {}, blueprints: [], storage: [] };
    if (!s.prestige) s.prestige = { generation: 1, relics: 0, bonusMult: 0, unlockedEndings: [] };
    s.version = 6;
  },
};

export function saveGame(state) {
  try {
    // 存档前确保版本号正确
    state.version = CURRENT_VERSION;
    const payload = {
      version: CURRENT_VERSION,
      savedAt: Date.now(),
      state: serializeState(state),
    };
    const serialized = JSON.stringify(payload);
    // 滚动备份: 把上一次的有效存档存到 BACKUP_KEY,主档损坏时可恢复
    try {
      const prev = localStorage.getItem(SAVE_KEY);
      if (prev) localStorage.setItem(BACKUP_KEY, prev);
    } catch {}
    localStorage.setItem(SAVE_KEY, serialized);
    return true;
  } catch (e) {
    console.warn("[save] save failed", e);
    return false;
  }
}

export function loadGame() {
  // 1. 尝试主存档(v2)
  let payload = readPayload(SAVE_KEY);
  // 2. 主存档损坏 → 尝试备份
  if (!payload) {
    payload = readPayload(BACKUP_KEY);
    if (payload) console.warn("[save] 主存档损坏,从备份恢复");
  }
  // 3. 都没有 → 尝试老版本(v1)存档并迁移
  if (!payload) {
    payload = readPayload(LEGACY_KEY);
    if (payload) {
      console.warn("[save] 检测到 v1 老存档,迁移到 v2");
      // 迁移后删旧 key,避免重复迁移
      try { localStorage.removeItem(LEGACY_KEY); } catch {}
    }
  }
  if (!payload) return null;

  try {
    let s = payload.state;
    const savedAt = payload.savedAt || Date.now();
    const oldVer = s.version || 1;

    // 迁移前备份原始数据(防止迁移失败丢档)
    if (oldVer < CURRENT_VERSION) {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
      } catch {}
    }

    // 应用迁移链: v1→v2→v3... 直到当前版本
    s = applyMigrations(s, oldVer);
    // 深度合并默认值(补全任何缺失字段,防 NPE)
    s = mergeDefaults(s);
    // Uint8Array 还原 + rng 重建
    s = restoreRuntime(s);
    // 完整性自检 + 修复
    s = validateState(s);
    // 读档后强制清弹窗(避免指向已变化的实体)
    s.modal = null;
    s.lastTickAt = savedAt;
    s.version = CURRENT_VERSION;
    return s;
  } catch (e) {
    console.error("[save] load/migrate failed", e);
    return null;
  }
}

// 读取并解析 payload,失败返回 null
function readPayload(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.state) return null;
    return payload;
  } catch (e) {
    console.warn("[save] parse failed for", key, e);
    return null;
  }
}

// 应用迁移链
function applyMigrations(s, oldVer) {
  let v = oldVer;
  while (v < CURRENT_VERSION) {
    const migrator = migrations[v + 1];
    if (migrator) {
      migrator(s);
    }
    v += 1;
    s.version = v;
  }
  return s;
}

// 深度合并默认值: 递归给缺失字段补默认,绝不留 undefined
function mergeDefaults(s) {
  if (!s) s = {};
  // 顶层基础字段
  if (!s.floats) s.floats = [];
  if (!s.log) s.log = [];
  if (!s.expeditions) s.expeditions = [];
  if (!s.nextSurvivorId) s.nextSurvivorId = 100;
  if (!s.nextExpeditionId) s.nextExpeditionId = 1;
  if (s.screen == null) s.screen = "base";
  if (s.tab == null) s.tab = "base";
  if (s.time == null) s.time = 0;
  if (s.day == null) s.day = 1;
  if (s.timeOfDay == null) s.timeOfDay = 0.3;
  if (s.speed == null) s.speed = 1;
  if (s.fullscreen == null) s.fullscreen = false;

  // res / resCap: 合并每个 key
  mergeObj(s, "res", DEFAULTS.res);
  mergeObj(s, "resCap", DEFAULTS.resCap);
  // stats: 合并每个子字段(修解锁/成就 NaN)
  mergeObj(s, "stats", DEFAULTS.stats);

  // base
  if (!s.base) s.base = { level: 1, facilities: createInitialFacilities() };
  if (s.base.level == null) s.base.level = 1;
  if (!Array.isArray(s.base.facilities)) s.base.facilities = createInitialFacilities();
  // 每个 facility 补字段
  for (const f of s.base.facilities) {
    if (f.level == null) f.level = DEFAULTS.facility.level;
    if (!Array.isArray(f.assigned)) f.assigned = [];
  }

  // survivors: 每个补字段(修 skills/perks NPE 热点)
  if (!Array.isArray(s.survivors)) s.survivors = [];
  for (const sv of s.survivors) {
    if (!Array.isArray(sv.perks)) sv.perks = [...DEFAULTS.survivor.perks];
    if (!sv.skills) {
      sv.skills = { ...DEFAULTS.survivor.skills };
    } else {
      // 补 skills 里缺失的 key
      for (const k in DEFAULTS.survivor.skills) {
        if (sv.skills[k] == null) sv.skills[k] = 0;
      }
    }
    if (sv.health == null) sv.health = DEFAULTS.survivor.health;
    if (sv.maxHealth == null) sv.maxHealth = DEFAULTS.survivor.maxHealth;
    if (sv.hunger == null) sv.hunger = DEFAULTS.survivor.hunger;
    if (sv.mood == null) sv.mood = DEFAULTS.survivor.mood;
    if (sv.assigned == null) sv.assigned = DEFAULTS.survivor.assigned;
    if (sv.busy == null) sv.busy = DEFAULTS.survivor.busy;
    if (sv.xp == null) sv.xp = DEFAULTS.survivor.xp;
    if (sv.level == null) sv.level = DEFAULTS.survivor.level;
    if (sv.xpNeed == null) sv.xpNeed = 50 + (sv.level || 1) * 30;
    // avatarImg 不补(运行时重分配)
    delete sv.avatarImg;
  }

  // radio
  if (!s.radio) s.radio = { ...DEFAULTS.radio };
  if (s.radio.candidate == null) s.radio.candidate = null;
  if (s.radio.cooldown == null) s.radio.cooldown = 0;

  // player: 合并字段
  if (!s.player) s.player = { ...DEFAULTS.player };
  for (const k in DEFAULTS.player) {
    if (s.player[k] == null) s.player[k] = DEFAULTS.player[k];
  }

  // raid
  if (!s.raid) s.raid = { ...DEFAULTS.raid };
  if (s.raid.timer == null) s.raid.timer = DEFAULTS.raid.timer;
  if (s.raid.threat == null) s.raid.threat = DEFAULTS.raid.threat;

  // guide(新手引导)
  if (!s.guide) s.guide = { ...DEFAULTS.guide };
  if (!Array.isArray(s.guide.dismissed)) s.guide.dismissed = [];
  for (const k of ["explored", "dispatched", "built", "recruited"]) {
    if (s.guide[k] == null) s.guide[k] = false;
  }

  // caravan(流浪商队)
  if (!s.caravan) s.caravan = { ...DEFAULTS.caravan };
  if (s.caravan.timer == null) s.caravan.timer = DEFAULTS.caravan.timer;
  if (s.caravan.here == null) s.caravan.here = false;
  if (s.caravan.leaveTimer == null) s.caravan.leaveTimer = 0;
  if (!Array.isArray(s.caravan.offers)) s.caravan.offers = [];

  // inventory(物品/背包)
  if (!s.inventory || typeof s.inventory !== "object") s.inventory = {};

  // tech(科技树)
  if (!s.tech) s.tech = { ...DEFAULTS.tech };
  for (const k of ["defense", "production", "bio"]) {
    if (s.tech[k] == null) s.tech[k] = 0;
  }

  // equipment(装备系统)
  if (!s.equipment) s.equipment = { ...DEFAULTS.equipment };
  if (!s.equipment.equipped || typeof s.equipment.equipped !== "object") s.equipment.equipped = {};
  if (!Array.isArray(s.equipment.blueprints)) s.equipment.blueprints = [];
  if (!Array.isArray(s.equipment.storage)) s.equipment.storage = [];

  // prestige(转生)
  if (!s.prestige) s.prestige = { ...DEFAULTS.prestige };
  for (const k of ["generation", "relics", "bonusMult"]) {
    if (s.prestige[k] == null) s.prestige[k] = k === "generation" ? 1 : 0;
  }
  if (!Array.isArray(s.prestige.unlockedEndings)) s.prestige.unlockedEndings = [];

  // maps: 重建若缺失,补全缺失地图
  if (!s.maps) s.maps = createMaps();
  if (!s.maps.list) s.maps.list = {};
  if (!s.maps.current) s.maps.current = "home";
  const freshMaps = createMaps();
  for (const id in freshMaps.list) {
    if (!s.maps.list[id]) s.maps.list[id] = freshMaps.list[id];
  }

  // tasks / achievements: 缺失或空数组则重建(空数组也不保留,避免老存档迁移后任务列表为空)
  if (!Array.isArray(s.tasks) || s.tasks.length === 0) s.tasks = createInitialTasks();
  if (!Array.isArray(s.achievements) || s.achievements.length === 0) s.achievements = createInitialAchievements();

  return s;
}

// 合并对象字段: target[key] 缺失则用 defaults[key]
function mergeObj(target, key, defaults) {
  if (!target[key] || typeof target[key] !== "object") target[key] = {};
  for (const k in defaults) {
    if (target[key][k] == null) target[key][k] = defaults[k];
  }
}

// 还原运行时不可序列化的数据: Uint8Array + expedition.rng
function restoreRuntime(s) {
  // 地图 cells → Uint8Array
  if (s.maps && s.maps.list) {
    for (const id in s.maps.list) {
      const m = s.maps.list[id];
      if (m.cells) {
        if (m.cells.__u8) {
          m.cells = new Uint8Array(m.cells.__u8);
        } else if (!(m.cells instanceof Uint8Array)) {
          // 普通数组或其他 → 重建
          m.cells = new Uint8Array(m.gridW * m.gridH);
        }
      } else {
        m.cells = new Uint8Array((m.gridW || 8) * (m.gridH || 7));
      }
      // pois 补字段
      if (Array.isArray(m.pois)) {
        for (const p of m.pois) {
          if (p.discovered == null) p.discovered = false;
          if (p.id == null) p.id = Math.floor(Math.random() * 1e6);
        }
      } else {
        m.pois = [];
      }
      if (m.discoveredCount == null) m.discoveredCount = 0;
      if (m.unlocked == null) m.unlocked = false;
    }
  }
  // expedition.rng 重建(最隐蔽的雷: 函数无法序列化,进行中的派遣读档后必崩)
  if (Array.isArray(s.expeditions)) {
    for (const e of s.expeditions) {
      // 补 expedition 基本字段
      if (!Array.isArray(e.members)) e.members = [];
      if (!e.rewards) e.rewards = {};
      if (e.event === undefined) e.event = null;
      if (!e.state) e.state = "done";
      // 对未完成的派遣重建 rng(用 startAt+id 确定性种子)
      if (e.state !== "done" && typeof e.rng !== "function") {
        const seed = ((e.startAt || 0) * 7919 + (e.id || 1)) % 1e9;
        e.rng = makeRng(Math.floor(Math.abs(seed)));
      }
    }
  }
  return s;
}

// 完整性自检: 关键字段类型不对则用默认覆盖(降级恢复,不崩)
function validateState(s) {
  const checks = [
    ["survivors", Array.isArray(s.survivors), () => (s.survivors = [])],
    ["base.facilities", Array.isArray(s.base?.facilities), () => (s.base.facilities = createInitialFacilities())],
    ["expeditions", Array.isArray(s.expeditions), () => (s.expeditions = [])],
    ["res", s.res && typeof s.res === "object", () => (s.res = { ...DEFAULTS.res })],
    ["maps.list", s.maps?.list && typeof s.maps.list === "object", () => (s.maps = createMaps())],
    ["player", s.player && typeof s.player === "object", () => (s.player = { ...DEFAULTS.player })],
  ];
  for (const [name, ok, fix] of checks) {
    if (!ok) {
      console.warn(`[save] validate: ${name} 异常,用默认值恢复`);
      fix();
    }
  }
  return s;
}

// 序列化: Uint8Array → {__u8:[...]}
function serializeState(state) {
  return JSON.parse(JSON.stringify(state, (key, value) => {
    if (value instanceof Uint8Array) return { __u8: Array.from(value) };
    return value;
  }));
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY) || !!localStorage.getItem(BACKUP_KEY) || !!localStorage.getItem(LEGACY_KEY);
  } catch {
    return false;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {}
}

// 兼容旧导出(migrate 现已内嵌到 loadGame,但保留函数避免外部引用断裂)
export function migrate(state) {
  return mergeDefaults(state);
}
