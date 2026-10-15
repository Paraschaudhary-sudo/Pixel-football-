"use strict";

// ==========================================
// PIXEL FOOTBALL — GAME ENGINE
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = (id) => document.getElementById(id);

const ui = {
  playerScore: $("playerScore"),
  enemyScore: $("enemyScore"),
  timer: $("timer"),
  overlay: $("menuOverlay"),
  overlayTitle: $("overlayTitle"),
  overlayText: $("overlayText"),
  startBtn: $("startBtn"),
  pauseBtn: $("pauseBtn"),
  restartBtn: $("restartBtn"),
  status: $("statusText"),
  goalFlash: $("goalFlash"),
  joystick: $("joystick"),
  joystickKnob: $("joystickKnob"),
  kickBtn: $("kickBtn"),
  sprintBtn: $("sprintBtn")
};

const W = canvas.width;
const H = canvas.height;

const field = {
  left: 42,
  right: W - 42,
  top: 40,
  bottom: H - 40
};

const centerX = W / 2;
const centerY = H / 2;
const goalHalf = 78;

let playerScore = 0;
let enemyScore = 0;
let timeLeft = 90;

let gameState = "menu";
let lastTime = 0;
let elapsed = 0;
let goalPause = 0;
let kickCooldown = 0;
let flashTimeout = null;
let lastScorer = "";

const keys = new Set();

const input = {
  x: 0,
  y: 0,
  sprint: false
};

function makePlayer(x, y, color, outline, facing) {
  return {
    x, y,
    vx: 0,
    vy: 0,
    radius: 17,
    color,
    outline,
    facing,
    speed: 205,
    sprintSpeed: 285
  };
}

const player = makePlayer(
  W * 0.28, centerY, "#49a7ff", "#d8efff", 1
);

const enemy = makePlayer(
  W * 0.72, centerY, "#ff626c", "#ffe0e0", -1
);

const ball = {
  x: centerX,
  y: centerY,
  vx: 0,
  vy: 0,
  radius: 10,
  spin: 0
};

// ==========================================
// RESET AND UI
// ==========================================

function resetPositions() {
  player.x = W * 0.28;
  player.y = centerY;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;

  enemy.x = W * 0.72;
  enemy.y = centerY;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.facing = -1;

  ball.x = centerX;
  ball.y = centerY;
  ball.vx = 0;
  ball.vy = 0;
  ball.spin = 0;

  goalPause = 0;
  kickCooldown = 0;
}

function updateScoreboard() {
  ui.playerScore.textContent = playerScore;
  ui.enemyScore.textContent = enemyScore;

  const seconds = Math.max(0, Math.ceil(timeLeft));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  ui.timer.textContent =
    String(minutes).padStart(2, "0") + ":" +
    String(remainder).padStart(2, "0");
}

function showOverlay(title, text, buttonText) {
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.startBtn.textContent = buttonText;
  ui.overlay.classList.remove("hidden");
}

function hideOverlay() {
  ui.overlay.classList.add("hidden");
}

function startMatch() {
  playerScore = 0;
  enemyScore = 0;
  timeLeft = 90;
  elapsed = 0;

  resetPositions();
  updateScoreboard();

  gameState = "playing";
  ui.status.textContent = "MATCH IN PROGRESS";
  ui.pauseBtn.disabled = false;
  ui.pauseBtn.textContent = "Ⅱ PAUSE";

  hideOverlay();
}

function pauseMatch() {
  if (gameState === "playing") {
    gameState = "paused";
    ui.status.textContent = "MATCH PAUSED";
    ui.pauseBtn.textContent = "▶ RESUME";

    showOverlay(
      "TIME OUT!",
      "Take a breather. Your score is saved until you resume.",
      "▶ RESUME MATCH"
    );
  } else if (gameState === "paused") {
    gameState = "playing";
    ui.status.textContent = "MATCH IN PROGRESS";
    ui.pauseBtn.textContent = "Ⅱ PAUSE";
    hideOverlay();
  }
}

function finishMatch() {
  gameState = "finished";
  ui.pauseBtn.disabled = true;
  ui.pauseBtn.textContent = "Ⅱ PAUSE";
  ui.status.textContent = "FULL TIME";

  let title = "IT'S A DRAW!";
  let message = `Final score: ${playerScore} - ${enemyScore}.`;

  if (playerScore > enemyScore) {
    title = "YOU WIN!";
    message = `What a match! You won ${playerScore} - ${enemyScore}.`;
  } else if (enemyScore > playerScore) {
    title = "CPU WINS!";
    message = `Final score: ${playerScore} - ${enemyScore}. Give it another go!`;
  }

  showOverlay(title, message, "↻ PLAY AGAIN");
}

function restartMatch() {
  startMatch();
}

ui.startBtn.addEventListener("click", () => {
  if (gameState === "paused") {
    pauseMatch();
  } else {
    startMatch();
  }
});

ui.pauseBtn.addEventListener("click", pauseMatch);
ui.restartBtn.addEventListener("click", restartMatch);

// ==========================================
// KEYBOARD CONTROLS
// ==========================================

const handledKeys = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  " ", "Shift", "w", "a", "s", "d", "W", "A", "S", "D"
]);

window.addEventListener("keydown", (event) => {
  if (handledKeys.has(event.key)) {
    event.preventDefault();
  }

  keys.add(event.key.toLowerCase());

  if (event.repeat) return;

  if (event.key.toLowerCase() === "p" ||
      event.key === "Escape") {
    if (gameState === "playing" || gameState === "paused") {
      pauseMatch();
    }
  }

  if (event.code === "Space" && gameState === "playing") {
    kickBall(player, true);
  }

  if (event.key === "Enter" &&
      (gameState === "menu" || gameState === "finished")) {
    startMatch();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  input.x = 0;
  input.y = 0;
  input.sprint = false;

  if (gameState === "playing") {
    pauseMatch();
  }
});

function readKeyboard() {
  let x = 0;
  let y = 0;

  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown")) y += 1;

  return {
    x: x + input.x,
    y: y + input.y,
    sprint: keys.has("shift") || input.sprint
  };
}

// ==========================================
// MOBILE JOYSTICK
// ==========================================

let joystickPointer = null;

function updateJoystick(event) {
  const rect = ui.joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  let dx = event.clientX - cx;
  let dy = event.clientY - cy;

  const maxDistance = rect.width * 0.32;
  const distance = Math.hypot(dx, dy);

  if (distance > maxDistance) {
    dx = dx / distance * maxDistance;
    dy = dy / distance * maxDistance;
  }

  input.x = dx / maxDistance;
  input.y = dy / maxDistance;

  ui.joystickKnob.style.left =
    `calc(50% + ${dx}px)`;
  ui.joystickKnob.style.top =
    `calc(50% + ${dy}px)`;
}

function resetJoystick() {
  joystickPointer = null;
  input.x = 0;
  input.y = 0;
  ui.joystickKnob.style.left = "50%";
  ui.joystickKnob.style.top = "50%";
}

ui.joystick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  joystickPointer = event.pointerId;
  ui.joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});

ui.joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickPointer) {
    event.preventDefault();
    updateJoystick(event);
  }
});

ui.joystick.addEventListener("pointerup", (event) => {
  if (event.pointerId === joystickPointer) resetJoystick();
});

ui.joystick.addEventListener("pointercancel", resetJoystick);

ui.sprintBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  input.sprint = true;
});

function releaseSprint() {
  input.sprint = false;
}

ui.sprintBtn.addEventListener("pointerup", releaseSprint);
ui.sprintBtn.addEventListener("pointercancel", releaseSprint);
ui.sprintBtn.addEventListener("lostpointercapture", releaseSprint);

ui.kickBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();

  if (gameState === "playing") {
    kickBall(player, true);
  }
});

// ==========================================
// PLAYER MOVEMENT AND COLLISIONS
// ==========================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function movePlayer(actor, dx, dy, sprint, dt) {
  const magnitude = Math.hypot(dx, dy);

  if (magnitude > 1) {
    dx /= magnitude;
    dy /= magnitude;
  }

  const speed = sprint ? actor.sprintSpeed : actor.speed;

  actor.vx = dx * speed;
  actor.vy = dy * speed;

  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;

  actor.x = clamp(
    actor.x,
    field.left + actor.radius,
    field.right - actor.radius
  );

  actor.y = clamp(
    actor.y,
    field.top + actor.radius,
    field.bottom - actor.radius
  );

  if (Math.abs(dx) > 0.05) {
    actor.facing = dx > 0 ? 1 : -1;
  }
}

function playerBallCollision(actor) {
  let dx = ball.x - actor.x;
  let dy = ball.y - actor.y;
  let distance = Math.hypot(dx, dy);
  const minDistance = actor.radius + ball.radius;

  if (distance >= minDistance) return;

  if (distance === 0) {
    dx = actor.facing;
    dy = 0;
    distance = 1;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;

  ball.x += nx * overlap;
  ball.y += ny * overlap;

  // A gentle touch moves the ball with the player.
  ball.vx += actor.vx * 0.12 + nx * 25;
  ball.vy += actor.vy * 0.12 + ny * 25;

  // Limit speed so the ball remains controllable.
  limitBallSpeed(420);
}

function separatePlayers() {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const distance = Math.hypot(dx, dy);
  const minimum = player.radius + enemy.radius;

  if (distance === 0 || distance >= minimum) return;

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = (minimum - distance) / 2;

  player.x -= nx * overlap;
  player.y -= ny * overlap;
  enemy.x += nx * overlap;
  enemy.y += ny * overlap;
}

// ==========================================
// BALL PHYSICS AND KICKING
// ==========================================

function limitBallSpeed(maxSpeed) {
  const speed = Math.hypot(ball.vx, ball.vy);

  if (speed > maxSpeed) {
    ball.vx = ball.vx / speed * maxSpeed;
    ball.vy = ball.vy / speed * maxSpeed;
  }
}

function kickBall(actor, isHuman) {
  if (gameState !== "playing" ||
      kickCooldown > 0 ||
      goalPause > 0) {
    return;
  }

  const dx = ball.x - actor.x;
  const dy = ball.y - actor.y;
  const distance = Math.hypot(dx, dy);

  // Kicks work when the ball is within reach.
  if (distance > actor.radius + ball.radius + 30) return;

  let nx;
  let ny;

  if (distance > 1) {
    nx = dx / distance;
    ny = dy / distance;
  } else {
    nx = actor.facing;
    ny = 0;
  }

  // Player aims toward the right goal.
  // CPU aims toward the left goal.
  const attackDirection = isHuman ? 1 : -1;

  nx = nx * 0.45 + attackDirection * 0.9;
  ny = ny * 0.45 + (centerY - ball.y) * 0.0007;

  const aimLength = Math.hypot(nx, ny) || 1;
  nx /= aimLength;
  ny /= aimLength;

  const power = isHuman ? 350 : 300;

  ball.vx = nx * power;
  ball.vy = ny * power;

  ball.x += nx * 5;
  ball.y += ny * 5;

  kickCooldown = isHuman ? 0.24 : 0.65;
}

function updateBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Friction slows the ball gradually.
  const friction = Math.pow(0.985, dt * 60);
  ball.vx *= friction;
  ball.vy *= friction;

  if (Math.abs(ball.vx) < 2) ball.vx = 0;
  if (Math.abs(ball.vy) < 2) ball.vy = 0;

  ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.02;

  // Bounce off the top and bottom touchlines.
  if (ball.y - ball.radius < field.top) {
    ball.y = field.top + ball.radius;
    ball.vy = Math.abs(ball.vy) * 0.78;
  }

  if (ball.y + ball.radius > field.bottom) {
    ball.y = field.bottom - ball.radius;
    ball.vy = -Math.abs(ball.vy) * 0.78;
  }

  checkGoal();
}

// ==========================================
// CPU OPPONENT AI
// ==========================================

function updateEnemy(dt) {
  const dx = ball.x - enemy.x;
  const dy = ball.y - enemy.y;
  const distance = Math.hypot(dx, dy);

  // The CPU approaches the ball and attempts to kick it.
  if (distance > enemy.radius + ball.radius + 14) {
    const moveX = dx / (distance || 1);
    const moveY = dy / (distance || 1);

    movePlayer(enemy, moveX, moveY, false, dt);
  } else {
    enemy.vx *= 0.8;
    enemy.vy *= 0.8;
    kickBall(enemy, false);
  }

  playerBallCollision(enemy);
}

// ==========================================
// GOALS AND FULL TIME
// ==========================================

function showGoalMessage(message) {
  ui.goalFlash.textContent = message;
  ui.goalFlash.classList.add("show");

  if (flashTimeout) clearTimeout(flashTimeout);

  flashTimeout = setTimeout(() => {
    ui.goalFlash.classList.remove("show");
    flashTimeout = null;
  }, 1100);
}

function checkGoal() {
  const insideGoalMouth =
    ball.y > centerY - goalHalf &&
    ball.y < centerY + goalHalf;

  if (!insideGoalMouth) {
    // Prevent the ball from escaping the pitch outside the goal.
    if (ball.x < field.left + ball.radius) {
      ball.x = field.left + ball.radius;
      ball.vx = Math.abs(ball.vx) * 0.75;
    }

    if (ball.x > field.right - ball.radius) {
      ball.x = field.right - ball.radius;
      ball.vx = -Math.abs(ball.vx) * 0.75;
    }

    return;
  }

  if (ball.x < field.left - ball.radius) {
    enemyScore++;
    lastScorer = "CPU SCORES!";
    registerGoal();
  } else if (ball.x > field.right + ball.radius) {
    playerScore++;
    lastScorer = "GOAL!!!";
    registerGoal();
  }
}

function registerGoal() {
  updateScoreboard();
  showGoalMessage(lastScorer);

  resetPositions();
  goalPause = 1.0;
  ui.status.textContent = lastScorer;
}

// ==========================================
// PIXEL-STYLE FIELD DRAWING
// ==========================================

function drawField() {
  ctx.fillStyle = "#28683c";
  ctx.fillRect(0, 0, W, H);

  // Alternating grass stripes.
  const stripeCount = 10;
  const stripeWidth = (field.right - field.left) / stripeCount;

  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#307745" : "#28683c";
    ctx.fillRect(
      field.left + i * stripeWidth,
      field.top,
      stripeWidth,
      field.bottom - field.top
    );
  }

  // Outer pitch lines.
  ctx.strokeStyle = "#d9f1d5";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    field.left, field.top,
    field.right - field.left,
    field.bottom - field.top
  );

  // Halfway line.
  ctx.beginPath();
  ctx.moveTo(centerX, field.top);
  ctx.lineTo(centerX, field.bottom);
  ctx.stroke();

  // Centre circle.
  ctx.beginPath();
  ctx.arc(centerX, centerY, 75, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#d9f1d5";
  ctx.fillRect(centerX - 3, centerY - 3, 6, 6);

  // Penalty boxes.
  const boxWidth = 125;
  const boxHeight = 250;

  ctx.strokeRect(
    field.left,
    centerY - boxHeight / 2,
    boxWidth,
    boxHeight
  );

  ctx.strokeRect(
    field.right - boxWidth,
    centerY - boxHeight / 2,
    boxWidth,
    boxHeight
  );

  // Goal areas.
  ctx.strokeRect(
    field.left,
    centerY - 110,
    52,
    220
  );

  ctx.strokeRect(
    field.right - 52,
    centerY - 110,
    52,
    220
  );

  // Goals behind each end line.
  ctx.fillStyle = "#e7f1df";
  ctx.fillRect(
    field.left - 12,
    centerY - goalHalf,
    12,
    goalHalf * 2
  );

  ctx.fillRect(
    field.right,
    centerY - goalHalf,
    12,
    goalHalf * 2
  );

  // Small pixel-like goal net pattern.
  ctx.strokeStyle = "#a9c3a0";
  ctx.lineWidth = 1;

  for (let y = centerY - goalHalf + 10;
       y < centerY + goalHalf; y += 15) {
    ctx.beginPath();
    ctx.moveTo(field.left - 11, y);
    ctx.lineTo(field.left - 1, y);
    ctx.moveTo(field.right + 1, y);
    ctx.lineTo(field.right + 11, y);
    ctx.stroke();
  }

  // Corner markers.
  ctx.fillStyle = "#e8f4e1";

  for (const x of [field.left, field.right]) {
    for (const y of [field.top, field.bottom]) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}

// ==========================================
// PIXEL PLAYERS AND BALL
// ==========================================

function drawPlayer(actor, label) {
  const x = Math.round(actor.x);
  const y = Math.round(actor.y);

  // Shadow.
  ctx.fillStyle = "#10281675";
  ctx.fillRect(x - 15, y + 12, 30, 7);

  // Boots.
  ctx.fillStyle = "#172018";
  ctx.fillRect(x - 12, y + 8, 9, 10);
  ctx.fillRect(x + 3, y + 8, 9, 10);

  // Body.
  ctx.fillStyle = actor.color;
  ctx.fillRect(x - 14, y - 12, 28, 23);

  // Shirt detail.
  ctx.fillStyle = actor.outline;
  ctx.fillRect(x - 3, y - 11, 6, 19);
  ctx.fillRect(x - 13, y - 7, 4, 10);
  ctx.fillRect(x + 9, y - 7, 4, 10);

  // Head.
  ctx.fillStyle = "#f1c79b";
  ctx.fillRect(x - 8, y - 23, 16, 13);

  // Hair.
  ctx.fillStyle = "#33271e";
  ctx.fillRect(x - 9, y - 25, 18, 5);
  ctx.fillRect(x - 9, y - 21, 4, 4);

  // Face direction.
  ctx.fillStyle = "#20251e";
  const eyeX = actor.facing > 0 ? x + 3 : x - 6;
  ctx.fillRect(eyeX, y - 19, 3, 3);

  // Player marker.
  if (actor === player) {
    ctx.fillStyle = "#c8ff54";
    ctx.fillRect(x - 3, y - 34, 6, 4);
    ctx.fillRect(x - 1, y - 30, 2, 3);
  }

  // Name label.
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#102016";
  ctx.fillText(label, x + 1, y - 39 + 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x, y - 39);
}

function drawBall() {
  const x = Math.round(ball.x);
  const y = Math.round(ball.y);

  // Shadow.
  ctx.fillStyle = "#122b1970";
  ctx.fillRect(x - 8, y + 7, 16, 5);

  // Ball base.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 9, y - 9, 18, 18);

  // Pixel panels.
  ctx.fillStyle = "#1d2820";
  ctx.fillRect(x - 3, y - 5, 6, 6);
  ctx.fillRect(x - 7, y + 3, 4, 3);
  ctx.fillRect(x + 4, y - 7, 3, 4);
  ctx.fillRect(x + 3, y + 5, 4, 3);

  ctx.fillStyle = "#dce5d8";
  ctx.fillRect(x - 6, y - 7, 3, 2);
}

// ==========================================
// UPDATE LOOP
// ==========================================

function update(dt) {
  if (gameState !== "playing") return;

  elapsed += dt;
  kickCooldown = Math.max(0, kickCooldown - dt);

  if (goalPause > 0) {
    goalPause -= dt;

    if (goalPause <= 0) {
      ui.status.textContent = "MATCH IN PROGRESS";
    }

    return;
  }

  timeLeft -= dt;

  if (timeLeft <= 0) {
    timeLeft = 0;
    updateScoreboard();
    finishMatch();
    return;
  }

  const controls = readKeyboard();

  movePlayer(
    player,
    controls.x,
    controls.y,
    controls.sprint,
    dt
  );

  updateEnemy(dt);

  separatePlayers();

  playerBallCollision(player);
  playerBallCollision(enemy);

  updateBall(dt);
  updateScoreboard();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawField();
  drawPlayer(player, "YOU");
  drawPlayer(enemy, "CPU");
  drawBall();
}

function loop(timestamp) {
  const dt = Math.min(
    (timestamp - lastTime) / 1000 || 0,
    0.033
  );

  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// ==========================================
// STARTUP
// ==========================================

resetPositions();
updateScoreboard();
draw();

requestAnimationFrame(loop);
