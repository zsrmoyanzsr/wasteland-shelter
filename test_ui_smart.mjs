import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle","--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const errs=[];
page.on("pageerror",(e)=>errs.push(String(e).slice(0,90)));
page.on("console",(m)=>{if(m.type()==="error")errs.push(m.text().slice(0,90));});
await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
const info = await page.evaluate(() => { const c=document.querySelector('canvas'); const r=c.getBoundingClientRect(); return {cssW:r.width,cssH:r.height,lw:parseFloat(c.dataset.logicW),lh:parseFloat(c.dataset.logicH)}; });
const cL = async (lx,ly) => { await page.mouse.click(lx*(info.cssW/info.lw), ly*(info.cssH/info.lh)); await page.waitForTimeout(150); };

// 智能点击: 扫描找到目标modal类型的按钮并点击
async function findAndClick(targetModalType, opts={}) {
  for (let y=(opts.yMin||100); y<=(opts.yMax||600); y+=(opts.step||8)) {
    for (let x=(opts.xMin||20); x<=(opts.xMax||540); x+=(opts.step||10)) {
      const before = await page.evaluate(()=>window.__game.state.modal?.type);
      await cL(x,y); await page.waitForTimeout(30);
      const after = await page.evaluate(()=>window.__game.state.modal?.type);
      if (after === targetModalType) return {x,y};
      // 如果点开了目标模态
      if (opts.openWhen === "click" && after === targetModalType) return {x,y};
    }
  }
  return null;
}
// 智能点击关闭/确认: 找让当前modal消失的按钮
async function findCloseButton(currentModal) {
  for (let y=400;y<=580;y+=10){
    for (let x=80;x<=480;x+=12){
      const before = await page.evaluate(()=>window.__game.state.modal?.type);
      if (before !== currentModal) return null; // 已关闭
      await cL(x,y); await page.waitForTimeout(40);
      const after = await page.evaluate(()=>window.__game.state.modal?.type);
      if (after !== currentModal) return {x,y,after};
    }
  }
  return null;
}

const R=[];
const ck=(n,c,d)=>R.push({n,pass:c,d:d||""});

// 开始
await page.evaluate(()=>{window.__game.state._newGameRequested=true;});
await page.evaluate((ms)=>window.advanceTime(ms),200);
await page.waitForTimeout(300);
let s = await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
ck("开始游戏", s.screen==="base");

// 给资源
await page.evaluate(()=>{const st=window.__game.state;st.res.scrap=500;st.res.parts=300;st.res.food=200;});

// 智能找工坊建造卡片
await page.evaluate(()=>{window.__game.state.modal=null;});
const wCard = await findAndClick("buildFacility");
ck("找到建造卡片", !!wCard, wCard?`@${wCard.x},${wCard.y}`:"");
// 找确认建造按钮
if (wCard) {
  const confirm = await findCloseButton("buildFacility");
  ck("确认建造", !!confirm, confirm?`@${confirm.x},${confirm.y}`:"");
}

// 导航到地图
await page.evaluate(()=>{window.__game.state.modal=null;});
await cL(168,685); await page.waitForTimeout(300);
s = await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
ck("进地图", s.screen==="map");

// 走动触发事件
let evt=false;
for (const [x,y] of [[300,300],[360,360],[240,420],[380,300],[300,440]]) {
  await cL(x,y); await page.evaluate((ms)=>window.advanceTime(ms),2500);
  const m = await page.evaluate(()=>window.__game.state.modal?.type);
  if (m==="exploreEvent"){evt=true;
    // 智能找事件选项(让modal消失的按钮)
    const res = await findCloseButton("exploreEvent");
    ck("事件解决", !!res);
    break;
  }
}
if(!evt) ck("事件触发", false, "概率未中");

// 输出
console.log("\n═══ 智能UI测试 ═══");
let p=0,f=0;
for(const r of R){console.log(`${r.pass?"✅":"❌"} ${r.n}${r.d?" ("+r.d+")":""}`); r.pass?p++:f++;}
console.log(`\n${p}通过 ${f}失败  errors:${errs.length?"有":"无"}✅`);
if(errs.length)console.log(errs.slice(0,3));
await browser.close();
