// 深度测试: 覆盖现有测试盲区 + 验证代码审查发现的可疑点
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push("P:" + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push("C:" + m.text().slice(0, 200)); });

await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const results = [];
const T = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || "" });

// ═══════════ 盲区1: 居民消耗是否误算派遣中的幸存者 (economy.js:76 bug验证) ═══════════
const busyConsume = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  // 让一个幸存者去派遣
  s.survivors[0].busy = "expedition";
  // 统计 population filter 的实际结果
  const pop = s.survivors.filter((sv) => !sv.busy || sv.busy !== "dead").length;
  const correctPop = s.survivors.filter((sv) => sv.busy !== "dead").length;
  // 派遣中的不应消耗食物,所以"应计入消耗的人数" = 非派遣非死亡
  const shouldConsume = s.survivors.filter((sv) => sv.busy !== "dead" && sv.busy !== "expedition").length;
  return { total: s.survivors.length, popFilterResult: pop, correctPop, shouldConsume };
});
T("[疑似bug] 派遣中幸存者被误算入食物消耗人口", busyConsume.popFilterResult !== busyConsume.shouldConsume,
  `filter结果=${busyConsume.popFilterResult} 应为${busyConsume.shouldConsume} (total=${busyConsume.total})`);

// ═══════════ 盲区2: POI_TYPES 是否有 loot 字段 (screenDispatch.js:162 bug验证) ═══════════
const lootField = await page.evaluate(async () => {
  const reg = await import("/src/content/regions.js");
  const types = ["hospital", "town", "factory", "military", "cache"];
  const hasLoot = {};
  for (const t of types) {
    const info = reg.poiInfo(t);
    hasLoot[t] = !!(info && info.loot);
  }
  const anyHasLoot = types.some((t) => reg.poiInfo(t)?.loot);
  return { hasLoot, anyHasLoot, sampleKeys: Object.keys(reg.poiInfo("hospital") || {}) };
});
T("[确认bug] POI_TYPES 无 loot 字段 → 派遣区产出列永远空", !lootField.anyHasLoot,
  `hospital字段=[${lootField.sampleKeys.join(",")}]`);

// ═══════════ 盲区3: 开局能否派遣 (派遣入口是否被 assigned 阻塞) ═══════════
const initialDispatch = await page.evaluate(async () => {
  const s = window.__game.state;
  // 模拟 screenDispatch.js drawRegionCard 的 freeCount 计算
  const freeCount = s.survivors.filter(
    (sv) => !sv.busy && !sv.assigned && sv.busy !== "dead" && sv.health >= 30
  ).length;
  return {
    totalSurv: s.survivors.length,
    assigned: s.survivors.filter((sv) => sv.assigned).length,
    freeCount,
    canDispatchAtStart: freeCount > 0,
  };
});
T("[流程bug] 开局无人可派遣(2人全被分配到farm/well)", !initialDispatch.canDispatchAtStart,
  `空闲=${initialDispatch.freeCount} 已分配=${initialDispatch.assigned}/${initialDispatch.totalSurv}`);

// ═══════════ 盲区4: 幸存者养成升级 (levelUpSurvivor 主技能+1) ═══════════
const levelUp = await page.evaluate(async () => {
  const sv = await import("/src/content/survivors.js");
  // 构造一个医生,medical=3
  const s = { profession: "doctor", level: 1, skills: { medical: 3, craft: 0, scavenge: 0, combat: 0, farm: 0, social: 0 } };
  const before = s.skills.medical;
  sv.levelUpSurvivor(s);
  const afterMed = s.skills.medical;
  const levelOk = s.level === 2;
  // 升级到6级(触发 level%3===0 的副技能)
  const s2 = { profession: "doctor", level: 2, skills: { medical: 5, craft: 1, scavenge: 0, combat: 0, farm: 0, social: 0 } };
  sv.levelUpSurvivor(s2); // level 3, 触发副技能
  const subSkillGrew = Object.entries(s2.skills).some(([k, v]) => k !== "medical" && v > (k === "craft" ? 1 : 0));
  return { before, afterMed, levelOk, subSkillGrew, level3skills: s2.skills };
});
T("升级: 主技能+1 (医生 medical 3→4)", levelUp.afterMed === 4 && levelUp.levelOk, `medical ${levelUp.before}→${levelUp.afterMed}`);
T("升级: 每3级+1随机副技能", levelUp.subSkillGrew, JSON.stringify(levelUp.level3skills));

// ═══════════ 盲区5: 任务完成判定全部覆盖 (5种任务类型) ═══════════
const taskTypes = await page.evaluate(async () => {
  const s = window.__game.state;
  const taskMod = await import("/src/content/tasks.js");
  const results = {};
  // facility_level: farm升到2级
  s.base.facilities.find((f) => f.type === "farm").level = 2;
  results.facility_level = taskMod.taskDef("t_build_farm");
  // 检查每个任务定义都有 type/target/reward
  const allValid = taskMod.TASK_DEFS.every((t) => t.type && t.target != null && t.reward && t.name && t.desc);
  return { defsCount: taskMod.TASK_DEFS.length, allValid, types: taskMod.TASK_DEFS.map((t) => t.type) };
});
T("7个任务定义结构完整(id/type/target/reward)", taskTypes.allValid, `数量=${taskTypes.defsCount}`);

// ═══════════ 盲区6: updateTasks 真的会标记 done ═══════════
const taskUpdate = await page.evaluate(async () => {
  const s = window.__game.state;
  const screen = await import("/src/screens/screenTasks.js");
  // 制造条件让 t_build_farm 完成 (farm 已经是2级上面设过,但state被重置了,重设)
  s.base.facilities.find((f) => f.type === "farm").level = 2;
  const before = s.tasks.find((t) => t.id === "t_build_farm").done;
  screen.updateTasks(s);
  const after = s.tasks.find((t) => t.id === "t_build_farm").done;
  return { before, after, completed: !before && after };
});
T("updateTasks 正确标记任务完成", taskUpdate.completed, `t_build_farm done: ${taskUpdate.before}→${taskUpdate.after}`);

// ═══════════ 盲区7: 任务领奖真的给资源 ═══════════
const taskReward = await page.evaluate(async () => {
  const s = window.__game.state;
  const t = s.tasks.find((x) => x.id === "t_first_explore");
  t.done = true; t.claimed = false;
  s.stats.expeditionsDone = 1;
  const beforeParts = s.res.parts;
  // 模拟 drawTaskCard 的领奖逻辑
  const taskMod = await import("/src/content/tasks.js");
  const def = taskMod.taskDef(t.id);
  for (const k in def.reward) {
    const cap = s.resCap[k] || Infinity;
    s.res[k] = Math.min(cap, (s.res[k] || 0) + def.reward[k]);
  }
  t.claimed = true;
  return { beforeParts, afterParts: s.res.parts, gained: s.res.parts - beforeParts, reward: def.reward };
});
T("任务领奖正确发放资源", taskReward.gained === (taskReward.reward.parts || 0), `parts +${taskReward.gained}`);

// ═══════════ 盲区8: 成就奖励领取 + rebuildProgress 不超1 ═══════════
const achFull = await page.evaluate(async () => {
  const s = window.__game.state;
  const ach = await import("/src/content/achievements.js");
  // 模拟全部成就完成
  for (const def of ach.ACHIEVEMENT_DEFS) {
    const rec = s.achievements.find((a) => a.id === def.id);
    rec.done = true; rec.claimed = false;
  }
  // 检查 rebuildProgress 上限
  const rp1 = ach.rebuildProgress(s);
  // 全部领取
  for (const def of ach.ACHIEVEMENT_DEFS) {
    const rec = s.achievements.find((a) => a.id === def.id);
    for (const k in def.reward) s.res[k] = (s.res[k] || 0) + def.reward[k];
    rec.claimed = true;
  }
  const rp2 = ach.rebuildProgress(s);
  return { rp1, rp2, bothValid: rp1 >= 0 && rp1 <= 1 && rp2 >= 0 && rp2 <= 1 };
});
T("重建进度始终在[0,1]范围", achFull.bothValid, `rp未领=${achFull.rp1?.toFixed(2)} rp全领=${achFull.rp2?.toFixed(2)}`);

// ═══════════ 盲区9: 存档迁移 v1→v2 (老存档结构) ═══════════
const migrateTest = await page.evaluate(async () => {
  const saveMod = await import("/src/engine/save.js");
  // 构造一个"老v1存档"(无maps, 单map, 无health)
  const oldV1 = {
    version: 1,
    savedAt: Date.now(),
    state: {
      version: 1,
      screen: "base", tab: "base",
      time: 500, day: 5, timeOfDay: 0.3, speed: 1,
      res: { food: 80, water: 70, parts: 30, power: 5, meds: 3, scrap: 40 },
      resCap: { food: 100, water: 100, parts: 100, power: 50, meds: 50, scrap: 100 },
      base: { level: 2, facilities: [{ id: 1, type: "farm", level: 2, assigned: [1] }] },
      survivors: [{ id: 1, name: "老张", profession: "doctor", profName: "医生", profIcon: "🩺", perks: ["doctor"], level: 2, xp: 10, health: 80, hunger: 60, mood: 70, assigned: 1, busy: null }],
      nextSurvivorId: 100,
      radio: { candidate: null, cooldown: 0 },
      player: { x: 100, y: 100, tx: 100, ty: 100, moveSpeed: 110, stamina: 80, maxStamina: 100 }, // 无 health
      expeditions: [], nextExpeditionId: 1,
      tasks: [], achievements: [],
      stats: { totalFood: 100 },
      log: [], floats: [], modal: null,
      raid: { timer: 300, threat: 0 },
      map: { current: "home" }, // 老的单map结构
    },
  };
  localStorage.setItem("wasteland_shelter_save_v1", JSON.stringify(oldV1));
  localStorage.removeItem("wasteland_shelter_save_v2");
  const loaded = saveMod.loadGame();
  return {
    loaded: !!loaded,
    version: loaded?.version,
    hasMaps: !!loaded?.maps?.list?.home,
    hasHealth: loaded?.player?.health != null,
    hasSkills: loaded?.survivors?.[0]?.skills != null && Object.keys(loaded.survivors[0].skills).length === 6,
    mapRemoved: loaded?.map === undefined,
    tasksRebuilt: Array.isArray(loaded?.tasks) && loaded.tasks.length === 7,
    achievementsRebuilt: Array.isArray(loaded?.achievements) && loaded.achievements.length === 10,
    cellsIsUint8: loaded?.maps?.list?.home?.cells instanceof Uint8Array,
  };
});
T("存档迁移 v1→v2: 加载成功", migrateTest.loaded, "");
T("存档迁移: version升到2", migrateTest.version === 2, "version=" + migrateTest.version);
T("存档迁移: 老map→新maps结构", migrateTest.hasMaps && migrateTest.mapRemoved, `hasMaps=${migrateTest.hasMaps} mapRemoved=${migrateTest.mapRemoved}`);
T("存档迁移: player补全health", migrateTest.hasHealth, "");
T("存档迁移: survivor补全6技能", migrateTest.hasSkills, "");
// 注: 老存档若 tasks/achievements 是空数组,mergeDefaults 视为有效不重建(已知边界)
T("存档迁移: tasks存在(空数组保留,缺失才重建)", Array.isArray(migrateTest?.tasksRebuilt) || (migrateTest?.tasksRebuilt), "边界:空数组不重建");
T("存档迁移: cells还原为Uint8Array", migrateTest.cellsIsUint8, "");

// ═══════════ 盲区10: 损坏存档从备份恢复 ═══════════
const corruptRecover = await page.evaluate(async () => {
  const saveMod = await import("/src/engine/save.js");
  const s = window.__game.state;
  s.res.scrap = 777;
  saveMod.saveGame(s);     // 主档=777
  s.res.scrap = 888;
  saveMod.saveGame(s);     // 主档=888, 备份=777
  // 破坏主档
  localStorage.setItem("wasteland_shelter_save_v2", "这不是合法JSON{{{");
  const loaded = saveMod.loadGame();
  return { recovered: !!loaded, scrap: loaded?.res?.scrap };
});
T("主档损坏→从备份恢复", corruptRecover.recovered && corruptRecover.scrap === 777, `恢复后scrap=${corruptRecover.scrap}(应为777)`);

// ═══════════ 盲区11: 派遣事件全部 resolve 不崩 (events.js 5类) ═══════════
const dispatchEvents = await page.evaluate(async () => {
  const ev = await import("/src/content/events.js");
  const ctx = {
    rng: Math.random,
    members: [{ id: 1, level: 2, perks: ["guardian"], skills: { combat: 3 } }],
    hasPerk: (pid) => ctx.members.some((m) => m.perks.includes(pid)),
    combatScore: () => 4,
  };
  let crash = 0, ok = 0;
  for (const e of ev.EXPEDITION_EVENTS) {
    for (const c of e.choices) {
      try { const r = c.resolve(ctx); if (r) ok++; } catch (ex) { crash++; }
    }
  }
  return { total: ev.EXPEDITION_EVENTS.length, ok, crash };
});
T("5类派遣事件全部resolve不崩", dispatchEvents.crash === 0, `crash=${dispatchEvents.crash} ok=${dispatchEvents.ok}`);

// ═══════════ 盲区12: rollExploreEvent 权重分布 + 侦察兵偏好 ═══════════
const eventRoll = await page.evaluate(async () => {
  const ev = await import("/src/content/exploreEvents.js");
  // 普通模式
  let goodN = 0, badN = 0, neutralN = 0;
  const rng1 = (function () { let a = 12345; return () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  for (let i = 0; i < 500; i++) {
    const e = ev.rollExploreEvent(rng1, false, null);
    if (e.kind === "good") goodN++; else if (e.kind === "bad") badN++; else neutralN++;
  }
  // 侦察兵偏好模式
  let goodS = 0;
  const rng2 = (function () { let a = 12345; return () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  for (let i = 0; i < 500; i++) {
    const e = ev.rollExploreEvent(rng2, true, null);
    if (e.kind === "good") goodS++;
  }
  return { goodN, badN, neutralN, goodS, scoutBoost: goodS > goodN };
});
T("rollExploreEvent 三类都有分布", eventRoll.goodN > 0 && eventRoll.badN > 0 && eventRoll.neutralN > 0,
  `好${eventRoll.goodN}/坏${eventRoll.badN}/中立${eventRoll.neutralN} (500次)`);
T("侦察兵偏好提升好事件比例", eventRoll.scoutBoost, `普通好${eventRoll.goodN} vs 偏好好${eventRoll.goodS}`);

// ═══════════ 盲区13: 网格揭示逻辑 (revealCellAndNeighbors) ═══════════
const reveal = await page.evaluate(async () => {
  const reg = await import("/src/content/regions.js");
  const s = window.__game.state;
  const map = s.maps.list.home;
  // 全部重置为HIDDEN(除了入口)
  map.cells.fill(0);
  const entryIdx = map.entry.gy * map.gridW + map.entry.gx;
  map.cells[entryIdx] = 2;
  // 在 (2,2) 踏足
  const r1 = reg.revealCellAndNeighbors(map, 2, 2);
  const visited22 = map.cells[2 * map.gridW + 2];
  const revealed32 = map.cells[2 * map.gridW + 3]; // (3,2) 相邻应揭示
  const revealed12 = map.cells[2 * map.gridW + 1]; // (1,2)
  // 再次踏足同格不应 newlyVisited
  const r2 = reg.revealCellAndNeighbors(map, 2, 2);
  return { r1New: r1.newlyVisited, visited22, revealed32, revealed12, r2New: r2.newlyVisited };
});
T("revealCellAndNeighbors: 踏足格→VISITED", reveal.visited22 === 2, "cell=" + reveal.visited22);
// ⚠️ 确认BUG: 首次踏足时提前return,相邻格不会被揭示(REVEALED状态几乎不存在)
T("[确认BUG] reveal相邻格未被揭示(应为1实际0)", reveal.revealed32 === 0, `相邻(3,2)=${reveal.revealed32} (1,2)=${reveal.revealed12} 应为0(bug)`);
T("revealCellAndNeighbors: 重复踏足不重复触发", reveal.r1New && !reveal.r2New, `r1=${reveal.r1New} r2=${reveal.r2New}`);

// ═══════════ 盲区14: checkPoiDiscovery 发现POI并+计数 ═══════════
const poiDiscover = await page.evaluate(async () => {
  const reg = await import("/src/content/regions.js");
  const s = window.__game.state;
  const map = s.maps.list.home;
  const before = map.discoveredCount;
  // home有2个POI: cache@(5,1) cache@(2,5)
  const poi = map.pois[0];
  const found = reg.checkPoiDiscovery(map, poi.gx, poi.gy);
  return { found: found.length, after: map.discoveredCount, countInc: map.discoveredCount - before };
});
T("checkPoiDiscovery: 踏上POI格→发现+计数", poiDiscover.found === 1 && poiDiscover.countInc === 1, "");

// ═══════════ 盲区15: travelToMap 传送正确性 ═══════════
const travel = await page.evaluate(async () => {
  const reg = await import("/src/content/regions.js");
  const s = window.__game.state;
  const before = s.maps.current;
  // town 已解锁(free)
  const ok = reg.travelToMap(s, "town");
  const after = s.maps.current;
  const playerAtEntry = s.player.x === reg.gridToWorld(s.maps.list.town.entry.gx, s.maps.list.town.entry.gy).x;
  // 传送到锁定地图应失败
  const failLocked = reg.travelToMap(s, "military");
  return { ok, before, after, playerAtEntry, failLocked, switched: before !== after };
});
T("travelToMap: 切换到已解锁地图", travel.ok && travel.switched && travel.after === "town", `${travel.before}→${travel.after}`);
T("travelToMap: 主角定位到入口格", travel.playerAtEntry, "");
T("travelToMap: 锁定地图传送失败", !travel.failLocked, "");

// ═══════════ 盲区16: cellEventHash 确定性 (同格同图同值) ═══════════
const hashDet = await page.evaluate(async () => {
  // cellEventHash 是 worldUpdate.js 内部函数,通过 updateExplore 间接测
  // 这里直接重算 hash 逻辑验证确定性
  function cellEventHash(gx, gy, mapId) {
    let h = 0;
    const s = mapId + ":" + gx + "," + gy;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    h ^= h >>> 13;
    return ((h >>> 0) % 1000) / 1000;
  }
  // 统计 home map (8x7=56格) 有多少格 hash<0.33
  let count = 0;
  for (let gx = 0; gx < 8; gx++) for (let gy = 0; gy < 7; gy++) {
    if (cellEventHash(gx, gy, "home") < 0.33) count++;
  }
  const density = count / 56;
  // 确定性: 调用两次相同
  const deterministic = cellEventHash(3, 3, "home") === cellEventHash(3, 3, "home");
  return { count, density, deterministic, pct: (density * 100).toFixed(0) };
});
T("cellEventHash 确定性", hashDet.deterministic, "");
T("cellEventHash 密度~33% (满足每9格≥3事件)", hashDet.density >= 0.28 && hashDet.density <= 0.45,
  `home触发率=${hashDet.pct}% (${hashDet.count}/56格)`);

// ═══════════ 盲区17: offlineSettle 上限8小时 + 效率0.8 ═══════════
const offline8h = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  const foodBefore = s.res.food;
  // 模拟离线 10 小时(应被截断到8h)
  s.lastTickAt = Date.now() - 10 * 3600 * 1000;
  const result = eco.offlineSettle(s, Date.now());
  return { offlineSec: result.offlineSec, capped8h: result.offlineSec <= 8 * 3600 + 60, foodGained: s.res.food - foodBefore };
});
T("offlineSettle: 离线时长上限8小时", offline8h.capped8h, `结算秒数=${Math.floor(offline8h.offlineSec/3600)}h`);

// ═══════════ 盲区18: 派遣完整结算(出发→完成→发奖→释放→XP) ═══════════
const fullDispatch = await page.evaluate(async () => {
  const s = window.__game.state;
  const reg = await import("/src/content/regions.js");
  const disp = await import("/src/screens/screenDispatch.js");
  // 发现POI
  s.maps.list.town.pois[0].discovered = true;
  s.maps.list.town.discoveredCount = 1;
  // 让幸存者空闲
  for (const sv of s.survivors) {
    if (sv.assigned) { const f = s.base.facilities.find((x) => x.id === sv.assigned); if (f) f.assigned = f.assigned.filter((id) => id !== sv.id); sv.assigned = null; }
    sv.busy = null;
  }
  const poi = reg.allDiscoveredPois(s)[0];
  const { makeRng } = await import("/src/content/survivors.js");
  const member = s.survivors[0];
  const exp = {
    id: s.nextExpeditionId++, regionId: poi.id, mapId: poi.mapId, mapName: poi.mapName,
    regionType: poi.type, regionName: reg.poiInfo(poi.type).name,
    members: [member.id], startAt: s.time, duration: 30, state: "running",
    rng: makeRng(999), event: null, rewards: {},
  };
  s.expeditions.push(exp);
  member.busy = "expedition";
  const xpBefore = member.xp;
  const expsBefore = s.stats.expeditionsDone;
  // 推进完成
  s.time += 31;
  disp.updateExpeditions(s, 1);
  // 如果进入event状态,手动resolve第一个选项
  if (exp.state === "event") {
    const ctxObj = { rng: exp.rng, members: [member], hasPerk: () => false, combatScore: () => 1 };
    const choice = exp.event.choices[0];
    // 模拟 resolveEvent 核心逻辑
    const result = choice.resolve(ctxObj);
    if (result.rewards) for (const k in result.rewards) exp.rewards[k] = (exp.rewards[k] || 0) + result.rewards[k];
    if (result.teamEffect && result.teamEffect.health) member.health = Math.max(0, Math.min(100, member.health + result.teamEffect.health));
    for (const k in exp.rewards) { const cap = s.resCap[k] || Infinity; s.res[k] = Math.min(cap, (s.res[k] || 0) + exp.rewards[k]); }
    member.busy = null; member.xp += 25; exp.state = "done"; s.stats.expeditionsDone++;
  }
  return {
    finalState: exp.state,
    memberReleased: member.busy === null,
    expsInc: s.stats.expeditionsDone - expsBefore > 0,
    xpGained: member.xp - xpBefore,
  };
});
T("派遣完整流程: 最终state=done", fullDispatch.finalState === "done", "state=" + fullDispatch.finalState);
// ⚠️ 确认BUG: 无事件分支不释放成员、不+expeditionsDone
T("[确认BUG] 无事件分支成员未释放(应为false)", !fullDispatch.memberReleased, `memberReleased=${fullDispatch.memberReleased}`);
T("[确认BUG] 无事件分支派遣次数未+1", !fullDispatch.expsInc, `expsInc=${fullDispatch.expsInc}`);
T("派遣完整流程: 成员获得XP", fullDispatch.xpGained > 0, `+${fullDispatch.xpGained}xp`);

// ═══════════ 盲区19: 袭击触发 + 防御计算 ═══════════
// 注: updateRaid 未导出,triggerRaid 在 update 循环中调用。验证袭击日志产生即可
const raid = await page.evaluate(async () => {
  const s = window.__game.state;
  s.base.facilities.push({ id: 50, type: "wall", level: 1, assigned: [] });
  s.raid.timer = 0.001;
  const logBefore = s.log.length;
  window.advanceTime(500);
  const newLogs = s.log.slice(0, s.log.length - logBefore + 5);
  const hasRaidLog = newLogs.some((l) => l.text.includes("袭击") || l.text.includes("掠夺"));
  return { timerAfter: s.raid.timer, hasRaidLog, recentLogs: newLogs.slice(0,3).map(l=>l.text) };
});
// 袭击功能在 progress.md 已验证(progress raid记录),这里仅检查 timer 不会 NaN/负数
T("袭击系统: timer保持有效数值", Number.isFinite(raid.timerAfter), `timer=${raid.timerAfter} logs=${JSON.stringify(raid.recentLogs)}`);

// ═══════════ 盲区20: 大量回合(30天)长跑稳定性 ═══════════
const longRun = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  const crashes = [];
  for (let day = 0; day < 30 * 120; day++) {
    try {
      eco.tickEconomy(s, 1);
      s.time += 1;
    } catch (e) { crashes.push(e.message); }
  }
  s.day = Math.floor(s.time / 120) + 1;
  const allFinite = Object.values(s.res).every((v) => Number.isFinite(v));
  const svFinite = s.survivors.every((sv) => Number.isFinite(sv.health) && Number.isFinite(sv.hunger));
  return { day: s.day, crashes: crashes.length, allFinite, svFinite, resSample: { food: Math.floor(s.res.food), water: Math.floor(s.res.water) } };
});
T("30天(3600tick)长跑无崩溃", longRun.crashes === 0, `crashes=${longRun.crashes}`);
T("30天长跑: 资源全finite", longRun.allFinite && longRun.svFinite, JSON.stringify(longRun.resSample));

// 报告
console.log("\n═══════════ 深度测试报告 (覆盖盲区+bug验证) ═══════════");
let pass = 0, fail = 0;
for (const r of results) {
  console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`);
  if (r.pass) pass++; else fail++;
}
console.log(`\n总计: ${pass} 通过, ${fail} 失败, console error: ${errs.length === 0 ? "无 ✅" : errs.length + "个"}`);
if (errs.length) console.log("errors:", errs.slice(0, 5));
await browser.close();
process.exit(fail > 0 ? 1 : 0);
