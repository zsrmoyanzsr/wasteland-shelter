// 数值长测: 模拟玩家发展策略,跑100/300/500天,看资源/人口/设施是否平衡
// 重点发现: 是否饿死? 资源是否爆仓浪费? 人口是否卡上限? 是否有 NaN/负数?
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push("P:" + String(e).slice(0, 150)));
page.on("console", (m) => { if (m.type() === "error") errs.push("C:" + m.text().slice(0, 150)); });

await page.goto("http://localhost:5180", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2000);

// 模拟一个"合理发展"的玩家策略:
// - 升级农场保证食物
// - 升级净水保证水
// - 建发电机+工坊+医疗室
// - 升级基地扩容
// - 招人到上限
// 不模拟探索/派遣(那部分逻辑已验证),聚焦经济平衡
async function developAndRun(days) {
  return await page.evaluate(async (D) => {
    const s = window.__game.state;
    const eco = await import("/src/engine/economy.js");
    const sv = await import("/src/content/survivors.js");
    const fac = await import("/src/content/facilities.js");

    // 重置到干净新档,给适量启动资源便于观察发展曲线
    Object.assign(s, {
      res: { food: 50, water: 50, parts: 30, power: 15, meds: 10, scrap: 60 },
      base: { level: 1, facilities: fac.createInitialFacilities() },
      survivors: sv.createInitialSurvivors(),
      stats: { totalFood:0, totalWater:0, totalParts:0, expeditionsDone:0, survivorsRecruited:0, facilitiesBuilt:0 },
    });
    // 预分配初始2人到farm/well
    const farm = s.base.facilities.find(f => f.type === "farm");
    const well = s.base.facilities.find(f => f.type === "well");
    farm.assigned = [s.survivors[0].id]; s.survivors[0].assigned = farm.id;
    well.assigned = [s.survivors[1].id]; s.survivors[1].assigned = well.id;
    s.time = 0;

    const totalSec = D * 120;
    const checkpoints = [];

    // 每"天"检查一次,模拟玩家阶段性操作(每10天发展一次)
    for (let sec = 0; sec < totalSec; sec++) {
      eco.tickEconomy(s, 1);
      s.time = sec;

      // 每10天(1200秒)做一次发展决策
      if (sec > 0 && sec % 1200 === 0) {
        const day = Math.floor(sec / 120) + 1;
        // 策略: 优先升农场到3级,然后建发电机、工坊、医疗室,升级基地,招人
        const facs = s.base.facilities;
        const farmLv = facs.find(f=>f.type==="farm")?.level || 0;
        const hasGen = facs.some(f=>f.type==="generator");
        const hasWork = facs.some(f=>f.type==="workshop");
        const hasMed = facs.some(f=>f.type==="medbay");

        if (farmLv < 3 && s.res.scrap >= 26 && s.res.parts >= 10) {
          const f = facs.find(f=>f.type==="farm");
          s.res.scrap -= 10 + f.level*8; s.res.parts -= 4 + f.level*3;
          f.level++;
        } else if (!hasGen && s.res.scrap >= 16 && s.res.parts >= 10) {
          s.res.scrap -= 16; s.res.parts -= 10;
          facs.push({ id: facs.length+1, type:"generator", level:1, assigned:[] });
        } else if (!hasWork && s.res.scrap >= 20 && s.res.parts >= 9) {
          s.res.scrap -= 20; s.res.parts -= 9;
          facs.push({ id: facs.length+1, type:"workshop", level:1, assigned:[] });
        } else if (!hasMed && s.res.scrap >= 22 && s.res.parts >= 13) {
          s.res.scrap -= 22; s.res.parts -= 13;
          facs.push({ id: facs.length+1, type:"medbay", level:1, assigned:[] });
        } else if (s.base.level < 5 && s.res.scrap >= 20+s.base.level*15 && s.res.parts >= 10+s.base.level*8) {
          // 升级基地
          s.res.scrap -= 20+s.base.level*15; s.res.parts -= 10+s.base.level*8; s.res.food -= 10+s.base.level*5;
          s.base.level++;
        } else {
          // 招人(若没满)
          const cap = 2 + s.base.level * 2;
          const pop = s.survivors.filter(x=>x.busy!=="dead").length;
          if (pop < cap) {
            s.survivors.push(sv.generateSurvivor(1, Math.random, 100+pop));
            s.stats.survivorsRecruited++;
          }
        }
      }

      // 每30天记录检查点
      if (sec > 0 && sec % (30*120) === 0) {
        const day = Math.floor(sec / 120);
        const allFinite = Object.values(s.res).every(v => Number.isFinite(v) && v >= 0);
        const svOk = s.survivors.every(x => Number.isFinite(x.health) && x.health >= 0 && Number.isFinite(x.hunger));
        const starving = s.survivors.filter(x => x.hunger <= 0).length;
        const injured = s.survivors.filter(x => x.health < 30).length;
        checkpoints.push({
          day,
          res: { food: Math.floor(s.res.food), water: Math.floor(s.res.water), parts: Math.floor(s.res.parts), scrap: Math.floor(s.res.scrap), power: Math.floor(s.res.power), meds: Math.floor(s.res.meds) },
          pop: s.survivors.filter(x=>x.busy!=="dead").length,
          baseLv: s.base.level,
          facCount: s.base.facilities.length,
          starving, injured,
          allFinite: allFinite && svOk,
        });
      }
    }
    return { days: D, checkpoints, finalDay: Math.floor(s.time/120)+1 };
  }, days);
}

console.log("═══════════ 数值长测 ═══════════\n");
const findings = [];

for (const D of [100, 300, 500]) {
  const result = await developAndRun(D);
  console.log(`──── ${D} 天长测 ────`);
  for (const cp of result.checkpoints) {
    const r = cp.res;
    console.log(`  Day${String(cp.day).padStart(3)}: 食${String(r.food).padStart(4)} 水${String(r.water).padStart(4)} 零${String(r.parts).padStart(4)} 铁${String(r.scrap).padStart(4)} 电${String(r.power).padStart(3)} 药${String(r.meds).padStart(3)} | 人口${cp.pop} 基地Lv${cp.baseLv} 设施${cp.facCount} | 饿${cp.starving} 伤${cp.injured} ${cp.allFinite ? "✓" : "✗NaN"}`);
  }
  // 判定问题
  const last = result.checkpoints[result.checkpoints.length - 1];
  const mid = result.checkpoints[Math.floor(result.checkpoints.length / 2)];
  if (!last.allFinite) findings.push(`${D}天: 出现 NaN/负数`);
  if (last.starving > 0) findings.push(`${D}天: ${last.starving}人饥饿(食物不足)`);
  if (last.injured > last.pop * 0.5) findings.push(`${D}天: 超半数居民受伤`);
  // 食物是否长期耗尽
  if (last.res.food <= 0) findings.push(`${D}天: 食物耗尽=${last.res.food}`);
  // 资源是否爆仓停滞
  if (last.res.scrap >= 200 && mid && mid.res.scrap >= 200) findings.push(`${D}天: 废铁长期爆仓(${last.res.scrap}),后期无消耗出口`);
  console.log("");
}

console.log("═══════════ 长测结论 ═══════════");
if (findings.length === 0) {
  console.log("✅ 未发现明显平衡问题(资源/人口/数值稳定)");
} else {
  console.log(`⚠️ 发现 ${findings.length} 个潜在问题:`);
  for (const f of findings) console.log("  • " + f);
}
console.log(`console error: ${errs.length === 0 ? "无 ✅" : errs.length + "个"}`);
if (errs.length) console.log("errors:", [...new Set(errs)].slice(0, 5));
await browser.close();
process.exit(0);
