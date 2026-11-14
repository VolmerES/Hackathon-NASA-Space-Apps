# Cómo comprobar el acimut y la elevación del Sol y la Tierra

Guía para que cualquiera (por ejemplo, el equipo de aeronáutica) compruebe
por su cuenta los ángulos que da la web, contra la fuente original: **NASA JPL
Horizons**, el servicio de efemérides del Jet Propulsion Laboratory.

## Qué son esos números

- **Acimut**: dirección en el horizonte, en grados desde el **norte local**
  y en sentido horario (90° = este, 180° = sur, 270° = oeste).
- **Elevación**: altura sobre el **plano horizontal local** de la Luna
  tomada como esfera, en grados. Es la elevación geométrica: no tiene en
  cuenta el relieve. Si el Sol o la Tierra se ven o no se decide después,
  comparando esta elevación con el horizonte de relieve LOLA del sitio.
- Horas en **UTC**. En la Luna no hay refracción.

## De dónde salen

1. La web guarda, para cada hora, los **puntos subsolar y subterrestre** de
   la Luna y la distancia Tierra–Luna, descargados de JPL Horizons
   (efemérides DE441, libración incluida): `web/public/data/subpoints.json`,
   con `web/scripts/fetch_subpoints.py`.
2. El navegador pasa esos puntos a acimut y elevación vistos desde cada sitio
   (`web/src/data/model.ts`, función `sampleAt`). Para la Tierra corrige el
   paralaje: el sitio está a 1.737 km del centro de la Luna.

## Comprobación ya hecha

Con `comparar_con_horizons.py` (en esta carpeta), los 5 sitios, 169 horas
desde el 1‑ene‑2027 00:00 UTC. Diferencia **máxima** entre la web y
Horizons, en grados:

| Sitio | Sol, acimut | Sol, elevación | Tierra, acimut | Tierra, elevación |
|---|---|---|---|---|
| Haworth 09 (HW09) | 0,0002 | 0,0007 | 0,0060 | 0,0006 |
| Malapert Massif K2023 | 0,0002 | 0,0007 | 0,0060 | 0,0006 |
| Mons Mouton 07 | 0,0002 | 0,0007 | 0,0060 | 0,0005 |
| Nobile Rim 1 02 | 0,0002 | 0,0007 | 0,0060 | 0,0005 |
| de Gerlache Rim 2 05 | 0,0002 | 0,0007 | 0,0060 | 0,0006 |

Para comparar: el disco del Sol mide unos 0,53°. Antes se comprobó lo mismo
en 6 sitios y las 10.249 horas del periodo, con un máximo de 0,0065°.

## Cómo comprobarlo vosotros

### A. Con el script (2 minutos)

Solo hace falta Python 3 (sin paquetes) y conexión a internet:

```
python comparar_con_horizons.py
```

Lee los CSV de esta carpeta (`HW09.csv`, `MMA_K2023.csv`…), pide a Horizons
las mismas horas y escribe la diferencia máxima. También imprime el enlace
exacto de cada consulta, para abrirlo en el navegador.

Los CSV salen del mismo código que usa la web
(`web/scripts/export_angles.ts`). Para otras fechas:

```
cd web
npx esbuild scripts/export_angles.ts --bundle --platform=node --format=esm --outfile=export.mjs
node export.mjs public/data ../docs/verificacion 2027-06-01T00:00:00Z 7
```

### B. A mano, en la web de Horizons

1. Abrir <https://ssd.jpl.nasa.gov/horizons/app.html>.
2. **Ephemeris Type**: *Observer Table*.
3. **Target Body**: *Sun* (código `10`) o *Earth* (código `399`).
4. **Observer Location**: *Edit* → *specify coordinates* → cuerpo
   **Moon (301)**, tipo **geodetic**, y la longitud este, la latitud y
   altura 0 del sitio (tabla de abajo).
5. **Time Specification**: la fecha y hora en UTC, paso de 1 hora.
6. **Table Settings**: marcar solo la cantidad **4** (*Apparent AZ & EL*),
   ángulos en grados decimales.
7. *Generate Ephemeris* y comparar con la web: en el street view, el panel
   «Cielo y suelo a esta hora»; o con el botón de descarga CSV de la ficha
   del sitio.

| Sitio | Latitud | Longitud (este, 0–360) |
|---|---|---|
| Malapert Massif K2023 | −85,9919 | 2,0564 |
| Haworth 09 | −86,6230 | 333,9254 |
| de Gerlache Rim 2 05 | −88,0646 | 297,9264 |
| Mons Mouton 07 | −85,1953 | 32,9287 |
| Nobile Rim 1 02 | −85,2606 | 36,8888 |

## Qué puede diferir y por qué

- **Altura del sitio.** Horizons pone el observador a 0 km sobre la esfera
  de la Luna; los sitios están entre −0,9 y +6,8 km. Para el Sol no cambia
  nada; para la Tierra mueve la elevación unas milésimas de grado.
- **Posición «aparente».** Horizons corrige el tiempo de luz y la aberración.
  La web parte de los puntos subsolar y subterrestre que también da Horizons,
  así que las dos van igual.
- **Lo que no comprueba esto.** Si el Sol o la Tierra quedan tapados por el
  relieve depende del horizonte LOLA del sitio, no de Horizons. Eso se
  contrastó aparte con los mapas de la NASA (PGDA 69) y con el estudio de
  Wueller et al. (2026): ver `docs/DATOS.md`.
