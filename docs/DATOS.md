# Datos y herramientas para el reto lunar

Qué ofrece cada fuente y para qué la usamos. Revisado la noche del 13‑nov,
leyendo las páginas oficiales. **No se ha descargado nada todavía**: se hace el
sábado a partir de las 9:00. Lo marcado ⚠️ está sin comprobar.

## Las dos herramientas que da el reto

### Quickmap (LROC, Arizona State University)

[quickmap.lroc.asu.edu](https://quickmap.lroc.asu.edu/) · Mapa interactivo de
la Luna en el navegador con las capas de la sonda LRO: imágenes de las cámaras
WAC y NAC, relieve de LOLA, pendientes y **mapas de iluminación polar**.

- **Para qué nos sirve:** mirar los sitios, ver el relieve que los rodea y
  **contrastar visualmente** nuestra iluminación con la suya.
- **Limitación:** no tiene una API documentada para exportar datos. Solo se
  pueden exportar dibujos y anotaciones, y codificar la vista en la URL.
- **El dato que hay detrás sí se descarga:** el mapa de iluminación de la WAC
  del polo sur (88°S–90°S, 100 m/píxel, un año lunar de 2010–2011, Speyerer y
  Robinson, 2013) está en el archivo de LROC como
  [`WAC_POLE_ILL_PCT_SOUTH`](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_PCT_SOUTH),
  con GeoTIFF de 8 bits. **Es una iluminación medida con fotos**, no calculada:
  muy útil para validar.

### Moon Trek (NASA, JPL)

[trek.nasa.gov/moon](https://trek.nasa.gov/moon/) · Visor 2D y 3D de la Luna,
con muchas capas de relieve e imagen.

- **Tiene API:** sirve sus capas como teselas por el estándar **WMTS**, con
  servicios específicos para el **polo sur** en proyección polar
  ([documentación](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon)).
  La plantilla es
  `https://{endpoint}/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`
  y cada capa tiene su `GetCapabilities`.
- **Para qué nos sirve:** el **mapa de fondo** de la web (relieve sombreado del
  polo sur con los sitios encima) sin montar un servidor de mapas. ⚠️ Elegir la
  capa polar y comprobar que las teselas cargan desde nuestro dominio.
- **Fallback:** si las teselas fallan, una imagen estática del relieve.
- **Comprobado en su configuración pública:** las teselas son JPG o PNG en
  `https://trek.nasa.gov/tiles/Moon/{EQ|polo}/{capa}/1.0.0/default/default028mm/{z}/{fila}/{col}.jpg`.
  Proyecciones: equirectangular, polo norte y **polo sur (IAU2000:30120)**.
  Índice de capas en `https://trek.nasa.gov/moon/TrekServices/ws/index/…/searchItems`
  y servicios de cada capa en `…/getLayerServices?uuid=`. Los mapas de relieve
  y pendientes **no se sirven como teselas** visibles. ⚠️ No comprobado si se
  descargan desde Trek; el relieve lo sacamos de PGDA.

### Cómo devuelven los «render»

Ni Moon Trek ni Quickmap devuelven una vista 3D: **sirven imágenes 2D
(teselas WMTS o recortes WMS) y el 3D lo pinta el navegador.** Quickmap pide
sus capas al servidor de LROC, que tiene un «WMS Browser» ⚠️ sin documentar
para uso externo. Para nosotros: el 3D lo hacemos con three.js. **No pegar fotos
como textura en el 3D:** llevan las sombras del momento en que se tomaron y
chocarían con nuestra iluminación calculada. Relieve gris iluminado solo por
nuestro Sol.

## Lo que usa la web ahora (datos reales, 14‑nov)

| Qué | Fuente | Script | Fichero en la web |
|---|---|---|---|
| Puntos subsolar y subterrestre y distancia Tierra‑Luna, cada hora del 1‑dic‑2026 al 1‑feb‑2028 | **NASA JPL Horizons** (DE441), observador en el geocentro, objetivo la Luna, cantidades 14, 15 y 20 | `web/scripts/fetch_subpoints.py` | `public/data/subpoints.json` |
| Sitios candidatos | **Wueller et al. 2026** (Zenodo, CC BY 4.0): 130 sitios en 16 regiones de Artemis, con sus días seguidos de luz publicados | `web/scripts/build_catalogue.py` | `public/data/sites.json` |
| Horizonte de cada sitio (720 acimuts, hasta 150 km, curvatura, 2 m de altura) | **LOLA** `LDEM_80S_80M` (80 m/px, nodo LOLA del PDS) y `ldem_16` (SVS) más allá de 80°S | `web/scripts/build_catalogue.py` | `public/data/horizons.json` |
| Elevación de la Luna sobre Robledo de Chavela | **NASA JPL Horizons** | `web/scripts/fetch_madrid.py` | `public/data/madrid.json` |

El navegador calcula, para cualquier punto y hora, el acimut y la elevación
del Sol y de la Tierra (con el paralaje de la Tierra) y los compara con el
horizonte.

**Validación:**
- **Frente a JPL Horizons sitio a sitio** (`fetch_horizons.py`, seis sitios,
  10.249 horas): error máximo de **0,0065°**. El criterio del MVP era menos
  de 0,1°. Las series de referencia están en `web/data-raw/horizons-per-site/`.
- **Frente a Wueller et al. 2026,** días seguidos de luz en el verano austral
  de 2027 (latitud subsolar ≤ −1,5°, del 14‑oct al 14‑nov) en los 130
  sitios: diferencia mediana de **1,0 días**, correlación **0,79** y mismo
  resultado en el umbral de 10 días en el **68 %**. Coinciden exactos los
  casos destacados del artículo: Malapert K2023 (31 frente a 31), CR06 y CR07
  (31 frente a 31) y PNS01 (18 frente a 18,4). Con el relieve de 1,9 km la
  diferencia mediana era de 5,1 días.
- ⚠️ **Discrepancia abierta:** una docena de sitios en los que el estudio da
  unos 2 días y nosotros unos 18 (AR02, AR03, CR02, FRA01…). Hay que
  revisarla con el relieve de 5 m (PGDA 78) o preguntando a los autores.

## El hallazgo: productos de la NASA que encajan de lleno

Del laboratorio de Geodesia Planetaria de Goddard (**PGDA**), el equipo de LOLA.
No están en la pestaña de recursos del reto, pero son **datos oficiales de la
NASA** y resuelven las dos piezas más difíciles del plan.

### 1. Relieve de 5 m/píxel de los sitios candidatos del polo sur

[PGDA 78 · High‑Resolution LOLA Topography for Lunar South Pole Sites](https://pgda.gsfc.nasa.gov/products/78)
(Barker et al., 2021)

- Mapas de elevación a **5 m/píxel** en GeoTIFF, proyección estereográfica
  polar sur, en el sistema **MOON_ME** de la efeméride **DE421**. Incertidumbre
  de altura ~0,3–0,5 m.
- **Ya traen la lista de sitios**, con la numeración del estudio de Mazarico et
  al. (2011): Connecting ridge, **Shackleton rim**, Nobile rim 1 y 2, Peak near
  Shackleton, de Gerlache rim, Leibnitz β plateau, **Malapert massif**,
  de Gerlache‑Kocher massif, Haworth, Shoemaker, Amundsen rim, Cabeus, Faustini…
- Cada sitio trae además pendientes, incertidumbres y 100 «clones» del relieve
  para estudiar la incertidumbre de la iluminación.
- **Uso:** el horizonte cercano de cada sitio, con mucho detalle.
- ⚠️ Comprobar el tamaño de cada fichero y el [README](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README).

### 2. Iluminación y visibilidad de la Tierra ya calculadas (para validar)

[PGDA 69 · Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69)
(Mazarico et al., 2011, actualizado)

- Mapas del polo sur con el **porcentaje medio de iluminación solar** y el
  **porcentaje medio de visibilidad de la Tierra**, calculados con el relieve de
  LOLA cada hora durante **18,6 años** (un ciclo de nutación completo).
- Tres coberturas: 65°S–90°S a 240 m/píxel, 75°S–90°S a 120 m/píxel y
  85°S–90°S a 60 m/píxel. También **zonas en sombra permanente** y
  **visibilidad del cielo**.
- En **Cloud‑Optimized GeoTIFF**: se puede leer solo el píxel de cada sitio sin
  bajar el mapa entero. Por ejemplo:
  - Sol: `AVGVISIB_85S_060M_201608_COG.TIF`
  - Tierra: `AVGVISIB_85S_060M_201608_EARTH_COG.TIF`
  - Sombra permanente: `LPSR_85S_060M_201608_COG.TIF`

  (en `https://pgda.gsfc.nasa.gov/data/MoonIllumination/`)
- **Uso: es nuestra validación principal.** Calculamos con nuestro método el
  porcentaje de Sol y de Tierra de cada sitio durante un periodo largo y lo
  comparamos con el valor de este mapa en ese mismo punto. Si cuadra, el
  método funciona. Ojo: la Tierra cuenta como visible si se ve cualquier parte
  de su disco (lo dice la propia página); usar el mismo criterio al comparar.
- ⚠️ Faltan por localizar en esa página los enlaces a los **mapas de elevación
  regionales** (240, 120 y 60 m/píxel), que necesitamos para el horizonte
  lejano.

### 2 bis. Wueller et al. (2026): 130 sitios candidatos y su iluminación

Lo encontró Luna. Artículo de acceso abierto (CC BY 4.0):

> Wueller, L., Berger, L. M., Christopher, H., Sugimoto, K., Thaker, A. D.,
> Carton, L., Jo, W., Lee, S., Pedrelli, R., Sanchez, P., y Kring, D. A.
> (2026). *Assessing Potential Landing Sites With Favorable Illumination and
> Accessible, Potentially Volatile‐Rich Permanently Shadowed Regions Within
> Artemis Candidate Landing Regions.* JGR Planets, 131(3), e2025JE009434.
> <https://doi.org/10.1029/2025JE009434>

Lo que dice el resumen:

- **130 sitios candidatos** dentro de las regiones de Artemis que cumplen los
  requisitos del Human Landing System y tienen una región en sombra
  permanente (PSR) a **2 km o menos**, el radio al que llegan los astronautas
  a pie, sin rover.
- Iluminación modelada en los **veranos de 2025 a 2032**, con la condición de
  que el sitio tenga **luz durante 6,5 días**, la duración prevista de las
  primeras misiones de Artemis en superficie.
- **La iluminación cambia mucho entre regiones y entre años:** según el año
  del lanzamiento, los sitios disponibles son otros. Es justo lo que enseña
  nuestra vista de 14 meses.
- Además estima el agua atrapada en esas PSR (temperaturas de Diviner y edad
  de los cráteres); el 85 % de los cráteres con PSR cerca de los sitios
  tendría menos de 1500 millones de años. Para nosotros es contexto, no
  entra en el cálculo.

**Sus datos, en Zenodo** (CC BY 4.0, [10.5281/zenodo.17084058](https://doi.org/10.5281/zenodo.17084058)):

| Fichero | Tamaño | Qué tiene | Para qué nos sirve |
|---|---|---|---|
| `Landing_Sites.zip` | 11,9 MB | Shapefile georreferenciado de los sitios candidatos y ráster de la zona que cumple los requisitos del HLS | **Lista real de sitios para `sites.json`** (tarea de Luna) |
| `Illumination_Modeling.zip` | 10,7 MB | Rásteres de iluminación de las 16 regiones candidatas de Artemis, veranos de 2025 a 2032 | **Segunda referencia para validar**, además de PGDA 69 |
| `PSR_Volatile_Estimates.zip` | 44 KB | PSR accesibles en CR, CRE, dGR1 y PNS con su estimación de volátiles | Contexto, si da tiempo |
| `Diffusion_Modeling_Crater_Ages_Soderblom.xlsx` | 20 KB | Edades de los cráteres con PSR | Contexto |

**Cómo lo calculan** (texto completo en
[`referencias/wueller-2026-artemis-landing-sites-es.pdf`](referencias/wueller-2026-artemis-landing-sites-es.pdf),
traducción automática del navegador; secciones 2.3, 4 y apéndice A):

| Qué | Ellos | Qué nos dice |
|---|---|---|
| Herramienta | **Lunar Quickmap TerrainShadows** (ACT), la misma Quickmap que nombra el reto | Podemos citarla y comparar con ella |
| Relieve | 60 m/píxel para la iluminación; LDEM de LOLA a 20 m/píxel para las pendientes | Nuestro 5 m cerca y 60–240 m lejos está a la par o mejor |
| Distancia de sombra | **150 km**: el terreno lejano tapa el Sol (desniveles de hasta 10 km) | Confirma lo que dice Luna sobre las montañas lejanas |
| Altura del observador | **2 m** sobre el suelo, la de los primeros paneles solares verticales (Ross et al., 2023) | ⚠️ Añadir esa altura a nuestro cálculo del horizonte |
| Paso de tiempo | 12 h | Nuestro paso horario es más fino |
| Efemérides | **JPL DE441** | Mismas efemérides que SPICE |
| Verano austral | Latitud subsolar ≤ −1,5° (Mahanti et al., 2024) | Criterio para marcar las mejores épocas |
| Comunicación | Calculan Sol y, a la vez, **Sol + Tierra** (enlace directo con la Tierra, DTE) | Es nuestra métrica «Sun and Earth together» |
| **Umbral de viabilidad** | **≥ 10 días seguidos de luz** para Artemis III (6,5 días en superficie más margen) | **Umbral con fuente para el veredicto** de la web, en lugar de uno inventado |
| Pendiente del HLS | < 8° (ideal < 5°) y a más de 100 m de pendientes mayores (precisión de alunizaje de 100 m, 3σ) | Filtro de sitios, si añadimos sitios propios |

**Resultados que sirven de referencia:**

- **Varía con el año:** en el verano de 2028 ningún sitio de Amundsen Rim
  da luz para 6,5 días; en 2030, casi todos. Mons Malapert (MMP) tiene luz
  suficiente en 2025, 2029 y 2032, pero no en 2026, 2027 ni 2031.
- **Sitios estables:** CR06, CR07 y 001, en el centro de Connecting Ridge,
  tienen **≥ 16 días seguidos de luz todos los años de 2025 a 2032**. También
  son estables las cimas, como MMA_K2023 en Mons Malapert y MMO01 y MMO02 en
  Mons Mouton.
- **La Tierra limita poco:** de los 130 sitios, 97 están disponibles en 2032
  y 44 en 2031; si además se exige ver la Tierra, 86 y 34.
- **Su recomendación** es elegir y ordenar **varios sitios según la fecha del
  lanzamiento**, con sitios de reserva para ventanas posteriores. Es lo que
  hace nuestra herramienta: sirve para el pitch.

**Lo que falta:**

- **Las tablas del PDF están incompletas:** la impresión trae solo las 13
  primeras filas de A1 (coordenadas) y de A2 (días seguidos de luz por año).
  La lista entera de los 130 sitios está en `Landing_Sites.zip` de Zenodo
  (11,9 MB). ⚠️ Sin descargar.
- **Validar contra sus días seguidos de luz** de esos 13 sitios, que ya
  están en el PDF, y contra los rásteres de `Illumination_Modeling.zip`.
- **Las regiones:** el artículo usa **16 regiones candidatas** de Artemis.
  En nuestros documentos aparecen 9 y 13, así que hay que aclararlo.
- **Citar el artículo y el dataset** en la página del proyecto si usamos sus
  datos.

### 2 ter. Kernels genéricos de SPICE (NAIF)

Página «Generic Kernels» de NAIF, aportada por Luna
([`referencias/naif-generic-kernels-es.pdf`](referencias/naif-generic-kernels-es.pdf);
original en <https://naif.jpl.nasa.gov/naif/data_generic.html>). Son los
kernels que no dependen de ninguna misión, justo los que usa nuestro cálculo:

| Tipo | Qué es | Para qué lo usamos |
|---|---|---|
| SPK | Efemérides de planetas y satélites | Posición del Sol, la Tierra y la Luna (DE440/DE441) |
| PCK | Constantes planetarias, con **versiones binarias especiales para la Tierra y la Luna** | Orientación precisa de la Luna (libración) |
| LSK | Segundos intercalares | Convertir UTC a la escala de tiempo de SPICE |
| FK | **Marcos de referencia de la Luna** | El sistema MOON_ME (medio Tierra), el de los mapas de LOLA |
| SPK + FK de **estaciones terrestres** | Posición topocéntrica de algunas estaciones | **La capa de Madrid**: la elevación de la Luna vista desde Robledo (DSS‑63) sale de SPICE, sin coordenadas copiadas a mano |
| DSK | Formas digitales de cuerpos pequeños | No lo necesitamos |

La página avisa de que hay que entender de dónde sale cada kernel genérico
antes de usarlo.

**Los ficheros concretos** (índice de `generic_kernels/` consultado el 14‑nov;
sin descargar todavía):

| Para qué | Fichero | Tamaño |
|---|---|---|
| Efemérides | `spk/planets/de440.bsp` (o `de440s.bsp`, más pequeño) | 114 MB (31 MB) |
| Orientación de la Luna | `pck/moon_pa_de440_200625.bpc` | 12 MB |
| Marco lunar MOON_ME | `fk/satellites/moon_de440_250416.tf` (el readme lo empareja con el `.bpc` de arriba) | 19 KB |
| Constantes | `pck/pck00011.tpc` y `pck/gm_de440.tpc` | 128 KB y 12 KB |
| Segundos intercalares | `lsk/naif0012.tls` | 5 KB |
| Estaciones terrestres | `spk/stations/earthstns_itrf93_260814.bsp` + `fk/stations/earth_topo_260814.tf`. **Incluye DSS‑63 (Madrid)**: lo dicen los comentarios del fichero (`earthstns_itrf93_260814.cmt`) | 26 KB y 68 KB |
| Orientación de la Tierra (para la elevación desde Madrid) | `pck/earth_latest_high_prec.bpc` | 4,9 MB |

Avisos de los readme: usar las versiones `260814` de los kernels de estaciones,
porque las `260717` tenían un error en DSS‑33. El readme de `pck/` cita
`moon_de440_220930.tf`, pero el fichero que existe y que cita el de `fk/` es
`moon_de440_250416.tf`. También hay ya una DE442 (2025), pero nos quedamos
con DE440 porque es la que emparejan los kernels lunares.

### 2 quater. La Luna de la interfaz: CGI Moon Kit (NASA SVS)

La Luna 3D que hay detrás de la web usa imágenes reales de la NASA:
**CGI Moon Kit** del NASA Scientific Visualization Studio
(<https://svs.gsfc.nasa.gov/4720/>). Crédito obligatorio: «NASA's Scientific
Visualization Studio».

| Fichero original | Qué es | Qué sale |
|---|---|---|
| `lroc_color_16bit_srgb_4k.tif` (59 MB) | Mosaico de color de LROC (LRO), versión 2025 | `web/public/moon/moon_color_{2k,4k}.jpg` |
| `ldem_16_uint.tif` (31,7 MB) | Relieve LOLA, 16 px/grado, medios metros sobre 1727,4 km | Mapas de normales `moon_normal_{2k,4k}.jpg`, el casquete polar y su mapa de alturas `polar_height.bin` para las sombras proyectadas (`web/scripts/moon_polar_height.py`) |

- Scripts: `web/scripts/moon_textures.py` (esfera) y
  `web/scripts/moon_polar_cap.py` (casquete polar sur en proyección
  azimutal equidistante hasta 25° del polo, sin el estiramiento del mapa
  equirectangular en el polo).
- Según la página, los mapas de color están «optimizados para la estética,
  no para la ciencia». Por eso **solo se usan para dibujar**: ninguna cifra
  de la herramienta sale de ellos.
- Los ficheros originales no van al repo: se bajan de la URL de arriba.

### 3. Otros, por si hacen falta

- [PGDA 81](https://pgda.gsfc.nasa.gov/products/81) y [PGDA 90](https://pgda.gsfc.nasa.gov/products/90):
  relieve de 5–30 m/píxel al sur de 80°S (Barker et al., 2023). Alternativa
  para el horizonte lejano ⚠️ sin revisar.
- [PGDA 92](https://pgda.gsfc.nasa.gov/products/92): relieve de ~30 m/píxel
  entre 60°S y 80°S para navegación óptica (archivo de ~1,1 GB). No hace falta.

## Cómo encaja en el plan

| Pieza | Fuente |
|---|---|
| Horizonte cercano (hasta ~10 km) | Relieve de 5 m/píxel de cada sitio (PGDA 78) |
| Horizonte lejano (hasta 150–200 km) | Relieve regional de 60–240 m/píxel (PGDA 69 / LOLA en el PDS) ⚠️ |
| Lista de sitios | Los de PGDA 78, que ya son los candidatos de alunizaje del polo sur |
| Posición del Sol y la Tierra | SPICE, validado con **Horizons** |
| **Validación de la iluminación y la Tierra** | Mapas de porcentaje medio de PGDA 69 y mapa de iluminación medido de la WAC (Quickmap / LROC) |
| Mapa de fondo de la web | Teselas WMTS de **Moon Trek**, o imagen estática |
| Contraste visual | Quickmap |

**Por qué importa para el jurado:** usamos los mismos datos y el mismo tipo de
cálculo que el equipo de LOLA de la NASA, y comparamos nuestras cifras con las
suyas. Eso es Validez y Relevancia de nota alta.

## Herramientas de la NASA, a la vista

El jurado puntúa que los datos de la NASA sean el núcleo. Usar además sus
herramientas, y que se vea, refuerza la historia:

- **SPICE** (NAIF/JPL): el cálculo de las posiciones. «El mismo sistema de
  navegación que usan las misiones de la NASA».
- **Horizons** (JPL): la validación y, si da tiempo, el botón «Check against
  JPL Horizons».
- **Moon Trek** (NASA/JPL): las teselas del mapa.
- **Quickmap** (LROC): la comparación de iluminación y **un enlace «View in
  Quickmap / Moon Trek» en cada sitio**, centrado en sus coordenadas.
- **LOLA / PGDA** (Goddard): el relieve y la validación.

### El horizonte: trazado de rayos propio

1. **Principal:** trazado de rayos propio con `numpy` sobre los mapas de LOLA.
   720 direcciones; paso no mayor que el píxel; interpolación bilineal; mapa de
   5 m hasta ~10 km y regional hasta ~200 km; curvatura de la Luna.
2. **Fuera del fin de semana:** SPICE con el relieve en formato DSK (utilidad
   de NAIF para convertir mapas) y trazado de rayos de SPICE. Sería «todo
   NASA», pero ⚠️ no sabemos cómo rinde ni cuánto cuesta montarlo. Como mucho,
   para comprobar unos pocos rayos.

## Herramientas externas que pueden ayudar

Buscadas la noche del 13‑nov. ⚠️ Ninguna probada todavía: se prueban el
sábado a primera hora.

| Herramienta | Qué es | Para qué | Riesgo |
|---|---|---|---|
| [**HORAYZON**](https://gmd.copernicus.org/articles/15/6817/2022/) (ETH Zúrich, 2022) | Librería de Python que calcula el horizonte del terreno desde un mapa de relieve con trazado de rayos (Embree). Unas 100 veces más rápida que el método clásico y simplifica el relieve lejano | ~~El horizonte de cada sitio~~ **Descartada** | Está pensada para calcular el horizonte de millones de píxeles; nosotros necesitamos 8–10 sitios. Un trazado de rayos propio con `numpy` cuesta ~2 millones de lecturas por sitio (segundos), es transparente, lo revisan Juan y Luna y sigue el mismo método que Mazarico et al. (2011) |
| [**Skyfield**](https://rhodesmill.org/skyfield/planetary.html) | Librería de astronomía en Python. Su documentación trae el ejemplo de un observador en la superficie de la Luna en `MOON_ME_DE421` | Solo **comprobación cruzada** de SPICE, si hace falta. Trabaja en el mismo sistema que los mapas de PGDA 78 | **No es de la NASA.** La herramienta principal es **SPICE** (NAIF/JPL), por Relevancia y coherencia con Horizons |
| [**lunarsky**](https://github.com/aelanman/lunarsky/) | Extensión de astropy con sistema local (este, norte, arriba) en la Luna | Alternativa a Skyfield | — |
| **astroquery** (`jplhorizons`) | Acceso a Horizons desde Python | Automatizar la validación | ⚠️ Comprobar que acepta un observador en la superficie lunar |
| [**Cesium Moon Terrain**](https://cesium.com/platform/cesium-ion/content/cesium-moon-terrain) | La Luna entera en 3D con datos de LOLA (5–60 m/píxel en los polos). Gratis para uso no comercial y educativo | Extra: entrada con la Luna entera y zoom hasta el sitio | Necesita cuenta de Cesium ion. [Aviso en su foro](https://community.cesium.com/t/cesium-ion-moon-terrain-appears-2-5-km-higher-than-lola-sldem2015-dem-at-the-same-lon-lat/46282): relieve ~2,5 km más alto que LOLA. **Solo para ver, nunca para calcular.** Añade CesiumJS al stack |
| [NASA: entorno de la base lunar](https://www.nasa.gov/moonbase-environment-visualization/) y [regiones de Artemis III](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) | Visualización interactiva y comunicados oficiales | Contexto del pitch y lista de sitios alineada con la NASA | ⚠️ Un comunicado dice 9 regiones y otro 13: mirar el vigente |
