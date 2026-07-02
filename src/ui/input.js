// 输入处理: 鼠标 / 触摸 / 键盘 → canvas 坐标
// 维护一个 pointer 状态 {x,y,down,pressed,justReleased}
// pressed 为单帧消费的"点击"信号,UI 按钮读取后每帧末重置

export function createInput(canvas) {
  const pointer = {
    x: -1,
    y: -1,
    down: false, // 当前是否按住
    pressed: false, // 本帧是否"按下"事件(点击触发)
    justReleased: false,
    dragX: 0,
    dragY: 0,
    downX: 0,
    downY: 0,
  };
  const keys = new Set(); // 当前按住的键码
  const keysPressed = new Set(); // 本帧按下的键(单次)
  let wheelDelta = 0; // 本帧滚轮累计(向下正,向上负)

  function toLocal(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    // 逻辑尺寸(绘制坐标系)存于 dataset,与 dpr 解耦
    // 逻辑坐标 = CSS偏移 × (逻辑宽 / CSS宽)
    const lw = parseFloat(canvas.dataset.logicW) || rect.width;
    const lh = parseFloat(canvas.dataset.logicH) || rect.height;
    return {
      x: (clientX - rect.left) * (lw / rect.width),
      y: (clientY - rect.top) * (lh / rect.height),
    };
  }

  function onDown(e) {
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const p = toLocal(t.clientX, t.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.down = true;
    pointer.pressed = true;
    pointer.downX = p.x;
    pointer.downY = p.y;
    pointer.dragX = p.x;
    pointer.dragY = p.y;
  }

  function onMove(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    const p = toLocal(t.clientX, t.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
    if (pointer.down) {
      pointer.dragX = p.x;
      pointer.dragY = p.y;
    }
  }

  function onUp(e) {
    pointer.down = false;
    pointer.justReleased = true;
  }

  function onKeyDown(e) {
    // 阻止默认滚动行为(方向键/space)
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key)) {
      e.preventDefault();
    }
    const code = e.code;
    if (!keys.has(code)) keysPressed.add(code);
    keys.add(code);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onWheel(e) {
    // 仅在 canvas 上时累积滚轮
    wheelDelta += e.deltaY;
  }

  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  canvas.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp, { passive: false });
  window.addEventListener("touchcancel", onUp, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("wheel", onWheel, { passive: true });

  return {
    pointer,
    keys,
    keysPressed,
    // 消费并返回本帧滚轮增量(调用后清零)
    consumeWheel() {
      const d = wheelDelta;
      wheelDelta = 0;
      return d;
    },
    // 每帧末调用: 重置单帧信号
    endFrame() {
      pointer.pressed = false;
      pointer.justReleased = false;
      keysPressed.clear();
      wheelDelta = 0;
    },
    destroy() {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("wheel", onWheel);
    },
  };
}
