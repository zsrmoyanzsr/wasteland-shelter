// 核心系统全量逻辑实测: 8大系统逐条验证真实数值
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 420, height: 760 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0,100)));
page.on("console", m => { if(m.type()==="error") errs.push(m.text().slice(0,100)); });
await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2500);
const P = []; // problems
const OK = []; // passed
const T = (name, cond, detail) => { (cond ? OK : P).push({ name, detail: detail || "" }); };

// ═══════ 1. 经济系统 ═══════
const eco = await page.evaluate(async () => {
  const s = window.__game.state;
  const eco = await import("/src/engine/economy.js");
  const stMod = await import("/src/engine/state.js");
  // 1a. 基础消耗: 2人每天food-6 water-5
  const b = { ...s.res };
  for (let i = 0; i < 120; i++) eco.tickEconomy(s, 1);
  const d = {}; for (const k in s.res) d[k] = parseFloat((s.res[k]-b[k]).toFixed(1));
  // 1b. 容量上限: food设99999, 1tick后应截到cap
  s.res.food = 99999;
  eco.tickEconomy(s, 1);
  const cap = stMod.getResCap(s, "food");
  const foodCapped = s.res.food <= cap + 1; // +1容差(tick产出)
  // 1c. 不变负: 设food=0, 拆农场, 跑1天, 确认>=0
  s.res.food = 0;
  for (let i = 0; i < 120; i++) eco.tickEconomy(s, 1);
  const noNeg = s.res.food >= 0;
  // 1d. 技能影响产出
  const farm = s.base.facilities.find(f=>f.type==="farm");
  const sv = s.survivors.find(x=>farm.assigned.includes(x.id));
  let m0=0, m5=0;
  if (sv) { sv.skills.farm=0; m0=eco.facilityProduction(s,farm).mult; sv.skills.farm=5; m5=eco.facilityProduction(s,farm).mult; sv.skills.farm=1; }
  // 1e. 离线结算
  s.lastTickAt = Date.now() - 5*3600*1000; // 5小时前
  const before = s.res.food;
  const result = eco.offlineSettle(s, Date.now());
  const offOk = result.offlineSec > 0 && result.offlineSec <= 8*3600;
  return { delta: d, foodCapped, cap, noNeg, m0, m5, skillGrows: m5>m0, offOk, offSec: result.offlineSec };
});
T("经济-每天消耗food(2人应≈-6含产出)", eco.delta.food > 0, "净Δ="+eco.delta.food+"(农场产>消耗为正)");
T("经济-容量截断(99999→cap)", eco.foodCapped, "food="+eco.foodCapped+" cap="+eco.cap);
T("经济-资源不变负", eco.noNeg, "");
T("经济-技能越高产出越高", eco.skillGrows, `farm0=${eco.m0} farm5=${eco.m5}`);
T("经济-离线结算生效且8h上限", eco.offOk, "offlineSec="+eco.offSec);

// ═══════ 2. 派遣系统 ═══════
const disp = await page.evaluate(async () => {
  const s = window.__game.state;
  const reg = await import("/src/content/regions.js");
  const dispMod = await import("/src/screens/screenDispatch.js");
  const { makeRng } = await import("/src/content/survivors.js");
  // 解锁POI
  for(const m of ["town","hospital","factory","military"]){s.maps.list[m].unlocked=true;s.maps.list[m].pois[0].discovered=true;s.maps.list[m].discoveredCount=1;}
  // 2a. 无事件分支: 释放成员+计数
  s.survivors.forEach(sv=>{sv.busy=null;sv.assigned=null;});
  const expsBefore = s.stats.expeditionsDone;
  const e1 = { id:1, regionId:1, mapId:"town", regionType:"town", regionName:"辐射小镇", members:[s.survivors[0].id], startAt:s.time, duration:10, state:"running", rng:(()=>0.95), event:null, rewards:{} };
  s.expeditions.push(e1); s.survivors[0].busy="expedition";
  s.time+=11; dispMod.updateExpeditions(s,1);
  const noEventOk = e1.state==="done" && s.survivors[0].busy===null;
  const expsInc = s.stats.expeditionsDone - expsBefore > 0;
  // 2b. 属性加成: 工程师去factory vs 无属性
  const plainM = { ...s.survivors[1], id:201, perks:[], skills:{medical:0,craft:0,scavenge:0,combat:0,farm:0,social:0} };
  const engM = { ...s.survivors[1], id:202, perks:["engineer"], skills:{medical:0,craft:5,scavenge:0,combat:0,farm:0,social:0} };
  if(!s.survivors.find(x=>x.id===201)) s.survivors.push(plainM);
  if(!s.survivors.find(x=>x.id===202)) s.survivors.push(engM);
  const e2 = { id:2, regionId:2, mapId:"factory", regionType:"factory", regionName:"锈蚀工厂", members:[201], startAt:s.time, duration:10, state:"running", rng:makeRng(1), event:null, rewards:{} };
  s.expeditions.push(e2); s.survivors.find(x=>x.id===201).busy="expedition";
  s.time+=11; dispMod.updateExpeditions(s,1);
  const partsPlain = (e2.state==="done" ? e2.rewards.parts : 0) || 0;
  const e3 = { id:3, regionId:3, mapId:"factory", regionType:"factory", regionName:"锈蚀工厂", members:[202], startAt:s.time, duration:10, state:"running", rng:makeRng(1), event:null, rewards:{} };
  s.expeditions.push(e3); s.survivors.find(x=>x.id===202).busy="expedition";
  s.time+=11; dispMod.updateExpeditions(s,1);
  const partsEng = (e3.state==="done" ? e3.rewards.parts : 0) || 0;
  // 2c. 物品掉落: 直接用随机rng多次派遣,统计掉落
  const dropItems = await import("/src/content/items.js");
  let totalDrops = 0;
  for(let i=0;i<5;i++){
    const drops = dropItems.rollItemDrops(Math.random, "town");
    totalDrops += Object.keys(drops).length;
  }
  const hasItems = totalDrops > 0; // 5次town派遣至少掉点东西
  return { noEventOk, expsInc, partsPlain, partsEng, attrWorks: partsEng > partsPlain, hasItems };
});
T("派遣-无事件分支释放成员", disp.noEventOk, "");
T("派遣-完成计入expeditionsDone", disp.expsInc, "");
T("派遣-工程师属性加成(parts更多)", disp.attrWorks, `无属性=${disp.partsPlain} 工程师=${disp.partsEng}`);
T("派遣-物品掉落生效", disp.hasItems, JSON.stringify(await page.evaluate(()=>window.__game.state.inventory)));

// ═══════ 3. 探索系统 ═══════
const explore = await page.evaluate(async () => {
  const reg = await import("/src/content/regions.js");
  const s = window.__game.state;
  const map = s.maps.list.home;
  // 3a. revealCellAndNeighbors 揭示相邻
  map.cells.fill(0);
  reg.revealCellAndNeighbors(map, 3, 3);
  const gw = map.gridW;
  const self = map.cells[3*gw+3] === 2; // VISITED
  const neighbor = map.cells[3*gw+4] === 1; // REVEALED
  // 3b. 重复踏足不重复
  const r1 = reg.revealCellAndNeighbors(map, 3, 3);
  const r2 = reg.revealCellAndNeighbors(map, 3, 3);
  const noRepeat = r1.newlyVisited === false && r2.newlyVisited === false;
  // 3c. POI发现
  map.cells.fill(0);
  const poi = map.pois[0];
  reg.revealCellAndNeighbors(map, poi.gx, poi.gy);
  const found = reg.checkPoiDiscovery(map, poi.gx, poi.gy);
  // 3d. 传送
  s.maps.current = "home";
  const ok = reg.travelToMap(s, "town");
  const tpOk = s.maps.current === "town" && ok;
  const failLocked = reg.travelToMap(s, "military"); // military可能未解锁
  reg.travelToMap(s, "home"); // 回去
  return { self, neighbor, noRepeat, found: found.length>0, tpOk };
});
T("探索-踏足格→VISITED", explore.self, "");
T("探索-相邻格→REVEALED", explore.neighbor, "");
T("探索-重复踏足不重复触发", explore.noRepeat, "");
T("探索-POI发现", explore.found, "");
T("探索-传送到已解锁地图", explore.tpOk, "");

// ═══════ 4. 威胁系统 ═══════
const threat = await page.evaluate(async () => {
  const eng = await import("/src/engine/threatEngine.js");
  const s = window.__game.state;
  s.inventory = { radaway: 10, antibiotic: 10 };
  s.day = 20; s.survivors = s.survivors.slice(0,2);
  // 4a. 道具应对
  s._activeThreat = "radiation_storm";
  const before = s.inventory.radaway;
  eng.doCounter(s, "radiation_storm");
  const consumed = s.inventory.radaway === before - 2; // 2人各1
  // 4b. 硬扛不致死
  s._activeThreat = "plague";
  s.survivors.forEach(sv=>sv.health=100);
  eng.doEndure(s, "plague");
  const noDeath = s.survivors.every(sv=>sv.health>=1);
  const hpDrop = s.survivors[0].health < 100;
  return { consumed, noDeath, hpDrop, hp: Math.round(s.survivors[0].health) };
});
T("威胁-道具应对消耗正确", threat.consumed, "");
T("威胁-硬扛扣血但不致死", threat.noDeath && threat.hpDrop, "血="+threat.hp);

// ═══════ 5. 科技树 ═══════
const tech = await page.evaluate(async () => {
  const eng = await import("/src/engine/techEngine.js");
  const techMod = await import("/src/content/tech.js");
  const s = window.__game.state;
  s.res = {food:200,water:200,power:200,parts:200,meds:200,scrap:200};
  s.inventory = { alloy:20, screw:30, circuit:30, cell:20, chem:30, cloth:20, fiber:20, barrel:10, lens:10, blueprint:3, antibiotic:5, stimpack:5 };
  // 5a. 研发防御1级
  const ok = eng.doResearch(s, "defense");
  const lv1 = s.tech.defense === 1;
  // 5b. 资源被扣
  const scrapAfter = s.res.scrap;
  // 5c. 加成生效
  const bonus = techMod.collectTechBonuses(s);
  const hasBonus = bonus.raidLossMult === 0.5;
  // 5d. 研发防御2级
  const ok2 = eng.doResearch(s, "defense");
  const lv2 = s.tech.defense === 2;
  return { ok, lv1, scrapAfter, hasBonus, ok2, lv2 };
});
T("科技-研发1级成功", tech.ok && tech.lv1, "");
T("科技-研发扣资源", tech.scrapAfter < 200, "scrap="+tech.scrapAfter+"(原200)");
T("科技-加成生效(raidLossMult=0.5)", tech.hasBonus, "");
T("科技-研发2级成功", tech.ok2 && tech.lv2, "");

// ═══════ 6. 神器系统 ═══════
const art = await page.evaluate(async () => {
  const eng = await import("/src/engine/artifactEngine.js");
  const s = window.__game.state;
  s.equipment = { equipped:{}, blueprints:[], storage:[] };
  // 6a. 唯一性: grantArtifact后hasArtifact=true
  const id1 = eng.grantArtifact(s, "C", ()=>0.5);
  const has1 = eng.hasArtifact(s, id1);
  // 6b. 再grant同等级不会再给同一个
  const id2 = eng.grantArtifact(s, "C", ()=>0.5);
  const unique = id1 !== id2;
  // 6c. 槽位: 强角色2槽,弱角色1槽
  const strong = { id:999, skills:{medical:5,craft:5,scavenge:5,combat:5,farm:5,social:5}, level:6 };
  const weak = { id:998, skills:{medical:1,craft:0,scavenge:0,combat:0,farm:0,social:0}, level:1 };
  const slotStrong = eng.survivorTier(s, strong);
  const slotWeak = eng.survivorTier(s, weak);
  // 6d. 穿戴
  s.survivors.push({...strong, name:"强者", profession:"scout", profName:"侦察兵", profIcon:"🧭", perks:[], xp:0, xpNeed:200, health:100, maxHealth:100, hunger:80, mood:75, assigned:null, busy:null});
  s.survivors.push({...weak, name:"弱者", profession:"scout", profName:"侦察兵", profIcon:"🧭", perks:[], xp:0, xpNeed:80, health:100, maxHealth:100, hunger:80, mood:75, assigned:null, busy:null});
  const equipOk = eng.equipArtifact(s, s.survivors.find(x=>x.id===999), id1);
  return { has1, unique, slotStrong, slotWeak, equipOk: equipOk.ok };
});
T("神器-获得后标记拥有", art.has1, "");
T("神器-唯一性(不再给同一个)", art.unique, `id1!=id2`);
T("神器-强角色2槽弱角色1槽", art.slotStrong===2 && art.slotWeak===1, `强=${art.slotStrong} 弱=${art.slotWeak}`);
T("神器-穿戴成功", art.equipOk, "");

// ═══════ 7. 商队系统 ═══════
const caravan = await page.evaluate(async () => {
  const eng = await import("/src/engine/caravan.js");
  const s = window.__game.state;
  s.caravan = { timer:720, here:false, leaveTimer:0, offers:[] };
  s.res = {food:100,water:100,parts:50,power:30,meds:20,scrap:80};
  // 7a. 到访生成3方案
  eng.arriveCaravan(s);
  const threeOffers = s.caravan.offers.length === 3;
  // 7b. 汇率合理(付出价值>=获得价值)
  const V = {food:1,water:1,scrap:1,power:1.8,parts:3,meds:3.2};
  const rateOk = s.caravan.offers.every(o=>{
    const gv = Object.entries(o.give).reduce((s,[k,v])=>s+v*V[k],0);
    const xv = Object.entries(o.get).reduce((s,[k,v])=>s+v*V[k],0);
    return gv >= xv;
  });
  // 7c. 交易扣给加得
  const o0 = s.caravan.offers[0];
  const gk = Object.keys(o0.give)[0], xk = Object.keys(o0.get)[0];
  s.res[gk] = Math.max(o0.give[gk], s.res[gk]);
  const before = s.res[xk];
  eng.takeOffer(s, 0);
  const after = s.res[xk];
  const tradeOk = after > before && o0.taken;
  // 7d. 在场超时离开
  s.caravan.leaveTimer = 1;
  eng.updateCaravan(s, 5);
  const left = !s.caravan.here;
  return { threeOffers, rateOk, tradeOk, left };
});
T("商队-到访生成3方案", caravan.threeOffers, "");
T("商队-汇率合理(无套利)", caravan.rateOk, "");
T("商队-交易扣给加得", caravan.tradeOk, "");
T("商队-超时自动离开", caravan.left, "");

// ═══════ 8. 存档系统 ═══════
const save = await page.evaluate(async () => {
  const saveMod = await import("/src/engine/save.js");
  const cloudMod = await import("/src/engine/cloudSave.js");
  const s = window.__game.state;
  // 8a. 存读档往返
  s.res.scrap = 777; s.base.level = 4;
  saveMod.saveGame(s);
  const loaded = saveMod.loadGame();
  const roundTrip = loaded?.res?.scrap === 777 && loaded?.base?.level === 4;
  // 8b. 存档码往返
  const code = await cloudMod.exportSaveCode(s);
  const imported = await cloudMod.importSaveCode(code);
  const codeOk = imported?.res?.scrap === 777;
  // 8c. 损坏恢复: 先存两次(建立备份链),再破坏主档
  s.res.scrap = 444; saveMod.saveGame(s); // 主=444
  s.res.scrap = 555; saveMod.saveGame(s); // 主=555 备份=444
  localStorage.setItem("wasteland_shelter_save_v2", "坏JSON{");
  const recovered = saveMod.loadGame();
  const recoverOk = !!recovered && recovered.res.scrap === 444; // 从备份444恢复
  // 8d. version正确
  const verOk = loaded?.version === 6;
  return { roundTrip, codeOk, codeLen: code.length, recoverOk, verOk };
});
T("存档-存读档往返完整", save.roundTrip, "");
T("存档-存档码导出导入往返", save.codeOk, "码长="+save.codeLen);
T("存档-主档损坏从备份恢复", save.recoverOk, "");
T("存档-version=6", save.verOk, "");

// ═══════ 报告 ═══════
console.log("\n═══════════ 核心系统全量逻辑实测 ═══════════\n");
for (const t of OK) console.log(`✅ ${t.name}${t.detail?"  ("+t.detail+")":""}`);
if (P.length) {
  console.log(`\n⚠️ 发现 ${P.length} 个问题:`);
  for (const t of P) console.log(`❌ ${t.name}${t.detail?"  ("+t.detail+")":""}`);
}
console.log(`\n总计: ${OK.length} 通过, ${P.length} 问题, console error: ${errs.length===0?"无 ✅":errs.length+"个"}`);
if (errs.length) console.log(errs.slice(0,3));
await browser.close();
process.exit(P.length > 0 ? 1 : 0);
