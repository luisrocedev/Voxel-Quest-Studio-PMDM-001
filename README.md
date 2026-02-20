# Voxel Quest Studio — PMDM · DAM2

> Videojuego 3D voxel (bloques estilo Minecraft) desarrollado con **Three.js + WebGL** y backend **Flask + SQLite**.
> Proyecto de la asignatura _Programación Multimedia y Dispositivos Móviles_ (001-Crear un videojuego).

**Alumno:** Luis Rodríguez Cedeño · 53945291X  
**Fecha:** 17 de febrero de 2026

---

## Qué incluye

| Capa                 | Tecnología                             | Descripción                               |
| -------------------- | -------------------------------------- | ----------------------------------------- |
| **Motor 3D**         | Three.js r128 + WebGL                  | Renderizado, sombras PCF, niebla          |
| **Controles FPS**    | PointerLockControls                    | WASD + ratón, gravedad y salto            |
| **Mundo procedural** | Terreno voxel (ondas sinusoidales)     | ~4600 bloques, 3 tipos de material        |
| **IA Enemigos**      | Pathfinding simple + escalado temporal | Hasta 18 enemigos concurrentes            |
| **Combate**          | Raycaster                              | Disparo click izq, combo × kills          |
| **Construcción**     | Raycast + recursos                     | Click derecho, consume 2 cristales        |
| **Backend**          | Flask 3.0 + SQLite                     | API REST, sesiones, telemetría            |
| **Persistencia**     | SQLite3                                | Jugadores, sesiones, eventos, leaderboard |

## Ejecutar

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abrir: **http://127.0.0.1:5090**

## Controles

| Tecla             | Acción                          |
| ----------------- | ------------------------------- |
| `WASD`            | Mover                           |
| `Espacio`         | Saltar                          |
| `Ratón`           | Mirar (Pointer Lock)            |
| `Click izquierdo` | Disparar enemigo                |
| `Click derecho`   | Construir bloque (−2 cristales) |

## Objetivo de partida

Sobrevive al menos **90 segundos** y recoge **12 cristales**.  
Los enemigos escalan en cantidad y velocidad con el tiempo transcurrido.

## API REST

| Método | Ruta                       | Descripción                   |
| ------ | -------------------------- | ----------------------------- |
| `POST` | `/api/player/register`     | Registra/recupera jugador     |
| `POST` | `/api/session/start`       | Inicia sesión de partida      |
| `POST` | `/api/session/event`       | Registra evento de telemetría |
| `POST` | `/api/session/end`         | Finaliza sesión con métricas  |
| `GET`  | `/api/leaderboard`         | Top N partidas                |
| `GET`  | `/api/player/<id>/history` | Historial del jugador         |
| `GET`  | `/api/stats`               | Estadísticas globales         |
| `GET`  | `/api/health`              | Health check                  |
| `POST` | `/api/seed`                | Inserta 5 partidas demo       |
| `POST` | `/api/import`              | Importa partidas desde JSON   |

## Estructura

```
app.py                  ← API + SQLite + servidor web
templates/index.html    ← HUD, overlays y paneles
static/game.js          ← Lógica Three.js del videojuego
static/styles.css       ← Design System v2 completo
requirements.txt        ← Dependencia Flask
docs/Actividad_CrearVideojuego_53945291X.md  ← Justificación entrega
Actividad_CrearVideojuego_53945291X.md       ← Actividad con desarrollo completo
```

## 14 mejoras (Design System v2)

1. **Tokens CSS** — 30+ custom properties centralizados
2. **Barra de salud visual** — Color dinámico verde→ámbar→rojo
3. **Flash de daño** — Vignette roja al recibir impacto
4. **Combo flotante** — Indicador `×N COMBO` con animación
5. **Toasts contextuales** — 4 tipos (ok/info/warning/danger)
6. **KPIs de objetivo** — Cristales y supervivencia en tiempo real
7. **KPI cards fin de partida** — 4 tarjetas con métricas finales
8. **Rank badges** — Insignias oro/plata/bronce en leaderboard
9. **Result badges** — Victoria/derrota estilizados en historial
10. **Seed demo** — Insertar 5 partidas ficticias
11. **Exportar JSON** — Descarga leaderboard + estadísticas
12. **Importar JSON** — Carga partidas desde archivo exportado
13. **Responsive** — Breakpoints 1000/760/480 px
14. **Animaciones** — fadeIn, scaleIn, toastUp, comboFloat, pulse, shake
