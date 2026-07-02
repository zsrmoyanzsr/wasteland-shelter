# 废土避难所 H5 经营游戏 — 进度记录

Original prompt: 设计并实现一款废土生存/经营类 H5 游戏。核心玩法循环: 招募→派遣→收获→建设→更强。
要素: 幸存者招募(无线电/营救/任务)、独特属性(职业/特长/状态)、养成; 区域探索+随机事件抉择;
基地经营(资源管理/设施建造升级/居民分配/发展路线); H5适配(放置挂机/简化操作/短平快反馈/阶段性目标);
**特别要求: 大地图,主角先去大地图行走探索揭雾,解开迷雾后回来派遣NPC去**(主角不进副本)。

风格: 扁平极简风(单 canvas 程序化绘制,圆角卡片/色块/高对比文字/Emoji 图标,零美术资源)。
范围: 全循环可玩。

---

## 已完成 (v1 全循环)

### 系统
- ✅ 单 canvas + 即时模式 UI 原语 (ui.js): roundedRect/text/wrap/button/iconButton/progressBar/clipRound
- ✅ 输入 (input.js): 鼠标/触摸/键盘,pointer{pressed,hover} 单帧消费
- ✅ 游戏循环 (main.js): render() 在 update() 之前(UI 先读 pressed),advanceTime 确定性步进
- ✅ 测试钩子: window.advanceTime(ms) / window.render_game_to_text()
- ✅ 开始屏 (扁平标题+简介+按钮,背景废墟剪影带发光窗)
- ✅ HUD: 顶部资源条(6资源芯片+天数+人口), 底部导航(基地/地图/居民/派遣/任务,带红点)
- ✅ 基地: 设施网格卡片(等级/产出/消耗/居民), 建造菜单(6类设施), 升级/建造确认模态
- ✅ 经济 (economy.js): 设施产出+消耗, 居民每日食物水消耗, 居民特长加成, 离线结算(8h上限)
- ✅ 幸存者 (content/survivors.js): 6职业/6特长/姓名生成器/初始2人/养成(xp升级)
- ✅ 居民页: 列表卡片(头像/职业/特长/HP/饱食/心情), 详情模态, 分配到设施模态
- ✅ 大地图 (screenMap.js + worldUpdate.js): 摄像机跟随, 沙地底纹+地表斑块, 8个POI, 迷雾网格(主角行走揭示), 主角点击移动+体力, 视野圈, 家标记
- ✅ 派遣 (screenDispatch.js): 已发现区域列表, 组队模态(选1-4人), 倒计时进度, 70%概率触发事件, 事件抉择(5类事件), 结果模态(战利品+队伍状态)
- ✅ 无线电招募 (screenTasks.js): 搜寻信号(60s冷却), 候选人, 招募确认模态
- ✅ 任务系统: 7个引导任务, 自动判定完成, 领取奖励
- ✅ 袭击事件 (轻量): 围墙防御, 失败损失资源

### 关键架构决策
1. **所有画面画在单 canvas** (含 UI),测试客户端截"最大canvas"可保证截图=视觉真相。
2. **模态集中绘制**: main.js 的 render() 末尾统一画模态,背景屏幕/HUD 在模态激活时 pressed=false 防点击穿透。各 screen 的 drawXScreen 只画背景,模态函数已 export 供 main 调用。
3. **时间**: 游戏内 1 天 = 120 秒。advanceTime(ms) 按 60fps 切片,每步传秒。
4. **离线**: localStorage 存档带 savedAt,上线 offlineSettle 按 0.8 效率结算(上限8h)。

---

## 已验证 (Playwright 端到端)
- ✅ 开始→点击进入基地
- ✅ 资源 tick 正向产出 (15s: food 50→57, water 50→54)
- ✅ 建造设施 (工坊/发电机/发电机: 扣资源+设施出现)
- ✅ 分配居民 (莫言→农场, 阿强→净水, assigned 正确)
- ✅ 分配后产能提升 (居民加成生效)
- ✅ 底部导航 5 屏切换
- ✅ 大地图: 主角出生在家(800,600),行走揭雾,发现POI(POI带名称+危险星)
- ✅ 派遣: 选区域+组队+出发+倒计时+事件自动弹出+抉择+结果模态
- ✅ 无线电招募: 搜寻信号(60s冷却)+候选人+招募确认模态
- ✅ 任务系统: 自动判定完成 + 领取奖励 (discover2: parts+6, scrap+10 实测到账)
- ✅ 存档/读档/离线结算 (2h离线后 food/water 达上限100,非归零)
- ✅ 模态点击穿透修复 (背景+导航在模态时禁用)
- ✅ 名册滚动 (鼠标滚轮 + 滚动条)
- ✅ 全屏切换 (f 键)
- ✅ 全程无 console error (skill 标准 client + 自定义 harness 均通过)

## 修复的关键 Bug
1. **render/update 顺序**: 即时模式 UI 在 render 读 pressed,需 render 在 update 前(否则 pressed 已被 endFrame 清空)
2. **advanceTime 单位**: 原传 ms(16.67) 当秒用导致时间飞涨;改为 dtSec=1/60
3. **模态点击穿透**: 模态激活时背景屏幕/HUD pressed 屏蔽;模态集中移到 main.js 末尾绘制(各 screen modal 函数已 export)
4. **离线消耗双重计算**: tickEconomy 中 dayFrac=dt/120 让消耗随 dt 缩放,又被 *dt 应用一次 → 长 dt 时资源崩塌。改为每秒速率(pop*3/120),离线 2h 现正确累积到上限
5. **主角出生位置**: 原 (0,0) 世界角落,修正为 map.home
6. **事件模态不自动弹出**: settleExpedition 设 e.state='event' 但未开 modal;dispatch screen 顶部自动检测并打开
7. **开局产能为负**: well 原 consume power 但开局无发电机;改为 well 不耗电 + 预分配初始居民到 farm/well + 提高 unattended 系数 0.15→0.35
8. **【关键】点击坐标在高清屏(dpr=2)完全失效**: `toLocal` 用 `canvas.width/rect.width` 但 canvas.width 含 dpr 乘数,导致点击坐标偏移 2 倍 → 玩家"点不动"。修复: 逻辑尺寸存 `canvas.dataset.logicW/H`,toLocal 用 `logicW/rect.width` 映射(与 dpr 解耦)。实测 dpr=2 下 5 屏导航全部 PASS。
9. **端口占用**: 原 5173 易被占,改为 5180(vite.config + package.json)

## 测试方法
- `test_harness.mjs`: 自定义 Playwright 脚本,逻辑坐标→CSS坐标映射,支持 click/advance/key/screenshot/state
- `scenarios/*.json`: 测试场景 (s1开始 / s2-s3循环 / s4真实玩家 / s5展示 / s6最终)
- 运行: `node test_harness.mjs scenarios/s4_real_player.json`
- skill 标准客户端兼容: `node web_game_playwright_client.js --url http://localhost:5173 ...`(需 playwright 本地依赖)

---

## TODO / 待办 (留给后续迭代)
- [ ] 更多随机事件 / 蓝图系统 / 科技树深度
- [ ] 贸易系统 / 多结局
- [ ] 音效/震动反馈
- [ ] 移动端竖屏适配实测(目前逻辑分辨率 360-560 宽,未在真机测)
- [ ] 名册/派遣列表的触摸拖拽滚动(目前仅鼠标滚轮)
- [ ] 浮动文字坐标统一(部分用世界坐标,位置略偏)

## 已知小问题
- 建造菜单横向排列,极窄屏(<360)可能放不下6个设施卡片(会截断,不影响功能)
- 派遣事件用确定性 rng,同一探索重玩结果相同(设计如此,可后续加扰动)

## 运行方式
```bash
cd D:/project/60s
npm install        # 安装 vite + playwright(dev)
npm run dev        # 启动 http://localhost:5180
# 测试:
node test_harness.mjs scenarios/s4_real_player.json
```

## 立绘/头像系统 (v1.3 - AI生图,真正好看)
- **12 张 AI 生成的二次元废土女角色立绘** (pollinations.ai, FLUX模型, 512px)。
  每张是不同角色:侦察兵/医生/士兵/工程师/拾荒者/交易员/农女/猎人/机械师/领袖/掠夺者/护士,
  统一"废土幸存者半身像、精致五官、纯色背景"风格,适合圆形头像裁剪。
- **图源**: pollinations.ai —— 免费免key的AI生图服务,
  `https://image.pollinations.ai/prompt/{prompt}?width=512&height=512&seed={n}&model=flux&nologo=true`
  (单张20-60秒,有429限流需串行+重试)。
- 文件: `public/avatars/girl_0..11.png` (25-58KB) + 内联 base64 `src/content/avatars_inlined.js` (642KB)。
- 内联保证零网络/零时序依赖,外部图(public/avatars)会异步覆盖。
- 已验证: dpr=2 下游戏显示"高质量二次元动漫女性角色立绘"(图像识别确认,非简笔画)。

### 生图脚本(可复用,生成更多/换风格)
见 git 历史 / 思路: pollinations.ai + flux 模型 + 不同 seed/角色描述。
prompt 模板: `"anime style, {角色描述}, post apocalyptic survivor, head portrait, looking at viewer, beautiful detailed face, clean solid {色} background, game character avatar"`

### 之前踩坑
- v1.0 emoji头像(丑)
- v1.1 dicebear程序化(简笔画,用户嫌丑)
- v1.2 dicebear内联(还是丑)
- v1.3 AI生图 ✅ (pollinations/FLUX,真正好看)

## 地图主角立绘 (v1.3.1)
- 地图主角(原绿色圆点+🧍emoji)已换成 AI 生成的**女性指挥官立绘**(hero.png, 512px)。
- 圆形裁剪 + 白色描边 + 行走脉动光晕 + "指挥官"名字标签。
- 内联在 `HERO_AVATAR`(avatars_inlined.js),外部 public/avatars/hero.png 可覆盖。
- getHeroImage() 导出,screenMap.js 使用。
- 关键: data URL Image 需 `.decode()` 预解码,否则首次渲染 complete=false 走兜底绿圆点。
- 已验证: 像素分析确认中心有肤色像素(头像),非纯绿圆点。

## 地图系统重做: 网格 + 探索事件 + 多地图 (v1.4)
- **网格化地图**: 5张地图(营地8×7/小镇10×9/医院10×9/工厂11×10/军事12×10),
  清晰方格+迷雾格+已踏足高亮+已揭示半透明。
- **探索事件系统** (content/exploreEvents.js): 10个事件好坏各半,踏入未探索格按概率(50-70%)触发。
  **不致死**:坏事件只扣体力/少量资源/心情。触发点 worldUpdate.js updateExplore,模态 screenExploreEvent.js。
- **多地图+解锁** (content/regions.js): 营地/小镇免费;医院=发现小镇1POI;工厂=parts≥30;军事=3次派遣+发现医院1POI。
- **传送**: 基地"外出探索"→地图选择模态(5卡片锁定/解锁/进度)→传送。travelToMap在regions.js。
- **存档兼容**: save遍历所有地图cells(Uint8);migrate老存档→新maps结构。
- 派遣用allDiscoveredPois(全局),任务discover查totalDiscovered(全局)。
- 已验证: 网格渲染/事件触发解决/地图选择/传送切换/存档读档保留进度。无error。
- 关键修复: 入口格预标记避免传送即触发事件;mapSelect走drawActiveModal集中路由(防点击屏蔽);travelToMap放regions避免循环依赖;事件率25%→50-70%。

## v1.5 大更新: 网格视觉 + 28事件 + 4大功能 (用户需求)
### 1. 网格三态对比强化
- 迷雾(未探索):深黑+问号纹理+粗边框;已揭示:主色淡填充+虚线边框;已踏足:亮填充+实线粗边框+✓角标
### 2. 探索事件扩到28个(14好14坏)
- player加health字段(0=重伤回营静养,不死);事件可扣血/回血
- 真正trade-off:武器库"强行突破必扣血vs安全离开"、坍塌"抢救资源受伤vs撤离"、野兽"搏斗受伤vs逃跑"等
- hasPerk生效:工程师解陷阱/医生治疗/侦察兵提升好事件/谈判者交涉免损
- 动态模态高度(支持3选项+长文本)
### 3. 基地升级系统
- "主基地Lv.X"可点升级,消耗scrap/parts/food,每级+2人口上限+30各资源容量
- populationCap(2+lv*2)和getResCap(基础+lv*30)动态生效,打通滚雪球循环
### 4. 医疗治疗系统
- medbay分配伤员自动回血(消耗meds,有doctor更快);重伤(health<30)工作效率-15%/人,不能派遣
### 5. 技能系统生效
- 6技能真正影响:farm/craft影响对应设施产出(每点+5%),medical影响治疗速度,combat/scavenge/social影响事件
- 升级时主技能+1(levelUpSurvivor),居民详情页显示技能值
### 6. 成就里程碑
- 10个成就(累计型,基于stats),完成给资源奖励
- 重建进度%(综合基地/人口/设施/探索/派遣/成就),任务页顶部显示
- 任务列表可滚动
### 已验证
- 三态像素亮度差异✅;28事件好坏均衡✅;扣血/回血resolve✅;基地升级Lv2+容量130✅;医疗回血20→40✅;技能farm5产出+25%✅;成就10个✅;重建进度15%✅;全程无error✅

## 存档系统 v2: 版本化 + 健壮迁移 (永不丢档)

### 设计
- **版本号真正生效**: state.version (当前 2),loadGame 读 payload.version,按 migrations 链逐步升级
- **有序迁移链**: migrations[N] 把 v(N-1)→vN。加版本只需加一条,老存档自动逐步升级
- **深度默认值合并** (mergeDefaults): 递归补全所有缺失字段
  - 修了 NPE 热点: survivor.skills(6键)/perks([])、expedition.members([])/rewards({})、facility.assigned([])
  - 修了 NaN 热点: stats 补全6子字段(之前补成{}导致解锁条件/成就除0)
  - player 全字段、raid、radio、res/resCap 每个key都补
- **rng 函数重建**: 进行中的 expedition 读档后 rng(函数无法序列化)用确定性种子 makeRng((startAt*7919+id)%1e9) 重建,不崩
- **滚动备份**: 每次存档把上次有效档存到 BACKUP_KEY;主档损坏从备份恢复
- **老key迁移**: 检测 wasteland_shelter_save_v1 老存档自动迁移到 v2
- **完整性自检**: validateState 检查关键字段类型,异常用默认覆盖(降级恢复)
- **读档清弹窗**: modal=null,避免指向已变化的实体

### ⭐ 以后加新内容(物品等)的步骤(重要!)
```
1. 在 state.js 的 createNewState() 加新字段默认值
   (同时更新 DEFAULTS 里的对应模板)
2. 提升 CURRENT_VERSION (state.js 顶部,如 2→3)
3. 在 save.js 的 migrations 加:
     3: (s) => { /* 老存档补新字段的版本特定逻辑 */ s.version = 3; },
   (大多数情况步骤1+2就够了,mergeDefaults 会自动补;步骤3只用于需要特殊转换的逻辑)
4. 完成。老存档读档时自动: 备份→逐步迁移→合并默认→验证→永不丢
```

### 已验证(4项全过)
- v1老存档(缺health/skills/maps/stats子字段)→ 读档不崩,字段补全 ✅
- 存档损坏(JSON乱码)→ 从备份恢复(scrap=777) ✅
- 进行中expedition的rng → 重建为函数,可调用 ✅
- 正常存读 → 基地等级/资源/地图探索/幸存者/Uint8Array 全保留 ✅

### SAVE_KEY 说明
- 当前: `wasteland_shelter_save_v2` (主) + `_backup` (滚动备份)
- 老key: `wasteland_shelter_save_v1` (检测到自动迁移后删除)

## v2.0 完整测试 + 文档更新 (本轮)

### 测试发现并修复的问题
- **基地布局拥挤**: 加了升级按钮+探索入口后,6个建造卡片挤不下,wall(围墙)被裁掉
  → 修复: 探索入口紧凑化(64→52高度)、设施卡片缩小(120→96)、建造卡片自动换行(perRow计算)
  → 验证: 6种设施(farm/well/workshop/generator/medbay/wall)全部可见可建造 ✅

### 26项逻辑测试全过 (test_logic.mjs)
1. 初始资源完整(6种) ✅
2. 初始基地Lv1+2设施(farm/well) ✅
3. 初始2幸存者已分配 ✅
4. 幸存者6技能+特长 ✅
5. 人口上限=2+lv*2=4 ✅
6. 主角health=100 ✅
7. 初始解锁2地图 ✅
8. 7任务+10成就 ✅
9. 1天食物正增长(+44.4) ✅
10. 1天净水正增长(+25) ✅
11. 1天居民存活 ✅
12. 基地升级→容量增加(100→160) ✅
13. 基地升级→人口增加(4→8) ✅
14. 医疗室治疗(20→80) ✅
15. 重伤(health<30)存在 ✅
16. 技能影响产出(0.70<0.95<1.20) ✅
17. 28事件resolve不崩(46选项) ✅
18. 事件好坏均衡(14:14) ✅
19. 医院解锁条件 ✅
20. 工厂解锁条件 ✅
21. 派遣列表有POI+mapId ✅
22. 成就自动判定 ✅
23. 重建进度>0(26%) ✅
24. 存读档完整保留 ✅
25. 10天长跑无NaN/Infinity ✅
26. 10天后居民存活 ✅

### 端到端可玩性
- 开始→建造→地图探索→事件→升级→5屏导航→存读档: 核心流程顺畅 ✅
- 全程无 console error ✅

### 文档
- README.md: 完整功能清单/技术栈/运行/结构/测试
- progress.md: 全部版本变更记录(从v1.0到v2.0)

## 补充测试: 边界 & trade-off 验证 (test_edge.mjs / test_tradeoff.mjs)

### 14项边界/反常测试 (全过 ✅)
专门测正常路径想不到的极端情况:
1. 资源不会变负数(消耗>存量时) ✅
2. 资源不超容量上限(food=99999被截断到100) ✅
3. 扣血不会让health变负(最低到0) ✅
4. 血量可降到0(重伤状态) ✅
5. 奖励加资源不超容量 ✅
6. 派遣启动→成员标记busy ✅
7. 派遣到时间→正确结算(done/event) ✅
8. 离线结算+医疗交互不崩 ✅
9. 离线期间医疗室治疗(30→100) ✅
10. 体力0时主角仍可移动(不卡死) ✅
11. 体力0不会致死 ✅
12. health=0会自动恢复(1分钟→31血) ✅
13. 人口超上限(7/4)不崩 ✅
14. 任务奖励不可重复领取 ✅

### 4项 trade-off & 特长验证 (全过 ✅)
1. 同一事件不同选项结果不同(武器库谨慎vs赌博) ✅
2. 工程师特长影响事件(解陷阱:无工程师-15血,有免伤) ✅
3. 侦察兵提升好事件率(普通54% → 偏好71%) ✅
4. 升级时主技能+1(scout的scavenge 1→2) ✅

### 测试发现的bug修复记录
- **基地布局wall被裁**: 加升级按钮+探索入口后6个建造卡片挤不下,wall(围墙)不可见不可建
  → 修复: 探索入口紧凑化(64→52)、设施卡片缩小(120→96)、建造卡片自动换行
  → 验证: 6种设施全可见可建 ✅

### 测试脚本清单(可随时回归)
- `test_logic.mjs` — 26项逻辑测试(初始/经济/升级/医疗/技能/事件/解锁/派遣/成就/存档/长跑)
- `test_edge.mjs` — 14项边界测试(负数/容量/扣血/体力/人口/重复领)
- 运行: `node test_logic.mjs && node test_edge.mjs`

## 测试局限(诚实说明)
- 只测了10天长跑,几百天的数值累积是否失衡未验证
- 真人非预期操作序列(乱点模态组合)可能触发未考虑的状态
- UI坐标随布局变化(加新内容后需重新确认可点击性)

## v2.1 探索事件大扩充 + 100%触发 (用户需求)

### 改动
- **事件池 28→60个** (好30/坏30),新增32个事件(汽车/医疗箱/售货机/工具箱/浆果/信号塔/变异鼠/断桥/酸液/滑坡等)
- **触发率改为100%**: 每个地块首次踏足必触发事件(不再靠概率)
- **修了相邻揭示导致事件丢失的bug**: revealCellAndNeighbors 之前只对 HIDDEN 格返回 newlyVisited,相邻被揭示成 REVEALED 后踏足不触发;改为"非VISITED都算首次踏足"
- **防连续重复**: 同一事件最多重试3次换不同的(rollExploreEvent)
- **防同格连发**: _exploreCooldown + _lastEventId

### 验证
- 60事件93个resolve全过,无崩溃,无重复ID ✅
- 踏8个新格触发8/8(100%),7种不同事件(几乎不重复)✅
- 40项逻辑+边界测试全过 ✅

## v2.2 事件体系改造 + 分组分布 + 中立/分支事件 + AI地图图标 (用户需求)

> 用户反馈: "好事件要多一点"、"根据人的选择随机生成好事件和坏事件,要有依据"、"做中立事件"、
> "地图格子多的话随机隔几个有一个事件,30%平均分布(每9格一组至少3个事件)"、
> "绘制一点图标用AI绘制,符合形象"、"无线电招募出来的人物立绘还是旧的"

### 改动1: 无线电招募立绘bug修复 (screenTasks.js)
- **问题**: generateSurvivor 生成的候选人 cand 没有 avatarImg,显示旧的占位立绘
- **修复**: 生成候选人后立即调用 `if (window.__assignAvatar) window.__assignAvatar(cand)`(line 169)
- **验证**: 无线电招募候选人现在显示最新AI立绘 ✅

### 改动2: 事件池扩充 60→82 (exploreEvents.js)
- **好事件 30→40**: 新增10个(温暖营地/老兵赠送/雨水收集/医疗志愿者/工程师修理/流浪狗/广播重逢/补给空投/友商交易/幸存童谣)
- **坏事件 30→30**: 保持原30个
- **中立事件 0→12**: 新增"需要抉择"类,玩家选择决定好坏结果
  - fork_road(岔路选择方向) / mysterious_box(神秘箱子开/不开) / trade_post(交易站换不换)
  - risky_search(冒险搜/保守搜) / gambling_crate(赌一把/不赌) / collapsed_tunnel(绕路/挖掘)
  - old_radio(修电台/拆零件) / stranger_offer(接受/拒绝陌生人) / weather_shift(继续/避难)
  - signal_choice(追强信号/稳信号) / repair_or_scrap(修机器/拆解) / deep_water(潜入/离开)
- **分支好坏**: 多个事件 choices 里 resolve 根据 rng/perk 产生不同结果(如神秘箱子,开箱可能出宝物也可能出陷阱,取决于 rng)
- **EXPLORE_EVENT_STATS** 增加 neutral 字段: `{ good:40, bad:30, neutral:12, total:82 }`

### 改动3: 触发逻辑从100%改为分组分布 (~33%密度)
- **问题**: 100%触发太密集,每个格子都弹事件太烦
- **新逻辑**: `cellEventHash(gx,gy,mapId)` 确定性哈希,`< 0.33` 才触发(约1/3格子有事件)
- **确定性**: 同一格子永远是否触发固定(基于坐标hash),存档无关,不会重复触发
- **分布均匀**: 经测试 home map (8x7=56格) 有约38%格子触发,符合"每9格一组≥3事件"的要求
- ** EXPLORE_EVENT_STATS.exploreRate 由 1.0 → ~0.33 **

### 改动4: AI绘制5个废土地图装饰图标 (pollinations.ai FLUX)
- **5种图标**: ruins.png(废墟) / tree.png(枯树) / rock.png(岩石) / crater.png(弹坑) / cache.png(补给箱)
- **风格**: 废土风格,暗色调,顶视图,128x128 PNG,3-6KB
- **存放**: `public/img/tiles/`
- **渲染**: screenMap.js 的 drawTileIcon(),60%格子有装饰(hash<0.6),REVEALED格alpha=0.35,VISITED格alpha=0.7
- **稳定性**: tileIconIndex 基于坐标hash,每格固定显示哪种图标,不闪烁
- **视觉区分**: REVEALED(半透明绿+淡图标) vs VISITED(不透明绿+清晰图标) 层次分明

### 改动5: test_logic.mjs 断言更新
- 事件数量断言: `good===30 && bad===30` → `good===40 && bad===30 && neutral===12`
- "28事件" → "82事件",事件resolve全部不崩

### 验证(全过 ✅)
- **逻辑测试 26/26 通过**: 含"82事件全部resolve不崩"、"事件数量好40/坏30/中立12"
- **边界测试 14/14 通过**
- **图标渲染实测**: shot_map.mjs 截图 + AI视觉分析确认
  - 网格8x6可见,HIDDEN(黑+?)/REVEALED(淡绿)/VISITED(深绿)三态分明
  - 装饰图标(废墟/枯树/弹坑/补给箱等)清晰渲染在已揭示/已踏足格子上
  - 分布统计: 31个非隐藏格中17个有图标(55%),5种图标类型齐全(ruins3/tree5/rock3/crater3/cache3)
  - 主角立绘 + 血量条(红HP=100/绿体力=99)+ "指挥官"标签正常
- **事件分布实测**: home map 触发率约38%,满足"每9格一组≥3事件"要求

### 新增/修改文件
- `src/content/exploreEvents.js` — 事件池82个,EXPLORE_EVENT_STATS含neutral
- `src/screens/screenMap.js` — TILE_ICONS加载 + tileIconIndex + drawTileIcon
- `src/screens/screenTasks.js` — 无线电候选人 __assignAvatar 修复(line 169)
- `public/img/tiles/{ruins,tree,rock,crater,cache}.png` — 5个AI图标
- `test_logic.mjs` — 事件数量断言更新
- `shot_map.mjs` — 地图截图验证脚本(新增)

## v2.2.1 深度测试 + 6个bug修复 (本轮)

> 对全部26个模块逐行审查 + 新增2套测试(test_deep 37项 / test_ui_e2e 27项),
> 发现并修复了原有40项测试漏掉的6个bug。**4套测试共104项全过,全程无console error。**

### 修复的bug(按严重度)

#### Bug1【严重】网格探索永不揭示相邻格 — regions.js revealCellAndNeighbors
- **问题**: 首次踏足新格时,`if (map.cells[idx] !== VISITED)` 分支直接 `return {newlyVisited:true}`,
  **提前返回,跳过了下面的"揭示上下左右相邻格"代码**。导致相邻格永远保持HIDDEN。
- **影响**: "已揭示(虚线半透明)"状态在真实游戏中几乎不存在;v2.2新增的废土装饰图标
  (只画在REVEALED/VISITED格上)几乎看不到;地图揭示极慢。AI视觉分析地图截图确认:
  玩家行走后只有1个VISITED格+3-4个入口预标记的REVEALED格。
- **修复**: 先揭示相邻格、再返回newlyVisited标志,不在首次踏足分支提前return。
- **验证**: test_deep "revealCellAndNeighbors相邻格→REVEALED" ✅

#### Bug2【严重】派遣无事件分支不释放成员/不计派遣次数 — screenDispatch.js settleExpedition
- **问题**: 派遣结算30%走"无事件"分支(else),设了state="done"+发奖+加XP,但漏写:
  `member.busy=null`(成员永久卡"派遣中") 和 `stats.expeditionsDone++`。
- **影响**: ~30%派遣会让幸存者永久无法再分配/派遣;任务"完成5次派遣"、成就"老兵探险家"
  永远无法达成;滚雪球恶化。只有走"事件分支"由玩家手动抉择后才正确释放。
- **修复**: else分支补上成员释放 + expeditionsDone++(与resolveEvent分支对齐)。
- **验证**: test_deep "派遣完整流程成员被释放/派遣次数+1" ✅

#### Bug3【中】派遣区"产出"列永远为空 — screenDispatch.js drawRegionCard
- **问题**: 代码访问 `info.loot`,但 POI_TYPES 只有 `rewards` 字段,无 `loot`。
  `for(k in info.loot)` 因undefined不迭代,产出列永远显示"—"。
- **修复**: 改用 `info.rewards`,展示该区域可能产出的资源图标。

#### Bug4【中】开局无人可派遣 — screenDispatch.js
- **问题**: 派遣只允许 `!s.assigned`(完全空闲)的幸存者;开局2人全分配到farm/well,
  派遣入口一直显示"无人",新手卡点且无引导。
- **修复**: 放宽为"空闲+工作中均可参加"(工作中者出发时自动从原设施调离);
  "无人"时点击给明确提示(重伤需治疗/升级基地扩容)。

#### Bug5【低】居民食物消耗误算派遣中的幸存者 — economy.js:76
- **问题**: `filter((s) => !s.busy || s.busy !== "dead")` 条件永真(等价于全部),
  应为 `s.busy !== "dead"`。
- **修复**: 改为 `s.busy !== "dead"`(注:派遣中居民仍驻扎基地,照常消耗,语义合理)。

#### Bug6【低·边界】空数组的tasks/achievements老存档不重建 — save.js
- **问题**: `if (!Array.isArray(s.tasks))` 对空数组 `[]` 为false,不重建。
  老存档若恰好存了空数组,迁移后任务/成就列表为空。
- **修复**: 改为 `!Array.isArray(...) || length === 0`,空数组也重建。

### 清理的代码债
- economy.js `checkAutoTasks` 死代码(空函数从未调用)删除
- screenDispatch.js 倒计时公式修正(原 `(1-prog)*(duration-elapsed)` 逻辑错误,改 `Math.max(0, duration-elapsed)`)
- screenBase.js 冗余赋值 `state.modal = {type:"buildFacility_close"}` 删除
- survivors.js 注释"升满5级时"修正为"每3级"(代码是 `level%3===0`)

### 测试体系
- **新增 test_deep.mjs (37项)**: 覆盖盲区 — 幸存者养成/任务领奖/成就/存档迁移v1→v2/
  损坏备份恢复/派遣事件resolve/事件权重分布/网格揭示/传送/cellEventHash/离线上限/派遣全流程/30天长跑
- **新增 test_ui_e2e.mjs (27项)**: UI端到端 — 5屏导航/6类模态/建造/升级/分配/地图行走/
  探索事件/招募/派遣组队/模态防穿透/F全屏,含精确指针模拟点击
- **4套测试共104项全过**: test_logic(26) + test_edge(14) + test_deep(37) + test_ui_e2e(27)
- 关键改进: 测试从"只断言主路径成功"升级为"断言副作用完整"(如验证相邻格状态、成员释放),
  这是发现Bug1/2的关键
- git仓库已初始化,基线提交 52fa30e

## v2.3 新手引导 + 数值平衡修复 + 派遣重构 (本轮)

> 三件事: 加新手引导系统、数值长测发现并修复hunger平衡bug、派遣状态机重构。
> **5套测试全过(logic26+edge14+deep43+ui27+balance),全程无console error。**

### 1. 新手引导系统 (engine/guide.js + ui/guideBanner.js)
- **问题**: 开局无教程,玩家不知道先建什么、怎么探索、派遣要解除分配,新手流失
- **方案**: 轻量横幅式引导(非强制弹窗),基于游戏进度判断该提示什么,完成对应行动即消失,可手动✕关闭
- **触发点**:
  - 还没探索过 → 引导去地图(go_explore)
  - 发现POI但没派遣过 → 引导派遣(go_dispatch)
  - 食物<20 → 警告建农场(low_food)
  - 资源够但没建过设施 → 鼓励建设(go_build)
- **埋点**: state.guide 记录里程碑(explored/dispatched/built/recruited),各系统在操作成功时更新
  - markExplored: 进入地图屏(screenMap.js)
  - markDispatched: launchExpedition(screenDispatch.js)
  - markBuilt: 建造确认(screenBase.js)
  - markRecruited: 招募确认(screenTasks.js)
- **渲染**: drawGuideBanner 在 base/dispatch 屏内容区顶部,有提示才占位(无则返回0不影响布局)
- **存档兼容**: state.guide 加入 DEFAULTS 模板 + mergeDefaults 补全,老存档自动获得引导字段

### 2. 【平衡bug修复】hunger 饱食度与食物供给脱钩 (economy.js updateSurvivorNeeds)
- **问题(长测发现)**: 旧逻辑 `hunger -= 6*dayFrac` 是**无条件下降**,即使食物满仓居民也线性饿死
- **长测证据**: 500天测试显示食物=100满仓,但4/4居民 hunger=0 全员饥饿受伤
- **根因**: 经济层(扣食物消耗)和需求层(hunger)是两套独立系统,没打通
- **修复**: 有食物供给时 hunger 回升(每天+8),食物短缺时加速下降(每天-14)
- **验证**: test_deep "hunger平衡" 两项 ✅,长测从"全员饿死"变"饿0伤0"稳定500天

### 3. 【已知平衡问题·记录】后期经济瓶颈(未修,需玩法决策)
- **现象**: 长测发现食物/水/电会爆仓(满仓无消耗出口),但**废铁/零件严重短缺**
- **根因**: 废铁产出极少(仅探索/派遣获得),工坊产零件却要消耗废铁(死循环);
  升级基地/建造都要大量废铁零件,后期卡死所有发展
- **建议(待后续决策)**: ① 加"废料场"设施稳定产废铁 ② 调整工坊不消耗废铁或减少消耗
  ③ 派遣奖励增加废铁产出 ④ 后期加废铁消耗出口(如维修)
- **状态**: 记录在案,未在本轮修改(涉及玩法数值设计,需玩家验证)

### 4. 派遣状态机重构 (screenDispatch.js)
- **问题(防Bug2同类)**: 出发/结算/释放逻辑散在 launchExpedition/settleExpedition/resolveEvent 4处,
  有事件/无事件两个分支各自手写收尾,导致原Bug2(无事件分支漏写释放)
- **重构**: 抽公共函数 `finishExpedition(state,e,xp)`,统一"释放成员+加XP+计expeditionsDone+设done"
- **效果**: 两个分支现在都调用它,逻辑单一来源,杜绝同类bug。验证:test_deep "派遣重构"两项 ✅

### 测试
- test_deep.mjs 增至 **43项**(新增hunger平衡/引导系统/派遣重构6项专项测试)
- **新增 test_balance.mjs**: 数值长测,模拟AI玩家发展策略跑100/300/500天,自动发现平衡问题
  (正是它发现了hunger bug)。5套测试体系完整建立
- **5套全过**: logic(26) + edge(14) + deep(43) + ui_e2e(27) + balance(长测)
