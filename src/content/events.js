// 随机事件库: 派遣途中遭遇的多选项事件
// 每个事件: id, text, 选项 choices[{label, desc, resolve(ctx)}]
// resolve 返回 {log, rewards:{}, teamEffect:{health,mood}}
// ctx 含: members(队伍幸存者), rng, hasPerk(fn)

export const EXPEDITION_EVENTS = [
  {
    id: "cache",
    weight: 3,
    text: "队伍发现了一处被掩埋的物资储藏点,木箱半露在瓦砾外。",
    choices: [
      {
        label: "全力搜刮",
        desc: "更多资源,但有陷阱风险",
        resolve(ctx) {
          const trap = ctx.rng() < 0.3;
          if (trap && !ctx.hasPerk("scavenger")) {
            const dmg = 15 + Math.floor(ctx.rng() * 15);
            return {
              log: { text: "触发陷阱! 队员受伤。", color: "#e0584e" },
              rewards: { scrap: 2, parts: 1 },
              teamEffect: { health: -dmg, mood: -10 },
            };
          }
          return {
            log: { text: "满载而归,收获颇丰!", color: "#7cc36b" },
            rewards: { scrap: 3, parts: 2, food: 2 },
            teamEffect: { mood: 8 },
          };
        },
      },
      {
        label: "谨慎搜索",
        desc: "安全但收获少",
        resolve(ctx) {
          return {
            log: { text: "小心清理后带走部分物资。", color: "#9aa1b0" },
            rewards: { scrap: 2, parts: 1 },
          };
        },
      },
    ],
  },
  {
    id: "survivor",
    weight: 2,
    text: "废墟中传来求救信号,一个虚弱的人影正在挥手。",
    choices: [
      {
        label: "施以援手",
        desc: "可能获得新成员",
        resolve(ctx) {
          if (ctx.rng() < 0.55) {
            return {
              log: { text: "对方感激地加入队伍,成为新的幸存者!", color: "#4caf87" },
              rewards: {},
              recruit: true,
              teamEffect: { mood: 15 },
            };
          }
          const dmg = 10 + Math.floor(ctx.rng() * 10);
          return {
            log: { text: "对方是诱饵! 遭到伏击。", color: "#e0584e" },
            teamEffect: { health: -dmg, mood: -15 },
          };
        },
      },
      {
        label: "绕道离开",
        desc: "避免风险",
        resolve(ctx) {
          return { log: { text: "队伍选择绕道,平安无事。", color: "#9aa1b0" } };
        },
      },
    ],
  },
  {
    id: "zombie",
    weight: 2,
    text: "一群丧尸从阴影中涌出,挡住了去路!",
    choices: [
      {
        label: "正面突围",
        desc: "战斗,看实力",
        resolve(ctx) {
          const combat = ctx.combatScore();
          if (combat > 5 || (combat > 2 && ctx.hasPerk("guardian"))) {
            return {
              log: { text: "队伍击退尸群,缴获战利品!", color: "#7cc36b" },
              rewards: { parts: 2, scrap: 3 },
              teamEffect: { mood: 5 },
            };
          }
          const dmg = 15 + Math.floor(ctx.rng() * 20);
          return {
            log: { text: "苦战突围,队伍负伤。", color: "#f0a93b" },
            rewards: { scrap: 1 },
            teamEffect: { health: -dmg, mood: -10 },
          };
        },
      },
      {
        label: "悄悄绕行",
        desc: "避免战斗",
        resolve(ctx) {
          if (ctx.rng() < 0.7) {
            return { log: { text: "队伍成功避开尸群。", color: "#9aa1b0" } };
          }
          return {
            log: { text: "被发现! 被迫边战边退。", color: "#f0a93b" },
            teamEffect: { health: -12, mood: -8 },
          };
        },
      },
    ],
  },
  {
    id: "raider",
    weight: 2,
    text: "一伙掠夺者拦住去路,索要过路费。",
    choices: [
      {
        label: "交出部分物资",
        desc: "破财消灾",
        resolve(ctx) {
          return {
            log: { text: "交出些废铁,得以通行。", color: "#9aa1b0" },
            rewards: { scrap: -3 },
          };
        },
      },
      {
        label: "武力驱逐",
        desc: "高风险高回报",
        resolve(ctx) {
          const combat = ctx.combatScore();
          if (combat > 4 || (ctx.hasPerk("guardian") && ctx.rng() < 0.6)) {
            return {
              log: { text: "击溃掠夺者,缴获他们的物资!", color: "#7cc36b" },
              rewards: { scrap: 4, parts: 2, food: 2 },
              teamEffect: { mood: 10 },
            };
          }
          const dmg = 20 + Math.floor(ctx.rng() * 20);
          return {
            log: { text: "激战失利,损失惨重。", color: "#e0584e" },
            teamEffect: { health: -dmg, mood: -15 },
            rewards: { scrap: -2 },
          };
        },
      },
    ],
  },
  {
    id: "trap",
    weight: 1,
    text: "前方地面有可疑痕迹,可能是地雷或绊索。",
    choices: [
      {
        label: "小心排雷通过",
        desc: "需要技巧",
        resolve(ctx) {
          if (ctx.hasPerk("scavenger") || ctx.rng() < 0.6) {
            return {
              log: { text: "成功排除陷阱,还找到些零件。", color: "#7cc36b" },
              rewards: { parts: 2 },
            };
          }
          const dmg = 10 + Math.floor(ctx.rng() * 15);
          return {
            log: { text: "排雷失败,有人受伤。", color: "#e0584e" },
            teamEffect: { health: -dmg },
          };
        },
      },
      {
        label: "原路返回",
        desc: "放弃深入",
        resolve(ctx) {
          return { log: { text: "队伍选择折返,改日再来。", color: "#9aa1b0" } };
        },
      },
    ],
  },
];

// 随机选一个事件(按权重)
export function rollEvent(rng) {
  const total = EXPEDITION_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of EXPEDITION_EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return EXPEDITION_EVENTS[0];
}
