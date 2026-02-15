# Voxel Quest Studio (PMDM · DAM2)

Prototipo de videojuego 3D basado en los ejercicios de clase de Three.js de mundo de bloques (`010-bloques` a `017-colision suavizada`) y ampliado con mecánicas de juego completas + persistencia SQL.

## Qué incluye

- Movimiento FPS con `PointerLockControls`, gravedad y salto.
- Mundo voxel procedural (tema idéntico al ejercicio base de clase).
- Sistema de cristales, enemigos, daño y condición de victoria/derrota.
- Construcción de bloques en tiempo real (consumo de recursos).
- HUD avanzado y panel lateral con ranking e historial.
- Backend Flask + SQLite con:
  - jugadores,
  - sesiones de partida,
  - eventos de telemetría de juego,
  - leaderboard persistente.

## Ejecutar

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abrir:

- `http://127.0.0.1:5090`

## Controles

- `WASD`: mover
- `Espacio`: saltar
- `Ratón`: mirar
- `Click izquierdo`: disparar enemigo
- `Click derecho`: construir bloque (consume 2 cristales)

## Objetivo de partida

- Sobrevive al menos `90` segundos y consigue `12` cristales.

## Estructura

- `app.py`: API + SQLite + servidor web
- `templates/index.html`: HUD, overlays y panel de ranking
- `static/game.js`: lógica principal del videojuego
- `static/styles.css`: estilo visual completo
- `docs/Actividad_CrearVideojuego_53945291X.md`: justificación de entrega
