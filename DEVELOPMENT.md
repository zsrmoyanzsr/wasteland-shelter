# 开发文档 · DEVELOPMENT.md

> **本文档面向接手开发的工程师。读完本文 + README.md + progress.md，应能完全理解项目架构并立即开始开发。**
> 从零接手也能在 30 分钟内跑通游戏、1 小时内动手改第一个功能。
>
> 文档与代码同步更新规则：**每次改了架构/数据结构/关键逻辑，必须同步更新本文对应章节。**
> 最后更新：v2.5（前期靠派遣 + 派遣属性深度 + 远POI高回报）。

---

## 0. 30 秒快速上手

```bash
cd D:/project/60s
npm install          # 装 vite + playwright
npm run dev          # 启动 → 浏览器开 http://localhost:5180
# 改代码后热重载自动生效。改完跑测试：
node test_logic.mjs && node test_edge.mjs   # 必须全绿才能算改完
```

**改第一个功能的最短路径**：见 [§6 内容扩展指南](#6-内容扩展指南)，每类内容都有"加一个就生效、无需改引擎"的范例。

**遇到奇怪的 bug 先看** [§8 踩坑记录](#8-踩坑记录-重要)，90% 的坑已记录在那里。

---

## 1. 项目概览

**废土避难所 Wasteland Shelter** — 废土生存/经营 H5 单机游戏。
核心循环：**招募幸存者 → 网格探索触发事件 → 收获资源 → 建设基地 → 更强地探索**。

- **技术栈**：Vite 5 + 原生 JavaScript（ES Module），**无框架**
- **渲染**：单 Canvas 2D，**即时模式 UI**（immediate-mode，每帧重绘全部）
- **美术**：零外部资源依赖。全部程序化绘制 + Emoji + **AI 生成立绘/图标**（内联 base64，离线可用）
- **存档**：localStorage，**版本化迁移**，加新字段老存档永不丢、永不崩
- **布局**：响应式。宽屏（电脑/平板）= 左侧竖向导航 + 宽内容区；窄屏（手机）= 顶部资源条 + 底部导航
- **规模**：26 个 JS 模块，约 6600 行代码

---

## 2. 环境搭建

### 2.1 运行

```bash
npm install          # 安装 vite + playwright (devDependencies)
npm run dev          # 开发服务器 http://localhost:5180
npm run build        # 生产构建到 dist/
npm run preview      # 预览构建产物
```

**端口固定 5180**（`vite.config.js` 里 `strictPort: true`，测试脚本硬编码此端口）。
若 5180 被占用，改 `vite.config.js` + 所有 `test_*.mjs` 里的 URL。

### 2.2 依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `vite` | ^5.4 | 开发服务器 + 构建 |
| `playwright` | ^1.60 | 自动化测试（test_*.mjs） |
| `pngjs` | ^7.0 | 立绘生成脚本辅助 |

无运行时依赖（纯前端，构建后是一堆静态文件）。

### 2.3 测试

```bash
node test_logic.mjs    # 26 项逻辑测试（初始/经济/升级/医疗/技能/事件/解锁/派遣/成就/存档/长跑）
node test_edge.mjs     # 14 项边界测试（负数/容量/扣血/体力/人口/重复领）
```

测试用 Playwright 启无头 Chromium，通过 `window.advanceTime(ms)` 步进游戏、`window.render_game_to_text()` 读状态、`window.__game.state` 直接读写 state。
**改代码后务必重跑这两个，必须全绿。** 写新测试参考 test_logic.mjs 的 `page.evaluate()` 模式。

### 2.4 目录结构

```
60s/
├── index.html              # 唯一 HTML，只一个 <canvas> + <script>
├── vite.config.js          # 端口 5180，strictPort
├── package.json
├── src/
│   ├── main.js             # 入口：canvas初始化/游戏循环/屏幕路由/测试钩子 (455行)
│   ├── engine/             # 引擎层（纯逻辑，无渲染）
│   │   ├── state.js        # 中心 state 对象 + DEFAULTS 模板 (219行)
│   │   ├── save.js         # 版本化存档/迁移/备份/自检 (336行)
│   │   ├── economy.js      # 经济 tick/产出消耗/医疗/离线结算 (175行)
│   │   ├── worldUpdate.js  # 主角移动/网格探索/事件触发 (115行)
│   │   └── avatarLoader.js # 立绘加载(内联base64+外部覆盖) (95行)
│   ├── content/            # 内容层（数据定义，可扩展）
│   │   ├── regions.js      # 5张地图/POI/网格/解锁/传送 (376行)
│   │   ├── exploreEvents.js# 探索事件池(82个:好40/坏30/中立12) (705行)
│   │   ├── events.js       # 派遣事件池(196行)
│   │   ├── survivors.js    # 职业/特长/姓名/生成器 (126行)
│   │   ├── facilities.js   # 6种设施定义/产出/成本 (132行)
│   │   ├── tasks.js        # 7个任务定义 (73行)
│   │   ├── achievements.js # 10个成就/重建进度 (139行)
│   │   └── avatars_inlined.js # 12立绘+主角 base64 内联 (~700KB)
│   ├── screens/            # 屏幕层（每屏一个绘制函数 + 模态）
│   │   ├── screenHud.js    # 顶栏/侧栏/底导航/布局 contentRect (201行)
│   │   ├── screenBase.js   # 基地屏:设施网格/建造升级/探索入口 (615行)
│   │   ├── screenMap.js    # 地图屏:网格/迷雾/主角/AI装饰图标 (352行)
│   │   ├── screenRoster.js # 居民屏:列表/详情/分配 (359行)
│   │   ├── screenDispatch.js# 派遣屏:组队/倒计时/事件/结果 (629行)
│   │   ├── screenTasks.js  # 任务屏:任务/成就/招募/重建进度 (335行)
│   │   ├── screenExploreEvent.js # 探索事件模态 (133行)
│   │   └── screenStart.js  # 开始屏 (98行)
│   └── ui/                 # UI 层（绘制原语/主题/头像）
│       ├── ui.js           # fillRoundRect/text/button/progressBar 等 (260行)
│       ├── theme.js        # 配色/字号/资源元数据 (65行)
│       ├── input.js        # 鼠标/触摸/键盘 → pointer状态 (124行)
│       └── avatar.js       # 头像绘制辅助 (273行)
├── public/
│   ├── avatars/            # 外部立绘(可选,覆盖内联): girl_0..11.png + hero.png + manifest.json
│   └── img/tiles/          # 5个AI地图装饰图标: ruins/tree/rock/crater/cache .png (128px)
├── test_logic.mjs          # 26项逻辑测试
├── test_edge.mjs           # 14项边界测试
├── shot_map.mjs            # 地图截图验证脚本
├── DEVELOPMENT.md          # ← 本文档（架构/扩展/踩坑）
├── README.md               # 项目总览（给所有人）
├── progress.md             # 完整变更历史 + bug修复记录 + 测试结果
└── DEPLOY.md               # 部署指南(Netlify/Vercel/GitHub Pages)
```

---

## 3. 核心架构

### 3.1 单一状态对象（Single Source of Truth）

整个游戏状态是一个**纯数据对象** `state`，定义在 `src/engine/state.js` 的 `createNewState()`。
**所有系统都读写这同一个对象**，无 Redux/状态管理库。这是最重要的约定。

```js
state = {
  version: 2,            // 存档版本（见 §4.4 存档系统）
  createdAt, lastTickAt, // 时间戳（lastTickAt 用于离线结算）
  screen, prevScreen, tab,  // 当前屏/上一屏/导航高亮 ("start"|"base"|"map"|"roster"|"dispatch"|"tasks")
  time, day, timeOfDay, speed,  // 游戏时间(秒)/天数/日内进度(0-1)/流速倍率
  res: {food,water,parts,power,meds,scrap},   // 6种资源
  resCap: {...},         // 基础容量（实际容量 = getResCap(state,key) = base + (level-1)*30）
  base: {level, facilities:[]},  // 基地等级(1-5) + 设施数组
  survivors: [],         // 幸存者数组
  nextSurvivorId: 100,   // ID 分配器
  radio: {candidate, cooldown},  // 无线电招募
  maps: {current:"home", list:{id: mapDef}},  // 多地图（见下）
  player: {x,y,tx,ty,moveSpeed,stamina,maxStamina,health,maxHealth},  // 主角
  expeditions: [],       // 派遣任务数组
  nextExpeditionId,
  tasks: [],             // 任务数组 {id, done, claimed}
  achievements: [],      // 成就数组 {id, done, claimed}
  stats: {totalFood,totalWater,totalParts,expeditionsDone,survivorsRecruited,facilitiesBuilt},
  log: [],               // 日志 [{t,text,color}]（最多30条）
  floats: [],            // 浮动文字 [{x,y,text,color,life,maxLife,vy}]（最多40个）
  modal: null,           // 当前弹窗 {type, ...data} 或 null
  raid: {timer, threat}, // 袭击计时（秒）
  // 运行时临时字段（不存档）：_exploreCooldown, _lastEventId, _lastExploreGx/Gy
}
```

**幸存者结构**（`content/survivors.js` generateSurvivor）：
```js
{
  id, name, profession, profName, profIcon,
  perks: [],             // 特长 id 数组 ["doctor","scavenger",...]
  level, xp, xpNeed,     // xpNeed = 50 + level*30
  skills: {medical,craft,scavenge,combat,farm,social},  // 0-10，影响设施产出+事件
  health, maxHealth,     // 0-100，<30=重伤（效率减半+不能派遣）
  hunger, mood,          // 0-100
  assigned,              // 分配的设施 id 或 null
  busy,                  // "expedition" | null（不死，"dead" 仅作过滤标记）
  avatarImg,             // 运行时挂载的 Image（不存档，加载后 assignAvatars 重分配）
}
```

**地图结构**（`content/regions.js` createMaps）：
```js
maps = {
  current: "home",       // 当前所在地图 id
  list: { home:{...}, town:{...}, hospital:{...}, factory:{...}, military:{...} }
}
// 每个地图：
{
  id, name, icon, desc, gridW, gridH,   // 网格尺寸（home 8×7 ... military 12×10）
  bgColor, bgGradTop, bgGradBot, accent, gridLineColor,  // 主题色
  entry: {gx, gy},      // 主角进入格（传送/出生点）
  unlock: {type:"free"|"resource"|"discover"|"expeditions"|"compound", ...},
  eventRate,            // 历史字段（现已被 cellEventHash 确定性分布取代，仅保留）
  cells: Uint8Array(gridW*gridH),  // ★关键: 0=HIDDEN迷雾 1=REVEALED已揭示 2=VISITED已踏足
  pois: [{type,gx,gy,id,discovered}],  // 可派遣点
  discoveredCount, unlocked,
}
```

> ⚠️ `cells` 是 **flat Uint8Array**，索引 = `gy * gridW + gx`，不是二维数组。存档时序列化成 `{__u8:[...]}`，读档时 restoreRuntime 还原。

### 3.2 即时模式 UI（Immediate-Mode）

**没有 DOM 元素**（除一个 canvas）。所有按钮/面板/列表每帧在 canvas 上重绘。
UI 元素通过 `inRect(px,py,x,y,w,h)` 检测 hover，靠 `ui.pointer.pressed` 检测点击。

核心原语在 `src/ui/ui.js`：
```js
button(ctx, ui, x, y, w, h, label, opts)   // 返回 true 当本次点击命中
iconButton(ctx, ui, x, y, w, h, emoji, opts)
fillRoundRect / roundRect / text / textWrap / progressBar / clipRound / inRect
```

**`ui` 参数**就是 `input` 对象（`src/ui/input.js` createInput）：
```js
ui.pointer = {x, y, down, pressed, justReleased, dragX, dragY, downX, downY}
//   pressed = 本帧"按下"事件（单次，endFrame 清除）
ui.keys, ui.keysPressed          // Set<keyCode>
ui.consumeWheel()                // 消费并返回本帧滚轮增量（调用后清零）
ui.endFrame()                    // 每帧末调用：清 pressed/keysPressed/wheel
```

### 3.3 渲染管线（render）— ⚠️ 顺序至关重要

`src/main.js` 的 `loop()`：
```js
function loop(now) {
  render();   // ① 先渲染（UI 在此读 pointer.pressed 触发点击）
  update(dt); // ② 再更新逻辑（此处 endFrame 清除 pressed）
  requestAnimationFrame(loop);
}
```

**为什么 render 在 update 前**：即时模式 UI 在 render 时读取 `pointer.pressed`。
若 update 先跑，`endFrame()` 会清掉 pressed，UI 永远收不到点击。**这个顺序绝对不能反。**

`render()` 流程（main.js）：
```
1. 清屏（T.bg）
2. 若 START 屏 → drawStartScreen，return
3. modalActive = !!state.modal
4. realPressed = input.pointer.pressed   // 保存真实点击
5. 若 modalActive → input.pointer.pressed = false   // 屏蔽背景点击
6. switch(state.screen) → drawXxxScreen   // 画背景内容
7. 若 modalActive → input.pointer.pressed = false   // 屏蔽导航
8. drawTopBar + drawBottomNav（含侧栏）
9. 若 modalActive → 恢复 realPressed；drawActiveModal()；pressed=false
10. drawFloats（浮动文字，最顶层）
```

**模态点击穿透防护**：模态激活时，背景屏和导航的 pressed 被置 false，只有模态自己（用真实 realPressed）能响应点击。这是防"点模态按钮却同时触发底层"的关键。

### 3.4 模态系统（Modal）

模态 = `state.modal = {type: "xxx", ...data}`。所有模态在 main.js 的 `drawActiveModal()` 里按 `state.screen + modal.type` 路由：

| screen | modal.type | 绘制函数 | 用途 |
|--------|-----------|---------|------|
| base | buildFacility | screenBase.drawBuildModal | 建造确认 |
| base | upgradeFacility | screenBase.drawUpgradeModal | 设施升级 |
| base | baseUpgrade | screenBase.drawBaseUpgradeModal | 基地升级 |
| base | mapSelect | screenBase.drawMapSelectModal | 地图选择传送 |
| roster | survivorDetail | screenRoster.drawDetailModal | 居民详情 |
| roster | assignSurvivor | screenRoster.drawAssignModal | 分配工作 |
| map | exploreEvent | screenExploreEvent.drawExploreEventModal | 探索事件 |
| dispatch | formTeam | screenDispatch.drawTeamModal | 组队 |
| dispatch | event | screenDispatch.drawEventModal | 派遣事件 |
| dispatch | expeditionResult | screenDispatch.drawResultModal | 派遣结果 |
| tasks | recruitConfirm | screenTasks.drawRecruitModal | 招募确认 |
| **全局(任意屏)** | **trade** | **screenTrade.drawTradeModal** | **流浪商队交易** |

> **全局模态**：trade 模态在 `drawActiveModal` 开头用 `if (m.type === "trade")` 顶层判断,**不绑定 screen**,任意屏都能弹(商队到访时若玩家正在别的屏)。这是全局模态的唯一特例。

**加新模态**：1) 在对应 screen 文件写 `drawXxxModal` 并 export；2) 在 `main.js` 的 `drawActiveModal` 加路由分支（绑定 screen 的进 switch；全局的在 switch 前顶层判断）。
读档时 `s.modal = null`（不恢复弹窗，避免指向已变化的实体）。

### 3.5 游戏循环（update）

`update(dt)` 每帧调用（dt=秒），驱动所有系统：
```
1. 时间推进：state.time += dt*speed; day = floor(time/120) + 1（游戏内1天=120秒）
2. 键盘快捷键：F=全屏，Escape=关模态
3. tickEconomy(state, dt)   — 设施产出/消耗/居民需求/医疗治疗
4. 无线电冷却递减
5. updatePlayer(state, dt)  — 主角移动/体力/血量恢复
6. updateExplore(state)     — 网格揭示/事件触发/POI发现（见 §4.2）
7. updateUnlocks(state)     — 地图解锁判定
8. updateExpeditions(state, dt) — 派遣倒计时/结算
9. updateTasks(state)       — 任务完成判定
10. checkAchievements(state) — 成就判定
11. updateRaid(state, dt)   — 袭击计时（到点触发，围墙防御够则无事，不够则丢资源）
12. 浮动文字生命期递减
13. 每5秒自动存档
14. input.endFrame()        — 清除单帧信号（pressed/keysPressed/wheel）
```

### 3.6 响应式布局（宽屏/窄屏）

`src/screens/screenHud.js` 的 `contentRect(W,H)` 是布局的**唯一开关**，所有屏幕都调它拿内容区：

```js
// 宽屏（窗口宽 > 高×0.85）：左侧竖向导航 + 右侧宽内容
contentRect = { x: SIDEBAR_W(96), y: HUD_TOP_H(56), w: W-96, h: H-56 }
// 窄屏：顶部资源条 + 底部导航 + 中间内容
contentRect = { x: 0, y: 56, w: W, h: H-56-68 }
```

判定靠 `canvas.dataset.isWide`（resize 时写入）。
- 宽屏：`drawSidebar`（左侧 ☢️ logo + 5个竖向导航项，每项 72px 高）
- 窄屏：`drawBottomBar`（底部横向 5 等分导航）

**导航项**：基地🏠 / 地图🗺️ / 居民🧑 / 派遣🚀 / 任务📜（screenHud.js 的 NAV_ITEMS）。
点击导航项设 `state.tab = state.screen = item.screen`。

---

## 4. 关键子系统详解

### 4.1 经济系统（`engine/economy.js`）

**`tickEconomy(state, dt)`** 每帧调用：
- 遍历所有设施 `facilityProduction(state, fac)` 算产出/消耗
- 检查消耗是否够（电力/废铁不足时该设施产能减半）
- 居民每日消耗食物/水（每秒速率 = 每日量/120；每人每天3食物2.5水）
- 资源应用带容量上限 `getResCap`（资源 clamp 到 [0, cap]）
- `updateSurvivorNeeds` — 饥饿/心情/健康随时间变化（食物不足饥饿加速下降，严重饥饿扣血）
- `healInMedbay` — 医疗室治疗伤员（有医生特长回血×2，消耗 meds）

**`facilityProduction` 产出倍率 mult**：
```
无人工作: mult = 0.35（半自动，不至于停摆）
有人工作: mult = 0.4 + 人数×0.3 + 特长加成(每个匹配 perk +0.5) + 技能值×0.05
重伤惩罚: 每个 health<30 的居民 -0.15
下限 0.2，上限 2.5
技能→设施映射: farm→farm, workshop/generator→craft, well→farm, medbay→medical
```

**离线结算** `offlineSettle(state, nowMs)`：按 lastTickAt 与现在差，效率 0.8，上限 8 小时，用 tickEconomy 逐步结算。

### 4.2 探索系统（`engine/worldUpdate.js`）— ★ v2.2 重点

**网格探索流程**（每帧 `updateExplore`）：
1. 算主角当前格 `(gx,gy)` = `worldToGrid(player.x, player.y)`
2. `revealCellAndNeighbors(map, gx, gy)`：踏足格设 VISITED（首次返回 newlyVisited:true），相邻4格设 REVEALED
3. `checkPoiDiscovery`：若踏上未发现 POI → 标记发现 + `discoveredCount++` + `updateUnlocks`（可能解锁新地图）
4. 若 newlyVisited 且无模态且无冷却 → **按确定性 hash 决定是否触发事件**：
   ```js
   const eventHash = cellEventHash(gx, gy, state.maps.current);  // 0..1 确定性
   if (eventHash < 0.33) {  // ~33% 密度
     const preferGood = 有scavenger特长 || 社交技能≥2;
     const ev = rollExploreEvent(Math.random, preferGood, state._lastEventId);
     state.modal = { type:"exploreEvent", eventId:ev.id, mapId, gx, gy };
   }
   state._exploreCooldown = true;  // 防同格连发
   ```
5. 离开该格清除 `_exploreCooldown`（下次进新格可再触发）

**`cellEventHash(gx,gy,mapId)`**（worldUpdate.js）：确定性哈希，**同一格+同一地图永远返回同一 0..1 值**。
设计目标：每 3×3 区块（~9格）里约 3 个格 hash<0.33 → **~33% 事件密度，满足"每9格一组≥3事件"**。实测 home map 约 38%。
确定性意味着：事件分布与存档无关、不闪、不会因重开改变。

**侦察兵偏好**：`preferGood=true` 时 `rollExploreEvent` 把好事件权重×2、坏事件×0.5、中立不变。

**主角状态**（`updatePlayer`）：
- 向目标 `(tx,ty)` 移动，移动耗体力
- health≤0 时静止自动回血（营地静养，**不死**，休闲向）
- 静止时恢复体力+微量回血

### 4.3 派遣系统（`screens/screenDispatch.js`）

- 玩家在派遣屏选**已发现的 POI**（来自地图探索）+ 组队 → 构造 expedition 对象，成员标记 `busy="expedition"`
- `updateExpeditions(dt)` 每帧检查，到时间调 `settleExpedition`
- 结算：按 POI 类型的 rewards 范围随机给资源（侦察兵×1.25），70% 概率触发派遣事件（events.js 的 5 类），否则直接发奖
- 事件抉择后释放成员、给经验、`levelUpSurvivor`
- expedition 带 `rng`（makeRng 确定性），**存档后丢失，restoreRuntime 必须重建**（见踩坑#4）

### 4.4 存档系统（`engine/save.js`）— ⚠️ 重点

**版本化迁移，永不丢档**。设计目标：以后加新字段/新内容（物品等），老存档永不丢、永不崩。

**版本号**：`CURRENT_VERSION = 2`（state.js 顶部）。每次结构性改动 +1。

**`loadGame()` 流程**：
```
1. 读 payload（主存档 → 备份 → 老v1，依次回退）
2. oldVer = payload.state.version
3. 迁移前备份原始数据到 BACKUP_KEY（防迁移失败丢档）
4. applyMigrations: 按 oldVer+1..CURRENT_VERSION 顺序应用 migrations[N]
5. mergeDefaults: 递归用 DEFAULTS 模板补全所有缺失字段（防 NPE/NaN）
6. restoreRuntime: Uint8Array 还原 + expedition.rng 重建
7. validateState: 关键字段类型自检，异常则降级用默认（不崩）
8. s.modal = null; s.lastTickAt = savedAt
```

**滚动备份**：每次 saveGame 把上一次的有效档存到 BACKUP_KEY；主档损坏时 loadGame 自动从备份恢复。

**★ 以后加新内容（物品/新字段）的标准步骤**：
```
1. state.js 的 createNewState() 加新字段默认值
2. state.js 的 DEFAULTS 模板加对应默认值（mergeDefaults 用它补老存档）
3. state.js 顶部 CURRENT_VERSION 从 2 改成 3
4. save.js 的 migrations 加:
     3: (s) => { /* 版本特定转换(通常可空,mergeDefaults 自动补字段) */ s.version = 3; },
完成。老存档读档自动迁移，不丢不崩。
```

**关键雷区**：
- `expedition.rng` 是函数，无法 JSON 序列化 → restoreRuntime 必须用 `makeRng((startAt*7919+id)%1e9)` 重建
- `Uint8Array` 序列化成 `{__u8:[...]}`，读档还原
- `stats` 不能补成 `{}`，6 个子字段都要补，否则解锁条件/成就 NaN
- `avatarImg` 是运行时 Image，不存档，读档后 assignAvatars 重分配

---

## 5. 坐标系统 ⚠️

**这是最容易踩坑的地方，必须理解三层坐标。**

- **逻辑坐标**：绘制用的坐标系。`LOGIC_W × LOGIC_H` = `window.innerWidth × innerHeight`（撑满）
- **CSS 坐标**：canvas 在页面的显示尺寸 = 窗口尺寸
- **物理像素**：`canvas.width = LOGIC_W × dpr`（dpr 上限 2，高清不糊）

**绘制**：`ctx.setTransform(dpr,0,0,dpr,0,0)` 后用逻辑坐标绘制。
**点击映射**（`input.js` 的 `toLocal`）：
```js
逻辑x = (clientX - rect.left) × (logicW / rect.width)
logicW/H 存在 canvas.dataset.logicW/H，与 dpr 解耦
```

**⚠️ 测试时**：Playwright 的 `page.mouse.click(cssX, cssY)` 用 CSS 坐标（=窗口坐标）。
若要点击逻辑坐标 (lx,ly)：因逻辑坐标=窗口坐标（撑满），通常 `cssX = lx`。但 deviceScaleFactor=2 时物理像素翻倍，截图坐标要 ×2。

**地图世界坐标**：地图内 `(player.x, player.y)` 是世界像素，`CELL_PX=56`。
`gridToWorld(gx,gy) = {x: gx*56+28, y: gy*56+28}`，`worldToGrid` 反向。

---

## 6. 内容扩展指南

### 6.1 加新设施
`content/facilities.js` 的 `FACILITY_TYPES` 加一个：
```js
newFac: {
  type: "newFac", name: "新设施", icon: "🔧",
  category: "production", catLabel: "生产", maxLevel: 5,
  base: { produces: {parts: 0.3}, consumes: {power: 0.1}, jobs: 2 },
  growth: 1.6, cost: (lvl) => ({scrap: 10+lvl*8, parts: 4+lvl*3}),
  perk: "engineer",
}
```
自动出现在基地建造菜单（`buildableTypes()`），无需改 UI。注意 base 卡片自动换行（防裁切）。

### 6.2 加新探索事件
`content/exploreEvents.js` 的 `EXPLORE_EVENTS` 数组加一个：
```js
{
  id: "my_event",            // ★唯一 id
  weight: 3,                 // 权重（越大越常出）
  kind: "good",              // ★"good"|"bad"|"neutral"
  text: "事件描述文本",
  choices: [
    { label: "选项A", desc: "说明",
      resolve(ctx) {
        // ctx = {rng, res, stamina, health, hasPerk, perkLevel}
        // 分支好坏靠 ctx.rng() / ctx.hasPerk()
        if (ctx.rng() < 0.5) return { log:{text:"好结果",color:"#7cc36b"}, rewards:{food:5}, mood:3 };
        return { log:{text:"坏结果",color:"#e0584e"}, health:-10, stamina:-5 };
      }
    },
  ],
}
```
`rollExploreEvent` 自动纳入，`EXPLORE_EVENT_STATS` 自动统计好/坏/中立数。**无需改引擎。**

返回字段：`log{text,color}` / `rewards{资源:量}`（可负）/ `stamina` / `health` / `mood`（负=扣）。
中立事件（kind:"neutral"）在模态显示蓝色边框 + ❓ + "需要抉择"标题（screenExploreEvent.js）。

### 6.3 加新地图
`content/regions.js` 的 `MAP_DEFS` 加一个（参考现有 5 张格式）：
```js
{ id:"newmap", name:"新地图", icon:"📍", gridW:10, gridH:9,
  bgColor/bgGradTop/bgGradBot/accent/gridLineColor,
  entry:{gx:0,gy:4},
  unlock:{ type:"resource"|"discover"|"expeditions"|"compound", ... },
  pois:[{type:"cache",gx:5,gy:3}], eventRate:0.6 }
```
`createMaps()` 自动创建。**老存档通过 mergeDefaults 补全新地图**（save.js 里遍历 freshMaps 补缺失）。
解锁条件类型：free / resource(res,amount) / discover(mapId,count) / expeditions(count) / compound(conditions[]).

### 6.4 加新成就
`content/achievements.js` 的 `ACHIEVEMENT_DEFS` 加一个：
```js
{ id:"my_ach", name:"名称", desc:"描述", icon:"🏆",
  check:(st)=> st.stats.xxx >= 10,           // 判定函数
  progress:(st)=> Math.min(1, st.stats.xxx/10),
  reward:{parts:10} }
```
`checkAchievements` 每帧自动判定。`rebuildProgress` 综合多维度算整体进度%。

### 6.5 加新职业/特长
`content/survivors.js` 的 `PROFESSIONS` / `PERKS` 加一个。
若要让特长影响探索事件：在 exploreEvents.js 的 resolve 里用 `ctx.hasPerk("新特长")` / `ctx.perkLevel("新特长")`。
若要影响设施产出：在 facilities.js 的对应设施 `perk` 字段填特长 id，并在 economy.js 的 skillMap 加技能映射（如需）。

### 6.6 加新任务
`content/tasks.js` 的 `TASK_DEFS` 加一个。任务类型：facility_level / population / discover / expeditions / facility_type / resource。`updateTasks`（screenTasks.js）每帧判定。

### 6.7 加新 AI 图标/立绘
- **地图装饰图标**：放 `public/img/tiles/xxx.png`（128×128，废土风格），在 screenMap.js 的 `TILE_ICONS` 数组加名字。`tileIconIndex` 决定每格显示哪个（hash<0.6 才显示，60%格子有装饰）。
- **幸存者立绘**：放 `public/avatars/girl_N.png`，更新 `public/avatars/manifest.json`。内联版在 `src/content/avatars_inlined.js`（base64，离线零依赖）。`getAvatarImage(id,name)` 按 id+name 哈希确定性分配。
- 生成图用 pollinations.ai FLUX（免费无 key）：`https://image.pollinations.ai/prompt/<URL编码的prompt>?width=128&height=128&nologo=true`

---

## 7. 测试

### 7.1 运行测试
```bash
node test_logic.mjs    # 26项逻辑测试
node test_edge.mjs     # 14项边界测试
node shot_map.mjs      # 地图截图(验证图标渲染,人工看图)
```
**改代码后务必重跑 test_logic + test_edge，必须全绿才能算改完。**

### 7.2 测试原理
- Playwright 启无头 Chromium，开 `http://localhost:5180`
- 清 localStorage → 新档 → 通过 `window.__game.state` 直接读写 state
- `window.advanceTime(ms)` 按秒步进游戏（60fps 切片）
- `window.render_game_to_text()` 读完整状态 JSON
- 断言用 `T(name, cond, detail)` 收集，末尾打印报告 + exit code

### 7.3 写新测试
参考 test_logic.mjs：`page.evaluate(() => import('/src/xxx.js'))` 拿模块、操作 state、断言。
注意 UI 点击用 CSS 坐标（见 §5）。改了事件数量等，记得同步更新 test_logic.mjs 的断言（如事件数好40/坏30/中立12）。

### 7.4 测试覆盖的角度
- **初始状态正确性**（资源/设施/幸存者/人口/地图/任务/成就）
- **经济平衡**（1天/10天后不饿死、资源正增长、无 NaN/Infinity）
- **升级链**（基地升级→容量/人口涨；技能越高产出越高）
- **医疗**（医疗室回血、重伤<30存在）
- **事件**（全部 resolve 不崩、数量正确、好坏中立都有）
- **解锁**（医院/工厂/军事区条件正确）
- **派遣**（已发现 POI、带 mapId）
- **成就**（自动判定、重建进度>0）
- **存档**（序列化/反序列化完整）
- **边界**（资源不变负、不超容量、扣血不致死、人口超上限不崩、奖励不重复领）

---

## 8. 踩坑记录（重要!）

> **遇到 bug 先扫这里，90% 的坑已记录。**

1. **render 必须在 update 前** — 否则 UI 收不到 pressed（见 §3.3）。loop() 顺序绝不能反。
2. **模态必须走 drawActiveModal 集中路由** — 在 screen 内部直接画模态会被背景点击屏蔽。新模态要在 main.js drawActiveModal 注册。
3. **dpr 坐标映射** — 用 `canvas.dataset.logicW/H`，**不能直接用 canvas.width**（含 dpr，会偏移）。input.js 的 toLocal 已处理。
4. **expedition.rng 无法序列化** — 函数不能 JSON 化，存档后丢失，restoreRuntime 必须用确定性种子 `makeRng((startAt*7919+id)%1e9)` 重建，否则进行中的派遣读档必崩。
5. **data URL Image 需预解码** — `img.decode()`，否则首次渲染 `complete=false` 显示空白。avatarLoader.initAvatars 已做。
6. **事件触发用确定性 hash 而非纯随机** — v2.2 改为 `cellEventHash<0.33`，~33% 密度且每格固定。纯随机会有的格永远没事件、有的连发。
7. **stats 不能补成 {}** — 6 个子字段都要补，否则解锁条件/成就计算 NaN。mergeDefaults 已用 DEFAULTS.stats 逐字段补。
8. **旅行/出生格预标记 VISITED** — 否则传送立即触发事件。travelToMap + createMaps 都做了。
9. **基地布局动态变化** — 加内容后建造卡片位置会变，wall 曾因此被裁掉。已修：卡片自动换行（perRow 计算）。
10. **无线电招募立绘要手动 assignAvatar** — generateSurvivor 生成的 candidate 默认无 avatarImg，必须 `window.__assignAvatar(cand)`（screenTasks.js 约 line 169），否则显示旧占位图。
11. **cells 是 flat Uint8Array** — 索引 `gy*gridW+gx`，不是 `cells[gy][gx]`。序列化成 `{__u8:[...]}`，读档还原。
12. **revealCellAndNeighbors 对 REVEALED 格也要返回 newlyVisited** — 早期版本只对 HIDDEN→VISITED 算首次，导致相邻揭示成 REVEALED 后踏足不触发事件。已修：任何非 VISITED 踏足都算首次。
13. **函数内提前 return 会跳过后续副作用代码** — v2.2.1 修：revealCellAndNeighbors 首次踏足分支曾 `return {newlyVisited:true}` 在揭示相邻格之前，导致相邻格永远 HIDDEN。教训：有副作用的函数不要在分支里提前 return，要先执行完所有副作用再返回标志。
14. **状态机的每个分支都要完整收尾** — v2.2.1 修：派遣 settleExpedition 的"无事件"分支漏了 `member.busy=null` 和 `expeditionsDone++`，导致成员永久卡住、派遣计数不加。教训：多分支结算(有事件/无事件)要对齐收尾逻辑(释放成员+计数+XP)，最好抽公共函数。详见 screenDispatch.js 的 resolveEvent vs settleExpedition。
15. **测试要断言副作用而非仅主路径** — 原有测试只验证"踏足格变VISITED""派遣到时间结算"，没验证"相邻格是否揭示""成员是否释放"，漏掉了Bug1/2。教训：写测试多问一句"这个操作还应该改变什么状态"，把副作用也断言上。

---

## 9. 已知局限 & TODO

- **后期经济瓶颈已修复（v2.3.1）**：加了废料场设施稳定产废铁 + 提高派遣废铁奖励，废铁不再枯竭。剩余现象：food/water/power/meds 后期爆仓，需中后期消耗出口（科技树等），属内容深度问题。
- **hunger 平衡已在 v2.3 修复**：旧版饱食度无条件下降导致食物满仓也饿死，现有食物时回升、缺粮时加速下降。
- 只测了 500 天长跑（v2.3 起），更长周期未验证
- 真人非预期操作序列（乱点模态组合）可能触发未考虑的状态
- 无音效、无多存档槽、无云存档
- 无线电招募的 candidate 立绘是确定性分配，同一 id 永远同一张（可接受）
- 详见 progress.md 各版本的 TODO

**可能的扩展方向**（按实现难度排序）：
1. 物品/背包系统（按 §4.4 流程加 state.player.inventory + CURRENT_VERSION+1）
2. 更多地图/事件（§6.2/6.3，纯数据扩展）
3. 战斗系统（目前袭击是自动数值判定，可加回合制）
4. 多存档槽（save.js 加 slot 参数）
5. 成就/任务云同步

---

## 10. 文档索引

| 文档 | 用途 | 给谁 |
|------|------|------|
| **README.md** | 项目总览、功能清单、运行方式、玩法 | 所有人 |
| **DEVELOPMENT.md**（本文档） | 架构、数据流、扩展指南、踩坑、测试 | 开发者（必读） |
| **progress.md** | 完整变更历史、每个版本的改动+bug修复+测试结果 | 接手开发者（查历史） |
| **DEPLOY.md** | 部署到 Netlify/Vercel/GitHub Pages 的步骤 | 要上线的人 |

**接手开发者的推荐阅读顺序**：
1. 本文 §0~§4（30分钟，理解架构）
2. 跑一遍游戏 + 测试（10分钟）
3. 按 §6 改一个小功能练手（加个探索事件，20分钟）
4. 遇到问题查 §8 踩坑 + progress.md 对应版本
5. 正式开发前通读 progress.md 了解演进历史和设计决策原因

---

## 附录 A：版本演进速查

| 版本 | 关键变化 | 详见 |
|------|---------|------|
| v1 | 单地图、28事件、基础循环 | progress.md |
| v2 | 多地图、存档迁移系统、health、技能、成就、6种资源 | progress.md |
| v2.1 | 事件池扩到60（好30/坏30）、100%触发 | progress.md |
| **v2.2** | **事件82个(好40/坏30/中立12)、~33%确定性分布、AI地图图标、无线电立绘修复、分支好坏事件** | **progress.md + 本文档** |
| **v2.2.1** | **深度测试修复6个bug(网格揭示相邻格/派遣无事件分支结算/info.loot缺失/派遣入口阻塞/居民消耗/空数组存档迁移)+ 新增test_deep+test_ui_e2e共64项** | **progress.md + 本文档** |
| **v2.3** | **新手引导系统 + hunger平衡修复(食物满仓不再饿死) + 派遣状态机重构(防Bug2同类) + 数值长测(test_balance) + 后期经济瓶颈记录** | **progress.md + 本文档** |
| **v2.3.1** | **经济平衡修复: 加废料场设施(稳定产废铁)+ 提高派遣废铁奖励,解决后期废铁枯竭卡死发展** | **progress.md + 本文档** |
| **v2.4** | **流浪商队交易系统: 每6-9天稀有到访,智能生成3个高价值方案(用富余换稀缺),解决后期爆仓+增加决策乐趣** | **progress.md + 本文档** |
| **v2.5** | **玩法转向: 前期资源精简(meds/power初始0)+ 自产削弱(前期靠派遣)+ 派遣属性加成(组队策略)+ 远POI高时间高回报** | **progress.md + 本文档** |

## 附录 B：关键常量速查

| 常量 | 值 | 位置 | 含义 |
|------|-----|------|------|
| CURRENT_VERSION | 2 | state.js | 存档版本 |
| CELL_PX | 56 | regions.js | 网格每格像素 |
| 游戏内1天 | 120秒 | main.js | day = time/120 |
| HUD_TOP_H | 56 | screenHud.js | 顶部资源条高 |
| HUD_BOTTOM_H | 68 | screenHud.js | 窄屏底部导航高 |
| SIDEBAR_W | 96 | screenHud.js | 宽屏左侧栏宽 |
| 事件密度阈值 | 0.33 | worldUpdate.js | cellEventHash<0.33 触发 |
| 图标显示阈值 | 0.6 | screenMap.js | tileIconIndex<0.6 显示装饰 |
| MAX_BASE_LEVEL | 5 | state.js | 基地最高级 |
| populationCap | 2+lv×2 | survivors.js | 人口上限 |
| xpForLevel | 50+lv×30 | survivors.js | 升级所需经验 |
| 端口 | 5180 | vite.config.js | 开发服务器（strictPort） |
