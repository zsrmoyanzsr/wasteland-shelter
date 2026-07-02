// 探索事件池 (v2): 主角踏入未探索格触发,28个事件好坏均衡
// 坏事件有真trade-off(拿资源vs受伤/安全vs零收益),惩罚合理但不致死
// resolve(ctx) 返回 { log, rewards:{}, stamina, health, mood }
//   stamina/health: 主角体力/生命增减(负=扣)
//   mood: 全基地居民心情增减
//   rewards: 资源增减(可负)
// ctx: { rng, res, hasPerk, perkLevel }
//   res: 当前资源(用于动态判断)
//   hasPerk(id): 基地是否有该特长居民
//   perkLevel(id): 该特长居民的最高技能等级(影响效果)

export const EXPLORE_EVENTS = [
  // ════════ 好事件 (14个) ════════
  {
    id: "supply_cache", weight: 4, kind: "good",
    text: "你在瓦砾下发现一个密封的物资箱,看起来还能用。",
    choices: [
      { label: "打开看看", desc: "70%概率拿食物",
        resolve(ctx) {
          if (ctx.rng() < 0.7) {
            const f = 3 + Math.floor(ctx.rng() * 3);
            return { log: { text: `箱子里有 ${f} 份食物!`, color: "#7cc36b" }, rewards: { food: f }, mood: 5 };
          }
          return { log: { text: "箱子是空的,但没白来。", color: "#9aa1b0" }, mood: 2 };
        } },
      { label: "搬走整箱", desc: "稳拿废铁", resolve(ctx) { return { log: { text: "你搬走了整个箱子。", color: "#7cc36b" }, rewards: { scrap: 3 } }; } },
    ],
  },
  {
    id: "spring", weight: 3, kind: "good",
    text: "一汪清澈的泉水从岩缝涌出,在这废土上极为罕见。",
    choices: [
      { label: "休息饮水", desc: "恢复体力+少量生命", resolve(ctx) { return { log: { text: "泉水让你精神焕发!", color: "#4caf87" }, stamina: 40, health: 15, mood: 8 }; } },
      { label: "装满水壶", desc: "带走净水", resolve(ctx) { const w = 3 + Math.floor(ctx.rng() * 2); return { log: { text: `你装了 ${w} 份净水。`, color: "#5b9bd5" }, rewards: { water: w } }; } },
    ],
  },
  {
    id: "blueprint", weight: 2, kind: "good",
    text: "废墟角落有一张褪色的图纸,似乎是设施构造图。",
    choices: [{ label: "收起图纸", desc: "换零件", resolve(ctx) { const p = 4 + Math.floor(ctx.rng() * 3); return { log: { text: `图纸能换 ${p} 个零件。`, color: "#c9a86a" }, rewards: { parts: p }, mood: 4 }; } }],
  },
  {
    id: "scrap_pile", weight: 4, kind: "good",
    text: "一堆生锈的金属件散落在地上,挑挑拣拣也许有用。",
    choices: [{ label: "收集废铁", desc: "稳赚", resolve(ctx) { const s = 3 + Math.floor(ctx.rng() * 4); return { log: { text: `你收集了 ${s} 块废铁。`, color: "#9aa1b0" }, rewards: { scrap: s } }; } }],
  },
  {
    id: "armory", weight: 2, kind: "good",
    text: "一扇半开的铁门后,隐约可见整齐排列的武器架。",
    choices: [
      { label: "谨慎搜索", desc: "安全拿零件(工程师更快)", resolve(ctx) {
        if (ctx.hasPerk("engineer")) { const p = 5 + Math.floor(ctx.rng() * 3); return { log: { text: `工程师帮你安全取出 ${p} 个零件!`, color: "#7cc36b" }, rewards: { parts: p }, mood: 6 }; }
        const p = 3 + Math.floor(ctx.rng() * 3); return { log: { text: `你小心取走 ${p} 个零件。`, color: "#7cc36b" }, rewards: { parts: p } };
      } },
      { label: "全部搬走", desc: "更多但有陷阱风险", resolve(ctx) {
        if (ctx.rng() < 0.4 && !ctx.hasPerk("scavenger")) { return { log: { text: "触发警报!你仓皇逃离。", color: "#e0584e" }, health: -20, stamina: -15, mood: -5 }; }
        const p = 6 + Math.floor(ctx.rng() * 4); return { log: { text: `满载而归,缴获 ${p} 个零件!`, color: "#7cc36b" }, rewards: { parts: p }, mood: 8 };
      } },
    ],
  },
  {
    id: "hidden_vault", weight: 2, kind: "good",
    text: "墙后传来空洞的回声——这里藏着一个保险库!",
    choices: [
      { label: "撬锁", desc: "需要技巧,失败扣体力", resolve(ctx) {
        if (ctx.hasPerk("scavenger") || ctx.rng() < 0.6) { const s = 5 + Math.floor(ctx.rng() * 5); return { log: { text: `锁被打开!里面有 ${s} 废铁和零件。`, color: "#f0a93b" }, rewards: { scrap: s, parts: 2 }, mood: 10 }; }
        return { log: { text: "撬锁失败,费了不少力气。", color: "#f0a93b" }, stamina: -25 };
      } },
    ],
  },
  {
    id: "campfire", weight: 3, kind: "good",
    text: "一处尚有余温的篝火,周围散落着前人留下的物资。",
    choices: [
      { label: "休整一下", desc: "回血回体力", resolve(ctx) { return { log: { text: "篝火旁的休整让你恢复不少。", color: "#4caf87" }, health: 25, stamina: 30, mood: 6 }; } },
      { label: "搜刮营地", desc: "拿资源", resolve(ctx) { return { log: { text: "你搜到些食物和净水。", color: "#7cc36b" }, rewards: { food: 3, water: 2 } }; } },
    ],
  },
  {
    id: "mutant_crop", weight: 2, kind: "good",
    text: "一片变异作物在废墟中疯长,果实硕大得惊人。",
    choices: [{ label: "采摘", desc: "食物大丰收", resolve(ctx) { const f = 5 + Math.floor(ctx.rng() * 4); return { log: { text: `这些变异作物能吃!收获 ${f} 份食物。`, color: "#7cc36b" }, rewards: { food: f }, mood: 5 }; } }],
  },
  {
    id: "radio_tower", weight: 2, kind: "good",
    text: "一座倾倒的无线电塔,设备似乎还能运作。",
    choices: [{ label: "启动广播", desc: "加速招募冷却", resolve(ctx) {
      return { log: { text: "你启动了广播,吸引了幸存者的注意!(招募冷却减半)", color: "#5b9bd5" }, rewards: { power: 2 }, _radioBoost: true, mood: 7 };
    } }],
  },
  {
    id: "survivor_diary", weight: 2, kind: "good",
    text: "一本泛黄的日记躺在废墟里,记录着物资藏匿点。",
    choices: [{ label: "按图索骥", desc: "获得废铁和药品", resolve(ctx) { return { log: { text: "日记指引你找到了藏匿点!", color: "#7cc36b" }, rewards: { scrap: 4, meds: 2 }, mood: 5 }; } }],
  },
  {
    id: "ancient_relic", weight: 1, kind: "good",
    text: "一台保存完好的发电机静静躺在地下室里。",
    choices: [{ label: "拆解搬走", desc: "大量电力设备", resolve(ctx) { const pw = 4 + Math.floor(ctx.rng() * 4); return { log: { text: `你拆解了发电机,获得 ${pw} 电力物资!`, color: "#e0c14a" }, rewards: { power: pw }, mood: 8 }; } }],
  },
  {
    id: "airdrop", weight: 2, kind: "good",
    text: "一个降落伞挂在废墟高处,下面吊着军用补给箱!",
    choices: [
      { label: "爬上去取", desc: "消耗体力但奖励丰富", resolve(ctx) { const f = 3 + Math.floor(ctx.rng() * 2); return { log: { text: `你费力取下补给: ${f}食物 ${f}净水!`, color: "#7cc36b" }, rewards: { food: f, water: f }, stamina: -20, mood: 8 }; } },
      { label: "等它掉下来", desc: "看运气", resolve(ctx) {
        if (ctx.rng() < 0.5) { return { log: { text: "风把补给吹了下来!", color: "#7cc36b" }, rewards: { food: 2, water: 2 } }; }
        return { log: { text: "补给卡得太死,你放弃了。", color: "#9aa1b0" } };
      } },
    ],
  },
  {
    id: "safe_house", weight: 2, kind: "good",
    text: "一间隐蔽的安全屋,门上刻着友善幸存者的标记。",
    choices: [{ label: "在此休息", desc: "完全恢复", resolve(ctx) { return { log: { text: "安全屋让你彻底恢复了状态!", color: "#4caf87" }, health: 40, stamina: 50, mood: 12 }; } }],
  },
  {
    id: "friendly_trader", weight: 3, kind: "good",
    text: "一个路过的旅人向你点头致意,愿意交换物资。",
    choices: [
      { label: "用废铁换药品", desc: "互惠", resolve(ctx) { return { log: { text: "你用废铁换了药品。", color: "#7cc36b" }, rewards: { meds: 3, scrap: -3 }, mood: 6 }; } },
      { label: "用零件换食物", desc: "互惠", resolve(ctx) { return { log: { text: "你用零件换了食物。", color: "#7cc36b" }, rewards: { food: 4, parts: -2 }, mood: 6 }; } },
    ],
  },

  // ════════ 坏事件 (14个) — 有真trade-off ════════
  {
    id: "thorns", weight: 3, kind: "bad",
    text: "茂密的变异荆棘挡住去路,强行穿过会有些费力。",
    choices: [
      { label: "强行穿过", desc: "扣体力", resolve(ctx) { return { log: { text: "你拨开荆棘通过,累得够呛。", color: "#f0a93b" }, stamina: -25 }; } },
      { label: "绕路走", desc: "扣少量体力", resolve(ctx) { return { log: { text: "你绕了个远路。", color: "#9aa1b0" }, stamina: -12 }; } },
    ],
  },
  {
    id: "zombie_shamble", weight: 3, kind: "bad",
    text: "几只游荡的丧尸发现了你,正踉跄着逼近!",
    choices: [
      { label: "快速逃离", desc: "扣体力", resolve(ctx) { return { log: { text: "你拼命奔跑,甩掉了丧尸。", color: "#f0a93b" }, stamina: -30, mood: -3 }; } },
      { label: "躲藏", desc: "看运气", resolve(ctx) {
        if (ctx.rng() < 0.6) { return { log: { text: "你屏住呼吸,丧尸没发现你。", color: "#9aa1b0" } }; }
        return { log: { text: "差点被发现!慌忙逃窜受了点伤。", color: "#e0584e" }, health: -15, stamina: -18, mood: -6 };
      } },
    ],
  },
  {
    id: "unstable_ground", weight: 2, kind: "bad",
    text: "脚下的地面突然塌陷,你险些掉进地下空洞!",
    choices: [{ label: "攀爬上来", desc: "掉落废铁+扣体力", resolve(ctx) { const loss = ctx.rng() < 0.5 ? 2 : 3; return { log: { text: `你艰难爬上来,弄丢了 ${loss} 废铁。`, color: "#e0584e" }, rewards: { scrap: -loss }, stamina: -15 }; } }],
  },
  {
    id: "raider_scout", weight: 2, kind: "bad",
    text: "远处有掠夺者的侦察兵,他们注意到了你。",
    choices: [
      { label: "交过路费", desc: "扣废铁", resolve(ctx) { return { log: { text: "你扔下些废铁,趁机溜走。", color: "#9aa1b0" }, rewards: { scrap: -3 } }; } },
      { label: "装没看见快走", desc: "扣体力", resolve(ctx) { return { log: { text: "你加快脚步离开。", color: "#f0a93b" }, stamina: -20 }; } },
    ],
  },
  {
    id: "radiation_leak", weight: 2, kind: "bad",
    text: "盖革计数器突然咔咔作响,这里辐射超标了!",
    choices: [
      { label: "迅速通过", desc: "扣体力+心情", resolve(ctx) { return { log: { text: "你捂住口鼻冲过辐射区。", color: "#f0a93b" }, stamina: -22, mood: -4 }; } },
      { label: "服药防护", desc: "消耗药品", resolve(ctx) { return { log: { text: "你服用了抗辐射药,安然无恙。", color: "#9aa1b0" }, rewards: { meds: -1 } }; } },
    ],
  },
  {
    id: "mutant_beast", weight: 3, kind: "bad",
    text: "一只变异野兽从阴影中扑出,獠牙泛着寒光!",
    choices: [
      { label: "正面搏斗", desc: "看实力,可能受伤", resolve(ctx) {
        const combat = ctx.perkLevel("guardian") || 0;
        if (combat >= 2 || ctx.rng() < 0.5) { return { log: { text: "你击退了野兽!缴获些食物。", color: "#7cc36b" }, rewards: { food: 3 }, mood: 5 }; }
        const dmg = 18 + Math.floor(ctx.rng() * 12); return { log: { text: `苦战击退野兽,但你受了伤(-${dmg}血)。`, color: "#e0584e" }, health: -dmg, mood: -5 };
      } },
      { label: "转身逃跑", desc: "扣大量体力", resolve(ctx) { return { log: { text: "你拼命逃跑了。", color: "#f0a93b" }, stamina: -35, mood: -4 }; } },
    ],
  },
  {
    id: "poison_gas", weight: 2, kind: "bad",
    text: "一股刺鼻的黄绿色气体从地缝渗出,是毒气!",
    choices: [
      { label: "憋气冲过", desc: "扣血+体力", resolve(ctx) { return { log: { text: "你憋气冲过,但吸入了些毒气。", color: "#e0584e" }, health: -18, stamina: -15 }; } },
      { label: "用药中和", desc: "消耗药品免伤", resolve(ctx) {
        if ((ctx.res.meds || 0) >= 1) { return { log: { text: "你用药剂中和了毒气。", color: "#9aa1b0" }, rewards: { meds: -1 } }; }
        return { log: { text: "没药可用,你硬扛着过去了。", color: "#e0584e" }, health: -22 };
      } },
    ],
  },
  {
    id: "collapsed_ruin", weight: 2, kind: "bad",
    text: "你踏入的建筑突然剧烈摇晃,天花板的碎石纷纷落下!",
    choices: [
      { label: "抢救物资", desc: "可能拿资源但扣血", resolve(ctx) {
        if (ctx.rng() < 0.5) { const s = 3 + Math.floor(ctx.rng() * 3); return { log: { text: `你在坍塌前抢出 ${s} 废铁,但受了伤!`, color: "#f0a93b" }, rewards: { scrap: s }, health: -20 }; }
        return { log: { text: "你差点被埋,慌忙逃出。", color: "#e0584e" }, health: -12, stamina: -20 };
      } },
      { label: "立刻撤离", desc: "安全但啥也没有", resolve(ctx) { return { log: { text: "你及时撤离,建筑在你身后塌了。", color: "#9aa1b0" }, stamina: -10 }; } },
    ],
  },
  {
    id: "mental_pollution", weight: 2, kind: "bad",
    text: "一面诡异的墙壁上浮现出扭曲的低语,让你头痛欲裂。",
    choices: [
      { label: "强忍过去", desc: "扣心情+体力", resolve(ctx) { return { log: { text: "低语让你精神恍惚了一阵。", color: "#9b7bd4" }, mood: -12, stamina: -15 }; } },
      { label: "摧毁墙壁", desc: "扣体力但消除影响", resolve(ctx) { return { log: { text: "你砸碎了墙壁,低语消失了。", color: "#9aa1b0" }, stamina: -25 }; } },
    ],
  },
  {
    id: "radiation_storm", weight: 2, kind: "bad",
    text: "天空中乌云翻涌,一场辐射风暴正在逼近!",
    choices: [
      { label: "找掩体躲避", desc: "扣体力+少量血", resolve(ctx) { return { log: { text: "你在风暴中挨过,消耗不小。", color: "#f0a93b" }, stamina: -20, health: -10, mood: -5 }; } },
      { label: "冒风暴前进", desc: "扣大量血", resolve(ctx) { return { log: { text: "你硬闯风暴,受了不轻的辐射伤!", color: "#e0584e" }, health: -30, stamina: -15 }; } },
    ],
  },
  {
    id: "trap_net", weight: 2, kind: "bad",
    text: "脚下一紧,你踩中了捕兽夹!附近似乎有猎人。",
    choices: [
      { label: "挣脱", desc: "扣血", resolve(ctx) { const dmg = 12 + Math.floor(ctx.rng() * 8); return { log: { text: `你挣脱了夹子,但受了伤(-${dmg}血)。`, color: "#e0584e" }, health: -dmg }; } },
      { label: "解机关(工程师)", desc: "有工程师免伤", resolve(ctx) {
        if (ctx.hasPerk("engineer")) { return { log: { text: "工程师轻松解开了机关!", color: "#7cc36b" }, mood: 3 }; }
        return { log: { text: "你费尽力气解开,受了点伤。", color: "#f0a93b" }, health: -15, stamina: -15 };
      } },
    ],
  },
  {
    id: "hostile_camp", weight: 2, kind: "bad",
    text: "前方是一座敌对幸存者的营地,他们封锁了去路。",
    choices: [
      { label: "交涉通过", desc: "谈判者免损,否则扣资源", resolve(ctx) {
        if (ctx.hasPerk("negotiator")) { return { log: { text: "谈判专家三言两语化解了危机!", color: "#7cc36b" }, mood: 8 }; }
        return { log: { text: "你被迫交出物资才被放行。", color: "#9aa1b0" }, rewards: { scrap: -3, food: -2 } };
      } },
      { label: "绕远路", desc: "扣体力", resolve(ctx) { return { log: { text: "你绕开了营地。", color: "#f0a93b" }, stamina: -28 }; } },
    ],
  },
  {
    id: "quicksand", weight: 1, kind: "bad",
    text: "地面突然变得松软,你陷进了流沙里!",
    choices: [
      { label: "奋力爬出", desc: "扣大量体力", resolve(ctx) { return { log: { text: "你筋疲力尽地爬出了流沙。", color: "#f0a93b" }, stamina: -35 }; } },
      { label: "丢弃负重", desc: "丢废铁保体力", resolve(ctx) { return { log: { text: "你扔掉些废铁才爬出来。", color: "#9aa1b0" }, rewards: { scrap: -2 }, stamina: -15 }; } },
    ],
  },
  {
    id: "emp_pulse", weight: 1, kind: "bad",
    text: "一道蓝光闪过,你的电子设备全失灵了!",
    choices: [{ label: "重启设备", desc: "损失电力物资", resolve(ctx) { return { log: { text: "设备重启,但电池报废了。", color: "#e0584e" }, rewards: { power: -2 } }; } }],
  },

  // ════════ 扩充好事件 (新增16个,共30) ════════
  {
    id: "abandoned_car", weight: 3, kind: "good",
    text: "一辆锈迹斑斑的汽车横在路边,后备箱似乎没锁。",
    choices: [
      { label: "撬开后备箱", desc: "看运气", resolve(ctx) {
        if (ctx.rng() < 0.6) { const s = 3 + Math.floor(ctx.rng()*4); return { log:{text:`后备箱里塞着 ${s} 废铁!`,color:"#7cc36b"}, rewards:{scrap:s}, mood:4 }; }
        return { log:{text:"后备箱是空的。",color:"#9aa1b0"}, mood:1 };
      }},
      { label: "拆电瓶", desc: "稳拿电力", resolve(ctx) { return { log:{text:"你拆下了还能用的电瓶。",color:"#e0c14a"}, rewards:{power:3} }; } },
    ],
  },
  {
    id: "med_cache", weight: 2, kind: "good",
    text: "一个红十字标记的箱子半埋在土里,可能是医疗物资。",
    choices: [{ label: "取出药品", desc: "药品奖励", resolve(ctx) { const m = 2 + Math.floor(ctx.rng()*3); return { log:{text:`找到 ${m} 份药品!`,color:"#e0588e"}, rewards:{meds:m}, mood:5 }; } }],
  },
  {
    id: "vending_machine", weight: 2, kind: "good",
    text: "一台自动售货机歪斜地立着,里面还有饮料和零食。",
    choices: [{ label: "砸开取货", desc: "食物+水", resolve(ctx) { const f=2+Math.floor(ctx.rng()*2),w=2+Math.floor(ctx.rng()*2); return { log:{text:`你砸开售货机,拿到 ${f}食物 ${w}水。`,color:"#7cc36b"}, rewards:{food:f,water:w} }; } }],
  },
  {
    id: "tool_box", weight: 2, kind: "good",
    text: "一个遗落的工具箱,里面的工具保存得相当好。",
    choices: [{ label: "收走工具", desc: "零件奖励", resolve(ctx) { const p=3+Math.floor(ctx.rng()*3); return { log:{text:`这些工具能拆出 ${p} 个零件。`,color:"#c9a86a"}, rewards:{parts:p} }; } }],
  },
  {
    id: "wild_berry", weight: 3, kind: "good",
    text: "灌木丛中结着一串串鲜艳的浆果,看起来能吃。",
    choices: [
      { label: "采摘食用", desc: "恢复+食物", resolve(ctx) { const f=2+Math.floor(ctx.rng()*2); return { log:{text:`浆果酸甜可口,还带了些走。`,color:"#7cc36b"}, rewards:{food:f}, stamina:10 }; } },
      { label: "小心辨别", desc: "看是不是有毒", resolve(ctx) {
        if (ctx.hasPerk("farmer")) return { log:{text:"农夫确认无毒,放心食用!",color:"#7cc36b"}, rewards:{food:3}, mood:3 };
        if (ctx.rng()<0.2) return { log:{text:"吃下去有点不舒服。",color:"#f0a93b"}, health:-8 };
        return { log:{text:"看起来没问题,吃了。",color:"#9aa1b0"}, rewards:{food:2} };
      }},
    ],
  },
  {
    id: "clean_water_pool", weight: 2, kind: "good",
    text: "一潭清澈见底的水,在辐射废土上简直是奇迹。",
    choices: [{ label: "尽情畅饮", desc: "恢复体力+水", resolve(ctx) { return { log:{text:"清水让你精神一振!",color:"#5b9bd5"}, stamina:25, health:10, rewards:{water:3} }; } }],
  },
  {
    id: "lost_backpack", weight: 3, kind: "good",
    text: "一个背包挂在树枝上,里面鼓鼓囊囊的。",
    choices: [{ label: "翻找", desc: "随机物资", resolve(ctx) {
      const r = ctx.rng();
      if (r<0.4) return { log:{text:"包里有不少废铁和零件!",color:"#7cc36b"}, rewards:{scrap:3,parts:2} };
      if (r<0.7) return { log:{text:"包里是食物和水。",color:"#7cc36b"}, rewards:{food:3,water:2} };
      return { log:{text:"包里只有些破烂。",color:"#9aa1b0"}, rewards:{scrap:1} };
    }}],
  },
  {
    id: "solar_panel", weight: 1, kind: "good",
    text: "一块完好的太阳能板躺在废墟顶上,还在微微运转。",
    choices: [{ label: "拆下来", desc: "大量电力", resolve(ctx) { const pw=4+Math.floor(ctx.rng()*4); return { log:{text:`太阳能板!获得 ${pw} 电力物资。`,color:"#e0c14a"}, rewards:{power:pw}, mood:6 }; } }],
  },
  {
    id: "friendly_dog", weight: 2, kind: "good",
    text: "一只瘦骨嶙峋的狗摇着尾巴走向你,似乎想跟随。",
    choices: [
      { label: "喂食收留", desc: "消耗食物换心情", resolve(ctx) { return { log:{text:"小狗成了营地的吉祥物,大家心情大好!",color:"#7cc36b"}, rewards:{food:-1}, mood:15 }; } },
      { label: "让它离开", desc: "不消耗", resolve(ctx) { return { log:{text:"你挥手让狗离开了。",color:"#9aa1b0"}, mood:-2 }; } },
    ],
  },
  {
    id: "intact_shelter", weight: 2, kind: "good",
    text: "一间门窗完好的小屋,里面似乎有人住过的痕迹。",
    choices: [
      { label: "搜刮", desc: "综合物资", resolve(ctx) { return { log:{text:"小屋里收获颇丰!",color:"#7cc36b"}, rewards:{food:2,water:2,scrap:2}, mood:4 }; } },
      { label: "休息", desc: "回血回体力", resolve(ctx) { return { log:{text:"在小屋安心休息,恢复不少。",color:"#4caf87"}, health:20,stamina:25 }; } },
    ],
  },
  {
    id: "ammo_box", weight: 1, kind: "good",
    text: "一个军绿色的弹药箱,锁已经锈蚀。",
    choices: [{ label: "撬开", desc: "零件+废铁", resolve(ctx) { return { log:{text:"弹药箱里有不少金属配件!",color:"#c9a86a"}, rewards:{parts:4,scrap:3}, mood:5 }; } }],
  },
  {
    id: "herb_garden", weight: 2, kind: "good",
    text: "一片野生草药在废墟角落长得茂盛。",
    choices: [{ label: "采摘草药", desc: "药品", resolve(ctx) { const m=2+Math.floor(ctx.rng()*2); return { log:{text:`采到 ${m} 份可用药草。`,color:"#7cc36b"}, rewards:{meds:m} }; } }],
  },
  {
    id: "food_storage", weight: 2, kind: "good",
    text: "一个地下储藏室,架子上还摆着罐头。",
    choices: [{ label: "搬走罐头", desc: "大量食物", resolve(ctx) { const f=4+Math.floor(ctx.rng()*4); return { log:{text:`储藏室有 ${f} 份罐头!`,color:"#7cc36b"}, rewards:{food:f}, mood:7 }; } }],
  },
  {
    id: "broken_drone", weight: 1, kind: "good",
    text: "一架坠毁的无人机,核心部件似乎还能用。",
    choices: [{ label: "拆核心", desc: "零件+电力", resolve(ctx) { return { log:{text:"无人机的核心值钱!",color:"#c9a86a"}, rewards:{parts:3,power:2} }; } }],
  },
  {
    id: "warm_vent", weight: 2, kind: "good",
    text: "地面裂口冒出温热的蒸汽,靠近让人放松。",
    choices: [{ label: "暖一暖", desc: "恢复体力+心情", resolve(ctx) { return { log:{text:"温暖让你卸下疲惫。",color:"#4caf87"}, stamina:30,mood:8 }; } }],
  },
  {
    id: "signal_relay", weight: 1, kind: "good",
    text: "一座小型信号中继站,指示灯还在闪。",
    choices: [{ label: "调频接收", desc: "加速招募", resolve(ctx) { return { log:{text:"你接收到清晰信号!(招募冷却减半)",color:"#5b9bd5"}, rewards:{power:1}, _radioBoost:true, mood:6 }; } }],
  },

  // ════════ 扩充坏事件 (新增16个,共30) ════════
  {
    id: "swarm_rat", weight: 3, kind: "bad",
    text: "一群变异老鼠从下水道涌出,吱吱叫着扑来!",
    choices: [
      { label: "驱赶", desc: "扣体力", resolve(ctx) { return { log:{text:"你挥舞武器赶走了鼠群。",color:"#f0a93b"}, stamina:-18 }; } },
      { label: "踩过去", desc: "可能受伤", resolve(ctx) { if(ctx.rng()<0.5) return { log:{text:"被老鼠咬了一口!",color:"#e0584e"}, health:-12 }; return { log:{text:"你踩着鼠群冲过去了。",color:"#9aa1b0"}, stamina:-10 }; } },
    ],
  },
  {
    id: "broken_bridge", weight: 2, kind: "bad",
    text: "前方的桥断了,下面是深不见底的裂缝。",
    choices: [
      { label: "绕路", desc: "扣体力", resolve(ctx) { return { log:{text:"你绕了一大圈才过去。",color:"#f0a93b"}, stamina:-22 }; } },
      { label: "跳过去", desc: "看运气", resolve(ctx) { if(ctx.rng()<0.7) return { log:{text:"你纵身一跃,有惊无险!",color:"#7cc36b"}, mood:4 }; return { log:{text:"没跳稳,擦伤了!",color:"#e0584e"}, health:-15,stamina:-10 }; } },
    ],
  },
  {
    id: "acid_puddle", weight: 2, kind: "bad",
    text: "地上有一滩冒着泡的绿色液体,是强酸!",
    choices: [
      { label: "小心绕过", desc: "扣体力", resolve(ctx) { return { log:{text:"你贴着墙根绕过了酸液。",color:"#9aa1b0"}, stamina:-12 }; } },
      { label: "直接跨过", desc: "可能溅伤", resolve(ctx) { if(ctx.rng()<0.4) return { log:{text:"酸液溅到腿上!",color:"#e0584e"}, health:-18 }; return { log:{text:"你跨过去了。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "creepy_statue", weight: 1, kind: "bad",
    text: "一尊扭曲的雕像立在雾中,盯着它让你脊背发凉。",
    choices: [{ label: "快步离开", desc: "扣心情", resolve(ctx) { return { log:{text:"雕像的目光让你很不舒服。",color:"#9b7bd4"}, mood:-10 }; } }],
  },
  {
    id: "landslide", weight: 2, kind: "bad",
    text: "山坡突然滑坡,碎石裹挟而下!",
    choices: [
      { label: "躲避", desc: "扣体力", resolve(ctx) { return { log:{text:"你扑到岩石后躲过滑坡。",color:"#f0a93b"}, stamina:-20 }; } },
      { label: "硬冲", desc: "可能受伤", resolve(ctx) { if(ctx.rng()<0.5) return { log:{text:"碎石砸中了你!",color:"#e0584e"}, health:-20 }; return { log:{text:"你抢在滑坡前冲过去了。",color:"#9aa1b0"}, stamina:-15 }; } },
    ],
  },
  {
    id: "strange_fog", weight: 2, kind: "bad",
    text: "一团诡异的彩色雾气飘来,闻着让人头晕。",
    choices: [
      { label: "屏息穿过", desc: "扣体力+心情", resolve(ctx) { return { log:{text:"你憋气穿过雾气,有点恶心。",color:"#9b7bd4"}, stamina:-15,mood:-6 }; } },
      { label: "等雾散", desc: "只扣时间", resolve(ctx) { return { log:{text:"你等雾散了再走。",color:"#9aa1b0"}, stamina:-8 }; } },
    ],
  },
  {
    id: "broken_floor", weight: 2, kind: "bad",
    text: "脚下的地板发出不祥的嘎吱声,感觉要塌!",
    choices: [
      { label: "快跑", desc: "扣体力", resolve(ctx) { return { log:{text:"你在地板塌前跑开了。",color:"#f0a93b"}, stamina:-16 }; } },
      { label: "慢慢走", desc: "看运气", resolve(ctx) { if(ctx.rng()<0.6) return { log:{text:"你小心翼翼通过了。",color:"#9aa1b0"} }; return { log:{text:"地板塌了!你掉了下去!",color:"#e0584e"}, health:-15,stamina:-12 }; } },
    ],
  },
  {
    id: "angry_birds", weight: 2, kind: "bad",
    text: "一群变异猛禽在头顶盘旋,发出刺耳的尖叫!",
    choices: [
      { label: "用东西驱赶", desc: "丢废铁", resolve(ctx) { return { log:{text:"你扔废铁赶走了猛禽。",color:"#9aa1b0"}, rewards:{scrap:-2} }; } },
      { label: "抱头快跑", desc: "扣体力可能受伤", resolve(ctx) { if(ctx.rng()<0.4) return { log:{text:"被猛禽啄伤了!",color:"#e0584e"}, health:-12 }; return { log:{text:"你抱着头跑出了领地。",color:"#f0a93b"}, stamina:-18 }; } },
    ],
  },
  {
    id: "muddy_road", weight: 3, kind: "bad",
    text: "一条泥泞不堪的路,每走一步都费劲。",
    choices: [{ label: "硬趟过去", desc: "扣体力", resolve(ctx) { return { log:{text:"泥路让你精疲力尽。",color:"#f0a93b"}, stamina:-20 }; } }],
  },
  {
    id: "spiked_pit", weight: 1, kind: "bad",
    text: "你差点踩进一个布满尖刺的陷阱坑!",
    choices: [
      { label: "攀着边缘爬", desc: "扣体力", resolve(ctx) { return { log:{text:"你扒着坑边爬上来了。",color:"#f0a93b"}, stamina:-18 }; } },
      { label: "踩尖刺借力", desc: "受伤但快", resolve(ctx) { return { log:{text:"尖刺扎进脚板,但你爬上来了。",color:"#e0584e"}, health:-16 }; } },
    ],
  },
  {
    id: "howling_wind", weight: 2, kind: "bad",
    text: "狂风呼啸,沙石打在脸上生疼。",
    choices: [{ label: "低头前进", desc: "扣体力", resolve(ctx) { return { log:{text:"风沙让你举步维艰。",color:"#f0a93b"}, stamina:-15,mood:-3 }; } }],
  },
  {
    id: "leaking_pipe", weight: 1, kind: "bad",
    text: "一根破裂的管道喷出高压蒸汽,挡住了路。",
    choices: [
      { label: "等间歇穿过", desc: "扣体力", resolve(ctx) { return { log:{text:"你趁蒸汽间歇钻了过去。",color:"#9aa1b0"}, stamina:-14 }; } },
      { label: "硬闯", desc: "烫伤", resolve(ctx) { return { log:{text:"蒸汽烫伤了你的手臂!",color:"#e0584e"}, health:-14 }; } },
    ],
  },
  {
    id: "unsettling_silence", weight: 1, kind: "bad",
    text: "周围突然死一般寂静,连风声都停了,气氛诡异。",
    choices: [{ label: "赶紧离开", desc: "扣心情", resolve(ctx) { return { log:{text:"死寂让你心慌意乱。",color:"#9b7bd4"}, mood:-8,stamina:-8 }; } }],
  },
  {
    id: "rusted_wire", weight: 2, kind: "bad",
    text: "你被一截生锈的铁丝绊倒,手被划伤!",
    choices: [{ label: "包扎伤口", desc: "扣血", resolve(ctx) { return { log:{text:"铁丝划破了你的手。",color:"#e0584e"}, health:-10 }; } }],
  },
  {
    id: "blocked_path", weight: 2, kind: "bad",
    text: "巨大的混凝土块堵死了去路,只能清理或绕行。",
    choices: [
      { label: "搬开", desc: "扣大量体力", resolve(ctx) { return { log:{text:"你费尽力气搬开了路障。",color:"#f0a93b"}, stamina:-28 }; } },
      { label: "绕行", desc: "扣体力", resolve(ctx) { return { log:{text:"你绕过了路障。",color:"#9aa1b0"}, stamina:-16 }; } },
    ],
  },
  {
    id: "echo_cave", weight: 1, kind: "bad",
    text: "你误入一个洞穴,回声不断放大你的脚步声,令人不安。",
    choices: [
      { label: "探索洞穴", desc: "可能找到东西但受伤", resolve(ctx) { if(ctx.rng()<0.5) return { log:{text:"洞穴里有积水,你滑倒受伤了。",color:"#e0584e"}, health:-12,rewards:{scrap:2} }; return { log:{text:"洞穴里有些废铁。",color:"#7cc36b"}, rewards:{scrap:3} }; } },
      { label: "原路退出", desc: "扣心情", resolve(ctx) { return { log:{text:"回声让你头皮发麻,赶紧退出了。",color:"#9b7bd4"}, mood:-7 }; } },
    ],
  },

  // ════════ 更多好事件 (新增10个) ════════
  {
    id: "treasure_chest", weight: 2, kind: "good",
    text: "废墟深处一口镶嵌宝石的箱子,宝石还在闪光!",
    choices: [{ label: "撬开", desc: "大量资源", resolve(ctx) { return { log:{text:"箱子里是战前的珍贵物资!",color:"#f0a93b"}, rewards:{parts:5,scrap:5,meds:2}, mood:10 }; } }],
  },
  {
    id: "oasis", weight: 1, kind: "good",
    text: "一片绿洲在沙尘中若隐若现,棕榈树和清澈的水潭!",
    choices: [{ label: "畅饮休息", desc: "完全恢复", resolve(ctx) { return { log:{text:"绿洲!你彻底恢复了状态!",color:"#4caf87"}, health:40,stamina:50,mood:15 }; } }],
  },
  {
    id: "repair_bot", weight: 1, kind: "good",
    text: "一台小型修理机器人蹲在角落,还闪烁着工作指示灯。",
    choices: [{ label: "启动它", desc: "它帮你修装备", resolve(ctx) { return { log:{text:"修理工帮你整备了装备,获得零件!",color:"#7cc36b"}, rewards:{parts:6}, mood:6 }; } }],
  },
  {
    id: "seed_vault", weight: 1, kind: "good",
    text: "一个低温种子库,门被卡住了但里面有珍贵的作物种子。",
    choices: [{ label: "强行打开", desc: "大量食物来源", resolve(ctx) { return { log:{text:"种子库!粮食问题缓解了!",color:"#7cc36b"}, rewards:{food:8}, mood:12 }; } }],
  },
  {
    id: "supply_truck", weight: 2, kind: "good",
    text: "一辆侧翻的补给卡车,车厢里货物撒了一地。",
    choices: [{ label: "收集物资", desc: "综合资源", resolve(ctx) { return { log:{text:"卡车补给收获丰富!",color:"#7cc36b"}, rewards:{food:3,water:3,scrap:3}, mood:6 }; } }],
  },
  {
    id: "art_cache", weight: 1, kind: "good",
    text: "墙后有个暗格,里面是前人藏匿的艺术品和贵重品。",
    choices: [{ label: "取走", desc: "废铁+心情", resolve(ctx) { return { log:{text:"这些艺术品让你想起了旧世界。",color:"#9b7bd4"}, rewards:{scrap:4}, mood:10 }; } }],
  },
  {
    id: "clean_cache", weight: 2, kind: "good",
    text: "一个密封的塑料箱,标签写着\"应急口粮\"。",
    choices: [{ label: "撬开", desc: "食物+水", resolve(ctx) { return { log:{text:"应急口粮!食物和水都有!",color:"#7cc36b"}, rewards:{food:4,water:3}, mood:5 }; } }],
  },
  {
    id: "med_lab", weight: 1, kind: "good",
    text: "一间小型实验室,药品柜里还剩些未过期的药剂。",
    choices: [{ label: "搜集药品", desc: "大量药品", resolve(ctx) { return { log:{text:"实验室收获不少药品!",color:"#e0588e"}, rewards:{meds:5}, mood:8 }; } }],
  },
  {
    id: "battery_rack", weight: 2, kind: "good",
    text: "一面墙上挂满了充电电池,有些还有余电。",
    choices: [{ label: "取走电池", desc: "电力", resolve(ctx) { const pw=3+Math.floor(ctx.rng()*4); return { log:{text:`你取走了 ${pw} 组电池!`,color:"#e0c14a"}, rewards:{power:pw} }; } }],
  },
  {
    id: "map_table", weight: 1, kind: "good",
    text: "一张巨大的废土地图铺在桌上,标注了资源点!",
    choices: [{ label: "研究地图", desc: "零件+废铁(情报价值)", resolve(ctx) { return { log:{text:"地图标注了宝藏位置!",color:"#5b9bd5"}, rewards:{parts:4,scrap:4}, mood:8 }; } }],
  },

  // ════════ 中立事件 (有选择但无明确好坏,纯trade-off) (12个) ════════
  {
    id: "fork_road", weight: 3, kind: "neutral",
    text: "面前的路分成两条,左边看起来安全但绕远,右边近但阴暗。",
    choices: [
      { label: "走左边(安全)", desc: "扣体力但无风险", resolve(ctx) { return { log:{text:"你选了安全的远路。",color:"#9aa1b0"}, stamina:-20 }; } },
      { label: "走右边(冒险)", desc: "省体力但看运气", resolve(ctx) {
        if (ctx.rng()<0.5) return { log:{text:"近路很顺利!",color:"#7cc36b"}, stamina:-5 };
        return { log:{text:"阴暗处有东西,你受了点惊吓。",color:"#e0584e"}, health:-10,mood:-5 };
      }},
    ],
  },
  {
    id: "mysterious_box", weight: 2, kind: "neutral",
    text: "一个上了锁的金属箱,摇一摇里面有东西在响。",
    choices: [
      { label: "砸开", desc: "消耗体力换随机物", resolve(ctx) {
        const r=ctx.rng();
        if(r<0.4) return { log:{text:"箱子里是食物!",color:"#7cc36b"}, rewards:{food:3}, stamina:-10 };
        if(r<0.7) return { log:{text:"里面是零件!",color:"#c9a86a"}, rewards:{parts:3}, stamina:-10 };
        if(r<0.9) return { log:{text:"是坏的陷阱弹片!",color:"#e0584e"}, health:-12, stamina:-10 };
        return { log:{text:"箱子是空的,白费力气。",color:"#9aa1b0"}, stamina:-15 };
      }},
      { label: "不碰它", desc: "什么也不发生", resolve(ctx) { return { log:{text:"你决定不冒险,离开了。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "trade_post", weight: 2, kind: "neutral",
    text: "路边有个简陋的交换摊,一个蒙面人示意你过来。",
    choices: [
      { label: "用食物换零件", desc: "资源交换", resolve(ctx) { return { log:{text:"你用食物换了零件。",color:"#9aa1b0"}, rewards:{food:-3,parts:3} }; } },
      { label: "用废铁换药品", desc: "资源交换", resolve(ctx) { return { log:{text:"你用废铁换了药品。",color:"#9aa1b0"}, rewards:{scrap:-4,meds:2} }; } },
      { label: "不感兴趣", desc: "离开", resolve(ctx) { return { log:{text:"你摇摇头走开了。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "risky_search", weight: 2, kind: "neutral",
    text: "一栋摇摇欲坠的大楼,里面可能有好东西,也可能随时塌。",
    choices: [
      { label: "快速搜索顶层", desc: "高回报高风险", resolve(ctx) {
        if (ctx.rng()<0.5) return { log:{text:"顶层有好东西!",color:"#7cc36b"}, rewards:{parts:4,scrap:3} };
        return { log:{text:"楼塌了!你仓皇逃出!",color:"#e0584e"}, health:-18, stamina:-15 };
      }},
      { label: "只搜底层", desc: "安全但少", resolve(ctx) { return { log:{text:"底层只找到些废铁。",color:"#9aa1b0"}, rewards:{scrap:2} }; } },
      { label: "不进去", desc: "放弃", resolve(ctx) { return { log:{text:"你不想冒这个险。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "gambling_crate", weight: 2, kind: "neutral",
    text: "三个密封箱子摆在你面前,只能开一个。",
    choices: [
      { label: "开左边的", desc: "赌一把", resolve(ctx) {
        const r=ctx.rng();
        if(r<0.33) return { log:{text:"左边箱子里是大量食物!",color:"#7cc36b"}, rewards:{food:5} };
        if(r<0.66) return { log:{text:"只有几块废铁。",color:"#9aa1b0"}, rewards:{scrap:2} };
        return { log:{text:"触发了陷阱!",color:"#e0584e"}, health:-15 };
      }},
      { label: "开中间的", desc: "赌一把", resolve(ctx) {
        const r=ctx.rng();
        if(r<0.33) return { log:{text:"中间箱子里是零件!",color:"#7cc36b"}, rewards:{parts:4} };
        if(r<0.66) return { log:{text:"是一滩污水。",color:"#9aa1b0"}, rewards:{water:1} };
        return { log:{text:"箱子爆炸了!",color:"#e0584e"}, health:-12,stamina:-10 };
      }},
      { label: "开右边的", desc: "赌一把", resolve(ctx) {
        const r=ctx.rng();
        if(r<0.4) return { log:{text:"右边箱子里是药品!",color:"#7cc36b"}, rewards:{meds:3} };
        return { log:{text:"空箱子。",color:"#9aa1b0"} };
      }},
      { label: "全都不开", desc: "稳妥", resolve(ctx) { return { log:{text:"你不想赌,离开了。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "collapsed_tunnel", weight: 2, kind: "neutral",
    text: "一条隧道塌了一半,勉强能钻过去,对面似乎有亮光。",
    choices: [
      { label: "钻过去看看", desc: "未知奖励/风险", resolve(ctx) {
        if (ctx.rng()<0.55) { const s=3+Math.floor(ctx.rng()*3); return { log:{text:`隧道那边有个藏匿点,${s}废铁!`,color:"#7cc36b"}, rewards:{scrap:s}, stamina:-12 }; }
        return { log:{text:"隧道那边什么也没有,白费力气。",color:"#9aa1b0"}, stamina:-18 };
      }},
      { label: "不冒险", desc: "安全离开", resolve(ctx) { return { log:{text:"你没钻隧道,继续赶路。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "old_radio", weight: 1, kind: "neutral",
    text: "一台老式收音机还能响,调到不同频道会有不同声音。",
    choices: [
      { label: "调到求救频道", desc: "可能找到人", resolve(ctx) { if(ctx.rng()<0.4) return { log:{text:"你收到了清晰的求救信号!",color:"#5b9bd5"}, _radioBoost:true, mood:6 }; return { log:{text:"只有静电噪音。",color:"#9aa1b0"} }; } },
      { label: "调到音乐频道", desc: "提升心情", resolve(ctx) { return { log:{text:"久违的音乐让你心情舒畅。",color:"#9b7bd4"}, mood:10 }; } },
      { label: "关掉它", desc: "什么也不做", resolve(ctx) { return { log:{text:"你关掉了收音机。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "stranger_offer", weight: 2, kind: "neutral",
    text: "一个陌生人拦住你,递给你一个小瓶子:\"喝了这个,你会更强壮。\"",
    choices: [
      { label: "喝下去", desc: "看运气", resolve(ctx) {
        const r=ctx.rng();
        if(r<0.35) return { log:{text:"感觉身体变轻了!体力恢复!",color:"#7cc36b"}, stamina:30, health:10 };
        if(r<0.65) return { log:{text:"味道苦涩,但没什么效果。",color:"#9aa1b0"} };
        return { log:{text:"是毒药!你腹痛难忍!",color:"#e0584e"}, health:-15, mood:-5 };
      }},
      { label: "拒绝", desc: "稳妥", resolve(ctx) { return { log:{text:"你谢绝了陌生人的好意。",color:"#9aa1b0"} }; } },
    ],
  },
  {
    id: "weather_shift", weight: 2, kind: "neutral",
    text: "天空突然变了色,远处一边阳光一边乌云。",
    choices: [
      { label: "朝阳光走", desc: "安全但绕路", resolve(ctx) { return { log:{text:"你在阳光下绕行了。",color:"#9aa1b0"}, stamina:-15, mood:3 }; } },
      { label: "穿乌云走", desc: "近但可能遇暴风", resolve(ctx) {
        if(ctx.rng()<0.5) return { log:{text:"乌云很快散了,路很近!",color:"#7cc36b"}, stamina:-5 };
        return { log:{text:"暴风来了!你淋了个透!",color:"#e0584e"}, health:-10, stamina:-15, mood:-5 };
      }},
    ],
  },
  {
    id: "signal_choice", weight: 1, kind: "neutral",
    text: "两个方向的信号同时出现,一个是物资,一个是求救。",
    choices: [
      { label: "追物资信号", desc: "资源", resolve(ctx) { return { log:{text:"你找到了物资信号源!",color:"#7cc36b"}, rewards:{scrap:3,parts:2} }; } },
      { label: "追求救信号", desc: "可能招募/可能陷阱", resolve(ctx) {
        if(ctx.rng()<0.3) return { log:{text:"是个友善的幸存者!",color:"#7cc36b"}, _radioBoost:true, mood:8 };
        if(ctx.rng()<0.6) return { log:{text:"是掠夺者的诱饵!",color:"#e0584e"}, health:-15, rewards:{scrap:-2} };
        return { log:{text:"信号消失了,什么也没找到。",color:"#9aa1b0"} };
      }},
    ],
  },
  {
    id: "repair_or_scrap", weight: 2, kind: "neutral",
    text: "一台半坏的发电机,可以修好也可以直接拆零件。",
    choices: [
      { label: "修理它(工程师更好)", desc: "获得电力", resolve(ctx) {
        if (ctx.hasPerk("engineer")) return { log:{text:"工程师修好了发电机!",color:"#e0c14a"}, rewards:{power:5} };
        if (ctx.rng()<0.4) return { log:{text:"你勉强修好了它。",color:"#e0c14a"}, rewards:{power:3} };
        return { log:{text:"修不好,白费力气。",color:"#9aa1b0"}, stamina:-15 };
      }},
      { label: "拆零件", desc: "稳拿", resolve(ctx) { return { log:{text:"你拆了发电机,获得零件。",color:"#c9a86a"}, rewards:{parts:3} }; } },
    ],
  },
  {
    id: "deep_water", weight: 1, kind: "neutral",
    text: "一个深水潭,水面下隐约能看到闪光的东西。",
    choices: [
      { label: "潜水去取", desc: "高风险高回报", resolve(ctx) {
        if (ctx.rng()<0.5) return { log:{text:"你潜下去拿到了宝物!",color:"#7cc36b"}, rewards:{parts:4,scrap:3} };
        return { log:{text:"水里有东西缠住了你!",color:"#e0584e"}, health:-15, stamina:-20 };
      }},
      { label: "用绳子钓", desc: "安全但可能钓不到", resolve(ctx) {
        if (ctx.rng()<0.3) return { log:{text:"你钓上来一些废铁!",color:"#7cc36b"}, rewards:{scrap:2} };
        return { log:{text:"什么也没钓到。",color:"#9aa1b0"}, stamina:-8 };
      }},
      { label: "不冒险", desc: "离开", resolve(ctx) { return { log:{text:"你不想下水,离开了。",color:"#9aa1b0"} }; } },
    ],
  },
];

// 按权重随机选事件
export function rollExploreEvent(rng, preferGood, excludeId) {
  // 过滤掉上次的事件(防连续重复)
  let pool = EXPLORE_EVENTS;
  if (excludeId) pool = EXPLORE_EVENTS.filter((e) => e.id !== excludeId);
  // 侦察兵偏好好事件:好事件权重×2,坏事件权重×0.5,中立不变
  let weighted;
  if (preferGood) {
    weighted = pool.map((e) => ({ e, w: e.kind === "good" ? e.weight * 2 : e.kind === "bad" ? e.weight * 0.5 : e.weight }));
  } else {
    weighted = pool.map((e) => ({ e, w: e.weight }));
  }
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.e; }
  return weighted[0].e;
}

export const EXPLORE_EVENT_STATS = {
  good: EXPLORE_EVENTS.filter((e) => e.kind === "good").length,
  bad: EXPLORE_EVENTS.filter((e) => e.kind === "bad").length,
  neutral: EXPLORE_EVENTS.filter((e) => e.kind === "neutral").length,
  total: EXPLORE_EVENTS.length,
};
