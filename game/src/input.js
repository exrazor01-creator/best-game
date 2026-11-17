// Keyboard and mouse, read every frame. Movement is WASD or arrows; the mouse
// aims and fires; Space dashes; P or Escape pauses; R restarts; M mutes; keys
// 1-3 pick a level-up card. Clicks are reported with their canvas coordinates
// so menus can hit-test buttons and cards.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_CHOICE_1 = 16;
export const ACTION_CHOICE_2 = 32;
export const ACTION_CHOICE_3 = 64;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = null;
  let consumedClick = null;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'enter') actions |= ACTION_CONFIRM;
    if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    if (key === 'r') actions |= ACTION_RESTART;
    if (key === 'm') actions |= ACTION_MUTE;
    if (key === '1') actions |= ACTION_CHOICE_1;
    if (key === '2') actions |= ACTION_CHOICE_2;
    if (key === '3') actions |= ACTION_CHOICE_3;
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function onMouseMove(event) {
    const point = toCanvas(event);
    mouseX = point.x;
    mouseY = point.y;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    mouseDown = true;
    const point = toCanvas(event);
    mouseX = point.x;
    mouseY = point.y;
    clicked = point;
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalized movement vector from the held keys. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const length = Math.hypot(x, y);
        x /= length;
        y /= length;
      }
      return { x, y };
    },
    /** Whether Space is held (dash). */
    dashHeld() {
      return keys.has(' ');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** One-shot actions since the last call; each is reported once. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** One-shot click since the last call, in canvas coordinates; once only. */
    takeClick() {
      if (clicked === null) return null;
      consumedClick = clicked;
      clicked = null;
      return consumedClick;
    },
  };
}
