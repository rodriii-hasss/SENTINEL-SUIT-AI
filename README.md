# SENTINEL RESCUE-X

Sistema simulado de asistencia y rescate de astronautas — prototipo educativo para clase y preparación del NASA Space Apps Challenge 2026.

Lema: **«Cuando el astronauta no puede pedir ayuda, su traje debe saber cómo actuar»**

> Aviso: prototipo 100% simulado. Todos los datos son ficticios.
> No está afiliado a NASA ni respaldado, probado o aprobado por ninguna agencia.
> Las alertas no tienen valor médico ni aeroespacial real.

---

## Cómo ejecutar la aplicación

Requisitos: **Node.js 18 o superior** (probado con Node 20) y npm.

```powershell
cd "C:\Users\rodri\OneDrive\Escritorio\proyecto la nasa"
npm install
npm start
```

Abre en el navegador: **http://127.0.0.1:3000**

Para detener el servidor: `Ctrl + C` en la terminal.

Si el puerto 3000 está ocupado:

```powershell
$env:PORT=3001; npm start
```

También se puede abrir `index.html` con doble clic (modo sin servidor). En ese caso no hay SQLite ni IA del servidor: la app usa `localStorage`, muestra `DB LOCAL (SIN SERVIDOR)` y conserva todas las funciones de simulación, ML, historial y rover.

### IA de alerta opcional (OpenAI)

Sin clave funciona la **heurística local del servidor**. Para usar OpenAI:

1. Copia `.env.example` como `.env`.
2. Rellena `OPENAI_API_KEY` (opcionalmente `OPENAI_MODEL`).
3. Reinicia con `npm start`.

La clave nunca se envía al navegador. Si OpenAI falla o no hay cuota, el servidor responde con la heurística local.

---

## Estructura del proyecto

```
proyecto la nasa/
├── index.html            Interfaz (6 pestañas)
├── style.css             Tema espacial oscuro y responsive
├── script.js             Motor de reglas, telemetría, ML, BFS, informes y persistencia
├── i18n.js               Diccionario y selector español / inglés
├── server.js             Servidor HTTP, API REST y SQLite (better-sqlite3)
├── sw.js                 Service worker de la PWA
├── manifest.webmanifest  Manifest de instalación
├── threejs/
│   ├── scene.js          Escena lunar 3D (Three.js global) con ruta y obstáculos
│   └── three.core.js     Copia local de Three.js (referencia)
├── icons/                Iconos de la PWA
├── scripts/gen-icon.js   Generador de iconos
├── sentinel.db           Base de datos SQLite (se crea/usa al arrancar)
├── .env.example          Plantilla de configuración opcional
└── README.md             Este archivo
```

La carpeta `_backup_20261028-134237` contiene los archivos y la base de datos originales previos a la reparación, además de una copia de la base con datos de prueba.

---

## Pestañas de la aplicación

| Pestaña | Qué hace |
|---|---|
| **Control misión** | Estado de la misión, 8 indicadores simulados, traje con estado normal/atención/crítico, clasificador ML en vivo y gráfica de los últimos 90 ciclos. |
| **Simulador** | 8 escenarios: normal, desmayo, caída, anomalía fisiológica, presión, CO₂, pérdida de comunicación y batería baja. Consola de secuencia, tiempos de respuesta y cola. |
| **Centro de control** | Incidente activo, condición disparadora, datos, comprobaciones, incertidumbres, estado de comunicaciones y cola de retransmisión, protocolo, rescate, evaluación de IA e informe. |
| **Rover rescate** | Mapa lunar 3D (Three.js) con fallback 2D, obstáculos, ruta BFS de 4 direcciones, distancia, progreso, bloqueo total de demostración y vista 3D/2D. |
| **Historial y pruebas** | Registro con filtros, métricas reales de la sesión, eventos SQLite y exportación `.txt`. |
| **Acerca del proyecto** | Problema, solución, innovación, tecnologías, límites, comparación con un traje real y aviso de no afiliación con NASA. |

---

## Flujo de demostración

1. **Control misión**: indicadores estables, gráfica en movimiento y traje en verde.
2. **Simulador → Caída + inmovilidad**: la consola registra la detección; tras 3 ciclos persistentes se confirma la alerta crítica y suena el aviso.
3. **Centro de control**: se guarda el incidente en SQLite, se muestra la evaluación de IA y se activa el protocolo de contingencia.
4. **Rover rescate**: el rover calcula la ruta con BFS y avanza celda a celda; la distancia y el porcentaje se actualizan en vivo.
5. **Pérdida de comunicación**: el enlace pasa a `SIN ENLACE`; los avisos quedan en cola. Al restaurar el enlace (o volver a normal) se marcan como enviados.
6. **Bloqueo total (demo)**: al iniciar la ruta el planificador explica que no existe camino y por qué.
7. **Informe**: se genera localmente y se puede exportar como `.txt`.
8. **Reiniciar**: limpia historial y métricas locales; con el servidor activo también vacía las tablas de eventos, incidentes y evaluaciones.

---

## Motor de detección

El motor de reglas determinista es el que decide las alertas:

- **Detección**: una señal sale del umbral programado (por ejemplo, FC < 52 lpm).
- **Verificación**: se exige persistencia de **3 ciclos** y se combinan señales (FC + inmovilidad, orientación + inmovilidad, etc.).
- **Confirmación simulada**: se emite una **posible emergencia**, con condición disparadora, comprobaciones ficticias e incertidumbres declaradas.

Umbrales principales (didácticos, no clínicos):

| Señal | Umbral de alerta |
|---|---|
| FC | ≤ 52 lpm o ≥ 128 lpm |
| SpO₂ | ≤ 93 % |
| Presión del traje | ≤ 84 kPa |
| CO₂ | ≥ 1.10 % |
| Batería | ≤ 25 % |
| Actividad | ≤ 6 (inmovilidad) |
| Orientación | desviación ≥ 58° |
| Temperatura | ≤ 35.8 °C o ≥ 38.2 °C |

Clases del clasificador ML (regresión softmax en el navegador): normal, colapso, caída, fisiológica, presión, CO₂ y batería. El ML solo anticipa el tipo; **la alerta la decide el motor de reglas**.

---

## Persistencia y API

Con el servidor activo, SQLite guarda:

- `events`: registro cronológico.
- `incidents`: incidente, condición, comprobaciones, incertidumbres y entrega.
- `ai_evaluations`: evaluación de IA con fuente, modelo y puntuación.
- `ml_models`: versiones del modelo con exactitud y muestras.

Endpoints principales:

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/health` | Estado del servidor, SQLite e IA |
| GET/POST | `/api/events` | Leer o guardar eventos |
| GET/POST | `/api/incidents` | Leer o guardar incidentes |
| GET | `/api/stats` | Totales y último incidente |
| POST | `/api/ai/alert` | Evaluación con OpenAI o heurística local |
| GET/POST | `/api/ml/model` | Último modelo o guardar uno nuevo |
| GET | `/api/ml/models` | Listado de modelos |
| POST | `/api/reset` | Vaciar eventos, incidentes y evaluaciones |

El frontend guarda además historial, métricas, telemetría, cola y pesos ML en `localStorage` con la clave `sentinel-rescue-x-v1`.

> `/api/reset` es destructivo: borra el historial de SQLite. La interfaz pide confirmación antes de ejecutarlo.

---

## PWA y modo sin conexión

- Al servirse por HTTP, `sw.js` se registra y cachea la app (incluido `threejs/scene.js`).
- La app es instalable desde el botón `INSTALAR APP` cuando el navegador lo permite.
- Sin Internet, la app sigue funcionando; la escena 3D cae automáticamente a un mapa 2D si Three.js no está disponible.
- Abriendo el archivo directamente (`file://`) se usa el modo sin servidor con `localStorage`.

---

## Comprobaciones

```powershell
npm test
```

El script ejecuta `node --check` sobre `script.js`, `i18n.js`, `sw.js`, `server.js`, `threejs/scene.js` y `scripts/gen-icon.js`.

Comprobación manual rápida:

1. `npm start` y abrir `http://127.0.0.1:3000` → Control misión visible.
2. Simulador → cada escenario de emergencia genera su alerta en menos de 30 s.
3. Centro de control → incidente + evaluación de IA + informe.
4. Rover → ruta y avance; bloqueo total → sin ruta.
5. Historial → métricas y exportación.
6. `EN` → interfaz en inglés; `ES` → español.

---

## Seguridad y límites

- Los umbrales son valores didácticos, no límites médicos ni aeroespaciales.
- El servidor escucha en `127.0.0.1` por defecto; no exponer la demo a Internet sin autenticación.
- La clave de OpenAI vive solo en `.env` del servidor.
- El rover es un personaje virtual: no representa robótica real.
- La IA y el ML son apoyo narrativo: no controlan el traje, no suprimen alertas y no emiten diagnósticos.
