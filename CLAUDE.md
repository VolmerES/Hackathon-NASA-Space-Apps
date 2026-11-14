# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Qué hay

Proyecto del NASA Space Apps Challenge 2026 (Madrid, 14–15 nov), reto
[Lunar Landing Site Navigator](docs/retos/lunar-landing-site-navigator.md).

- `docs/`: documentación interna en castellano. `README.md` resume cada
  fichero. `docs/STACK.md` y `docs/PLAN.md` son la propuesta de antes de
  programar: donde no coincidan con `web/`, lo que manda es el código.
- `web/`: la aplicación (Vite + React 19 + TypeScript + Tailwind 4, three.js;
  las gráficas son SVG a mano). No hay `pipeline/` aparte: los scripts de datos están en
  `web/scripts/`.

## Comandos (`web/`, Node ≥ 20.19)

```bash
cd web
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b + vite build → web/dist/
npm run lint      # oxlint
npm run preview   # sirve el build
```

No hay pruebas automáticas en el repo.

## Arquitectura

**Todo se calcula en el navegador a partir de ficheros estáticos; no hay
servidor.** `web/src/data/model.ts` es el núcleo: `loadData()` lee
`web/public/data/` (`sites.json`, `horizons.json`, `subpoints.json`,
`madrid.json`, `validation.json`) y de ahí salen la simulación hora a hora y
las métricas de cada sitio y fecha.

- **`subpoints.json`**: puntos subsolar y subterrestre y distancia Tierra–Luna
  cada hora, de JPL Horizons (DE441, con libración). La posición del Sol y la
  Tierra en cualquier sitio se deriva de ellos. Se validó contra consultas
  directas a Horizons por sitio (`data-raw/horizons-per-site/`).
- **`horizons.json`** y **`sites.json`**: horizonte de relieve de cada sitio
  (720 valores, cada 0,5° de acimut) trazado sobre LOLA, y los 130 sitios
  candidatos de Wueller et al. (2026) en las 16 regiones de Artemis. Las
  coordenadas personalizadas usan una esfera lisa (`ideal: true`) y la
  interfaz lo avisa.
- **`madrid.json`**: elevación de la Luna sobre la estación de espacio profundo
  de Madrid (Robledo).
- Convenios: grados, UTC, acimut desde el norte local en sentido horario.

Los datos se regeneran con los scripts de `web/scripts/` (Python con `numpy`,
`tifffile` y `PIL`; cada uno documenta su uso en la cabecera). Se ejecutan
con `python -P` o `-I` y escriben en `web/public/data/` o `web/public/moon/`.
Esos ficheros generados sí van en git porque son lo que se sirve.

Interfaz: `web/src/App.tsx` orquesta el flujo guiado (buscar sitio →
respuesta → paneles opcionales). Las piezas grandes están en
`web/src/components/` (`MoonScene` y `Surface3D` con three.js, `Panorama`).
El escenario va en la URL (`scenario.ts`).

**Misiones** (`web/src/missions.ts`, `components/Missions.tsx`): misiones y escenarios guardados
solo en el navegador (`localStorage`), sin servidor. Ojo con los nombres: `Mission` en `model.ts`
son los parámetros de la estancia con los que corre el modelo (fecha, días, potencia, batería,
requisitos); `MissionDef` es la misión que los rellena. Los requisitos de la misión son los umbrales
de `verdictOf()`, así que veredicto, calendario y ranking los siguen. Las simulaciones no se guardan:
se recalculan siempre.

**Es bilingüe** (`web/src/i18n.tsx`): inglés por defecto, español con `l=es`.
Cualquier texto nuevo de la interfaz lleva las dos versiones.

PWA a mano (`public/sw.js`, `manifest.webmanifest`): funciona sin conexión
tras la primera visita. Se publica en `nasaspaceapps.volmer.es` con nginx en
contenedor detrás de Caddy (`web/deploy/`).

## Al trabajar

- Los avances del hackathon se marcan en [`docs/HACKATHON.md`](docs/HACKATHON.md).
- En `docs/IA.md`, las entradas del día van bajo su fecha con la tabla
  `Qué | Qué hizo la IA | Qué hizo el equipo | Comprobado`.
- Commits en castellano, con una línea `IA: <qué hizo>` en el cuerpo y **sin**
  `Co-Authored-By` (esto manda sobre la atribución por defecto).
