# Demo en directo de 2 minutos

**Propuesta de Claude, pendiente de Juan y Luna** (llevan el pitch según
[`REPARTO.md`](REPARTO.md)). Un recorrido por la web publicada que enseña un
punto fuerte por cada criterio del jurado ([`CONTEXTO.md`](CONTEXTO.md),
«Criterios del jurado»), con lo que hay que decir en cada paso. Sirve igual
para el pitch en directo que como guion de una grabación de pantalla.

Los nombres de botones son los de la interfaz en inglés; entre paréntesis, los
de la versión en español. Las cifras son las que daba la web el 15 de noviembre
para **Malapert Massif K2023**, alunizaje el **1 dic 2026 a las 06:00 UTC** y
**10 días**, que es lo que sale por defecto. Cambian si se toca la fecha o el
modelo (`web/src/data/model.ts` cambió el 15‑nov y las movió): **leerlas de la
pantalla** el día del pitch.

## Antes de salir

- **Abrir la web un rato antes** en el ordenador de la presentación, con red:
  así queda guardada (funciona sin conexión después de la primera visita).
- **Probarla en ese ordenador**: el 3D y el alunizaje necesitan la tarjeta
  gráfica. Solo se han visto en capturas sin GPU.
- **Sonido**: subir el volumen y escucharlo una vez; tiene un botón de
  silencio arriba a la derecha si en la sala molesta.
- **Alta definición fuera de la demo**: depende de la red y del servicio de
  Cesium. La demo no la usa.
- **Plan B**: una grabación de pantalla de este mismo recorrido, por si falla
  el ordenador o la red. No usar la canción «Fly Me to the Moon» de fondo
  (tiene derechos).

## El recorrido (2:00)

| Tiempo | Criterio | Qué se hace | Qué se dice (EN) | Qué se dice (ES) |
|---|---|---|---|---|
| 0:00–0:15 | Impacto | Portada: el logo, Franky entra rodando en la tarjeta del modo educativo | *«At the lunar south pole the Sun skims the horizon. One ridge can leave a lander without power, or without a line to Earth. We built a tool that shows, for any site and date, how much light and Earth contact the NASA data suggest.»* | *«En el polo sur de la Luna el Sol roza el horizonte. Una cresta basta para dejar una nave sin energía o sin línea con la Tierra. Hemos hecho una herramienta que enseña, para cualquier sitio y fecha, cuánta luz y cuánto contacto con la Tierra sugieren los datos de la NASA.»* |
| 0:15–0:30 | Creatividad | Pulsar **Expert mode** (Modo experto). La carga muestra los datos que llegan; se abre con el mejor sitio ya elegido y sus fechas sugeridas a la derecha | *«No server, no install. Everything runs in your browser, hour by hour, from NASA files, and keeps working offline.»* | *«Sin servidor y sin instalar nada. Todo se calcula en el navegador, hora a hora, con ficheros de la NASA, y funciona sin conexión.»* |
| 0:30–0:50 | Relevancia | Señalar la ficha de **Malapert Massif K2023** (ya elegido): «Possible, with little margin», 100 % de luz, 14 % de Tierra, sin oscuridad. Pasar el ratón por los otros sitios de la Luna | *«It opens on the best of the candidate sites from the Artemis regions. The answer comes at once: sunlight, Earth in view, longest night. The Sun and Earth come from JPL Horizons, the terrain from the Lunar Reconnaissance Orbiter.»* | *«Se abre en el mejor de los sitios candidatos de las regiones de Artemis. La respuesta sale al momento: luz, Tierra a la vista, noche más larga. El Sol y la Tierra vienen de JPL Horizons; el relieve, del Lunar Reconnaissance Orbiter.»* |
| 0:50–1:05 | Validez · utilidad | **Suggested dates** (Fechas sugeridas), ya abierto a la derecha: la franja de 14 meses; pulsar un día oscuro y cerrar el panel con **Close** | *«When should we land? Fourteen months, hour by hour. Click a good day and the whole tool moves there.»* | *«¿Cuándo alunizar? Catorce meses, hora a hora. Pulsas un buen día y toda la herramienta se va ahí.»* |
| 1:05–1:40 | Presentación (el momento fuerte) | **Simulate landing** (Simular alunizaje). La cámara baja al sitio, la nave llega y se posa. Dejarlo correr en silencio los últimos segundos, hasta «Contact light» | *«And this is that ground, with that day's real Sun and Earth. The lander follows Apollo 11's real descent, height and speed as Buzz Aldrin called them out…»* (callar hasta el contacto) | *«Y este es ese suelo, con el Sol y la Tierra reales de ese día. La nave sigue el descenso real del Apolo 11, la altura y la velocidad tal como las cantó Buzz Aldrin…»* (callar hasta el contacto) |
| 1:40–2:00 | Validez | Cerrar la vista. Menú → **The project at a glance** (El proyecto de un vistazo), bloque 3 | *«Can you trust it? Our Sun and Earth match direct Horizons runs within 0.0065 degrees. Against a published study of 130 sites, the median difference is one day. And it never says "land here": it suggests. Fly Me to the Moon.»* | *«¿Es de fiar? Nuestro Sol y nuestra Tierra coinciden con consultas directas a Horizons con 0,0065 grados de diferencia máxima. Frente a un estudio publicado de 130 sitios, la diferencia mediana es de un día. Y nunca dice "aluniza aquí": sugiere. Fly Me to the Moon.»* |

Si sobra tiempo (pitch de 3 minutos), entre 1:05 y 1:40 cabe pulsar el botón
**Franky** y pedirle, por ejemplo, *«Which site looks best for 10 days in
December?»*: abre paneles y elige por su cuenta. Es lo más llamativo para
Creatividad, pero depende de la red y del servicio de IA, así que no va en el
recorrido base.

## Preguntas probables del jurado

| Pregunta | Respuesta corta | Dónde está |
|---|---|---|
| ¿De dónde salen el Sol y la Tierra? | JPL Horizons (DE441), cada hora, con libración. Comprobado contra consultas directas por sitio: 0,0065° de diferencia máxima en 10 249 horas y 6 sitios | `docs/DATOS.md`, `web/public/data/validation.json` |
| ¿Y el relieve? | LRO LOLA a 80 m; a 5 m alrededor de los cinco sitios del equipo. El horizonte de cada sitio se traza sobre ese relieve | `docs/DATOS.md` |
| ¿Coincide con estudios publicados? | Con Wueller et al. (2026) en 130 sitios: diferencia mediana de 1 día de luz, correlación 0,79. Los sitios donde no coincide se señalan en la propia web | panel «El proyecto de un vistazo» |
| ¿Qué no hace? | No es una trayectoria ni un presupuesto de enlace de radio: ver la Tierra no garantiza comunicación y tener Sol no garantiza energía. Lo dice en pantalla | nota bajo la ficha de cada sitio |
| ¿Y el alunizaje? | Altura, descenso y avance reales del Apolo 11 (Apollo Lunar Surface Journal), 8 veces más rápido. No es una trayectoria para ese sitio; también lo dice | «Fuente: Apolo 11, NASA» en el panel de vuelo |
| ¿Dónde habéis usado IA? | Código y textos con asistentes, declarado línea a línea en el registro de IA; el modelo de Franky, con Meshy; el asistente Franky usa un modelo abierto | `docs/IA.md` |

## Lo que queda por confirmar

- ⚠️ Duración real del pitch (2 o 3 minutos) y quién sale al escenario
  (máximo 2 personas): pendiente en `CONTEXTO.md`.
- ⚠️ Cronometrar el alunizaje en el ordenador de la presentación: en capturas
  dura unos 20 s desde que se pulsa, pero puede variar con la carga del modelo.
- ⚠️ Si se cambia la fecha por defecto de la web, repasar las cifras de la tabla.
