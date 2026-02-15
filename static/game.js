const canvas = document.getElementById('gameCanvas');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const playerNameInput = document.getElementById('playerName');

const hud = {
  health: document.getElementById('hudHealth'),
  score: document.getElementById('hudScore'),
  crystals: document.getElementById('hudCrystals'),
  enemies: document.getElementById('hudEnemies'),
  combo: document.getElementById('hudCombo'),
  time: document.getElementById('hudTime'),
};

const leaderboardBody = document.getElementById('leaderboardBody');
const historyBody = document.getElementById('historyBody');
const endTitle = document.getElementById('endTitle');
const endSummary = document.getElementById('endSummary');

const CONFIG = {
  WORLD_RADIUS: 34,
  PLAYER_SPEED: 9,
  JUMP_FORCE: 10,
  GRAVITY: -25,
  TARGET_SURVIVAL_SECONDS: 90,
  TARGET_CRYSTALS: 12,
  CRYSTAL_RESPAWN_SECONDS: 2.8,
  ENEMY_SPAWN_SECONDS: 4.8,
  ENEMY_MAX: 18,
  BASE_ENEMY_SPEED: 1.8,
};

const state = {
  running: false,
  locked: false,
  playerId: null,
  sessionId: null,
  score: 0,
  health: 100,
  crystals: 0,
  enemiesDefeated: 0,
  maxCombo: 0,
  combo: 0,
  lastKillAt: 0,
  startedAt: 0,
  elapsed: 0,
  velocityY: 0,
  keys: {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    Space: false,
  },
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5ff);
scene.fog = new THREE.Fog(0x87b5ff, 30, 180);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 8, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const controls = new THREE.PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const hemi = new THREE.HemisphereLight(0xdce7ff, 0x5f6d85, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(20, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220),
  new THREE.MeshStandardMaterial({ color: 0x386f3b, roughness: 0.95 })
);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.y = -0.5;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

const worldBlocks = new Map();
const buildBlocks = new Map();
const crystals = [];
const enemies = [];

const raycaster = new THREE.Raycaster();

function key3(x, y, z) {
  return `${x}|${y}|${z}`;
}

function terrainHeightAt(x, z) {
  const waveA = Math.sin(x * 0.12) * 2.2;
  const waveB = Math.cos(z * 0.08) * 1.7;
  const waveC = Math.sin((x + z) * 0.05) * 1.3;
  return Math.floor(2 + waveA + waveB + waveC);
}

function generateWorld() {
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);

  for (let x = -CONFIG.WORLD_RADIUS; x <= CONFIG.WORLD_RADIUS; x += 1) {
    for (let z = -CONFIG.WORLD_RADIUS; z <= CONFIG.WORLD_RADIUS; z += 1) {
      const y = terrainHeightAt(x, z);
      const color = y > 4 ? 0x8a8f98 : y > 2 ? 0x5a8d4f : 0x907248;
      const block = new THREE.Mesh(
        blockGeo,
        new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02 })
      );
      block.position.set(x + 0.5, y + 0.5, z + 0.5);
      block.castShadow = true;
      block.receiveShadow = true;
      scene.add(block);
      worldBlocks.set(key3(x, y, z), block);
    }
  }
}

function randomCoord(radius = CONFIG.WORLD_RADIUS - 6) {
  const x = Math.floor((Math.random() * 2 - 1) * radius);
  const z = Math.floor((Math.random() * 2 - 1) * radius);
  return { x, z };
}

function createCrystal() {
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color: 0x5bd7ff, emissive: 0x0b5b85, emissiveIntensity: 0.8 })
  );
  const p = randomCoord();
  const y = terrainHeightAt(p.x, p.z) + 1.3;
  orb.position.set(p.x + 0.5, y, p.z + 0.5);
  orb.userData.baseY = y;
  orb.castShadow = true;
  scene.add(orb);
  crystals.push(orb);
}

function spawnInitialCrystals() {
  for (let i = 0; i < 22; i += 1) createCrystal();
}

function createEnemy() {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.3, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xd54343, emissive: 0x4d0f0f, emissiveIntensity: 0.35 })
  );

  const p = randomCoord(CONFIG.WORLD_RADIUS - 3);
  const y = terrainHeightAt(p.x, p.z) + 0.65;
  cube.position.set(p.x + 0.5, y, p.z + 0.5);
  cube.castShadow = true;
  cube.userData.hp = 3;
  cube.userData.speed = CONFIG.BASE_ENEMY_SPEED + Math.random() * 0.9;
  cube.userData.damageCooldown = 0;
  scene.add(cube);
  enemies.push(cube);
}

function updateHud() {
  hud.health.textContent = Math.max(0, Math.round(state.health));
  hud.score.textContent = Math.round(state.score);
  hud.crystals.textContent = state.crystals;
  hud.enemies.textContent = state.enemiesDefeated;
  hud.combo.textContent = state.maxCombo;
  hud.time.textContent = `${Math.floor(state.elapsed)}s`;
}

function getGroundHeight(x, z) {
  const base = terrainHeightAt(Math.floor(x), Math.floor(z));
  let extra = 0;
  for (const [k] of buildBlocks) {
    const [bx, by, bz] = k.split('|').map(Number);
    if (bx === Math.floor(x) && bz === Math.floor(z)) {
      extra = Math.max(extra, by + 1);
    }
  }
  return Math.max(base + 1, extra);
}

function applyMovement(delta) {
  const speed = CONFIG.PLAYER_SPEED;
  const moveForward = Number(state.keys.KeyW) - Number(state.keys.KeyS);
  const moveRight = Number(state.keys.KeyD) - Number(state.keys.KeyA);

  if (moveForward !== 0) controls.moveForward(moveForward * speed * delta);
  if (moveRight !== 0) controls.moveRight(moveRight * speed * delta);

  const pos = controls.getObject().position;
  const groundY = getGroundHeight(pos.x, pos.z) + 0.8;

  state.velocityY += CONFIG.GRAVITY * delta;
  pos.y += state.velocityY * delta;

  if (pos.y < groundY) {
    pos.y = groundY;
    state.velocityY = 0;
    if (state.keys.Space) {
      state.velocityY = CONFIG.JUMP_FORCE;
      state.keys.Space = false;
    }
  }

  const limit = CONFIG.WORLD_RADIUS - 1;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
}

function updateCrystals(time) {
  const playerPos = controls.getObject().position;
  for (let i = crystals.length - 1; i >= 0; i -= 1) {
    const orb = crystals[i];
    orb.rotation.y += 0.8 * (1 / 60);
    orb.position.y = orb.userData.baseY + Math.sin(time * 0.002 + i) * 0.15;

    if (orb.position.distanceTo(playerPos) < 1.1) {
      scene.remove(orb);
      crystals.splice(i, 1);
      state.crystals += 1;
      state.score += 25;
      sendEvent('collect_crystal', 25, { crystals: state.crystals });
      setTimeout(createCrystal, CONFIG.CRYSTAL_RESPAWN_SECONDS * 1000);
    }
  }
}

function updateEnemies(delta) {
  const playerPos = controls.getObject().position;

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const dir = new THREE.Vector3(
      playerPos.x - enemy.position.x,
      0,
      playerPos.z - enemy.position.z
    );
    const distance = dir.length();

    if (distance > 0.01) {
      dir.normalize();
      enemy.position.x += dir.x * enemy.userData.speed * delta;
      enemy.position.z += dir.z * enemy.userData.speed * delta;
      enemy.position.y = terrainHeightAt(Math.floor(enemy.position.x), Math.floor(enemy.position.z)) + 0.65;
      enemy.lookAt(playerPos.x, enemy.position.y, playerPos.z);
    }

    enemy.userData.damageCooldown -= delta;
    if (distance < 1.5 && enemy.userData.damageCooldown <= 0) {
      state.health -= 8;
      enemy.userData.damageCooldown = 1.0;
      sendEvent('damage_taken', 8, { health: Math.round(state.health) });
    }
  }
}

function shotEnemy() {
  if (!state.running || !state.locked) return;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = raycaster.intersectObjects(enemies, false)[0];
  if (!hit || hit.distance > 45) return;

  const enemy = hit.object;
  enemy.userData.hp -= 1;

  if (enemy.userData.hp <= 0) {
    const now = performance.now();
    state.combo = now - state.lastKillAt <= 3000 ? state.combo + 1 : 1;
    state.lastKillAt = now;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    state.enemiesDefeated += 1;
    state.score += 35 + (state.combo - 1) * 5;

    scene.remove(enemy);
    const index = enemies.indexOf(enemy);
    if (index >= 0) enemies.splice(index, 1);

    sendEvent('enemy_defeated', 1, { combo: state.combo });
  }
}

function placeBuildBlock() {
  if (!state.running || !state.locked) return;
  if (state.crystals < 2) return;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const basePos = controls.getObject().position.clone();
  const targetX = Math.floor(basePos.x + dir.x * 3);
  const targetZ = Math.floor(basePos.z + dir.z * 3);
  const targetY = getGroundHeight(targetX, targetZ);

  const k = key3(targetX, targetY, targetZ);
  if (buildBlocks.has(k) || worldBlocks.has(k)) return;

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8f6c41, roughness: 0.9 })
  );
  block.position.set(targetX + 0.5, targetY + 0.5, targetZ + 0.5);
  block.castShadow = true;
  block.receiveShadow = true;
  scene.add(block);
  buildBlocks.set(k, block);

  state.crystals -= 2;
  state.score += 8;
  sendEvent('build_block', 1, { x: targetX, y: targetY, z: targetZ });
}

async function api(url, method = 'GET', body = null) {
  const options = { method, headers: {} };
  if (body !== null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  return response.json();
}

async function registerPlayer(name) {
  const data = await api('/api/player/register', 'POST', { name });
  if (!data.ok) throw new Error(data.error || 'Error al registrar jugador');
  return data.player;
}

async function startSession(playerId) {
  const data = await api('/api/session/start', 'POST', { player_id: playerId, mode: 'voxel_survival' });
  if (!data.ok) throw new Error(data.error || 'Error al iniciar sesión');
  return data.session_id;
}

function sendEvent(eventType, eventValue, payload = {}) {
  if (!state.sessionId) return;
  api('/api/session/event', 'POST', {
    session_id: state.sessionId,
    event_type: eventType,
    event_value: eventValue,
    payload,
  }).catch(() => {});
}

async function finishSession(result) {
  if (!state.sessionId) return;
  await api('/api/session/end', 'POST', {
    session_id: state.sessionId,
    result,
    score: Math.round(state.score),
    crystals: state.crystals,
    enemies_defeated: state.enemiesDefeated,
    survived_seconds: Math.floor(state.elapsed),
    max_combo: state.maxCombo,
  });
}

async function loadLeaderboard() {
  const data = await api('/api/leaderboard?limit=10');
  const rows = (data.items || []).map((item) => `
    <tr>
      <td>${item.player_name}</td>
      <td>${item.score}</td>
      <td>${item.crystals}</td>
      <td>${item.survived_seconds}s</td>
    </tr>
  `);
  leaderboardBody.innerHTML = rows.join('');
}

async function loadHistory() {
  if (!state.playerId) return;
  const data = await api(`/api/player/${state.playerId}/history?limit=8`);
  const rows = (data.items || []).map((item) => `
    <tr>
      <td>${item.result || '-'}</td>
      <td>${item.score}</td>
      <td>${item.survived_seconds}s</td>
    </tr>
  `);
  historyBody.innerHTML = rows.join('');
}

let enemySpawnTimer = 0;
let crystalSpawnTimer = 0;

function updateSpawners(delta) {
  enemySpawnTimer += delta;
  crystalSpawnTimer += delta;

  const dynamicEnemyMax = Math.min(CONFIG.ENEMY_MAX, 6 + Math.floor(state.elapsed / 10));

  if (enemySpawnTimer >= CONFIG.ENEMY_SPAWN_SECONDS && enemies.length < dynamicEnemyMax) {
    enemySpawnTimer = 0;
    createEnemy();
  }

  if (crystalSpawnTimer >= CONFIG.CRYSTAL_RESPAWN_SECONDS && crystals.length < 22) {
    crystalSpawnTimer = 0;
    createCrystal();
  }
}

function endGame(result) {
  if (!state.running) return;
  state.running = false;
  controls.unlock();

  finishSession(result)
    .then(async () => {
      await loadLeaderboard();
      await loadHistory();
    })
    .finally(() => {
      endTitle.textContent = result === 'victory' ? '¡Victoria táctica!' : 'Derrota';
      endSummary.textContent = `Score ${Math.round(state.score)} · Cristales ${state.crystals} · Enemigos ${state.enemiesDefeated} · Tiempo ${Math.floor(state.elapsed)}s`;
      endOverlay.classList.add('visible');
    });
}

function resetRuntimeState() {
  state.score = 0;
  state.health = 100;
  state.crystals = 0;
  state.enemiesDefeated = 0;
  state.maxCombo = 0;
  state.combo = 0;
  state.lastKillAt = 0;
  state.startedAt = performance.now();
  state.elapsed = 0;
  state.velocityY = 0;

  enemySpawnTimer = 0;
  crystalSpawnTimer = 0;

  for (const enemy of enemies) scene.remove(enemy);
  enemies.length = 0;

  for (const orb of crystals) scene.remove(orb);
  crystals.length = 0;
  spawnInitialCrystals();

  for (const [, block] of buildBlocks) scene.remove(block);
  buildBlocks.clear();

  controls.getObject().position.set(0, getGroundHeight(0, 0) + 2, 0);
}

async function startGame() {
  const name = playerNameInput.value.trim();
  if (name.length < 3) {
    playerNameInput.focus();
    return;
  }

  const player = await registerPlayer(name);
  state.playerId = player.id;
  state.sessionId = await startSession(state.playerId);

  await loadLeaderboard();
  await loadHistory();

  resetRuntimeState();
  updateHud();

  state.running = true;
  startOverlay.classList.remove('visible');
  endOverlay.classList.remove('visible');
  controls.lock();
  sendEvent('session_ready', 1, { player: name });
}

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, (animate.lastTime ? (now - animate.lastTime) / 1000 : 0));
  animate.lastTime = now;

  if (state.running) {
    state.elapsed = (now - state.startedAt) / 1000;

    applyMovement(delta);
    updateCrystals(now);
    updateEnemies(delta);
    updateSpawners(delta);

    if (state.health <= 0) endGame('defeat');
    if (state.elapsed >= CONFIG.TARGET_SURVIVAL_SECONDS && state.crystals >= CONFIG.TARGET_CRYSTALS) {
      endGame('victory');
    }

    updateHud();
  }

  renderer.render(scene, camera);
}
animate.lastTime = 0;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
  if (e.code in state.keys) state.keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (e.code in state.keys) state.keys[e.code] = false;
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) shotEnemy();
});
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  placeBuildBlock();
});

controls.addEventListener('lock', () => {
  state.locked = true;
});
controls.addEventListener('unlock', () => {
  state.locked = false;
  if (state.running) {
    startOverlay.classList.add('visible');
  }
});

startBtn.addEventListener('click', () => {
  startGame().catch((err) => {
    alert(`No se pudo iniciar: ${err.message}`);
  });
});

retryBtn.addEventListener('click', () => {
  endOverlay.classList.remove('visible');
  startOverlay.classList.add('visible');
});

generateWorld();
spawnInitialCrystals();
loadLeaderboard().catch(() => {});
updateHud();
animate(performance.now());
