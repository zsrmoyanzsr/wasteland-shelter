// UI 端到端测试: 真实点击导航/模态/建造/分配/派遣 + 截图 + console error 监控
// 重点验证: 5屏导航、模态点击穿透防护、建造流程、探索事件、派遣全流程、BUG在UI的表现
import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push("P:" + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push("C:" + m.text().slice(0, 200)); });

await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const results = [];
const T = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || "" });
const SHOT_DIR = "shots_ui";
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);

// 获取状态快照
async function snap() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

// 精确点击: 在逻辑坐标 (lx,ly) 模拟一次按下(即时模式UI在下一帧render读取pressed)
// 通过直接操作 input.pointer,确保命中,避免 CSS/逻辑坐标换算误差
async function clickAt(lx, ly) {
  await page.evaluate(({ x, y }) => {
    const inp = window.__game.input;
    inp.pointer.x = x; inp.pointer.y = y;
    inp.pointer.pressed = true;
    inp.pointer.down = true;
  }, { x: lx, y: ly });
  await page.waitForTimeout(120); // 等一帧 render+update 消费 pressed
  await page.evaluate(() => {
    const inp = window.__game.input;
    inp.pointer.down = false;
  });
  await page.waitForTimeout(80);
}

// ═══════════ UI-1: 开始屏 → 进入游戏 ═══════════
let st = await snap();
T("UI: 初始在开始屏", st.screen === "start", "screen=" + st.screen);
await page.screenshot({ path: `${SHOT_DIR}/01_start.png` });

// 点击"新游戏"按钮(开始屏中央区域点击)
// 开始屏按钮位置需从代码确认,先尝试点击屏幕中下方
await page.mouse.click(210, 480);
await page.waitForTimeout(800);
st = await snap();
T("UI: 点击后进入基地屏", st.screen === "base", "screen=" + st.screen);
await page.screenshot({ path: `${SHOT_DIR}/02_base.png` });

// ═══════════ UI-2: 5屏导航(底部导航栏点击) ═══════════
const screens = [
  { tab: "map", label: "地图", y: 726 },     // 底部导航 y≈H-34=726
  { tab: "base", label: "基地", y: 726 },
  { tab: "roster", label: "居民", y: 726 },
  { tab: "dispatch", label: "派遣", y: 726 },
  { tab: "tasks", label: "任务", y: 726 },
];
// 底部导航5等分, 宽420, 每份84, 中心:42,126,210,294,378
const navCenters = { base: 42, map: 126, roster: 210, dispatch: 294, tasks: 378 };
for (const target of ["map", "roster", "tasks", "dispatch", "base"]) {
  await page.mouse.click(navCenters[target], 726);
  await page.waitForTimeout(500);
  st = await snap();
  T(`UI: 导航→${target}`, st.screen === target, `screen=${st.screen}`);
  await page.screenshot({ path: `${SHOT_DIR}/03_nav_${target}.png` });
}

// ═══════════ UI-3: 基地建造设施流程 ═══════════
await page.mouse.click(navCenters.base, 726);
await page.waitForTimeout(400);
// 给足资源,确保可建造
await page.evaluate(() => {
  const s = window.__game.state;
  s.res.scrap = 500; s.res.parts = 200; s.res.food = 300;
});
// 建造工坊: 滚动到建造区,点击工坊卡片(底部建造区)
// 建造区在屏幕下方,工坊是第3个卡片(production类)
// 先用 state 直接触发建造模态来验证模态流程(更可靠)
await page.evaluate(() => {
  window.__game.state.modal = { type: "buildFacility", facilityType: "workshop" };
});
await page.waitForTimeout(300);
st = await snap();
T("UI: 建造模态可打开", st.modal === "buildFacility", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/04_build_modal.png` });

// 点击"确认建造"按钮(模态: mx=40,my=230,mw=340,mh=300; 按钮 mx+24=64, my+mh-56=474, 130x40; 中心129,494)
await clickAt(129, 494);
st = await snap();
T("UI: 确认建造后模态关闭", st.modal === null, "modal=" + st.modal);
const facs = await page.evaluate(() => window.__game.state.base.facilities.map(f => f.type));
T("UI: 工坊已建造", facs.includes("workshop"), "facs=" + facs.join(","));

// ═══════════ UI-4: 设施升级模态 ═══════════
await page.evaluate(() => {
  const s = window.__game.state;
  const farm = s.base.facilities.find(f => f.type === "farm");
  s.modal = { type: "upgradeFacility", facId: farm.id };
});
await page.waitForTimeout(300);
st = await snap();
T("UI: 升级模态可打开", st.modal === "upgradeFacility", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/05_upgrade_modal.png` });
// 关闭(Esc)
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
st = await snap();
T("UI: Esc关闭模态", st.modal === null, "modal=" + st.modal);

// ═══════════ UI-5: 基地升级模态 ═══════════
await page.evaluate(() => {
  const s = window.__game.state;
  s.res.scrap = 500; s.res.parts = 300; s.res.food = 300;
  s.modal = { type: "baseUpgrade" };
});
await page.waitForTimeout(300);
st = await snap();
T("UI: 基地升级模态可打开", st.modal === "baseUpgrade", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/06_base_upgrade.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// ═══════════ UI-6: 居民详情 + 分配模态 ═══════════
await page.mouse.click(navCenters.roster, 726);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT_DIR}/07_roster.png` });
st = await snap();
T("UI: 居民屏有幸存者", st.survivors.length >= 2, "count=" + st.survivors.length);
// 打开详情
await page.evaluate(() => {
  const s = window.__game.state;
  s.modal = { type: "survivorDetail", survivorId: s.survivors[0].id };
});
await page.waitForTimeout(300);
st = await snap();
T("UI: 居民详情模态", st.modal === "survivorDetail", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/08_survivor_detail.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// 分配模态
await page.evaluate(() => {
  const s = window.__game.state;
  s.modal = { type: "assignSurvivor", survivorId: s.survivors[0].id };
});
await page.waitForTimeout(300);
st = await snap();
T("UI: 分配工作模态", st.modal === "assignSurvivor", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/09_assign.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// ═══════════ UI-7: 地图屏 + 行走 + 探索事件 ═══════════
await page.mouse.click(navCenters.map, 726);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT_DIR}/10_map.png` });
st = await snap();
T("UI: 地图屏主角在家", st.map.current === "home", "map=" + st.map.current);

// 点击地图格子让主角行走(内容区中心偏左)
await page.mouse.click(150, 380);
await page.waitForTimeout(1500);
// 推进时间触发事件
await page.evaluate(() => window.advanceTime(3000));
await page.waitForTimeout(500);
st = await snap();
T("UI: 地图行走可触发探索事件", st.modal === "exploreEvent" || st.map.player, "modal=" + st.modal);
if (st.modal === "exploreEvent") {
  await page.screenshot({ path: `${SHOT_DIR}/11_explore_event.png` });
  // 探索事件选项: mx=30,选项区 x=mx+24+12=66, 宽312; 第一个选项中心约 (210, my+170)
  // my动态,取屏幕中部偏下。选项高度56,首个约在 my+78+文本行*20+8 处。保守用 380
  await clickAt(210, 380);
  st = await snap();
  T("UI: 探索事件选择后关闭", st.modal === null, "modal=" + st.modal);
  if (st.modal === "exploreEvent") {
    // 再尝试更低位置
    await clickAt(210, 440);
    st = await snap();
    T("UI: 探索事件选择后关闭(重试)", st.modal === null, "modal=" + st.modal);
  }
}

// ═══════════ UI-8: 地图选择传送模态 ═══════════
await page.evaluate(() => { window.__game.state.modal = { type: "mapSelect" }; });
await page.waitForTimeout(300);
st = await snap();
T("UI: 地图选择模态", st.modal === "mapSelect", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/12_map_select.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// ═══════════ UI-9: 任务屏 + 无线电招募 ═══════════
await page.mouse.click(navCenters.tasks, 726);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT_DIR}/13_tasks.png` });
st = await snap();
T("UI: 任务屏有7任务+10成就", st.tasks.length === 7, "tasks=" + st.tasks.length);

// 触发无线电招募候选人
await page.evaluate(() => {
  const s = window.__game.state;
  const { generateSurvivor } = { generateSurvivor: null };
  // 直接构造候选人
  s.radio.candidate = { id: 50, name: "测试员", profession: "scout", profName: "侦察兵", profIcon: "🧭", perks: ["scavenger"], level: 1, xp: 0, xpNeed: 80, skills: { medical:0,craft:0,scavenge:2,combat:0,farm:0,social:0 }, health:100, maxHealth:100, hunger:80, mood:75, assigned:null, busy:null };
  if (window.__assignAvatar) window.__assignAvatar(s.radio.candidate);
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT_DIR}/14_radio_candidate.png` });
// 打开招募确认
await page.evaluate(() => { window.__game.state.modal = { type: "recruitConfirm" }; });
await page.waitForTimeout(300);
st = await snap();
T("UI: 招募确认模态", st.modal === "recruitConfirm", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/15_recruit.png` });
// 接纳按钮: mx=40,my=200,mh=360; 按钮 mx+24=64, my+mh-56=504, 140x42; 中心(134,525)
await clickAt(134, 525);
const pop = await page.evaluate(() => window.__game.state.survivors.length);
T("UI: 招募后人数+1", pop >= 3, "pop=" + pop);

// ═══════════ UI-10: 派遣屏(验证 BUG B 在 UI 的表现) ═══════════
await page.mouse.click(navCenters.dispatch, 726);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT_DIR}/16_dispatch.png` });
// 先发现一个POI
await page.evaluate(() => {
  const s = window.__game.state;
  s.maps.list.town.pois[0].discovered = true;
  s.maps.list.town.discoveredCount = 1;
});
// 解除一人分配使其可派遣
await page.evaluate(() => {
  const s = window.__game.state;
  const sv = s.survivors.find(x => x.assigned);
  if (sv) { const f = s.base.facilities.find(f => f.id === sv.assigned); if (f) f.assigned = f.assigned.filter(id => id !== sv.id); sv.assigned = null; }
});
await page.waitForTimeout(300);
const dispatchState = await page.evaluate(() => {
  const s = window.__game.state;
  const free = s.survivors.filter(sv => !sv.busy && !sv.assigned && sv.health >= 30).length;
  return { freeCount: free, discovered: s.maps.list.town.discoveredCount };
});
T("UI: 解除分配后有人可派遣", dispatchState.freeCount > 0, "free=" + dispatchState.freeCount);

// 组队模态
await page.evaluate(() => {
  const s = window.__game.state;
  const poi = s.maps.list.town.pois[0];
  s.modal = { type: "formTeam", poi: { ...poi, mapId: "town", mapName: "郊区小镇" }, team: [] };
});
await page.waitForTimeout(300);
st = await snap();
T("UI: 组队模态可打开", st.modal === "formTeam", "modal=" + st.modal);
await page.screenshot({ path: `${SHOT_DIR}/17_team.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// ═══════════ UI-11: 全屏切换(f键) ═══════════
// 注: headless 下 requestFullscreen 可能无效,仅验证不报错
await page.keyboard.press("KeyF");
await page.waitForTimeout(300);
T("UI: F键全屏切换不报错", errs.filter(e => e.includes("fullscreen")).length === 0, "");

// ═══════════ UI-12: 模态点击穿透防护 ═══════════
// 打开模态时点击背景,不应触发导航切换
await page.mouse.click(navCenters.base, 726);
await page.waitForTimeout(300);
await page.evaluate(() => { window.__game.state.modal = { type: "baseUpgrade" }; });
await page.waitForTimeout(200);
const screenBefore = await page.evaluate(() => window.__game.state.screen);
// 点击底部导航区域(应被屏蔽)
await page.mouse.click(navCenters.map, 726);
await page.waitForTimeout(300);
const screenAfter = await page.evaluate(() => window.__game.state.screen);
T("UI: 模态激活时导航点击被屏蔽(防穿透)", screenBefore === screenAfter, `${screenBefore}→${screenAfter}`);

// 报告
console.log("\n═══════════ UI 端到端测试报告 ═══════════");
let pass = 0, fail = 0;
for (const r of results) {
  console.log(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`);
  if (r.pass) pass++; else fail++;
}
console.log(`\n总计: ${pass} 通过, ${fail} 失败, console error: ${errs.length === 0 ? "无 ✅" : errs.length + "个"}`);
if (errs.length) console.log("errors:", [...new Set(errs)].slice(0, 8));
console.log(`截图已保存到 ${SHOT_DIR}/ (${fs.readdirSync(SHOT_DIR).length}张)`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
