# Actividad 001 · Crear un videojuego

**Módulo:** Programación multimedia y dispositivos móviles  
**Curso:** DAM2  
**Alumno:** 53945291X  
**Fecha:** 15/02/2026

## 1) Punto de partida (respeto al ejercicio de clase)

El proyecto parte de la misma temática y línea técnica trabajada en clase: **videojuego 3D de bloques en Three.js**.

Referencias directas usadas como base:

- `001-Análisis de motores de juegos/008-Aplicación de modificaciones sobre juegos existentes/101-Ejercicios/010-bloques.html`
- `.../013-mas mejoras.html`
- `.../017-colision suavizada.html`

Se respeta el tipo de ejercicio (mundo voxel 3D y controles FPS), evolucionándolo a una versión mucho más completa.

## 2) Modificaciones estéticas y visuales (calado alto)

1. Rediseño completo de interfaz de juego:
   - HUD dinámico (vida, score, cristales, enemigos, combo y tiempo).
   - Panel lateral con objetivos, leaderboard e historial.
   - Overlays de inicio y fin de partida con feedback.

2. Mejora visual del entorno:
   - Cielo/fog, iluminación hemisférica + direccional con sombras.
   - Cristales emisivos animados y enemigos con material propio.
   - Crosshair y composición visual responsive.

3. UX de partida:
   - Señalización clara de controles y objetivos.
   - Flujo de inicio/reintento integrado.

## 3) Modificaciones funcionales (código + base de datos, calado alto)

1. Mecánicas de juego avanzadas:
   - Condición de victoria/derrota.
   - IA básica de enemigos con escalado de presión por tiempo.
   - Sistema de combate por raycast (disparo), vida y daño.
   - Recolección de recursos + construcción de bloques consumiendo recursos.

2. Persistencia SQL real (SQLite):
   - `players`: registro de jugadores.
   - `game_sessions`: sesiones completas con métricas finales.
   - `game_events`: auditoría granular de eventos de juego.

3. Capa API propia con Flask:
   - Registro de jugador.
   - Inicio/cierre de sesión de partida.
   - Registro de eventos en tiempo real.
   - Ranking global e historial por jugador.

Esto implica una ampliación estructural muy relevante frente al ejercicio de clase inicial.

## 4) Cumplimiento rúbrica (4 puntos de siempre)

- Se parte de ejemplo real de clase y se mantiene la temática base.
- Se aplican cambios visuales extensos y comprobables.
- Se aplican cambios funcionales de gran calado técnico.
- Se incorpora base de datos y arquitectura cliente-servidor para trazabilidad y evaluación de partidas.

## 5) Entrega técnica

Ruta de entrega:

- `Programación multimedia y dispositivos móviles/301-Actividades final de unidad - Segundo trimestre/001-Crear un videojuego/voxel_quest_studio`

Contenido principal:

- `app.py`
- `templates/index.html`
- `static/game.js`
- `static/styles.css`
- `requirements.txt`
- `README.md`
- `docs/Actividad_CrearVideojuego_53945291X.md`
