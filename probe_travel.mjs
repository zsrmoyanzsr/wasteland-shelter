import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle","--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.evaluate(()=>localStorage.removeItem("wasteland_shelter_save_v1"));
await page.reload({waitUntil:"domcontentloaded"});
await page.waitForTimeout(1500);
const info = await page.evaluate(() => { const c=document.querySelector('canvas'); const r=c.getBoundingClientRect(); return {cssW:r.width,cssH:r.height,lw:parseFloat(c.dataset.logicW),lh:parseFloat(c.dataset.logicH)}; });
const cL = async (lx,ly) => { await page.mouse.click(lx*(info.cssW/info.lw), ly*(info.cssH/info.lh)); await page.waitForTimeout(100); };
await cL(280,461); await page.waitForTimeout(400);
await cL(80,120); await page.waitForTimeout(300);
// 详细扫描所有可点击点(任何能让modal消失或current变化的)
let found=[];
for (let y=170;y<=460;y+=8){
  for (let x=80;x<=500;x+=8){
    await page.evaluate(()=>{ /* 保持mapSelect打开 */ });
    const before = await page.evaluate(()=>({modal:window.__game.state.modal?.type, cur:window.__game.state.maps.current}));
    if(before.modal!=="mapSelect") continue;
    await cL(x,y); await page.waitForTimeout(40);
    const after = await page.evaluate(()=>({modal:window.__game.state.modal?.type, cur:window.__game.state.maps.current}));
    if(after.modal!=="mapSelect" || after.cur!==before.cur){
      found.push({x,y,modal:after.modal,cur:after.cur});
      // 重置回mapSelect以便继续扫描
      await page.evaluate(()=>{window.__game.state.modal={type:"mapSelect"};});
    }
  }
  if(found.length>3)break;
}
console.log("可点击点:", JSON.stringify(found.slice(0,5)));
await browser.close();
