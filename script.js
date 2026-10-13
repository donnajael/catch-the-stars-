"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const $ = id => document.getElementById(id);
const ui = { score: $("score"), best: $("best"), time: $("time"), lives: $("lives"), level: $("level"), overlay: $("overlay"), overlayIcon: $("overlayIcon"), overlayTitle: $("overlayTitle"), overlayText: $("overlayText"), mainButton: $("mainButton"), pause: $("pauseButton"), status: $("status") };

let best = 0;
try { best = Number(localStorage.getItem("catchTheStarsBest") || 0) || 0; } catch (_) { /* storage may be blocked */ }
const basket = { x: W / 2 - 48, y: H - 61, w: 96, h: 29, speed: 410 };
let state = "ready";
let score = 0;
let lives = 3;
let remaining = 60;
let elapsed = 0;
let spawnClock = 0;
let objects = [];
let particles = [];
let lastFrame = 0;
let raf = 0;
const keys = { left: false, right: false };
let pointerX = null;
const backgroundStars = Array.from({ length: 64 }, (_, i) => ({ x: (i * 137.5 + 19) % W, y: (i * 83.7 + 31) % H, r: .6 + (i % 4) * .4, phase: i * .6 }));

function level() { return Math.min(3, 1 + Math.floor(elapsed / 20)); }
function updateUI() {
  ui.score.textContent = score;
  ui.best.textContent = best;
  ui.time.textContent = `${Math.ceil(remaining)}s`;
  ui.lives.textContent = "♥ ".repeat(lives).trim() || "—";
  ui.level.textContent = level();
}
function showOverlay(icon, title, message, buttonText) {
  ui.overlayIcon.textContent = icon;
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = message;
  ui.mainButton.textContent = buttonText;
  ui.overlay.classList.remove("hidden");
}
function hideOverlay() { ui.overlay.classList.add("hidden"); }
function resetGame() {
  score = 0; lives = 3; remaining = 60; elapsed = 0; spawnClock = 0;
  objects = []; particles = []; basket.x = W / 2 - basket.w / 2;
  pointerX = null; keys.left = false; keys.right = false;
  updateUI();
}
function startGame() {
  resetGame(); state = "playing"; hideOverlay(); ui.pause.disabled = false;
  ui.pause.textContent = "Pause"; ui.status.textContent = "Catch the stars!";
  lastFrame = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function pauseGame() {
  if (state === "playing") {
    state = "paused"; ui.pause.textContent = "Resume";
    ui.status.textContent = "Game paused.";
    showOverlay("⏸", "Taking a break?", "Your stars are waiting for you.", "Resume game");
    cancelAnimationFrame(raf);
  } else if (state === "paused") {
    state = "playing"; ui.pause.textContent = "Pause"; hideOverlay();
    ui.status.textContent = "Catch the stars!";
    lastFrame = performance.now(); raf = requestAnimationFrame(loop);
  }
}
function endGame() {
  state = "over"; ui.pause.disabled = true; ui.status.textContent = "Game finished.";
  if (score > best) {
    best = score;
    try { localStorage.setItem("catchTheStarsBest", String(best)); } catch (_) { /* optional storage */ }
  }
  updateUI();
  showOverlay(score >= 200 ? "🏆" : "🌙", "Game over!", `You scored ${score} points! Your personal best is ${best}. Want another try?`, "Play again ✨");
}
function spawn() {
  const roll = Math.random();
  const kind = roll < .17 ? "bomb" : roll < .31 ? "gem" : "star";
  const r = kind === "bomb" ? 17 : kind === "gem" ? 15 : 16;
  objects.push({ x: 25 + Math.random() * (W - 50), y: -25, r, kind, vy: (115 + Math.random() * 70) * (1 + .33 * (level() - 1)), rotation: Math.random() * 6.28 });
}
function sparkle(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, s = 55 + Math.random() * 120;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .45, color });
  }
}
function update(dt) {
  remaining = Math.max(0, remaining - dt);
  elapsed += dt;
  if (pointerX !== null) basket.x = pointerX - basket.w / 2;
  else basket.x += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * basket.speed * dt;
  basket.x = Math.max(0, Math.min(W - basket.w, basket.x));
  spawnClock += dt;
  const interval = .72 - (level() - 1) * .14;
  while (spawnClock >= interval) { spawn(); spawnClock -= interval; }
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]; obj.y += obj.vy * dt; obj.rotation += dt * 2;
    const overlaps = obj.x + obj.r > basket.x && obj.x - obj.r < basket.x + basket.w && obj.y + obj.r > basket.y && obj.y - obj.r < basket.y + basket.h;
    if (overlaps) {
      if (obj.kind === "bomb") { lives--; sparkle(obj.x, obj.y, "#ff789d"); ui.status.textContent = "Ouch! Avoid the bombs!"; }
      else { score += obj.kind === "gem" ? 25 : 10; sparkle(obj.x, obj.y, obj.kind === "gem" ? "#ff9edc" : "#ffe58b"); ui.status.textContent = obj.kind === "gem" ? "Bonus gem! +25" : "Nice catch! +10"; }
      objects.splice(i, 1);
    } else if (obj.y - obj.r > H) objects.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  updateUI();
  if (lives <= 0 || remaining <= 0) endGame();
}
function starPath(x, y, outer, inner, points = 5, angle = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = angle + i * Math.PI / points;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function render() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#221747"); sky.addColorStop(.65, "#3a2464"); sky.addColorStop(1, "#704075");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (const s of backgroundStars) {
    ctx.globalAlpha = .35 + .45 * (1 + Math.sin(elapsed * 2 + s.phase)) / 2;
    ctx.fillStyle = "#fff2d9"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff3c6"; ctx.beginPath(); ctx.arc(W - 86, 72, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#221747"; ctx.beginPath(); ctx.arc(W - 73, 61, 29, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#b17fbe55";
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(80 + i * 165, H - 4, 120, 37 + i % 2 * 14, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const obj of objects) {
    ctx.save(); ctx.translate(obj.x, obj.y); ctx.rotate(obj.rotation);
    if (obj.kind === "star") {
      ctx.shadowColor = "#ffe48b"; ctx.shadowBlur = 16;
      starPath(0, 0, obj.r, obj.r * .46); ctx.fillStyle = "#ffde78"; ctx.fill();
    } else if (obj.kind === "gem") {
      ctx.shadowColor = "#ff9de6"; ctx.shadowBlur = 14;
      starPath(0, 0, obj.r, obj.r * .48, 4); ctx.fillStyle = "#ff91d4"; ctx.fill();
    } else {
      ctx.fillStyle = "#171329"; ctx.beginPath(); ctx.arc(0, 0, obj.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff7d8e"; ctx.fillRect(-5, -4, 3, 3); ctx.fillRect(5, -4, 3, 3);
      ctx.strokeStyle = "#ffc36b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(12, -22); ctx.stroke();
    }
    ctx.restore();
  }
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .45); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // Basket: rim, body, and decorative band.
  ctx.fillStyle = "#efb4e8"; ctx.beginPath(); ctx.moveTo(basket.x + 9, basket.y + 5); ctx.lineTo(basket.x + basket.w - 9, basket.y + 5); ctx.lineTo(basket.x + basket.w - 20, basket.y + basket.h); ctx.lineTo(basket.x + 20, basket.y + basket.h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffdcf3"; ctx.fillRect(basket.x, basket.y, basket.w, 10);
  ctx.fillStyle = "#bd77b6"; ctx.fillRect(basket.x + 22, basket.y + 16, basket.w - 44, 5);
  ctx.fillStyle = "#fff3c6"; starPath(basket.x + basket.w / 2, basket.y + 17, 6, 2.5); ctx.fill();
}
function loop(now) {
  if (state !== "playing") return;
  const dt = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
  update(dt); render();
  if (state === "playing") raf = requestAnimationFrame(loop);
}
function setDirection(direction, pressed) { keys[direction] = pressed; if (pressed) pointerX = null; }
document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  if (["arrowleft", "arrowright", " ", "a", "d"].includes(key)) e.preventDefault();
  if (key === "arrowleft" || key === "a") setDirection("left", true);
  if (key === "arrowright" || key === "d") setDirection("right", true);
  if (key === " " && !e.repeat) pauseGame();
});
document.addEventListener("keyup", e => {
  const key = e.key.toLowerCase();
  if (key === "arrowleft" || key === "a") setDirection("left", false);
  if (key === "arrowright" || key === "d") setDirection("right", false);
});
window.addEventListener("blur", () => { keys.left = false; keys.right = false; if (state === "playing") pauseGame(); });
function movePointer(e) { const r = canvas.getBoundingClientRect(); pointerX = (e.clientX - r.left) * W / r.width; }
canvas.addEventListener("pointerdown", e => { if (state === "playing") { movePointer(e); canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener("pointermove", e => { if (state === "playing" && e.buttons) movePointer(e); });
function attachHold(buttonId, direction) {
  const button = $(buttonId);
  button.addEventListener("pointerdown", e => { e.preventDefault(); button.setPointerCapture(e.pointerId); setDirection(direction, true); });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(event, () => setDirection(direction, false));
}
attachHold("leftButton", "left"); attachHold("rightButton", "right");
ui.mainButton.addEventListener("click", () => state === "paused" ? pauseGame() : startGame());
ui.pause.addEventListener("click", pauseGame);
$("restartButton").addEventListener("click", startGame);
updateUI(); render();
