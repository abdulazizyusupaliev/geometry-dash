const API_BASE = "";
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const apiStatus = document.getElementById("apiStatus");
const levelSummary = document.getElementById("levelSummary");
const scoreList = document.getElementById("scoreList");
const attemptValue = document.getElementById("attemptValue");
const progressValue = document.getElementById("progressValue");
const orbValue = document.getElementById("orbValue");
const bestValue = document.getElementById("bestValue");
const progressBar = document.getElementById("progressBar");

const FLOOR_Y = 602;
const PLAYER_SIZE = 54;
const GRAVITY = 1800;
const JUMP_FORCE = 700;
const CAMERA_LEAD = 280;

const state = {
  level: null,
  scoreBoard: [],
  status: "loading",
  attempt: 0,
  progress: 0,
  bestProgress: 0,
  playerName: "Player-1",
  cameraX: 0,
  elapsedMs: 0,
  lastTimestamp: 0,
  orbsCollected: new Set(),
  particles: [],
  deathFlash: 0,
  player: {
    x: 140,
    y: FLOOR_Y - PLAYER_SIZE,
    vy: 0,
    rotation: 0,
    grounded: true
  }
};

function updateOverlay(title, text, visible = true) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.toggle("hidden", !visible);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${path}`);
  }

  return response.json();
}

async function bootstrap() {
  try {
    const [health, levelPayload, scorePayload] = await Promise.all([
      request("/api/health"),
      request("/api/level"),
      request("/api/scores")
    ]);

    apiStatus.textContent = `${health.status} | ${health.engine}`;
    state.level = levelPayload.level;
    state.scoreBoard = scorePayload.scores;
    levelSummary.textContent = `${state.level.name}: ${state.level.palette.join(" / ")} with ${state.level.segments.length} obstacle clusters and ${state.level.collectibles.length} pulse orbs.`;
    renderScores();
    updateOverlay("Tap Space To Begin", "The level is loaded from the Python API. Start the run and clear Neon Circuit in one shot.");
    state.status = "ready";
    resetRun(false);
    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error(error);
    apiStatus.textContent = "Backend unavailable";
    updateOverlay("Backend Required", "Start the Python API first. The game waits for /api/level and /api/scores before running.");
  }
}

function resetPlayer() {
  state.player.x = 140;
  state.player.y = FLOOR_Y - PLAYER_SIZE;
  state.player.vy = 0;
  state.player.rotation = 0;
  state.player.grounded = true;
  state.cameraX = 0;
  state.elapsedMs = 0;
  state.progress = 0;
  state.orbsCollected = new Set();
  state.particles = [];
  state.deathFlash = 0;
  orbValue.textContent = "0";
  progressValue.textContent = "0%";
  progressBar.style.width = "0%";
}

function resetRun(countAttempt = true) {
  if (!state.level) {
    return;
  }

  if (countAttempt) {
    state.attempt += 1;
  }

  attemptValue.textContent = String(state.attempt);
  resetPlayer();
  state.status = "ready";
}

function spawnParticles(x, y, color, count) {
  for (let index = 0; index < count; index += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 360,
      vy: -Math.random() * 260 - 80,
      size: Math.random() * 6 + 3,
      life: Math.random() * 0.55 + 0.35,
      color
    });
  }
}

function beginRun() {
  if (!state.level) {
    return;
  }

  if (state.status === "ready") {
    state.status = "playing";
    updateOverlay("", "", false);
  } else if (state.status === "complete" || state.status === "dead") {
    resetRun(true);
    state.status = "playing";
    updateOverlay("", "", false);
  }
}

function jump() {
  if (state.status === "ready") {
    beginRun();
  }

  if (state.status !== "playing") {
    return;
  }

  if (state.player.grounded) {
    state.player.vy = -JUMP_FORCE;
    state.player.grounded = false;
    spawnParticles(state.player.x + PLAYER_SIZE / 2, state.player.y + PLAYER_SIZE, "#71f6ff", 9);
  }
}

function playerRect() {
  return {
    x: state.player.x,
    y: state.player.y,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE
  };
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function update(dt) {
  if (!state.level) {
    return;
  }

  if (state.status === "playing") {
    state.elapsedMs += dt * 1000;
    const speed = state.level.scroll_speed;
    state.player.x += speed * dt;
    state.player.vy += GRAVITY * dt;
    state.player.y += state.player.vy * dt;
    state.player.rotation += dt * 5.4;

    if (state.player.y + PLAYER_SIZE >= FLOOR_Y) {
      state.player.y = FLOOR_Y - PLAYER_SIZE;
      state.player.vy = 0;
      state.player.grounded = true;
      state.player.rotation = 0;
    }

    state.cameraX = Math.max(0, state.player.x - CAMERA_LEAD);
    state.progress = clamp((state.player.x / state.level.length) * 100, 0, 100);
    progressValue.textContent = `${Math.floor(state.progress)}%`;
    progressBar.style.width = `${state.progress}%`;

    if (state.progress > state.bestProgress) {
      state.bestProgress = state.progress;
      bestValue.textContent = `${Math.floor(state.bestProgress)}%`;
    }

    const playerBounds = playerRect();

    for (const pad of state.level.jump_pads) {
      const padRect = {
        x: pad.x,
        y: FLOOR_Y - pad.height,
        width: pad.width,
        height: pad.height
      };

      if (intersects(playerBounds, padRect) && state.player.vy >= 0) {
        state.player.vy = -pad.boost;
        state.player.grounded = false;
        spawnParticles(pad.x + pad.width / 2, FLOOR_Y - pad.height, "#ffd166", 14);
      }
    }

    for (const segment of state.level.segments) {
      const obstacleRect = {
        x: segment.x,
        y: FLOOR_Y - segment.height,
        width: segment.width,
        height: segment.height
      };

      if (intersects(playerBounds, obstacleRect)) {
        handleRunEnd(false);
        return;
      }
    }

    for (const orb of state.level.collectibles) {
      if (state.orbsCollected.has(orb.id)) {
        continue;
      }

      const orbRect = {
        x: orb.x - orb.radius,
        y: orb.y - orb.radius,
        width: orb.radius * 2,
        height: orb.radius * 2
      };

      if (intersects(playerBounds, orbRect)) {
        state.orbsCollected.add(orb.id);
        orbValue.textContent = String(state.orbsCollected.size);
        spawnParticles(orb.x, orb.y, "#34d7c5", 18);
      }
    }

    if (state.player.x >= state.level.length - 150) {
      handleRunEnd(true);
      return;
    }
  }

  state.deathFlash = Math.max(0, state.deathFlash - dt * 1.8);

  state.particles = state.particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt,
      vy: particle.vy + 420 * dt,
      life: particle.life - dt
    }))
    .filter((particle) => particle.life > 0);
}

async function handleRunEnd(completed) {
  state.status = completed ? "complete" : "dead";
  state.deathFlash = completed ? 0.35 : 0.9;

  spawnParticles(
    state.player.x + PLAYER_SIZE / 2,
    state.player.y + PLAYER_SIZE / 2,
    completed ? "#ffd166" : "#ff866f",
    completed ? 32 : 24
  );

  const score = Math.floor(state.progress);
  updateOverlay(
    completed ? "Circuit Cleared" : "Run Crashed",
    completed
      ? `You finished at ${score}% with ${state.orbsCollected.size} pulse orbs. Press Space to run again.`
      : `You reached ${score}% before impact. Press Space or R to restart.`
  );

  try {
    await request("/api/run", {
      method: "POST",
      body: JSON.stringify({
        player: state.playerName,
        progress: score,
        attempts: state.attempt,
        collected_orbs: state.orbsCollected.size,
        completed,
        duration_ms: Math.floor(state.elapsedMs)
      })
    });
    const scorePayload = await request("/api/scores");
    state.scoreBoard = scorePayload.scores;
    renderScores();
  } catch (error) {
    console.error("Failed to submit run", error);
  }
}

function drawBackground() {
  const width = canvas.width;
  const height = canvas.height;

  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, "#16314f");
  bgGradient.addColorStop(0.5, "#0c1d31");
  bgGradient.addColorStop(1, "#07111b");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  const parallaxX = state.cameraX * 0.25;
  for (let index = 0; index < 12; index += 1) {
    const x = ((index * 170) - parallaxX) % (width + 240);
    const towerHeight = 120 + (index % 4) * 70;
    ctx.fillStyle = "rgba(50, 120, 180, 0.14)";
    ctx.fillRect(x - 120, FLOOR_Y - towerHeight - 120, 84, towerHeight);
  }

  ctx.fillStyle = "rgba(113, 246, 255, 0.08)";
  for (let index = 0; index < 24; index += 1) {
    const y = 80 + index * 20;
    ctx.fillRect(0, y, width, 1);
  }
}

function drawGround() {
  ctx.fillStyle = "#0e2735";
  ctx.fillRect(0, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);

  const stripeOffset = -(state.cameraX * 0.9) % 160;
  for (let x = stripeOffset; x < canvas.width + 160; x += 160) {
    ctx.fillStyle = "rgba(113, 246, 255, 0.16)";
    ctx.fillRect(x, FLOOR_Y + 18, 80, 6);
    ctx.fillStyle = "rgba(255, 209, 102, 0.08)";
    ctx.fillRect(x + 20, FLOOR_Y + 36, 120, 6);
  }
}

function worldToScreenX(x) {
  return x - state.cameraX;
}

function drawSegments() {
  for (const segment of state.level.segments) {
    const x = worldToScreenX(segment.x);
    const y = FLOOR_Y - segment.height;

    if (x + segment.width < -100 || x > canvas.width + 100) {
      continue;
    }

    const gradient = ctx.createLinearGradient(x, y, x, FLOOR_Y);
    gradient.addColorStop(0, "#ff866f");
    gradient.addColorStop(1, "#ff4f6f");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y);
    ctx.lineTo(x + segment.width / 2, y);
    ctx.lineTo(x + segment.width, FLOOR_Y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawPads() {
  for (const pad of state.level.jump_pads) {
    const x = worldToScreenX(pad.x);
    const y = FLOOR_Y - pad.height;
    if (x + pad.width < -80 || x > canvas.width + 80) {
      continue;
    }

    const gradient = ctx.createLinearGradient(x, y, x + pad.width, y + pad.height);
    gradient.addColorStop(0, "#ffd166");
    gradient.addColorStop(1, "#ff9a62");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, pad.width, pad.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.fillRect(x + 10, y + 6, pad.width - 20, 5);
  }
}

function drawCollectibles() {
  for (const orb of state.level.collectibles) {
    if (state.orbsCollected.has(orb.id)) {
      continue;
    }

    const x = worldToScreenX(orb.x);
    if (x + orb.radius < -60 || x - orb.radius > canvas.width + 60) {
      continue;
    }

    const pulse = 1 + Math.sin((state.elapsedMs / 160) + orb.id) * 0.08;
    const radius = orb.radius * pulse;

    const gradient = ctx.createRadialGradient(x, orb.y, 2, x, orb.y, radius * 1.5);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    gradient.addColorStop(0.32, "rgba(52, 215, 197, 0.95)");
    gradient.addColorStop(1, "rgba(52, 215, 197, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, orb.y, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#71f6ff";
    ctx.beginPath();
    ctx.arc(x, orb.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const x = state.player.x - state.cameraX;
  const y = state.player.y;

  ctx.save();
  ctx.translate(x + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2);
  ctx.rotate(state.player.rotation);

  ctx.shadowColor = "rgba(113, 246, 255, 0.45)";
  ctx.shadowBlur = 24;
  const gradient = ctx.createLinearGradient(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE / 2, PLAYER_SIZE / 2);
  gradient.addColorStop(0, "#71f6ff");
  gradient.addColorStop(1, "#34d7c5");
  ctx.fillStyle = gradient;
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

  ctx.fillStyle = "#032332";
  ctx.fillRect(-13, -13, 10, 10);
  ctx.fillRect(3, -13, 10, 10);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(-14, 8, 28, 6);
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.life, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(worldToScreenX(particle.x), particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawFinishMarker() {
  const finishX = worldToScreenX(state.level.length - 120);
  ctx.fillStyle = "rgba(255, 209, 102, 0.22)";
  ctx.fillRect(finishX, 110, 8, FLOOR_Y - 110);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(finishX - 24, 110, 60, 26);
}

function render() {
  if (!state.level) {
    return;
  }

  drawBackground();
  drawGround();
  drawSegments();
  drawPads();
  drawCollectibles();
  drawFinishMarker();
  drawPlayer();
  drawParticles();

  if (state.deathFlash > 0) {
    ctx.fillStyle = `rgba(255, 134, 111, ${state.deathFlash * 0.2})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function gameLoop(timestamp) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const dt = Math.min((timestamp - state.lastTimestamp) / 1000, 0.032);
  state.lastTimestamp = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function renderScores() {
  if (!state.scoreBoard.length) {
    scoreList.innerHTML = "<li>No runs recorded yet.</li>";
    return;
  }

  scoreList.innerHTML = state.scoreBoard
    .slice(0, 6)
    .map((score) => (
      `<li>${score.player}: ${score.progress}% | ${score.collected_orbs} orbs | ${score.completed ? "clear" : "crash"}</li>`
    ))
    .join("");
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }

  if (event.code === "KeyR") {
    resetRun(true);
    updateOverlay("Run Reset", "The level is ready. Press Space to launch again.");
  }
});

window.addEventListener("pointerdown", () => {
  jump();
});

bootstrap();
