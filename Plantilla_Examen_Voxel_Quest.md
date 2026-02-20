# Plantilla Examen — Voxel Quest Studio (PMDM-001)

**Alumno:** Luis Rodríguez Cedeño · 53945291X  
**Módulo:** Programación multimedia y dispositivos móviles · DAM2

---

## 1 · Arquitectura general

- **Stack:** Three.js r128 (CDN) + Flask 3.0 + SQLite3
- **Puerto:** 5090
- **Capas:** frontend HTML/CSS/JS → fetch API REST → Flask → SQLite
- **Ficheros clave:**
  - `app.py` → backend (326 líneas)
  - `static/game.js` → motor 3D (692 líneas)
  - `static/styles.css` → design system (387 líneas)
  - `templates/index.html` → shell HTML con HUD/overlays

---

## 2 · Three.js — Escena 3D

- `THREE.Scene()` + `THREE.PerspectiveCamera(74, aspect, 0.1, 500)`
- `THREE.WebGLRenderer({ antialias: true })` + `shadowMap.enabled = true`
- `THREE.Fog(0x87b5ff, 30, 180)` → niebla de distancia
- `THREE.HemisphereLight(0xdce7ff, 0x5f6d85, 0.85)` → luz ambiental cielo/suelo
- `THREE.DirectionalLight(0xffffff, 1.1)` → sol con sombras PCF (mapSize 2048)

```javascript
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5ff);
scene.fog = new THREE.Fog(0x87b5ff, 30, 180);
const camera = new THREE.PerspectiveCamera(
  74,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
```

---

## 3 · Mundo voxel procedural

- `WORLD_RADIUS = 34` → ~4600 bloques
- Función `terrainHeightAt(x, z)` → 3 ondas sinusoidales superpuestas
- 3 tipos de material por altura: piedra (y>4), hierba (y>2), tierra
- `worldBlocks` → Map con clave `"x|y|z"` para consulta O(1)

```javascript
function terrainHeightAt(x, z) {
  const waveA = Math.sin(x * 0.12) * 2.2;
  const waveB = Math.cos(z * 0.08) * 1.7;
  const waveC = Math.sin((x + z) * 0.05) * 1.3;
  return Math.floor(2 + waveA + waveB + waveC);
}
```

- `key3(x, y, z)` → genera clave string `"x|y|z"` para Maps
- `BlockGeometry(1,1,1)` reutilizado, material único por bloque

---

## 4 · Controles FPS (PointerLock)

- `THREE.PointerLockControls(camera, document.body)` → bloqueo de ratón
- `controls.getObject()` añadido a la escena → posición del jugador
- `controls.moveForward(val)` y `controls.moveRight(val)` → movimiento
- Gravedad: `CONFIG.GRAVITY = -25`, salto: `CONFIG.JUMP_FORCE = 10`
- Eventos `lock`/`unlock` → activan/desactivan `state.locked`
- `state.keys` → objeto { KeyW, KeyA, KeyS, KeyD, Space }

```javascript
const controls = new THREE.PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// En applyMovement(delta):
state.velocityY += CONFIG.GRAVITY * delta;
pos.y += state.velocityY * delta;
if (pos.y < groundY) {
  pos.y = groundY;
  state.velocityY = 0;
  if (state.keys.Space) {
    state.velocityY = CONFIG.JUMP_FORCE;
  }
}
```

---

## 5 · Cristales — Colisión AABB

- `THREE.IcosahedronGeometry(0.35, 0)` + material emisivo (emissive: 0x0b5b85)
- 22 cristales iniciales, respawn tras `CRYSTAL_RESPAWN_SECONDS = 2.8`
- Detección: `orb.position.distanceTo(playerPos) < 1.1` → colisión esférica
- Al recoger: +25 score, +1 cristal, `sendEvent('collect_crystal')`, toast ok

```javascript
if (orb.position.distanceTo(playerPos) < 1.1) {
  scene.remove(orb);
  crystals.splice(i, 1);
  state.crystals += 1;
  state.score += 25;
  sendEvent("collect_crystal", 25, { crystals: state.crystals });
  showToast(`💎 Cristal recogido (${state.crystals})`, "ok");
  setTimeout(createCrystal, CONFIG.CRYSTAL_RESPAWN_SECONDS * 1000);
}
```

---

## 6 · IA Enemigos

- `BoxGeometry(0.9, 1.3, 0.9)` → material rojo emisivo
- `userData.hp = 3`, `userData.speed`, `userData.damageCooldown`
- Persecución: normalizar vector dirección jugador→enemigo, aplicar speed×delta
- Daño al jugador: `distance < 1.5` + cooldown ≤ 0 → −8 HP + cooldown = 1.0s
- **Escalado dinámico:** `dynamicEnemyMax = min(18, 6 + floor(elapsed / 10))`
- Spawn cada `ENEMY_SPAWN_SECONDS = 4.8`

```javascript
// Persecución
const dir = new THREE.Vector3(
  playerPos.x - enemy.position.x,
  0,
  playerPos.z - enemy.position.z,
).normalize();
enemy.position.x += dir.x * enemy.userData.speed * delta;

// Escalado
const dynamicEnemyMax = Math.min(
  CONFIG.ENEMY_MAX,
  6 + Math.floor(state.elapsed / 10),
);
```

---

## 7 · Combate por Raycaster

- `THREE.Raycaster()` desde centro de pantalla `(0, 0)` hacia cámara
- `raycaster.intersectObjects(enemies, false)` → array de hits
- Alcance máximo: 45 unidades
- Cada hit: −1 HP → si HP ≤ 0: eliminar enemigo
- **Combo:** si tiempo entre kills ≤ 3000ms → combo +1, si no → reset a 1
- Score: `35 + (combo - 1) * 5` por kill

```javascript
raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
const hit = raycaster.intersectObjects(enemies, false)[0];
if (!hit || hit.distance > 45) return;

enemy.userData.hp -= 1;
if (enemy.userData.hp <= 0) {
  state.combo = now - state.lastKillAt <= 3000 ? state.combo + 1 : 1;
  state.score += 35 + (state.combo - 1) * 5;
  scene.remove(enemy);
}
```

---

## 8 · Construcción de bloques

- Click derecho → `placeBuildBlock()`
- Requiere ≥ 2 cristales (consume 2)
- Dirección: `camera.getWorldDirection(dir)` → 3 unidades adelante
- Coordenada: `getGroundHeight(x, z)` (máx entre terreno y build previos)
- Material madera: color `0x8f6c41`
- Score: +8 por bloque

```javascript
const dir = new THREE.Vector3();
camera.getWorldDirection(dir);
const targetX = Math.floor(basePos.x + dir.x * 3);
const targetZ = Math.floor(basePos.z + dir.z * 3);
const targetY = getGroundHeight(targetX, targetZ);
// ...
state.crystals -= 2;
state.score += 8;
```

---

## 9 · Game loop y condiciones

- `requestAnimationFrame(animate)` → loop principal
- `delta = min(0.05, (now - lastTime) / 1000)` → framerate-independiente
- Cada frame: `applyMovement` → `updateCrystals` → `updateEnemies` → `updateSpawners` → `updateHud`
- **Victoria:** `elapsed >= 90` AND `crystals >= 12`
- **Derrota:** `health <= 0`
- `endGame(result)` → `finishSession()` + actualizar leaderboard/historial + mostrar overlay

```javascript
if (state.health <= 0) endGame("defeat");
if (
  state.elapsed >= CONFIG.TARGET_SURVIVAL_SECONDS &&
  state.crystals >= CONFIG.TARGET_CRYSTALS
) {
  endGame("victory");
}
```

---

## 10 · Backend Flask + SQLite

### Esquema (3 tablas)

| Tabla           | Columnas clave                                                                              | FK                  |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| `players`       | id, name (UNIQUE), created_at, last_seen                                                    | —                   |
| `game_sessions` | id, player_id, mode, result, score, crystals, enemies_defeated, survived_seconds, max_combo | → players(id)       |
| `game_events`   | id, session_id, event_type, event_value, payload_json                                       | → game_sessions(id) |

### Conexión + init

```python
DB_PATH = BASE_DIR / "voxel_quest.sqlite3"

def db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # acceso por nombre de columna
    return conn

def init_db():
    with db_connection() as conn:
        conn.executescript("PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS ...")
```

### API REST — 10 endpoints

| #   | Método | Ruta                       | Función                                          |
| --- | ------ | -------------------------- | ------------------------------------------------ |
| 1   | POST   | `/api/player/register`     | INSERT ... ON CONFLICT(name) DO UPDATE           |
| 2   | POST   | `/api/session/start`       | INSERT game_sessions, devuelve session_id        |
| 3   | POST   | `/api/session/event`       | INSERT game_events (telemetría)                  |
| 4   | POST   | `/api/session/end`         | UPDATE game_sessions con métricas finales        |
| 5   | GET    | `/api/leaderboard`         | SELECT JOIN ORDER BY score DESC LIMIT ?          |
| 6   | GET    | `/api/player/<id>/history` | SELECT sesiones WHERE player_id ORDER BY id DESC |
| 7   | GET    | `/api/stats`               | COUNT(\*) de players, sessions, events           |
| 8   | GET    | `/api/health`              | Health check → `{"ok": true}`                    |
| 9   | POST   | `/api/seed`                | 5 jugadores demo con randint para stats          |
| 10  | POST   | `/api/import`              | Re-inserta items de JSON exportado               |

### Registro de jugador (UPSERT)

```python
conn.execute(
    "INSERT INTO players (name) VALUES (?) "
    "ON CONFLICT(name) DO UPDATE SET last_seen=CURRENT_TIMESTAMP",
    (name,))
row = conn.execute(
    "SELECT id, name, created_at, last_seen FROM players WHERE name = ?",
    (name,)).fetchone()
```

### Leaderboard (JOIN + ORDER)

```python
rows = conn.execute("""
    SELECT s.id, p.name AS player_name, s.result, s.score,
           s.crystals, s.enemies_defeated, s.survived_seconds, s.max_combo
      FROM game_sessions s
      JOIN players p ON p.id = s.player_id
     WHERE s.ended_at IS NOT NULL
     ORDER BY s.score DESC, s.survived_seconds DESC
     LIMIT ?""", (limit,)).fetchall()
```

---

## 11 · Funciones v2 clave

### showDamageFlash()

```javascript
function showDamageFlash() {
  damageFlash.classList.add("active");
  setTimeout(() => damageFlash.classList.remove("active"), 220);
}
```

- Usa CSS `#damageFlash` con `radial-gradient` + `opacity` transition

### showCombo(n)

```javascript
function showCombo(n) {
  comboIndicator.textContent = `×${n} COMBO`;
  comboIndicator.classList.remove("show");
  void comboIndicator.offsetWidth; // forzar reflow para reiniciar animación
  comboIndicator.classList.add("show");
}
```

- `void offsetWidth` → truco para forzar reflow y reiniciar `@keyframes comboFloat`

### showToast(msg, type)

```javascript
function showToast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`; // ok | info | warning | danger
  el.textContent = msg;
  toastBox.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}
```

- Auto-eliminación con `animationend` (no necesita setTimeout)
- `toastUp` dura 2.4s con fade in/out

### updateObjectiveKPIs()

```javascript
function updateObjectiveKPIs() {
  const cDone = state.crystals >= CONFIG.TARGET_CRYSTALS;
  const tDone = state.elapsed >= CONFIG.TARGET_SURVIVAL_SECONDS;
  objCrystals.className = `obj-kpi${cDone ? " done" : ""}`;
  objCrystals.querySelector(".value").textContent =
    `${state.crystals} / ${CONFIG.TARGET_CRYSTALS}`;
}
```

### Health bar dinámica

```javascript
const pct = Math.max(0, state.health);
healthFill.style.width = `${pct}%`;
healthFill.className =
  "health-fill" + (pct <= 25 ? " danger" : pct <= 50 ? " warning" : "");
```

- `danger` (≤25%) → rojo + pulse | `warning` (≤50%) → ámbar | normal → verde

---

## 12 · Seed / Export / Import

### Seed (frontend → backend)

```javascript
async function seedData() {
  const res = await api("/api/seed", "POST");
  if (res.ok) showToast(`🌱 ${res.inserted} partidas demo insertadas`, "ok");
}
```

### Export (descarga JSON)

```javascript
const lb = await api("/api/leaderboard?limit=50");
const st = await api("/api/stats");
const blob = new Blob(
  [JSON.stringify({ leaderboard: lb.items, stats: st }, null, 2)],
  { type: "application/json" },
);
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = `voxel_quest_export_${Date.now()}.json`;
a.click();
```

### Import (input file → POST)

```javascript
importFile.addEventListener("change", async () => {
  const text = await file.text();
  const json = JSON.parse(text);
  const res = await api("/api/import", "POST", json);
  if (res.ok) showToast(`📤 ${res.imported} partidas importadas`, "ok");
});
```

---

## 13 · CSS — Design System v2

### Tokens (30+ variables)

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
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 14px;
  --shadow-panel: 0 12px 30px rgba(0, 0, 0, 0.35);
  --font: Inter, -apple-system, sans-serif;
  --t-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Animaciones (6 @keyframes)

| Nombre       | Uso                       | Duración      |
| ------------ | ------------------------- | ------------- |
| `fadeIn`     | Aparición de paneles      | 0.4s          |
| `scaleIn`    | Cards de overlay y KPI    | 0.35s         |
| `toastUp`    | Notificaciones toast      | 2.4s          |
| `comboFloat` | Texto `×N COMBO` flotante | 1.2s          |
| `pulse`      | Barra de vida en danger   | 0.8s infinite |
| `shake`      | Efecto de temblor         | —             |

### Responsive (3 breakpoints)

| Breakpoint | Cambios                                           |
| ---------- | ------------------------------------------------- |
| `≤ 1000px` | Panel derecho: 320px; ek-grid gap: 8px            |
| `≤ 760px`  | Panel derecho: oculto; HUD: 92vw centrado         |
| `≤ 480px`  | HUD padding: 8px; grid 1fr 1fr; ek-grid 1 columna |

---

## 14 · Resumen de las 14 mejoras v2

| #   | Mejora              | Clave técnica                                     |
| --- | ------------------- | ------------------------------------------------- |
| 1   | Tokens CSS          | 30+ custom properties en `:root`                  |
| 2   | Barra de salud      | `.health-fill` + clases warning/danger dinámicas  |
| 3   | Flash de daño       | `#damageFlash` radial-gradient + classList toggle |
| 4   | Combo flotante      | `void offsetWidth` reflow + comboFloat keyframe   |
| 5   | Toasts contextuales | `animationend` auto-remove, 4 variantes de color  |
| 6   | KPIs de objetivo    | `.obj-kpi.done` → color verde al completar        |
| 7   | KPI cards fin       | `.ek-grid` 2×2 con animation-delay escalonado     |
| 8   | Rank badges         | `.rank-badge.gold/silver/bronze` en top 3         |
| 9   | Result badges       | `.result-badge.victory/defeat` en historial       |
| 10  | Seed demo           | `/api/seed` + SEED_NAMES + randint para stats     |
| 11  | Exportar JSON       | `Blob` + `URL.createObjectURL` + `a.click()`      |
| 12  | Importar JSON       | `<input type="file">` + `file.text()` + POST      |
| 13  | Responsive          | 3 media queries (1000/760/480 px)                 |
| 14  | Animaciones         | 6 @keyframes en CSS puro                          |
