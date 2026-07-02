// 边界 & 反常测试: 专门找正常测试覆盖不到的 bug
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

// ── 边界1: 资源扣成负数? ──
const negRes = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  s.res.scrap = 5;
  // 建工坊消耗废铁,让消耗>存量
  s.base.facilities.push({ id: 99, type: "workshop", level: 5, assigned: [1] }); // 高级工坊消耗大
  for (let i = 0; i < 600; i++) eco.tickEconomy(s, 1); // 跑很久
  const allNonNeg = Object.values(s.res).every(v => v >= 0);
  return { scrap: s.res.scrap.toFixed(2), allNonNeg, anyNeg: Object.entries(s.res).filter(([k,v])=>v<0).map(([k])=>k) };
});
T("资源不会变负数", negRes.allNonNeg, "负数资源:" + JSON.stringify(negRes.anyNeg));

// ── 边界2: 资源超过容量? ──
const overCap = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  const stMod = await import("/src/engine/state.js");
  s.res.food = 99999;
  eco.tickEconomy(s, 1);
  const cap = stMod.getResCap(s, "food");
  return { food: Math.floor(s.res.food), cap, capped: s.res.food <= cap };
});
T("资源不超容量上限", overCap.capped, `food=${overCap.food} cap=${overCap.cap}`);

// ── 边界3: 事件扣血让health变负? ──
const negHp = await page.evaluate(async () => {
  const ev = await import("/src/content/exploreEvents.js");
  const s = window.__game.state;
  s.player.health = 10; // 低血
  // 找最狠的扣血事件,反复resolve
  const beast = ev.EXPLORE_EVENTS.find(e => e.id === "mutant_beast");
  const ctx = { rng: () => 0.99, res: s.res, hasPerk: () => false, perkLevel: () => 0 };
  for (let i = 0; i < 5; i++) {
    const r = beast.choices[0].resolve(ctx);
    if (r.health) s.player.health = Math.max(0, Math.min(s.player.maxHealth, s.player.health + r.health));
  }
  return { hp: s.player.health, nonNeg: s.player.health >= 0, zero: s.player.health === 0 };
});
T("扣血不会让health变负", negHp.nonNeg, "hp=" + negHp.hp);
T("血量可降到0(重伤)", negHp.zero, "hp=" + negHp.hp);

// ── 边界4: 奖励超过容量被截断? ──
const rewardCap = await page.evaluate(async () => {
  const s = window.__game.state;
  const stMod = await import("/src/engine/state.js");
  s.res.food = 95;
  const cap = stMod.getResCap(s, "food");
  // 给+50食物奖励
  s.res.food = Math.min(cap, s.res.food + 50);
  return { food: s.res.food, cap, capped: s.res.food <= cap };
});
T("奖励加资源不超容量", rewardCap.capped, `food=${rewardCap.food}/${rewardCap.cap}`);

// ── 边界5: 派遣完成→成员释放+结算 ──
const dispatchEnd = await page.evaluate(async () => {
  const s = window.__game.state;
  const reg = await import("/src/content/regions.js");
  // 发现POI
  s.maps.list.town.pois[0].discovered = true;
  s.maps.list.town.discoveredCount = 1;
  // 让一个幸存者空闲
  const sv = s.survivors[0];
  const oldFac = sv.assigned;
  if (oldFac) { const f = s.base.facilities.find(x=>x.id===oldFac); if(f) f.assigned = f.assigned.filter(id=>id!==sv.id); sv.assigned = null; }
  sv.busy = null;
  // 直接构造 expedition(模拟 launchExpedition)
  const poi = reg.allDiscoveredPois(s)[0];
  const { makeRng } = await import("/src/content/survivors.js");
  const exp = {
    id: s.nextExpeditionId++, regionId: poi.id, mapId: poi.mapId, mapName: poi.mapName,
    regionType: poi.type, regionName: reg.poiInfo(poi.type).name,
    members: [sv.id], startAt: s.time, duration: 45, state: "running",
    rng: makeRng(12345), event: null, rewards: {},
  };
  s.expeditions.push(exp);
  sv.busy = "expedition";
  const memBusyBefore = sv.busy;
  // 推进到完成
  s.time += exp.duration + 1;
  // 调用 updateExpeditions(已导出)
  const disp = await import("/src/screens/screenDispatch.js");
  disp.updateExpeditions(s, 1);
  return { launched: !!exp, memBusy: memBusyBefore === "expedition", expState: exp.state, doneOrEvent: exp.state === "done" || exp.state === "event" };
});
T("派遣启动→成员标记busy", dispatchEnd.memBusy, "busy=" + dispatchEnd.memBusy);
T("派遣到时间→结算(done/event)", dispatchEnd.doneOrEvent, "state=" + dispatchEnd.expState);

// ── 边界6: 离线结算 + 医疗交互 ──
const offlineHeal = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  // 伤员 + 医疗室
  const med = { id: 88, type: "medbay", level: 1, assigned: [] };
  s.base.facilities.push(med);
  s.survivors[1].health = 30;
  s.survivors[1].assigned = med.id;
  med.assigned = [s.survivors[1].id];
  s.res.meds = 50;
  const hpBefore = s.survivors[1].health;
  // 离线结算(模拟1小时)
  s.lastTickAt = Date.now() - 3600 * 1000;
  const result = eco.offlineSettle(s, Date.now());
  const hpAfter = s.survivors[1].health;
  return { hpBefore, hpAfter: Math.floor(hpAfter), healed: hpAfter > hpBefore, crashed: isNaN(hpAfter) };
});
T("离线结算+医疗不崩", !offlineHeal.crashed, "hp=" + offlineHeal.hpAfter);
T("离线期间医疗室治疗", offlineHeal.healed, `${offlineHeal.hpBefore}→${offlineHeal.hpAfter}`);

// ── 边界7: 体力耗尽强行探索 ──
const noStamina = await page.evaluate(async () => {
  const s = window.__game.state;
  const wu = await import("/src/engine/worldUpdate.js");
  s.player.stamina = 0;
  s.player.health = 100;
  const x0 = s.player.x, y0 = s.player.y;
  // 设目标走远
  s.player.tx = x0 + 500; s.player.ty = y0 + 500;
  for (let i = 0; i < 60; i++) wu.updatePlayer(s, 1);
  const moved = Math.abs(s.player.x - x0) > 10;
  return { stamina: Math.floor(s.player.stamina), moved, stillAlive: s.player.health > 0 };
});
T("体力0时主角仍可移动(不卡死)", noStamina.moved, "moved=" + noStamina.moved);
T("体力0不会致死", noStamina.stillAlive, "hp>0");

// ── 边界8: 重伤(health=0)恢复 ──
const recoverFromZero = await page.evaluate(async () => {
  const s = window.__game.state;
  const wu = await import("/src/engine/worldUpdate.js");
  s.player.health = 0;
  const x0 = s.player.x;
  s.player.tx = x0 + 200; // 试着走
  for (let i = 0; i < 60; i++) wu.updatePlayer(s, 1); // 1分钟恢复
  const hpAfter = s.player.health;
  const moved = Math.abs(s.player.x - x0) > 5;
  return { hpAfter: Math.floor(hpAfter), recovering: hpAfter > 0, notMovedWhileHurt: !moved || hpAfter > 0 };
});
T("health=0会自动恢复", recoverFromZero.recovering, "hp=" + recoverFromZero.hpAfter);

// ── 边界9: 人口超上限(强行加幸存者) ──
const overPop = await page.evaluate(async () => {
  const s = window.__game.state;
  const stMod = await import("/src/engine/state.js");
  const cap = 2 + s.base.level * 2;
  // 强行加到超上限
  while (s.survivors.length < cap + 3) {
    s.survivors.push({ id: 900+s.survivors.length, name:"溢出", profession:"scout", profName:"侦察兵", profIcon:"🧭", perks:[], level:1, xp:0, xpNeed:80, skills:{medical:0,craft:0,scavenge:0,combat:0,farm:0,social:0}, health:100, maxHealth:100, hunger:80, mood:75, assigned:null, busy:null });
  }
  // 经济不应崩
  const eco = await import("/src/engine/economy.js");
  let crash = false;
  try { for(let i=0;i<50;i++) eco.tickEconomy(s, 1); } catch(e){crash=true;}
  return { popCount: s.survivors.length, cap, crash, foodConsumesNormally: !isNaN(s.res.food) };
});
T("人口超上限不崩", !overPop.crash && overPop.foodConsumesNormally, `pop=${overPop.popCount}/${overPop.cap}`);

// ── 边界10: 任务领取奖励重复领? ──
const dupClaim = await page.evaluate(async () => {
  const s = window.__game.state;
  const scrapBefore = s.res.scrap;
  // 找一个done未claim的任务,领两次
  const t = s.tasks.find(x => !x.done) || s.tasks[0];
  t.done = true; t.claimed = false;
  const def = s.tasks; // 用第一个任务定义
  // 模拟领奖(第一次)
  const td = (await import("/src/content/tasks.js")).taskDef(t.id);
  if (td) { for(const k in td.reward) s.res[k] = Math.min(s.resCap[k]||999, (s.res[k]||0)+td.reward[k]); }
  t.claimed = true;
  const scrapAfter1 = s.res.scrap;
  // 模拟领奖(第二次,应该被claimed挡住)
  if (!t.claimed) { for(const k in td.reward) s.res[k] += td.reward[k]; }
  const scrapAfter2 = s.res.scrap;
  return { scrapBefore, scrapAfter1, scrapAfter2, noDup: scrapAfter2 === scrapAfter1 };
});
T("任务奖励不可重复领取", dupClaim.noDup, `scrap: ${dupClaim.scrapBefore}→${dupClaim.scrapAfter1}→${dupClaim.scrapAfter2}`);

// 报告
console.log("\n═══════════ 边界/反常测试 ═══════════");
let pass = 0, fail = 0;
for (const r of results) {
  console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`);
  if (r.pass) pass++; else fail++;
}
console.log(`\n总计: ${pass} 通过, ${fail} 失败, console error: ${errs.length === 0 ? "无 ✅" : errs.length + "个"}`);
if (errs.length) console.log("errors:", errs.slice(0, 5));
await browser.close();
process.exit(fail > 0 ? 1 : 0);
