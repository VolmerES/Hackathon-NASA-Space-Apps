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
