// 结局定义: 4种结局,每种对应一条通关路线
// 触发: 科技满级(unlocksEnding) 或 获得方舟之钥(truth)
export const ENDINGS = {
  warlord: {
    id: "warlord",
    name: "战争领主",
    icon: "⚔️",
    title: "废土的统治者",
    desc: "你的防御科技达到了巅峰。力场穹顶笼罩避难所,再无威胁能撼动你。掠夺者闻风丧胆,你成为了废土的绝对统治者。但统治之下,是孤独的王座。",
    color: "#e0584e",
  },
  civilization: {
    id: "civilization",
    name: "重建文明",
    icon: "🏛️",
    title: "新文明的黎明",
    desc: "物质复制器的嗡鸣声响彻避难所。饥饿与匮乏成为历史。你建立了一个自给自足的新文明,幸存者们不再只是生存——他们开始生活。这是废土上第一个真正的家园。",
    color: "#4caf87",
  },
  science: {
    id: "science",
    name: "方舟计划",
    icon: "🚀",
    title: "驶向星辰",
    desc: "方舟计划的完成意味着人类不再被困在这片废土。你带领最优秀的幸存者登上方舟,驶向未知的新世界。留在地面的人将继续重建,而你选择了星辰大海。",
    color: "#9b7bd4",
  },
  truth: {
    id: "truth",
    name: "末日真相",
    icon: "🗝️",
    title: "真相的重量",
    desc: "方舟之钥打开了核战前最后的秘密。原来这场末日并非意外——它是一次精心设计的'清洗'。掌握了真相的你,必须做出选择:公开真相引发混乱,还是带着秘密继续重建?无论如何,世界再也回不去了。",
    color: "#f0a93b",
  },
};

export function endingDef(id) {
  return ENDINGS[id] || null;
}

// 检查并触发结局(返回触发的结局id或null)
export function checkEnding(state) {
  // 科技满级触发
  const techMod = state.tech || {};
  // 防御5级→warlord
  if (techMod.defense >= 5 && !state.prestige?.unlockedEndings?.includes("warlord")) return "warlord";
  // 生产5级→civilization
  if (techMod.production >= 5 && !state.prestige?.unlockedEndings?.includes("civilization")) return "civilization";
  // 生物5级→science
  if (techMod.bio >= 5 && !state.prestige?.unlockedEndings?.includes("science")) return "science";
  return null;
}
