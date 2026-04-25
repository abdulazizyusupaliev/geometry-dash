const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const speedValue = document.getElementById("speedValue");
const powerupValue = document.getElementById("powerupValue");
const powerupTimer = document.querySelector("#powerupTimer span");

const groundY = canvas.height - 96;
const gravity = 2400;
const jumpVelocity = -840;
const baseSpeed = 420;
const maxSpeed = 900;

const powerups = {
  shield: { label: "Shield Core", color: "#b8ff66", duration: 0 },
  slow: { label: "Time Warp", color: "#5de4ff", duration: 5.5 },
  jump: { label: "Jump Surge", color: "#ff8e3c", duration: 5 },
};

const state = {
  running: true,
  gameOver: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem("gd-best-score") || 0),
  worldSpeed: baseSpeed,
  distance: 0,
  obstacleTimer: 0,
  powerupTimer: 0,
  particles: [],
  obstacles: [],
  collectibles: [],
  activePowerup: null,
  player: {
    x: 160,
    y: groundY - 42,
    width: 42,
    height: 42,
    velocityY: 0,
    rotation: 0,
    onGround: true,
    shieldHits: 0,
  },
};

bestValue.textContent = state.best;

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  state.score = 0;
  state.worldSpeed = baseSpeed;
  state.distance = 0;
  state.obstacleTimer = 0;
  state.powerupTimer = 0;
  state.particles = [];
  state.obstacles = [];
  state.collectibles = [];
  state.activePowerup = null;
  state.player = {
    x: 160,
    y: groundY - 42,
    width: 42,
    height: 42,
    velocityY: 0,
    rotation: 0,
    onGround: true,
    shieldHits: 0,
  };
  overlay.classList.add("hidden");
  pauseButton.textContent = "Pause";
  updateHud();
}

function jump() {
  if (!state.running || state.paused || state.gameOver) {
    return;
  }

  if (state.player.onGround) {
    const jumpBoost = state.activePowerup === "jump" ? 1.2 : 1;
    state.player.velocityY = jumpVelocity * jumpBoost;
    state.player.onGround = false;
    spawnBurst(state.player.x + 12, state.player.y + state.player.height, "#5de4ff", 8);
  }
}

function togglePause() {
  if (state.gameOver) {
    return;
  }

  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
}

function activatePowerup(type) {
  state.activePowerup = type;
  state.powerupTimer = powerups[type].duration;

  if (type === "shield") {
    state.player.shieldHits = 1;
  }

  spawnBurst(state.player.x + 16, state.player.y + 16, powerups[type].color, 14);
  updateHud();
}

function endPowerup() {
  if (state.activePowerup === "shield") {
    state.player.shieldHits = 0;
  }

  state.activePowerup = null;
  state.powerupTimer = 0;
  updateHud();
}

function hitObstacle() {
  if (state.player.shieldHits > 0) {
    state.player.shieldHits = 0;
    endPowerup();
    spawnBurst(state.player.x + 20, state.player.y + 20, "#b8ff66", 18);
    return;
  }

  state.gameOver = true;
  state.running = false;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem("gd-best-score", String(state.best));
  bestValue.textContent = state.best;
  overlayTitle.textContent = "Crash Detected";
  overlayText.textContent = `Score ${Math.floor(state.score)}. Press R or restart to run again.`;
  overlay.classList.remove("hidden");
}

function spawnObstacle() {
  const spikeCount = Math.random() > 0.72 ? 2 : 1;
  const width = spikeCount === 2 ? 74 : 42;

  state.obstacles.push({
    x: canvas.width + 20,
    y: groundY,
    width,
    height: spikeCount === 2 ? 54 : 42,
    spikeCount,
  });
}

function spawnCollectible() {
  const types = ["shield", "slow", "jump"];
  const type = types[Math.floor(Math.random() * types.length)];
  state.collectibles.push({
    type,
    x: canvas.width + 20,
    y: groundY - 84 - Math.random() * 90,
    size: 24,
    phase: Math.random() * Math.PI * 2,
  });
}

function spawnBurst(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    state.particles.push({
      x,
      y,
      color,
      life: 0.6 + Math.random() * 0.5,
      maxLife: 0.6 + Math.random() * 0.5,
      velocityX: (Math.random() - 0.5) * 280,
      velocityY: (Math.random() - 0.5) * 280,
      size: 2 + Math.random() * 5,
    });
  }
}

function updateHud() {
  scoreValue.textContent = Math.floor(state.score);
  bestValue.textContent = state.best;
  speedValue.textContent = `${(state.worldSpeed / baseSpeed).toFixed(1)}x`;

  if (state.activePowerup) {
    powerupValue.textContent = powerups[state.activePowerup].label;
    const duration = powerups[state.activePowerup].duration || 1;
    const remaining = Math.max(0, state.powerupTimer / duration) * 100;
    powerupTimer.style.width = `${remaining}%`;
    powerupTimer.style.background = `linear-gradient(90deg, ${powerups[state.activePowerup].color}, #ffffff)`;
  } else {
    powerupValue.textContent = "None";
    powerupTimer.style.width = "0%";
  }
}

function update(dt) {
  if (!state.running || state.paused) {
    return;
  }

  const speedFactor = state.activePowerup === "slow" ? 0.68 : 1;
  state.worldSpeed = Math.min(maxSpeed, baseSpeed + state.score * 0.75) * speedFactor;
  state.score += dt * 18;
  state.distance += state.worldSpeed * dt;

  state.player.velocityY += gravity * dt;
  state.player.y += state.player.velocityY * dt;
  state.player.rotation += dt * 8;

  if (state.player.y >= groundY - state.player.height) {
    state.player.y = groundY - state.player.height;
    state.player.velocityY = 0;
    state.player.rotation = 0;
    state.player.onGround = true;
  }

  state.obstacleTimer += dt;
  const obstacleDelay = Math.max(0.6, 1.25 - state.score / 280);
  if (state.obstacleTimer >= obstacleDelay) {
    state.obstacleTimer = 0;
    spawnObstacle();

    if (Math.random() > 0.65 && !state.activePowerup && state.collectibles.length === 0) {
      spawnCollectible();
    }
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10);
  state.collectibles = state.collectibles.filter((item) => item.x + item.size > -10);
  state.particles = state.particles.filter((particle) => particle.life > 0);

  state.obstacles.forEach((obstacle) => {
    obstacle.x -= state.worldSpeed * dt;

    if (isColliding(state.player, {
      x: obstacle.x,
      y: obstacle.y - obstacle.height,
      width: obstacle.width,
      height: obstacle.height,
    })) {
      hitObstacle();
    }
  });

  state.collectibles.forEach((item) => {
    item.x -= state.worldSpeed * dt;
    item.phase += dt * 4;
    item.y += Math.sin(item.phase) * 14 * dt;

    if (isColliding(state.player, {
      x: item.x - item.size / 2,
      y: item.y - item.size / 2,
      width: item.size,
      height: item.size,
    })) {
      activatePowerup(item.type);
      item.x = -999;
    }
  });

  state.particles.forEach((particle) => {
    particle.life -= dt;
    particle.x += particle.velocityX * dt;
    particle.y += particle.velocityY * dt;
    particle.velocityY += 300 * dt;
  });

  if (state.activePowerup && powerups[state.activePowerup].duration > 0) {
    state.powerupTimer -= dt;
    if (state.powerupTimer <= 0) {
      endPowerup();
    }
  }

  updateHud();
}

function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#071120");
  gradient.addColorStop(1, "#0d1b36");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 22; i += 1) {
    const x = ((i * 130) - (state.distance * 0.2)) % (canvas.width + 140);
    const y = 80 + (i % 6) * 56;
    ctx.fillStyle = "rgba(93, 228, 255, 0.08)";
    ctx.fillRect(x, y, 90, 10);
  }

  ctx.fillStyle = "#112a4f";
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  ctx.fillStyle = "#5de4ff";
  for (let i = 0; i < 40; i += 1) {
    const x = ((i * 64) - state.distance * 0.6) % (canvas.width + 64);
    ctx.fillRect(x, groundY + 12, 32, 4);
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(state.player.x + state.player.width / 2, state.player.y + state.player.height / 2);
  ctx.rotate(state.player.rotation);

  if (state.activePowerup === "shield" && state.player.shieldHits > 0) {
    ctx.fillStyle = "rgba(184, 255, 102, 0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ff5da8";
  ctx.fillRect(-state.player.width / 2, -state.player.height / 2, state.player.width, state.player.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-10, -8, 8, 8);
  ctx.fillRect(6, -8, 8, 8);
  ctx.fillStyle = "#07111f";
  ctx.fillRect(-8, -6, 4, 4);
  ctx.fillRect(8, -6, 4, 4);

  ctx.restore();
}

function drawObstacle(obstacle) {
  ctx.fillStyle = "#ff8e3c";
  const spikeWidth = obstacle.width / obstacle.spikeCount;
  for (let i = 0; i < obstacle.spikeCount; i += 1) {
    const baseX = obstacle.x + i * spikeWidth;
    ctx.beginPath();
    ctx.moveTo(baseX, groundY);
    ctx.lineTo(baseX + spikeWidth / 2, groundY - obstacle.height);
    ctx.lineTo(baseX + spikeWidth, groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCollectible(item) {
  const config = powerups[item.type];
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.phase);
  ctx.fillStyle = config.color;
  ctx.fillRect(-item.size / 2, -item.size / 2, item.size, item.size);
  ctx.fillStyle = "#07111f";
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
  ctx.globalAlpha = 1;
}

function drawStatusText() {
  if (state.paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ecf6ff";
    ctx.font = '700 52px "Orbitron"';
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
  }
}

function render() {
  drawBackground();
  state.obstacles.forEach(drawObstacle);
  state.collectibles.forEach(drawCollectible);
  drawPlayer();
  drawParticles();
  drawStatusText();
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    jump();
  }

  if (event.key.toLowerCase() === "r") {
    resetGame();
  }

  if (event.key.toLowerCase() === "p") {
    togglePause();
  }
});

canvas.addEventListener("pointerdown", jump);
restartButton.addEventListener("click", resetGame);
pauseButton.addEventListener("click", togglePause);

resetGame();
requestAnimationFrame(frame);
