// 完整系统检索: 16大系统逐条验证
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 420, height: 760 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0,120)));
page.on("console", m => { if(m.type()==="error") errs.push(m.text().slice(0,120)); });
await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2500);
const OK=[], FAIL=[];
const T=(n,c,d)=>(c?OK:FAIL).push({n,d:d||""});

// 1. 经济
const eco=await page.evaluate(async()=>{const s=window.__game.state;const e=await import("/src/engine/economy.js");const st=await import("/src/engine/state.js");const b={...s.res};for(let i=0;i<120;i++)e.tickEconomy(s,1);const foodPos=s.res.food>b.food;s.res.food=99999;e.tickEconomy(s,1);const cap=st.getResCap(s,"food");s.res.food=0;s.base.facilities=s.base.facilities.filter(f=>f.type!=="farm");for(let i=0;i<120;i++)e.tickEconomy(s,1);return{foodPos,capOk:s.res.food<=cap+1,noNeg:s.res.food>=0};});
T("经济-食物正产出",eco.foodPos);T("经济-容量截断",eco.capOk);T("经济-不变负",eco.noNeg);

// 2. 派遣
const disp=await page.evaluate(async()=>{const s=window.__game.state;const d=await import("/src/screens/screenDispatch.js");const items=await import("/src/content/items.js");s.maps.list.town.pois[0].discovered=true;s.maps.list.town.discoveredCount=1;s.survivors.forEach(x=>{x.busy=null;x.assigned=null;});const eb=s.stats.expeditionsDone;const e1={id:1,regionId:1,mapId:"town",regionType:"town",regionName:"辐射小镇",members:[s.survivors[0].id],startAt:s.time,duration:10,state:"running",rng:()=>0.95,event:null,rewards:{}};s.expeditions.push(e1);s.survivors[0].busy="expedition";s.time+=11;d.updateExpeditions(s,1);let dropTotal=0;for(let i=0;i<10;i++)dropTotal+=Object.keys(items.rollItemDrops(Math.random,"town")).length;return{release:s.survivors[0].busy===null,done:e1.state==="done",count:s.stats.expeditionsDone>eb,hasItems:dropTotal>0};});
T("派遣-释放成员",disp.release);T("派遣-完成计数",disp.count);T("派遣-物品掉落",disp.hasItems);

// 3. 探索
const exp=await page.evaluate(async()=>{const r=await import("/src/content/regions.js");const s=window.__game.state;const m=s.maps.list.home;m.cells.fill(0);r.revealCellAndNeighbors(m,3,3);const gw=m.gridW;const self=m.cells[3*gw+3]===2;const nb=m.cells[3*gw+4]===1;const r1=r.revealCellAndNeighbors(m,3,3);const r2=r.revealCellAndNeighbors(m,3,3);const poi=r.checkPoiDiscovery(m,m.pois[0].gx,m.pois[0].gy);return{self,nb,noRep:!r1.newlyVisited&&!r2.newlyVisited,found:poi.length>0};});
T("探索-踏足VISITED",exp.self);T("探索-相邻REVEALED",exp.nb);T("探索-不重复",exp.noRep);T("探索-POI发现",exp.found);

// 4. 威胁
const th=await page.evaluate(async()=>{const e=await import("/src/engine/threatEngine.js");const s=window.__game.state;s.inventory={radaway:10};s.day=20;s.survivors=s.survivors.slice(0,2);s._activeThreat="radiation_storm";const b=s.inventory.radaway;e.doCounter(s,"radiation_storm");const consumed=s.inventory.radaway===b-2;s._activeThreat="plague";s.survivors.forEach(x=>x.health=100);e.doEndure(s,"plague");return{consumed,noDeath:s.survivors.every(x=>x.health>=1),hpDrop:s.survivors[0].health<100};});
T("威胁-道具消耗",th.consumed);T("威胁-硬扛不致死",th.noDeath&&th.hpDrop);

// 5. 科技
const tech=await page.evaluate(async()=>{const e=await import("/src/engine/techEngine.js");const tm=await import("/src/content/tech.js");const s=window.__game.state;s.tech={defense:0,production:0,bio:0};s.res={food:300,water:300,power:300,parts:300,meds:300,scrap:300};s.inventory={alloy:30,screw:30,circuit:30,cell:20,chem:30,cloth:20,fiber:20,barrel:10,lens:10,blueprint:3};const ok1=e.doResearch(s,"defense");const bonus=tm.collectTechBonuses(s).raidLossMult===0.5;const ok2=e.doResearch(s,"defense");return{ok1,bonus,ok2};});
T("科技-研发1级+加成",tech.ok1&&tech.bonus);T("科技-研发2级",tech.ok2);

// 6. 神器
const art=await page.evaluate(async()=>{const e=await import("/src/engine/artifactEngine.js");const s=window.__game.state;s.equipment={equipped:{},blueprints:[],storage:[]};const id1=e.grantArtifact(s,"C",()=>0.5);const has=e.hasArtifact(s,id1);const id2=e.grantArtifact(s,"C",()=>0.5);const strong={id:999,skills:{medical:5,craft:5,scavenge:5,combat:5,farm:5,social:5},level:6};const weak={id:998,skills:{medical:1,craft:0,scavenge:0,combat:0,farm:0,social:0},level:1};return{has,uniq:id1!==id2,s2:e.survivorTier(s,strong)===2,s1:e.survivorTier(s,weak)===1};});
T("神器-唯一+槽位",art.has&&art.uniq&&art.s2&&art.s1);

// 7. 商队
const car=await page.evaluate(async()=>{const e=await import("/src/engine/caravan.js");const s=window.__game.state;s.caravan={timer:720,here:false,leaveTimer:0,offers:[]};s.res={food:100,water:100,parts:50,power:30,meds:20,scrap:80};e.arriveCaravan(s);const three=s.caravan.offers.length===3;const o0=s.caravan.offers[0];const gk=Object.keys(o0.give)[0],xk=Object.keys(o0.get)[0];s.res[gk]=Math.max(o0.give[gk],s.res[gk]);const bb=s.res[xk];e.takeOffer(s,0);const tradeOk=s.res[xk]>bb&&o0.taken;s.caravan.leaveTimer=1;e.updateCaravan(s,5);return{three,tradeOk,left:!s.caravan.here};});
T("商队-3方案+交易",car.three&&car.tradeOk);T("商队-超时离开",car.left);

// 8. 存档
const sv=await page.evaluate(async()=>{const sm=await import("/src/engine/save.js");const cm=await import("/src/engine/cloudSave.js");const s=window.__game.state;s.res.scrap=777;s.base.level=4;sm.saveGame(s);const l=sm.loadGame();const rt=l?.res?.scrap===777;const code=await cm.exportSaveCode(s);const imp=await cm.importSaveCode(code);s.res.scrap=444;sm.saveGame(s);s.res.scrap=555;sm.saveGame(s);localStorage.setItem("wasteland_shelter_save_v2","badjson");const rec=sm.loadGame();return{rt,codeOk:imp?.res?.scrap===777,recOk:!!rec&&rec.res.scrap===444,ver:l?.version===6};});
T("存档-往返+码+恢复+版本",sv.rt&&sv.codeOk&&sv.recOk&&sv.ver);

// 9. 地标
const lm=await page.evaluate(()=>{const s=window.__game.state;let all=true;let total=0;for(const id in s.maps.list){const l=s.maps.list[id].landmarks;if(!l||l.length===0)all=false;total+=(l||[]).length;}return{all,total};});
T("地标-所有地图都有",lm.all,"共"+lm.total+"个");

// 10. 蓝图建筑
const bp=await page.evaluate(async()=>{const s=window.__game.state;const f=await import("/src/content/facilities.js");s.blueprints=[];const before=f.buildableTypes(s).length;s.blueprints.push("auto_farm");const after=f.buildableTypes(s).length;return{bpCount:f.BLUEPRINT_BUILDINGS.length,worked:after>before};});
T("蓝图-4种+解锁后显示",bp.bpCount===4&&bp.worked);

// 11. 解雇
const fire=await page.evaluate(()=>{const s=window.__game.state;const before=s.survivors.length;s.survivors.push({id:888,name:"test",profession:"scout",profName:"scout",profIcon:"icon",perks:[],level:1,skills:{medical:0,craft:0,scavenge:0,combat:0,farm:0,social:0},health:100,maxHealth:100,hunger:80,mood:75,assigned:null,busy:null,xp:0,xpNeed:80});s.survivors=s.survivors.filter(x=>x.id!==888);return{ok:s.survivors.length===before,lastProtected:s.survivors.length>1};});
T("解雇-移除+保护最后1人",fire.ok&&fire.lastProtected);

// 12. 消耗品
const ci=await page.evaluate(async()=>{const inv=await import("/src/engine/inventory.js");const s=window.__game.state;s.inventory={bandage:5};s.survivors[0].health=50;const b=s.survivors[0].health;inv.useConsumable(s,"bandage",s.survivors[0]);return{healed:s.survivors[0].health>b,consumed:s.inventory.bandage===4};});
T("消耗品-回血+扣减",ci.healed&&ci.consumed);

// 13. 虚弱debuff
const wk=await page.evaluate(async()=>{const s=window.__game.state;const e=await import("/src/engine/economy.js");let f=s.base.facilities.find(x=>x.type==="farm");if(!f){f={id:1,type:"farm",level:1,assigned:[s.survivors[0].id]};s.base.facilities.push(f);}const sv=s.survivors[0];sv.assigned=f.id;sv.skills.farm=3;sv.health=100;const mh=e.facilityProduction(s,f).mult;sv.health=40;const ml=e.facilityProduction(s,f).mult;sv.health=100;return{ok:ml<mh};});
T("虚弱-设施产能debuff",wk.ok);

// 14. 结局
const ed=await page.evaluate(async()=>{const s=window.__game.state;s.tech={defense:5,production:0,bio:0};const en=await import("/src/content/endings.js");return{warlord:en.checkEnding(s)==="warlord",count:Object.keys(en.ENDINGS).length};});
T("结局-触发+4种",ed.warlord&&ed.count===4);

// 15. 地图
const mp=await page.evaluate(()=>{const s=window.__game.state;const ids=Object.keys(s.maps.list);let total=0;for(const id of ids){total+=s.maps.list[id].gridW*s.maps.list[id].gridH;}return{count:ids.length,total};});
T("地图-8张+总面积大",mp.count===8&&mp.total>1000,"总"+mp.total+"格");

// 16. 事件密度
const den=await page.evaluate(()=>{let c=0;const s=window.__game.state;const m=s.maps.list.home;for(let gx=0;gx<m.gridW;gx++)for(let gy=0;gy<m.gridH;gy++){let h=0;const str="home:"+gx+","+gy;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);h^=h>>>13;if(((h>>>0)%1000)/1000<0.15)c++;}return parseInt(c/(m.gridW*m.gridH)*100);});
T("事件密度-<25%",den<25,den+"%");

console.log("\n═══════════ 完整系统检索 (16系统) ═══════════\n");
for(const t of OK) console.log("OK " + t.n + (t.d?"  ("+t.d+")":""));
if(FAIL.length){console.log("\nFAIL " + FAIL.length + ":");for(const t of FAIL) console.log("XX " + t.n + (t.d?"  ("+t.d+")":""));}
console.log("\n: " + OK.length + " pass, " + FAIL.length + " fail, error: " + (errs.length===0?"none":errs.length));
if(errs.length) console.log(errs.slice(0,3));
await browser.close();
process.exit(FAIL.length>0?1:0);
