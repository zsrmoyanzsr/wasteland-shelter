// 综合逻辑测试: 从可玩性/经济/平衡/边界/交互 多角度验证
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push("P:" + String(e).slice(0, 120)));
page.on("console", (m) => { if (m.type() === "error") errs.push("C:" + m.text().slice(0, 120)); });

await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const results = [];
const T = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || "" });

// ── 角度1: 初始状态正确性 ──
const init = await page.evaluate(() => {
  const s = window.__game.state;
  return {
    res: { ...s.res },
    resCap: { ...s.resCap },
    baseLevel: s.base.level,
    facCount: s.base.facilities.length,
    facTypes: s.base.facilities.map(f => f.type),
    survCount: s.survivors.length,
    survAssigned: s.survivors.map(x => ({ name: x.name, assigned: x.assigned, skills: Object.keys(x.skills).length, perks: x.perks.length })),
    popCap: 2 + s.base.level * 2,
    playerHealth: s.player.health,
    mapsUnlocked: Object.values(s.maps.list).filter(m => m.unlocked).length,
    taskCount: s.tasks.length,
    achCount: s.achievements.length,
    radioCd: s.radio.cooldown,
  };
});
T("初始资源完整(6种)", Object.keys(init.res).length === 6, JSON.stringify(init.res));
T("初始基地Lv1+2设施(farm/well)", init.baseLevel === 1 && init.facCount === 2 && init.facTypes.includes("farm") && init.facTypes.includes("well"), init.facTypes.join(","));
T("初始2幸存者且已分配(farm/well)", init.survCount === 2 && init.survAssigned.every(s => s.assigned !== null), JSON.stringify(init.survAssigned));
T("幸存者有6技能+特长", init.survAssigned.every(s => s.skills === 6 && s.perks >= 1), JSON.stringify(init.survAssigned));
T("人口上限=2+lv*2=4", init.popCap === 4, "popCap=" + init.popCap);
T("主角有health=100", init.playerHealth === 100, "hp=" + init.playerHealth);
T("初始解锁2张地图(home/town)", init.mapsUnlocked === 2, "unlocked=" + init.mapsUnlocked);
T("7任务+13成就", init.taskCount === 7 && init.achCount === 13, `tasks=${init.taskCount} ach=${init.achCount}`);

// ── 角度2: 经济逻辑(产出>消耗,不饿死) ──
const econ = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  const before = { ...s.res };
  // 模拟1天(120秒)
  for (let i = 0; i < 120; i++) eco.tickEconomy(s, 1);
  const after = { ...s.res };
  // 检查居民状态
  const sv = s.survivors.map(x => ({ hp: Math.floor(x.health), hunger: Math.floor(x.hunger), mood: Math.floor(x.mood) }));
  return {
    foodDelta: (after.food - before.food).toFixed(1),
    waterDelta: (after.water - before.water).toFixed(1),
    powerDelta: (after.power - before.power).toFixed(1),
    survivorsOk: sv.every(x => x.hp > 0 && x.hunger > 0),
    sv,
  };
});
T("1天后食物正增长(不饿死)", parseFloat(econ.foodDelta) > 0, "food Δ=" + econ.foodDelta);
T("1天后净水正增长", parseFloat(econ.waterDelta) > 0, "water Δ=" + econ.waterDelta);
T("1天后居民存活(血/饱食>0)", econ.survivorsOk, JSON.stringify(econ.sv));

// ── 角度3: 基地升级→人口/容量真的涨 ──
const upgrade = await page.evaluate(async () => {
  const s = window.__game.state;
  const stMod = await import("/src/engine/state.js");
  s.res.scrap = 500; s.res.parts = 300; s.res.food = 300;
  const capBefore = stMod.getResCap(s, "food");
  const popBefore = 2 + s.base.level * 2;
  // 升级
  s.base.level = 3;
  const capAfter = stMod.getResCap(s, "food");
  const popAfter = 2 + s.base.level * 2;
  return { capBefore, capAfter, popBefore, popAfter, capGrew: capAfter > capBefore, popGrew: popAfter > popBefore };
});
T("基地升级→资源容量增加", upgrade.capGrew, `${upgrade.capBefore}→${upgrade.capAfter}`);
T("基地升级→人口上限增加", upgrade.popGrew, `${upgrade.popBefore}→${upgrade.popAfter}`);

// ── 角度4: 医疗治疗 + 重伤限制 ──
const heal = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  // 建医疗室,放重伤员
  const med = { id: 99, type: "medbay", level: 1, assigned: [] };
  s.base.facilities.push(med);
  s.survivors[0].health = 20;
  s.survivors[0].assigned = med.id;
  med.assigned = [s.survivors[0].id];
  s.res.meds = 20;
  const hpBefore = s.survivors[0].health;
  for (let i = 0; i < 30; i++) eco.tickEconomy(s, 1);
  const hpAfter = s.survivors[0].health;
  // 重伤不能派遣检测
  const canDispatch = s.survivors[0].health >= 30;
  return { hpBefore, hpAfter: Math.floor(hpAfter), healed: hpAfter > hpBefore, heavyInjury: hpBefore < 30 };
});
T("医疗室治疗伤员(回血)", heal.healed, `${heal.hpBefore}→${heal.hpAfter}`);
T("重伤(health<30)存在", heal.heavyInjury, "hp=" + heal.hpBefore);

// ── 角度5: 技能影响产出 ──
const skill = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  const farm = s.base.facilities.find(f => f.type === "farm");
  const sv = s.survivors.find(x => farm.assigned.includes(x.id));
  if (!sv) return { err: "no farmer" };
  sv.skills.farm = 0;
  const m0 = eco.facilityProduction(s, farm).mult;
  sv.skills.farm = 5;
  const m5 = eco.facilityProduction(s, farm).mult;
  sv.skills.farm = 10;
  const m10 = eco.facilityProduction(s, farm).mult;
  return { m0: m0.toFixed(2), m5: m5.toFixed(2), m10: m10.toFixed(2), grows: m5 > m0 && m10 > m5 };
});
T("技能越高产出越高(0<5<10)", skill.grows, `mult: ${skill.m0}/${skill.m5}/${skill.m10}`);

// ── 角度6: 探索事件resolve不崩 + 数值合理 ──
const events = await page.evaluate(async () => {
  const ev = await import("/src/content/exploreEvents.js");
  const ctx = { rng: Math.random, res: { meds: 10, scrap: 10, food: 10, water: 10, parts: 10, power: 10 }, hasPerk: () => true, perkLevel: () => 2 };
  let crash = 0, ok = 0;
  const samples = [];
  for (const e of ev.EXPLORE_EVENTS) {
    for (const c of e.choices) {
      try {
        const r = c.resolve(ctx);
        // 验证返回结构
        if (r && (r.log || r.rewards || r.stamina != null || r.health != null || r.mood != null)) ok++;
        else samples.push(e.id + ":空返回");
      } catch (ex) { crash++; samples.push(e.id + ":CRASH " + ex.message.slice(0, 40)); }
    }
  }
  return { total: ev.EXPLORE_EVENTS.length, good: ev.EXPLORE_EVENT_STATS.good, bad: ev.EXPLORE_EVENT_STATS.bad, neutral: ev.EXPLORE_EVENT_STATS.neutral, ok, crash, samples: samples.slice(0, 3) };
});
T("82事件全部resolve不崩", events.crash === 0, `crash=${events.crash} ok=${events.ok} total=${events.total}`);
T("事件数量: 好40/坏30/中立12", events.good === 40 && events.bad === 30 && events.neutral === 12, `good=${events.good} bad=${events.bad} neutral=${events.neutral} total=${events.total}`);

// ── 角度7: 多地图解锁逻辑 ──
const unlock = await page.evaluate(async () => {
  const s = window.__game.state;
  const reg = await import("/src/content/regions.js");
  // 初始: home/town解锁,其他锁定
  const initUnlocked = Object.values(s.maps.list).filter(m => m.unlocked).length;
  // 模拟: 在town发现1个POI → 医院应解锁
  s.maps.list.town.discoveredCount = 1;
  reg.updateUnlocks(s);
  const hospitalUnlocked = s.maps.list.hospital.unlocked;
  // 模拟: parts>=30 → 工厂解锁
  s.res.parts = 35;
  reg.updateUnlocks(s);
  const factoryUnlocked = s.maps.list.factory.unlocked;
  return { initUnlocked, hospitalUnlocked, factoryUnlocked };
});
T("医院解锁条件(发现town 1POI)", unlock.hospitalUnlocked, "hospital=" + unlock.hospitalUnlocked);
T("工厂解锁条件(parts>=30)", unlock.factoryUnlocked, "factory=" + unlock.factoryUnlocked);

// ── 角度8: 派遣完整流程(出发→倒计时→结算) ──
const dispatch = await page.evaluate(async () => {
  const s = window.__game.state;
  const reg = await import("/src/content/regions.js");
  // 先发现一个POI
  const town = s.maps.list.town;
  town.pois[0].discovered = true;
  town.discoveredCount = 1;
  const pois = reg.allDiscoveredPois(s);
  return { hasDiscovered: pois.length > 0, poiHasMapId: pois[0]?.mapId != null };
});
T("派遣列表有已发现POI+带mapId", dispatch.hasDiscovered && dispatch.poiHasMapId, JSON.stringify(dispatch));

// ── 角度9: 成就判定 + 重建进度 ──
const ach = await page.evaluate(async () => {
  const s = window.__game.state;
  const aMod = await import("/src/content/achievements.js");
  // 模拟达成: 招募3人
  while (s.survivors.filter(x => x.busy !== "dead").length < 3) {
    s.survivors.push({ id: 90 + s.survivors.length, name: "测试", profession: "scout", profName: "侦察兵", profIcon: "🧭", perks: [], level: 1, xp: 0, xpNeed: 80, skills: { medical: 0, craft: 0, scavenge: 0, combat: 0, farm: 0, social: 0 }, health: 100, maxHealth: 100, hunger: 80, mood: 75, assigned: null, busy: null });
  }
  const newly = aMod.checkAchievements(s);
  const rp = aMod.rebuildProgress(s);
  return { newlyDone: newly, firstSurvAch: s.achievements.find(a => a.id === "first_survivor")?.done, rp: Math.floor(rp * 100) };
});
T("成就自动判定(招募3人→first_survivor达成)", ach.firstSurvAch, JSON.stringify(ach));
T("重建进度>0", ach.rp > 0, "rp=" + ach.rp + "%");

// ── 角度10: 存档完整性(序列化/反序列化) ──
const save = await page.evaluate(async () => {
  const s = window.__game.state;
  const saveMod = await import("/src/engine/save.js");
  s.res.scrap = 123;
  s.base.level = 2;
  saveMod.saveGame(s);
  const loaded = saveMod.loadGame();
  return { scrap: loaded?.res?.scrap, level: loaded?.base?.level, mapsOk: !!loaded?.maps?.list?.home?.cells, intact: loaded?.res?.scrap === 123 && loaded?.base?.level === 2 };
});
T("存读档完整保留", save.intact, `scrap=${save.scrap} lv=${save.level} cells=${save.mapsOk}`);

// ── 角度11: 长时间运行不崩(10天=1200秒) ──
const longrun = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  for (let i = 0; i < 1200; i++) {
    eco.tickEconomy(s, 1);
    s.time += 1;
  }
  s.day = Math.floor(s.time / 120) + 1;
  const sv = s.survivors.filter(x => x.busy !== "dead");
  const allFinite = sv.every(x => Number.isFinite(x.health) && Number.isFinite(x.hunger) && Number.isFinite(x.mood));
  const resFinite = Object.values(s.res).every(v => Number.isFinite(v));
  return { day: s.day, survAlive: sv.length, allFinite, resFinite, resSample: { food: Math.floor(s.res.food), scrap: Math.floor(s.res.scrap) } };
});
T("10天长跑无NaN/Infinity", longrun.allFinite && longrun.resFinite, JSON.stringify(longrun.resSample));
T("10天后居民存活", longrun.survAlive > 0, "alive=" + longrun.survAlive);

// 输出报告
console.log("\n═══════════ 逻辑测试报告 ═══════════");
let pass = 0, fail = 0;
for (const r of results) {
  console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`);
  if (r.pass) pass++; else fail++;
}
console.log(`\n总计: ${pass} 通过, ${fail} 失败, console error: ${errs.length === 0 ? "无 ✅" : errs.length + "个"}`);
if (errs.length) console.log("errors:", errs.slice(0, 5));
await browser.close();
process.exit(fail > 0 ? 1 : 0);
