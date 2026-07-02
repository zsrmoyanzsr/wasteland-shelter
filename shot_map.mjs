// 截图验证: 地图AI装饰图标渲染 + 事件分布
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });

await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

// 切换到地图屏(宽屏布局: 侧栏第2项=地图, y≈198, x≈48; dpr=2 → 物理坐标)
await page.evaluate(() => {
  const s = window.__game.state;
  s.tab = "map";
  s.screen = "map";
});
await page.waitForTimeout(800);

// 确认当前屏
const tab = await page.evaluate(() => window.__game.state.tab);
console.log("当前屏:", tab);

// 揭示一片区域用于截图
await page.evaluate(() => {
  const s = window.__game.state;
  const map = s.maps.list[s.maps.current];
  const W = map.gridW, H = map.gridH;
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const dx = gx - 3, dy = gy - 3;
      const d2 = dx * dx + dy * dy;
      const idx = gy * W + gx;
      if (d2 <= 4) {
        map.cells[idx] = 2; // VISITED
      } else if (d2 <= 9) {
        if (map.cells[idx] === 0) map.cells[idx] = 1; // REVEALED
      }
    }
  }
  // 主角移到中心(3,3) → world coord = 3*56+28, 3*56+28
  s.player.x = 3 * 56 + 28;
  s.player.y = 3 * 56 + 28;
});
await page.waitForTimeout(800);
await page.screenshot({ path: "shot_map_revealed.png" });
console.log("已保存 shot_map_revealed.png");

// 统计图标分布(用正确的flat索引)
const stats = await page.evaluate(() => {
  function tileIconIndex(gx, gy, mapId) {
    let h = 0;
    const s = mapId + ":" + gx + "," + gy;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    h ^= h >>> 13;
    return ((h >>> 0) % 100) / 100;
  }
  const s = window.__game.state;
  const map = s.maps.list[s.maps.current];
  const W = map.gridW, H = map.gridH;
  let hidden = 0, revealed = 0, visited = 0, iconCells = 0;
  const iconByType = { ruins: 0, tree: 0, rock: 0, crater: 0, cache: 0 };
  const names = ["ruins", "tree", "rock", "crater", "cache"];
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const idx = gy * W + gx;
      const st = map.cells[idx];
      if (st === 0) hidden++;
      else if (st === 1) revealed++;
      else if (st === 2) visited++;
      if (st >= 1) {
        const h = tileIconIndex(gx, gy, s.maps.current);
        if (h < 0.6) {
          iconCells++;
          const i = Math.floor(h / 0.6 * names.length);
          iconByType[names[i]]++;
        }
      }
    }
  }
  return { mapId: s.maps.current, w: W, h: H, hidden, revealed, visited, iconCells, iconByType };
});
console.log("地图统计:", JSON.stringify(stats, null, 2));

// 再扩大一片 VISITED
await page.evaluate(() => {
  const s = window.__game.state;
  const map = s.maps.list[s.maps.current];
  const W = map.gridW, H = map.gridH;
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const dx = gx - 3, dy = gy - 3;
      const d2 = dx * dx + dy * dy;
      const idx = gy * W + gx;
      if (d2 <= 9) map.cells[idx] = 2; // VISITED
      else if (d2 <= 16) map.cells[idx] = Math.max(map.cells[idx], 1);
    }
  }
});
await page.waitForTimeout(600);
await page.screenshot({ path: "shot_map_visited.png" });
console.log("已保存 shot_map_visited.png");

await browser.close();
