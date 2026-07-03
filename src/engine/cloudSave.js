// 存档码系统: 纯前端云存档方案(无需后端)
// 导出: 存档JSON → 精简(去运行时数据) → gzip压缩 → Base64 → 存档码字符串
// 导入: 存档码 → Base64解码 → gzip解压 → JSON解析 → 校验 → 写入localStorage
// 玩家复制存档码保存,换设备粘贴即可恢复进度

const CODE_PREFIX = "WS-"; // 存档码前缀(识别用)

// 精简存档: 去掉运行时/可重建的大块数据,减小体积
function slimState(state) {
  const s = state;
  return {
    version: s.version,
    createdAt: s.createdAt,
    time: s.time,
    day: s.day,
    res: { ...s.res },
    resCap: { ...s.resCap },
    base: { level: s.base.level, facilities: s.base.facilities.map(f => ({ id: f.id, type: f.type, level: f.level, assigned: [...(f.assigned||[])] })) },
    survivors: s.survivors.map(sv => ({
      id: sv.id, name: sv.name, profession: sv.profession, profName: sv.profName, profIcon: sv.profIcon,
      perks: [...(sv.perks||[])], level: sv.level, xp: sv.xp, xpNeed: sv.xpNeed,
      skills: { ...sv.skills }, health: sv.health, maxHealth: sv.maxHealth,
      hunger: sv.hunger, mood: sv.mood, assigned: sv.assigned, busy: sv.busy,
    })),
    nextSurvivorId: s.nextSurvivorId,
    radio: { candidate: null, cooldown: s.radio?.cooldown || 0 },
    maps: {
      current: s.maps.current,
      list: Object.fromEntries(Object.entries(s.maps.list).map(([k, m]) => [
        k, { unlocked: m.unlocked, discoveredCount: m.discoveredCount, cells: Array.from(m.cells), pois: m.pois.map(p => ({ ...p })) }
      ])),
    },
    player: { ...s.player },
    expeditions: [],
    nextExpeditionId: s.nextExpeditionId,
    tasks: s.tasks.map(t => ({ ...t })),
    achievements: s.achievements.map(a => ({ ...a })),
    stats: { ...s.stats },
    raid: { ...s.raid },
    caravan: { timer: s.caravan?.timer || 720, here: false, leaveTimer: 0, offers: [] },
    guide: { ...(s.guide||{}) },
  };
}

// Uint8Array → Base64 字符串(分块处理避免栈溢出)
function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Base64 → Uint8Array
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 导出存档码
export async function exportSaveCode(state) {
  const slim = slimState(state);
  const json = JSON.stringify(slim);
  // gzip 压缩(浏览器原生 CompressionStream)
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(new TextEncoder().encode(json));
  writer.close();
  const reader = cs.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const compressed = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let off = 0;
  for (const c of chunks) { compressed.set(c, off); off += c.length; }
  const b64 = bytesToBase64(compressed);
  // 分段(每32字符一段,便于阅读/复制)
  const parts = [];
  for (let i = 0; i < b64.length; i += 32) parts.push(b64.slice(i, i + 32));
  return CODE_PREFIX + parts.join("-");
}

// 导入存档码 → 返回解析后的 state(调用方负责写入localStorage)
export async function importSaveCode(code) {
  if (!code || typeof code !== "string") throw new Error("存档码为空");
  code = code.trim();
  if (!code.startsWith(CODE_PREFIX)) throw new Error("存档码格式错误(缺少前缀)");
  // 去前缀和分隔符
  const b64 = code.slice(CODE_PREFIX.length).replace(/[\s-]/g, "");
  let compressed;
  try {
    compressed = base64ToBytes(b64);
  } catch (e) {
    throw new Error("存档码损坏(解码失败)");
  }
  // gzip 解压
  let json;
  try {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(compressed);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const decompressed = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
    let off = 0;
    for (const c of chunks) { decompressed.set(c, off); off += c.length; }
    json = new TextDecoder().decode(decompressed);
  } catch (e) {
    throw new Error("存档码损坏(解压失败)");
  }
  let state;
  try {
    state = JSON.parse(json);
  } catch (e) {
    throw new Error("存档码损坏(数据格式错误)");
  }
  if (!state || !state.version || !state.res) throw new Error("存档码数据不完整");
  return state;
}

// 工具: 校验存档码格式(不解析,只看前缀)
export function isSaveCode(str) {
  return typeof str === "string" && str.trim().startsWith(CODE_PREFIX);
}
