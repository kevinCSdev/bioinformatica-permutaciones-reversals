# Laboratorio de Permutaciones y Reversals (UBB)

Laboratorio interactivo de **Bioinformática** de la Universidad del Bío-Bío. El
sistema aborda dos problemas de genómica comparativa: la enumeración de
permutaciones sobre secuencias biológicas y el cálculo de distancias de
reordenamiento cromosómico mediante inversiones (*reversals*). El backend se
implementa en **FastAPI** y concentra los motores algorítmicos en Python; el
frontend se construye en **TypeScript y Tailwind CSS** sobre Vite. Toda la
teoría, el análisis y el código comentado se sirven desde la propia interfaz,
sin material externo.

La interfaz aplica el sistema de color de **Google Material Design 3 (M3)**
sobre tokens semánticos definidos en `frontend/src/style.css`, con las
tipografías **Poppins** para el texto y **JetBrains Mono** para el código.

## Funcionalidades

- **Función 1 · Permutaciones:** benchmark de seis variantes (backtracking,
  `itertools`, Heap iterativo, poda multinomial, Narayana in-place y línea base
  con `set`), con medición separada de tiempo (`timeit`) y memoria
  (`tracemalloc`).
- **Función 2 · Reversal sin dirección:** mínimo de giros ignorando la
  orientación, resuelto con A* (heurística admisible `⌈b/2⌉`) o heurística voraz.
- **Función 3 · Reversal con dirección (+/-):** reordenamiento guiado por el
  grafo de puntos de ruptura (cota de Bafna–Pevzner `(n+1) − c(π)`).
- **Función 4 · Comparación paralela:** trazas sincronizadas F2 vs F3 sobre la
  misma instancia, incluyendo el efecto físico real de los giros de F2 sobre la
  hebra.
- **Casos precargados:** 13 instancias de prueba repartidas entre las cuatro
  funciones, definidas en `frontend/src/data/presets.ts`.
- **Informe integrado:** ficha del trabajo, fundamento biológico, análisis
  algorítmico y visor del código Python real.

## Requisitos

- Python 3.11+ (probado con 3.14)
- Node.js 18+ y npm

## Instalación y ejecución (1 comando)

Desde `App/`, un solo comando crea el entorno, instala dependencias, compila
el frontend y levanta el servidor unificado:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && npm --prefix frontend install && npm --prefix frontend run build && .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Luego abre <http://127.0.0.1:8000>: FastAPI sirve la interfaz compilada y los
endpoints `/api/*` desde el mismo puerto.

## Inicio posterior (con `.venv` ya creado)

Si ya ejecutaste la instalación, no hace falta repetirla. Para volver a levantar
el proyecto basta con iniciar el servidor unificado:

```bash
.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Abre <http://127.0.0.1:8000>. Si modificaste el frontend, recompílalo antes con
`npm --prefix frontend run build`; si modificaste el backend, agrega `--reload`
para recargar los cambios automáticamente.

## Modo desarrollo (dos terminales)

```bash
# Terminal 1 — API con recarga automática
.venv/bin/uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Vite con HMR (proxy /api -> 127.0.0.1:8000)
npm --prefix frontend run dev
```

La interfaz de desarrollo queda en <http://127.0.0.1:5173>.

## Pruebas

```bash
# Backend (pytest)
.venv/bin/pytest -q

# Frontend: tipos estrictos y pruebas unitarias
npm --prefix frontend run typecheck
npm --prefix frontend test
```

El backend cubre API, permutaciones y reversals en `tests/`. En el frontend,
`services/sequenceInput.test.ts` y `state/StepperState.spec.ts` verifican el
parseo de secuencias y el estado del reproductor de trazas.

## Endpoints de la API

| Método | Ruta                          | Descripción                                   |
| ------ | ----------------------------- | --------------------------------------------- |
| GET    | `/api/health`                 | Sonda de salud                                |
| POST   | `/api/permutations/benchmark` | Función 1 · benchmark de permutaciones        |
| POST   | `/api/reversal/undirected`    | Función 2 · reversal sin dirección            |
| POST   | `/api/reversal/directed`      | Función 3 · reversal con dirección (+/-)      |
| POST   | `/api/reversal/parallel`      | Función 4 · comparación paralela F2 vs F3     |
| GET    | `/api/source-code`            | Código Python comentado para el visor         |

## Sistema de diseño (M3)

La paleta define roles semánticos M3 como utilidades de Tailwind v4 en
`frontend/src/style.css`. Las superficies se aclaran hacia el blanco y conservan
el tono azul en las tarjetas de información (`#d4e7f8`).

Cada token `--color-md-*` se expone como utilidad semántica de Tailwind v4
(`bg-md-surface`, `text-md-on-surface`, `border-md-error`, etc.), de modo que los
componentes no usan colores literales. El mapeo completo de roles es el
siguiente.

### Superficies y contenedores

| Rol M3                    | Token                             | Valor     | Uso                                      |
| ------------------------- | --------------------------------- | --------- | ---------------------------------------- |
| Surface                   | `md-surface`                      | `#e7f2fc` | Lienzo general de la aplicación          |
| Surface Bright            | `md-surface-bright`               | `#d4e7f8` | Tarjetas de información y paneles        |
| Surface Container High    | `md-surface-container-high`       | `#cde1f6` | Panel lateral de navegación              |
| Surface Container         | `md-surface-container`            | `#c3daf3` | Métricas, desgloses y cajas internas     |
| Surface Container Highest | `md-surface-container-highest`    | `#b6d1ef` | Inputs y controles                       |
| On Surface                | `md-on-surface`                   | `#141c26` | Texto principal y títulos                |
| On Surface Variant        | `md-on-surface-variant`           | `#283747` | Subtítulos, etiquetas e iconos inactivos |
| Outline                   | `md-outline`                      | `#547291` | Bordes de foco y divisores enfáticos     |
| Outline Variant           | `md-outline-variant`              | `#82aada` | Bordes sutiles y separadores             |

### Acentos

| Rol M3                    | Token                          | Valor     | Uso                                  |
| ------------------------- | ------------------------------ | --------- | ------------------------------------ |
| Primary                   | `md-primary`                   | `#125596` | Acción principal                     |
| On Primary                | `md-on-primary`                | `#ffffff` | Texto e iconos sobre el primario     |
| Primary Container         | `md-primary-container`         | `#9ec9f7` | Ítem de navegación activo            |
| On Primary Container      | `md-on-primary-container`      | `#001c3b` | Texto del ítem activo                |
| Secondary                 | `md-secondary`                 | `#405468` | Controles de paso a paso             |
| Secondary Container       | `md-secondary-container`       | `#a0c7ed` | Badges y chips informativos          |
| On Secondary Container    | `md-on-secondary-container`    | `#0d1a29` | Texto sobre contenedores secundarios |
| Tertiary                  | `md-tertiary`                  | `#00677d` | Hebra `+` y soluciones óptimas       |
| Tertiary Container        | `md-tertiary-container`        | `#b5ebff` | Fondo de bloques de la hebra `+`     |
| On Tertiary Container     | `md-on-tertiary-container`     | `#001f28` | Texto sobre el contenedor terciario  |
| Error                     | `md-error`                     | `#ba1a1a` | Tramo invertido `[i..j]`             |
| Error Container           | `md-error-container`           | `#ffdad6` | Fondo de bloques en inversión        |
| On Error Container        | `md-on-error-container`        | `#410002` | Texto sobre bloques en inversión     |

### Tokens biológicos e inversas

| Rol M3                    | Token                          | Valor     | Uso                                    |
| ------------------------- | ------------------------------ | --------- | -------------------------------------- |
| Strand Minus              | `md-strand-minus`              | `#9c4300` | Símbolo de la hebra `−`                |
| Strand Minus Container    | `md-strand-minus-container`    | `#ffdbcb` | Fondo de bloques de la hebra `−`       |
| Breakpoint                | `md-breakpoint`                | `#825500` | Marcador de punto de ruptura `⚡`       |
| Inverse Surface           | `md-inverse-surface`           | `#2b3440` | Fondo del visor de código              |
| Inverse On Surface        | `md-inverse-on-surface`        | `#eaf1f9` | Texto del visor de código              |

### Aplicación a componentes

- **Navigation Drawer:** el panel lateral usa `md-surface-container-high` con
  borde `md-outline-variant`; el ítem activo es una píldora
  `md-primary-container` sobre `md-on-primary-container`.
- **Lienzo de trabajo:** `<main>` usa `md-surface`; las tarjetas de algoritmo y
  las métricas usan `md-surface-bright`, y sus cajas internas
  `md-surface-container`.
- **Bloques de secuencia:** los bloques normales usan `md-surface-bright` con
  borde `md-outline-variant`; la hebra `+` se marca en `md-tertiary` y la hebra
  `−` en `md-strand-minus`.
- **Inversión activa:** el tramo `[i..j]` se resalta con `md-error` y
  `md-error-container`, y los puntos de ruptura con `md-breakpoint`.
- **Visor de código:** usa `md-inverse-surface` y `md-inverse-on-surface` con la
  tipografía monoespaciada.

## Estructura

```text
App/
├── backend/
│   ├── main.py              # FastAPI: endpoints /api/* y montaje del bundle
│   ├── schemas.py           # Modelos Pydantic de entrada y salida
│   └── core/
│       ├── permutations.py
│       ├── reversal_unsigned.py
│       ├── reversal_signed.py
│       └── parallel_compare.py
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── style.css        # Tokens M3 (@theme) y estilos base
│       ├── data/            # presets.ts: casos biológicos precargados
│       ├── services/        # apiClient.ts, sequenceInput.ts (+ test)
│       ├── state/           # StepperState.ts (+ spec)
│       ├── types/           # api.ts, ui.ts
│       └── ui/              # vistas (Benchmark, Reversal, Parallel, Report), Sidebar, tokens
├── tests/                   # pytest del backend
├── conftest.py
└── requirements.txt
```

## Límites

- Función 1: secuencias de 1 a 8 símbolos.
- Funciones 2, 3 y 4: 1 a 10 bloques **distintos** (los reordenamientos requieren
  marcadores sinténicos únicos; los multiconjuntos se estudian en la Función 1).
- Si una búsqueda óptima agota su presupuesto de tiempo, la traza se marca como
  *aproximada* y se reporta la mejor solución encontrada.
