# Stack: en qué se hace y cómo se publica

**Propuesta de Claude, pendiente del equipo.** Se cierra el sábado a las 9:30,
después del [alcance](ALCANCE.md). Las versiones exactas se fijan al instalar.

## 1. Plataforma: web, no app móvil

| | Web adaptable (elegida) | App móvil nativa |
|---|---|---|
| El jurado | Abre un enlace y listo. Es lo que pide «Link to Final Project» (público, sin login) | Tienda o APK: el jurado no lo instala |
| El usuario del reto | Planificadores de misión, en ordenador | Poco útil para comparar sitios |
| Tiempo | Una base de código, sin revisiones de tiendas | Dos plataformas o un framework más |
| Sin conexión | **PWA** (si da tiempo): instalable y con caché | Sí, pero no compensa |

- **Móvil primero** (decidido el 14‑nov): **se tiene que poder usar entero en
  el móvil**, no solo consultar. Se diseña para 360–430 px y se amplía a
  escritorio (paneles lado a lado desde ~1024 px).
- **Probado en un iPhone (Safari) y un Android (Chrome) de verdad.**
- **PWA en el MVP:** instalable en la pantalla de inicio y con los datos en
  caché, como una app pero sin tienda. Funciona sin conexión (ver la sección 4).
- Navegadores: Chrome, Edge, Firefox y Safari recientes.

## 2. Las piezas

```text
 pipeline/ (Python, en local)            data/ (salida)               web/ (navegador)
 ┌───────────────────────────┐         ┌──────────────────┐         ┌────────────────────────┐
 │ efemérides (SPICE)        │────────▶│ ephemeris.bin    │────────▶│ React + TypeScript     │
 │ horizonte (LOLA, numpy)   │────────▶│ sites/<id>.json  │────────▶│ tarjetas, cronograma,  │
 │ cifras de ingeniería      │         │ validation.json  │         │ panorama, mapa, 3D     │
 │ validación (Horizons/PGDA)│────────▶│ explain/<id>.json│         │                        │
 └───────────────────────────┘         └──────────────────┘         └────────────────────────┘
        ▲ params.yaml (Juan y Luna)                                    sin servidor: todo estático
```

- **Python precalcula** todo lo pesado en local y escribe ficheros.
- **La web solo lee ficheros** y hace cuentas ligeras (posición del Sol y la
  Tierra para el sitio elegido, cifras al mover el retraso).
- **No hay servidor** en el MVP: nada que se caiga.

## 3. Tecnologías por parte

### Cálculo (`pipeline/`)

| Qué | Tecnología |
|---|---|
| Lenguaje | Python 3.12, entorno virtual (`.venv`), `requirements.txt` |
| Efemérides | `spiceypy` + kernels de NAIF (DE440, orientación lunar, frames) |
| Relieve | `rasterio` (GeoTIFF de PGDA) + `numpy` |
| Tablas y CSV | `pandas` |
| Gráficas de verificación | `matplotlib` |
| Verificación | `jupyter` (notebook para Juan y Luna) |
| Validación con Horizons | API de Horizons (con `requests`; `astroquery` si acepta observador lunar) |
| Pruebas | `pytest` con las pruebas de sentido físico |
| Parámetros | `params.yaml`, editado por Juan y Luna |

### Web (`web/`)

| Qué | Tecnología | Por qué |
|---|---|---|
| Base | **Vite + React + TypeScript** | Lo que mejor conoce la IA; build estático |
| Estilos | **Tailwind CSS** | Rápido y coherente sin diseñar desde cero |
| Gráficas | **SVG con D3** (escalas y gestos) | Panorama y cronograma ligeros y táctiles. **Plotly descartado:** ~1 MB comprimido y manejo táctil regular en el móvil |
| Mapa del polo sur | MVP: **imagen del relieve + marcadores SVG**. Si da tiempo: **OpenLayers** con teselas WMTS de Moon Trek | OpenLayers maneja bien proyecciones polares; Leaflet necesita más apaños |
| 3D (si da tiempo) | **three.js + React Three Fiber + drei** | Ver [`INTERFAZ.md`](INTERFAZ.md) |
| Estado | Estado de React + **escenario en la URL** | Sin librerías extra |
| PWA (MVP) | `vite-plugin-pwa` | Instalable y sin conexión |
| Textos | Inglés | Lo que ve el jurado |

### IA

| Qué | Tecnología |
|---|---|
| Explicaciones «Why?» | API de Claude, **precalculadas** desde el pipeline a `explain/<id>.json` y marcadas «SI‑generated from data» |
| Preguntas en directo (si da tiempo) | FastAPI en el VPS de Contabo, con las explicaciones precalculadas de reserva |

### Publicación

| Qué | Dónde |
|---|---|
| Web | **Hostinger**, `nasaspaceapps.volmer.es` (build estático de `web/`) |
| Copia de reserva | **GitHub Pages**, con GitHub Actions al hacer push a `main` |
| Servidor opcional | **Contabo** (VPS de whoshuman y telegrupos), contenedor propio |
| Filtros del jurado | Clasificación en **FortiGuard** del subdominio |

## 4. Fiabilidad para el usuario (no solo para la demo)

Decidido el 14‑nov: un planificador puede estar usándola **en un momento
crítico**. La resiliencia es una característica del producto.

**Principio: una cifra equivocada es peor que ninguna.** Si algo falla, la app
lo dice; nunca enseña datos malos en silencio.

| Capa | Qué | Cuándo |
|---|---|---|
| **Sin conexión** | PWA: la app y todos sus datos quedan en el dispositivo. Indicador «Available offline ✓» | 🟢 MVP |
| **Sin servidor único** | Copias idénticas en Hostinger y GitHub Pages | 🟢 MVP |
| | La app pide los datos a la otra copia si una falla, sola | 🟡 Si da tiempo |
| **Servicios externos opcionales** | Horizons, Moon Trek y la IA fuera del camino crítico: mapa → imagen estática, IA → plantilla, Horizons → «no disponible» | 🟢 MVP |
| **Datos con versión** | Manifiesto con versión, fecha, fuentes; la versión se ve en la interfaz | 🟢 MVP |
| | Huella (*checksum*) de cada fichero; si llega dañado, se usa la última versión buena | 🟡 Si da tiempo |
| **Fallar de forma segura** | Fuera de 2026–2028: mensaje, nunca extrapolar. Coordenadas sin relieve: aviso permanente. Una pieza que falla no tumba la app (*error boundaries* de React) | 🟢 MVP |
| **Copia de la decisión** | Escenario en la URL | 🟡 Si da tiempo |
| | Exportar a PDF o CSV con cifras, versión de datos y fuentes | 🟡 Si da tiempo |
| **Regenerable** | Código, scripts y fuentes de la NASA en el repo público: cualquiera regenera y vuelve a publicar | 🟢 MVP |

## 5. Estructura del repo

```text
docs/            Esta documentación
pipeline/        Python: efemérides, horizonte, cifras, validación, export
  params.yaml    Parámetros (Juan y Luna)
  tests/         Pruebas de sentido físico
notebooks/       Verificación para Juan y Luna
raw/             Descargas de la NASA (kernels, GeoTIFF) — fuera de git, se
                 regeneran con un script
web/             La aplicación
  public/data/   Lo que genera el pipeline (sí va en git: es lo que se sirve)
```

## 6. El contrato de datos (lo primero el sábado)

La forma exacta de los ficheros entre Python y la web. Con él, Angela trabaja
desde las 10:30 con datos de prueba. Esbozo, a cerrar el sábado:

- `ephemeris.bin` + `ephemeris.json`: posiciones del Sol y la Tierra respecto
  al centro de la Luna, en MOON_ME, 2026–2028. **Paso de 30 min ≈ 1,3 MB**
  (pensado para datos móviles; 10 min serían ≈ 3,8 MB). Si hace falta más
  detalle, se cargan solo los meses de la misión.
- `sites/<id>.json`: nombre, coordenadas, altura, fuente, **horizonte** (720
  valores de elevación por acimut) y valores de PGDA para comparar.
- `validation.json`: diferencias con Horizons y con PGDA por sitio.
- `explain/<id>.json`: textos de la IA con las cifras que citan.
- Unidades y convenios por escrito: grados, UTC, acimut desde el norte en
  sentido horario, sistema MOON_ME.

## 7. Lo que queda fuera

- App nativa (iOS, Android, Flutter, React Native).
- Servidor en el MVP.
- Next.js, bases de datos, cuentas de usuario.
