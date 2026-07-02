// 自定义测试脚本: 模拟点击(canvas 逻辑坐标) + 推进时间 + 截图 + 状态
// 用法: node test_harness.mjs <steps_json_file>
// steps: [{type:'click', x, y}, {type:'advance', ms}, {type:'key', code}, {type:'screenshot', name}, {type:'state'}]
import fs from "node:fs";
import { chromium } from "playwright";

const URL = "http://localhost:5180";
const OUT = "output/test";

async function main() {
  const stepsFile = process.argv[2];
  const steps = JSON.parse(fs.readFileSync(stepsFile, "utf-8"));
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // canvas 逻辑坐标 → CSS 坐标的转换(基于实际 boundingBox)
  async function clickLogical(lx, ly) {
    const box = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height, cw: c.width, ch: c.height };
    });
    const cssX = box.left + (lx / box.cw) * box.w;
    const cssY = box.top + (ly / box.ch) * box.h;
    await page.mouse.click(cssX, cssY);
  }

  async function screenshot(name) {
    const path = `${OUT}/${name}.png`;
    await page.screenshot({ path });
    console.log(`  📸 ${path}`);
  }

  async function getState() {
    return await page.evaluate(() => window.render_game_to_text());
  }

  let shotIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.type === "click") {
      await clickLogical(s.x, s.y);
      await page.waitForTimeout(150);
      console.log(`▶ click (${s.x},${s.y})`);
    } else if (s.type === "advance") {
      await page.evaluate((ms) => window.advanceTime(ms), s.ms);
      console.log(`▶ advance ${s.ms}ms`);
    } else if (s.type === "key") {
      await page.keyboard.press(s.code);
      await page.waitForTimeout(150);
      console.log(`▶ key ${s.code}`);
    } else if (s.type === "wait") {
      await page.waitForTimeout(s.ms);
      console.log(`▶ wait ${s.ms}ms`);
    } else if (s.type === "screenshot") {
      await screenshot(s.name || `shot-${shotIdx++}`);
    } else if (s.type === "state") {
      const st = await getState();
      fs.writeFileSync(`${OUT}/state-${s.name || shotIdx}.json`, st);
      console.log(`  📄 state-${s.name || shotIdx}.json`);
    } else if (s.type === "log") {
      console.log(`// ${s.msg}`);
    }
  }

  if (errors.length) {
    console.log("\n❌ CONSOLE ERRORS:");
    errors.forEach((e) => console.log("  " + e));
    fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
  } else {
    console.log("\n✅ No console errors");
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
