# Videojuego 3D Voxel Quest Studio — Sistema de Bloques con IA y Persistencia

**Módulo:** Programación multimedia y dispositivos móviles  
**Curso:** DAM2 2025/26  
**Alumno:** Luis Rodríguez Cedeño · 53945291X  
**Fecha:** 17 de febrero de 2026  
**Lección:** `dam2526/Segundo/Programación multimedia y dispositivos móviles/301-Actividades final de unidad - Segundo trimestre/001-Crear un videojuego`

---

## 1) Base de ejercicio de clase utilizada

El proyecto parte directamente de los ejercicios de clase de Three.js de mundo de bloques:

- `010-bloques.html` → generación de mundo voxel con Three.js
- `013-mas mejoras.html` → control de cámara, gravedad y colisiones
- `017-colision suavizada.html` → movimiento FPS con colisión suavizada

Se respeta completamente la temática base: **mundo 3D de bloques (voxel) con controles en primera persona**.

---

## 2) Modificaciones estéticas y visuales (calado alto)

### 2.1 Interfaz de juego completa

- HUD fijo superior izquierdo con vida, puntuación, cristales, enemigos, combo y tiempo.
- Panel lateral derecho con objetivos, leaderboard e historial.
- Overlays de inicio y fin de partida con formulario y resumen.

### 2.2 Design System v2

30+ CSS custom properties organizadas en categorías:

```css
:root {
  --bg: #05070f;
  --panel: rgba(8, 12, 25, 0.82);
  --ok: #2de38d;
  --info: #5bd7ff;
  --warning: #ffc145;
  --danger: #ff6a6a;
  --accent: #6078ff;
  --gold: #ffd700;
  --silver: #c0c0c0;
  --bronze: #cd7f32;
  --r-sm: 8px; --r-md: 12px; --r-lg: 14px;
  --shadow-panel: 0 12px 30px rgba(0,0,0,0.35);
  --font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --t-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 2.3 Barra de salud visual

```css
.health-bar {
  height: 8px;
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
}
.health-fill {
  height: 100%;
  background: var(--ok);
  transition: width var(--t-normal), background var(--t-normal);
}
.health-fill.warning { background: var(--warning); }
.health-fill.danger  { background: var(--danger); animation: pulse 0.8s infinite; }
```

### 2.4 Flash de daño (vignette)

```css
#damageFlash {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(255,50,50,0.45) 100%);
  pointer-events: none;
  opacity: 0;
  z-index: 9;
  transition: opacity 0.15s;
}
#damageFlash.active { opacity: 1; }
```

### 2.5 Combo flotante y toasts

- `#comboIndicator` aparece con animación comboFloat al encadenar muertes.
- `#toastBox` muestra notificaciones contextuales con 4 variantes (ok/info/warning/danger).

### 2.6 KPIs de objetivo y fin de partida

- `.obj-row` con progreso de cristales y supervivencia en tiempo real.
- `.ek-grid` de 4 tarjetas KPI al finalizar partida (score, cristales, enemigos, combo máx).

### 2.7 Rank badges y result badges

- Insignias oro/plata/bronce para las 3 primeras posiciones del leaderboard.
- Badges de victoria/derrota con estilo propio en el historial.

### 2.8 6 animaciones @keyframes

fadeIn, scaleIn, toastUp, comboFloat, pulse, shake.

### 2.9 Responsive

Breakpoints a 1000 px, 760 px y 480 px con colapso progresivo de paneles.

---

## 3) Modificaciones funcionales (código + base de datos, calado alto)

### 3.1 Motor de juego Three.js

#### Mundo voxel procedural

```javascript
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
      const block = new THREE.Mesh(blockGeo,
        new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
      block.position.set(x + 0.5, y + 0.5, z + 0.5);
      block.castShadow = true;
      scene.add(block);
      worldBlocks.set(key3(x, y, z), block);
    }
  }
}
```

#### Controles FPS con PointerLock

```javascript
const controls = new THREE.PointerLockControls(camera, document.body);
scene.add(controls.getObject());

function applyMovement(delta) {
  const speed = CONFIG.PLAYER_SPEED;
  const moveForward = Number(state.keys.KeyW) - Number(state.keys.KeyS);
  const moveRight = Number(state.keys.KeyD) - Number(state.keys.KeyA);
  if (moveForward !== 0) controls.moveForward(moveForward * speed * delta);
  if (moveRight !== 0) controls.moveRight(moveRight * speed * delta);

  state.velocityY += CONFIG.GRAVITY * delta;
  pos.y += state.velocityY * delta;
  if (pos.y < groundY) {
    pos.y = groundY;
    state.velocityY = 0;
    if (state.keys.Space) { state.velocityY = CONFIG.JUMP_FORCE; }
  }
}
```

#### IA enemigos con escalado temporal

```javascript
function createEnemy() {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.3, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xd54343, emissive: 0x4d0f0f })
  );
  cube.userData.hp = 3;
  cube.userData.speed = CONFIG.BASE_ENEMY_SPEED + Math.random() * 0.9;
  cube.userData.damageCooldown = 0;
  enemies.push(cube);
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    const dir = new THREE.Vector3(
      playerPos.x - enemy.position.x, 0,
      playerPos.z - enemy.position.z).normalize();
    enemy.position.x += dir.x * enemy.userData.speed * delta;
    enemy.position.z += dir.z * enemy.userData.speed * delta;

    enemy.userData.damageCooldown -= delta;
    if (distance < 1.5 && enemy.userData.damageCooldown <= 0) {
      state.health -= 8;
      enemy.userData.damageCooldown = 1.0;
      showDamageFlash();
    }
  }
}

// Escalado dinámico de enemigos máximos
const dynamicEnemyMax = Math.min(CONFIG.ENEMY_MAX, 6 + Math.floor(state.elapsed / 10));
```

#### Combate por raycast

```javascript
function shotEnemy() {
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
    showToast(`💀 Enemigo eliminado`, 'danger');
    if (state.combo > 1) showCombo(state.combo);
  }
}
```

#### Construcción de bloques

```javascript
function placeBuildBlock() {
  if (state.crystals < 2) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const targetX = Math.floor(basePos.x + dir.x * 3);
  const targetZ = Math.floor(basePos.z + dir.z * 3);
  const targetY = getGroundHeight(targetX, targetZ);
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8f6c41 })
  );
  block.position.set(targetX + 0.5, targetY + 0.5, targetZ + 0.5);
  scene.add(block);
  buildBlocks.set(k, block);
  state.crystals -= 2;
  showToast('🧱 Bloque construido (−2 cristales)', 'info');
}
```

### 3.2 Funciones v2 del frontend

```javascript
function showDamageFlash() {
  damageFlash.classList.add('active');
  setTimeout(() => damageFlash.classList.remove('active'), 220);
}

function showCombo(n) {
  comboIndicator.textContent = `×${n} COMBO`;
  comboIndicator.classList.remove('show');
  void comboIndicator.offsetWidth;          // reflow
  comboIndicator.classList.add('show');
}

function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastBox.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function updateObjectiveKPIs() {
  const cDone = state.crystals >= CONFIG.TARGET_CRYSTALS;
  objCrystals.className = `obj-kpi${cDone ? ' done' : ''}`;
  objCrystals.querySelector('.value').textContent =
    `${state.crystals} / ${CONFIG.TARGET_CRYSTALS}`;
}
```

### 3.3 Seed / Export / Import

```javascript
async function seedData() {
  const res = await api('/api/seed', 'POST');
  if (res.ok) {
    showToast(`🌱 ${res.inserted} partidas demo insertadas`, 'ok');
    await loadLeaderboard();
  }
}

async function exportData() {
  const lb = await api('/api/leaderboard?limit=50');
  const st = await api('/api/stats');
  const blob = new Blob(
    [JSON.stringify({ leaderboard: lb.items || [], stats: st }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `voxel_quest_export_${Date.now()}.json`;
  a.click();
}
```

### 3.4 Backend Flask + SQLite

#### Esquema de 3 tablas

```sql
CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'survival',
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT, result TEXT,
    score INTEGER DEFAULT 0,
    crystals INTEGER DEFAULT 0,
    enemies_defeated INTEGER DEFAULT 0,
    survived_seconds INTEGER DEFAULT 0,
    max_combo INTEGER DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE game_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_value INTEGER DEFAULT 0,
    payload_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
);
```

#### API REST (10 endpoints)

```python
# Registro de jugador (INSERT ... ON CONFLICT)
@app.route("/api/player/register", methods=["POST"])

# Sesión de partida
@app.route("/api/session/start", methods=["POST"])
@app.route("/api/session/event", methods=["POST"])
@app.route("/api/session/end", methods=["POST"])

# Consultas
@app.route("/api/leaderboard")
@app.route("/api/player/<int:player_id>/history")
@app.route("/api/stats")
@app.route("/api/health")

# v2 – Seed e Import
@app.route("/api/seed", methods=["POST"])
@app.route("/api/import", methods=["POST"])
```

#### Endpoint seed (inserta 5 demos)

```python
SEED_NAMES = ["AlphaWolf", "NovaStrike", "CrystalHunter", "VoxelKing", "PixelNinja"]

@app.route("/api/seed", methods=["POST"])
def seed_data():
    inserted = 0
    with db_connection() as conn:
        for name in SEED_NAMES:
            conn.execute(
                "INSERT INTO players (name) VALUES (?) "
                "ON CONFLICT(name) DO UPDATE SET last_seen=CURRENT_TIMESTAMP", (name,))
            pid = conn.execute("SELECT id FROM players WHERE name=?", (name,)).fetchone()["id"]
            score = _rnd.randint(120, 950)
            crystals = _rnd.randint(3, 14)
            survived = _rnd.randint(30, 100)
            result = "victory" if survived >= 90 and crystals >= 12 else "defeat"
            conn.execute("""INSERT INTO game_sessions
               (player_id, mode, ended_at, result, score, crystals,
                enemies_defeated, survived_seconds, max_combo)
               VALUES (?, 'voxel_survival', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)""",
               (pid, result, score, crystals, _rnd.randint(2, 18), survived, _rnd.randint(1, 6)))
            inserted += 1
    return jsonify({"ok": True, "inserted": inserted})
```

---

## 4) Cumplimiento de rúbrica

| Criterio | Evidencia |
|----------|-----------|
| **Parte de ejercicio de clase** | Ejercicios 010-bloques a 017-colisión suavizada de Three.js |
| **Cambios visuales extensos** | Design System v2 completo (30+ tokens CSS), health bar, flash de daño, combo flotante, toasts, KPIs, rank/result badges, 6 @keyframes, responsive 3 breakpoints |
| **Cambios funcionales de calado** | Motor 3D completo (mundo procedural, IA enemigos, raycast combat, construcción), persistencia SQLite con 3 tablas, API REST de 10 endpoints, seed/export/import |
| **Nivel de 2.º curso** | Arquitectura cliente-servidor full-stack, telemetría granular, patrón async/await para API calls, state machine de partida |

---

## 5) Entrega técnica

**Ruta:** `Programación multimedia y dispositivos móviles/301-Actividades final de unidad - Segundo trimestre/001-Crear un videojuego/voxel_quest_studio`

**Contenido del proyecto:**

| Archivo | Descripción |
|---------|-------------|
| `app.py` | API Flask + SQLite + servidor web (326 líneas) |
| `templates/index.html` | Shell HTML con HUD, overlays y paneles |
| `static/game.js` | Motor Three.js completo del videojuego (692 líneas) |
| `static/styles.css` | Design System v2 completo (387 líneas) |
| `requirements.txt` | Dependencia Flask>=3.0.0 |
| `README.md` | Documentación del proyecto |
| `docs/Actividad_CrearVideojuego_53945291X.md` | Justificación técnica breve |

---

## Anexo — 14 mejoras Design System v2

| # | Mejora | Archivo | Descripción |
|---|--------|---------|-------------|
| 1 | Tokens CSS | `styles.css` | 30+ custom properties (palette, radii, shadows, typography, transitions) |
| 2 | Barra de salud | `styles.css` + `game.js` | Color dinámico verde→ámbar→rojo con animación pulse |
| 3 | Flash de daño | `styles.css` + `game.js` | Vignette radial-gradient roja al recibir golpe |
| 4 | Combo flotante | `styles.css` + `game.js` | Texto `×N COMBO` con keyframe comboFloat |
| 5 | Toasts contextuales | `styles.css` + `game.js` | 4 tipos (ok/info/warning/danger) con animationend auto-remove |
| 6 | KPIs de objetivo | `styles.css` + `game.js` | Progreso cristales y supervivencia en tiempo real |
| 7 | KPI cards fin partida | `styles.css` + `game.js` | 4 tarjetas con score, cristales, enemigos y combo |
| 8 | Rank badges | `styles.css` + `game.js` | Insignias oro/plata/bronce en top 3 del leaderboard |
| 9 | Result badges | `styles.css` + `game.js` | Victoria/derrota con estilo en historial |
| 10 | Seed demo | `game.js` + `app.py` | Inserta 5 jugadores ficticios con stats aleatorios |
| 11 | Exportar JSON | `game.js` | Descarga leaderboard + stats como archivo .json |
| 12 | Importar JSON | `game.js` + `app.py` | Carga partidas desde archivo JSON exportado |
| 13 | Responsive | `styles.css` | 3 breakpoints (1000/760/480 px) con colapso progresivo |
| 14 | Animaciones | `styles.css` | 6 @keyframes: fadeIn, scaleIn, toastUp, comboFloat, pulse, shake |
