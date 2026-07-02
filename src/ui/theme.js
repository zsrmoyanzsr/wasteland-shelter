// 扁平极简风配色 / 尺寸常量
// 全部画面在单 canvas 上程序化绘制,这里集中管理视觉常量

export const THEME = {
  // 背景与面板(深色系,高对比)
  bg: "#11131a",
  bgGradTop: "#161922",
  bgGradBot: "#0e1016",
  panel: "#1f232e",
  panelAlt: "#262b38",
  panelHi: "#2e3442",
  panelLine: "#3a4150",

  // 文字
  text: "#e8eaf0",
  textDim: "#9aa1b0",
  textMute: "#6b7280",

  // 强调色(扁平)
  primary: "#4caf87", // 主绿(建造/确认)
  primaryDark: "#3a8d6c",
  accent: "#f0a93b", // 橙(资源/奖励)
  danger: "#e0584e", // 红(危险/不足)
  info: "#5b9bd5", // 蓝(任务/派遣)
  purple: "#9b7bd4",

  // 资源色
  food: "#7cc36b",
  water: "#5b9bd5",
  parts: "#c9a86a",
  power: "#e0c14a",
  meds: "#e0588e",

  // 圆角与间距
  radius: 12,
  radiusSm: 8,
  radiusLg: 16,
  gap: 10,
  gapSm: 6,
  gapLg: 16,

  // 字号
  fontXs: 11,
  fontSm: 13,
  fontMd: 15,
  fontLg: 18,
  fontXl: 24,
  fontXxl: 34,

  // 字体
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
};

// 资源元数据: key -> { icon, label, color, desc }
export const RESOURCES = {
  food: { icon: "🍖", label: "食物", color: THEME.food, desc: "幸存者每日消耗" },
  water: { icon: "💧", label: "净水", color: THEME.water, desc: "幸存者每日消耗" },
  parts: { icon: "⚙️", label: "零件", color: THEME.parts, desc: "建造与升级" },
  power: { icon: "⚡", label: "电力", color: THEME.power, desc: "高级设施运转" },
  meds: { icon: "💊", label: "药品", color: THEME.meds, desc: "治疗伤员" },
  scrap: { icon: "🔩", label: "废铁", color: "#9aa1b0", desc: "基础建材" },
};

// 资源显示顺序(顶部资源条)
export const RESOURCE_ORDER = ["food", "water", "power", "parts", "scrap", "meds"];
