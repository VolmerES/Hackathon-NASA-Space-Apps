# Uso de IA («Super Intelligence»)

Space Apps exige indicar **dónde y cómo** se ha usado la IA (la llama «Super
Intelligence», SI). De la guía de entrega:

- **Imágenes y vídeos** generados: **marca de agua visible**.
- **Audio, código y datos** generados: dicho en el texto **y** en los metadatos.
- Lo generado **no puede usar ni modificar la marca de la NASA**.
- El campo «Use of Super Intelligence» de la página del proyecto **no lo ve el
  jurado**, pero sí ve las marcas dentro del proyecto y valora «originalidad,
  intención y ejecución».

Este fichero es el registro completo. Al final del hackathon, de aquí sale el
texto en inglés para ese campo y para el README del proyecto.

## Herramientas

| Herramienta | Quién la usa | Para qué |
|---|---|---|
| **Claude Code** (CLI de Anthropic), modelo **Claude Opus 5.5** | Juan Bautista | Investigación, transcripción, documentación, análisis de retos y código |
| *(añadir las que use cada uno: ChatGPT, Copilot, generadores de imagen…)* | | |

## Registro

Cada entrada dice **qué hizo la IA**, **qué hizo el equipo** y **qué se
comprobó**. Lo que no se ha comprobado lleva ⚠️.

### 13‑nov (noche, antes del hackathon): base de conocimiento

| Qué | La IA (Claude Code) | El equipo | Comprobado |
|---|---|---|---|
| Diapositivas del evento (`docs/briefing/`) | Leyó las fotos y transcribió agenda, criterios, premios y entregables a `CONTEXTO.md`. Marcó una contradicción (pitch de 2 o 3 min) | Juan Bautista hizo las fotos en la presentación | ⚠️ Transcripción sin revisar contra las fotos por una persona |
| Guías oficiales (PDF) | Extrajo el texto y resumió reglas, criterios (escala 1–5), fechas y campos de la página del proyecto | Juan Bautista consiguió y aportó los PDF | Citas literales sacadas del texto del PDF. ⚠️ Resúmenes sin revisar |
| Los 14 retos (`docs/retos/`, `RETOS.md`) | Descargó los enunciados de la web oficial con un script y los guardó tal cual. Hizo la tabla y los resúmenes en castellano | Juan Bautista dio la dirección del reto lunar, que la IA no encontraba | Enunciados: copia literal de la web oficial. ⚠️ Resúmenes sin revisar |
| Ganadores anteriores (`GANADORES.md`) | Buscó en la web (notas de prensa de la NASA, prensa española), resumió los 30 ganadores globales y los de Madrid, y redactó «qué tienen en común» | — | Fuentes enlazadas. ⚠️ Las conclusiones son interpretación de la IA |
| Elección del reto | Comparó los candidatos (a favor, en contra, riesgos, encaje con el equipo, uso de IA) y dio una recomendación razonada | **Juan y Luna** investigaron los 14 retos y eligieron los tres candidatos. Juan Bautista contó los equipos inscritos en cada reto. **El equipo decidió** el reto lunar | La recomendación es de la IA; la decisión, del equipo |
| Mensaje de WhatsApp al equipo | Redactó el resumen de pros y contras | Juan Bautista lo revisó y envió | — |
| Plan del proyecto (`PLAN.md`) | Redactó la propuesta completa: el problema, el método (SPICE, horizonte con LOLA, validación con Horizons), tecnologías, entregables, reparto y calendario | Juan Bautista pidió que resolviera el reto de verdad, no solo una app bonita. ⚠️ Pendiente de que lo revisen los cuatro | ⚠️ Nombres de kernels y productos de LOLA sin comprobar |
| Fuentes de datos (`DATOS.md`) | Buscó y leyó las páginas de Quickmap, Moon Trek, LROC y PGDA; encontró el relieve de 5 m/píxel de los sitios y los mapas de iluminación para validar | Juan Bautista pidió investigar Quickmap y Moon Trek | Leído en las páginas oficiales. ⚠️ Nada descargado aún |
| Interfaz (`INTERFAZ.md`) | Propuso el recorrido, el boceto de la pantalla y las piezas (tarjetas de veredicto, cronograma, panorama del horizonte, explicación, sello de validación) | Juan Bautista lo pidió. ⚠️ Pendiente de que lo decida Angela con el equipo | Las cifras del boceto son inventadas y así se dice |
| Reparto (`REPARTO.md`) | Desglosó las tareas de Juan y Luna (sitios, Horizons, modelo de ingeniería, validación, escenario, textos, pitch) | Juan Bautista lo pidió. ⚠️ Pendiente de cerrarlo con el equipo el sábado | — |
| Vista 3D desde el sitio (`INTERFAZ.md`) | Valoró la idea (pros, contras, técnica, cuándo) | **La idea es de Juan Bautista** | — |
| Alcance (`ALCANCE.md`) | Repasó cada objetivo y sugerencia del enunciado y los clasificó en MVP, si da tiempo y fuera; definió cuándo está hecho el MVP | Juan Bautista pidió fijar el alcance antes que la tecnología. ⚠️ Pendiente de cerrarlo con el equipo | — |
| Herramientas externas (`DATOS.md`) | Buscó y resumió HORAYZON, Skyfield, lunarsky, astroquery, Cesium Moon Terrain y los recursos de Artemis III | Juan Bautista lo pidió | ⚠️ Ninguna probada |
| Reparto del software (`REPARTO.md`) | Propuso que Juan y Luna programen el módulo de física y listó los errores típicos que deben vigilar | Juan Bautista planteó que se quedaba con todo el software. Juan y Luna manejan algo de Python: hacen las fórmulas cortas y la verificación | — |
| Stack (`STACK.md`) | Propuso web adaptable frente a app móvil, las tecnologías de cada parte, la estructura del repo y el esbozo del contrato de datos | Juan Bautista pidió definirlo. ⚠️ Pendiente de cerrarlo con el equipo | El peso de las efemérides es una estimación |
| Móvil primero (`STACK.md`, `INTERFAZ.md`, `ALCANCE.md`) | Tradujo la decisión a cambios: gráficas en SVG con D3 en vez de Plotly, efemérides a 30 min, interacción táctil, PWA prioritaria, prueba en dispositivos reales | **La decisión es de Juan Bautista** | — |
| Fiabilidad (`STACK.md`) | Diseñó las capas de resiliencia (sin conexión, dos copias, servicios opcionales, datos con versión, fallo seguro, copia de la decisión) | **La exigencia es de Juan Bautista:** que no se caiga a un usuario en un momento crítico | — |
| Plotly (`STACK.md`) | Propuso el paquete básico cargado bajo demanda y la prueba en móvil, con D3 de reserva solo para el panorama | **La decisión de mantener Plotly es de Juan Bautista** | ⚠️ Tamaño del paquete sin comprobar |
| Repo en GitHub | Creó el repo, hizo el commit y lo subió | Juan Bautista lo pidió y decidió hacerlo público | — |

### 14‑nov · sábado

| Qué | Qué hizo la IA | Qué hizo el equipo | Comprobado |
|---|---|---|---|
| Propuesta de Luna (`PROPUESTA-LUNA.md`) | La pasó a Markdown, la cruzó con el plan y señaló las diferencias | **El documento y las ideas son de Luna** (métricas horarias, 14 meses, aviso de límites, capa de Madrid) | — |
| Web bilingüe | Tradujo la interfaz al español con selector de idioma; inglés por defecto | **Juan Bautista pidió entregas en inglés y todo también en español** | ⚠️ Revisar la traducción |
| Web: métricas de Luna | Programó «Sun and Earth together», el aviso de límites, la vista de 14 meses, el CSV horario y la capa de Robledo (con datos de demostración) | Ideas de Luna | Compila; capturas revisadas. ⚠️ Umbral de 10° sin confirmar |
| Despliegue | Contenedor nginx en el VPS detrás de Caddy, y registro DNS en Hostinger | Juan Bautista lo pidió | Ver `TAREAS.md` |
| Luna 3D con datos de la NASA | Descargó la CGI Moon Kit (SVS), generó las texturas y el casquete polar con LOLA, y programó la escena con three.js: splash, acercamiento al polo y sitios marcados sobre la Luna | **Juan Bautista dio la idea** de una Luna realista girando de fondo, la transición por ampliación y marcar los sitios al elegirlos | Capturas revisadas. Solo es imagen: no da cifras |
| Flujo guiado | Rediseñó la interfaz para que primero se busque un sitio, luego se vea la respuesta y solo si se quiere se abran los paneles del cielo, las mejores fechas y la comparación | **La idea es de Juan Bautista** («que un tonto pueda usarlo») | Capturas revisadas en escritorio y móvil |
| Logo e identidad | Diseñó el símbolo (borde lunar con el Sol rasante), el logotipo y el favicon | Juan Bautista lo pidió | — |
| Datos reales | Consultó JPL Horizons, descargó y leyó el shapefile de Wueller (Zenodo) y el relieve LOLA de 80 m (PDS), trazó los horizontes y conectó todo a la web | Juan Bautista pidió que la respuesta fuera de verdad | Frente a Horizons: 0,0065°. Frente a Wueller: diferencia mediana de 1 día. ⚠️ Pendiente de que Juan y Luna lo revisen |
| Splash con servicios reales, mapa de calor, street view, alternativa sin 3D | Programados y probados en un navegador real automatizado, también con WebGL desactivado | Ideas de Juan Bautista | Pruebas automáticas sin errores en escritorio y móvil |
| Porcentajes con barra en la ficha del resultado (luz, Tierra, ambos, oscuridad) | Programado y probado en escritorio y móvil | Petición de Juan Bautista | Capturas sin errores; umbrales marcados en cada barra |
| Ficha flotante al pasar el ratón por un sitio de la Luna 3D (línea guía, veredicto, luz, Tierra, oscuridad) | Programada y probada en escritorio pasando el ratón por puntos y etiquetas | Idea de Juan Bautista | Se abre y se cierra bien, sin errores en consola |
| Luna más libre: zoom con rueda, pellizco y botones, giro vertical, vista de la Luna entera y botón «Polo sur» | Programado y probado en escritorio y con toques de dos dedos en móvil emulado | Idea de Juan Bautista | Zoom, giro y vuelta al polo funcionan, sin errores en consola |
| Gráfica 2D del cielo (curvas del Sol y la Tierra sobre el relieve) fija bajo la Luna al elegir un sitio; en móvil, dentro de la ficha | Programado y probado en escritorio y móvil emulado | Idea de Juan Bautista | Capturas sin errores |
| Favicon, iconos de app, manifiesto instalable con capturas y accesos directos, vista previa para redes, datos estructurados, robots y sitemap, cabeceras de seguridad, caché corregida y modo sin conexión | Iconos y vista previa generados por código a partir del logo; capturas reales de la app | Petición de Juan Bautista | Cabeceras comprobadas en el servidor; la web abre sin red tras una visita |
| Todo plegable con botones flotantes (ficha, curvas del cielo, «¿Cuándo?») y botón de cerrar/plegar único, grande y con borde | Programado y probado en escritorio y móvil emulado | Petición de Juan Bautista | Pliega y despliega bien; panel del móvil opaco |
| Botones «Cambiar de sitio» y «Volver» con el mismo estilo que cerrar: 44 px, borde y flecha | Programado y probado en escritorio | Petición de Juan Bautista | Capturas sin errores |
| Resumen por región en la lista («Sirven 2 de sus 5 sitios») con botón al mejor sitio | Programado tras la primera prueba en un Android real (el autor dudó con Malapert) y probado en móvil emulado | Primera prueba real: Juan Bautista, Android | El botón lleva a Malapert Massif 03, «Puedes alunizar aquí» |
| Street view nuevo: picado de la cámara sobre la Luna 3D hasta el sitio y vista a pantalla completa con relieve real (LOLA) y textura del polo (LROC), Sol con halo, Tierra con su fase real, zoom y arrastre suave | Programado y probado en navegador (Malapert K2023: Sol visible sobre un horizonte negativo, Tierra con fase) | Petición de Juan Bautista | Corregidos el horizonte negativo, una costura al norte y un intervalo de tiempo negativo |
| Gráfica 2D rehecha a mano en SVG (cielo con estrellas, relieve con grano, recorridos con brillo, iconos de Sol y Tierra con fase, guía al pasar el ratón) e inercia en el giro de la Luna con ratón y dedo | Programado y probado en escritorio y móvil emulado | Petición de Juan Bautista | Capturas sin errores; giro con inercia medido |
| Transiciones más suaves (cámara de la Luna con deslizamientos lentos, entrada y salida de paneles, ficha flotante, street view), botón «Quitar» con el estilo de cerrar y etiquetas de la Luna solo dentro de la zona libre | Programado y probado en escritorio y móvil emulado | Petición de Juan Bautista | Pruebas de street view, región, inercia y paneles sin errores |
| Guía para asistentes (`CLAUDE.md`) | Leyó la documentación y el código de `web/` y redactó la guía: comandos, flujo de datos, bilingüismo, despliegue y convenios | Angela lo pidió (`/init`) | ⚠️ Sin revisar |
| Luz y sombras reales según la fecha y la hora | La Luna 3D se ilumina desde el punto subsolar de JPL Horizons a la hora elegida (o la que se está reproduciendo), en lugar del Sol de adorno; la vista de calle proyecta sombras del relieve con ese Sol | **Idea de Angela** | La elevación del Sol que da la luz del globo coincide con la de `model.ts` en 4.240 combinaciones de sitio y hora (diferencia < 10⁻¹³°). Compila y pasa el lint. ⚠️ Sin revisar en pantalla. Las sombras fuera del propio sitio son orientativas (el cuenco se modela a partir del horizonte) |
| Relieve de LOLA para sombras en el globo | Buscó el enlace en la página del CGI Moon Kit (NASA SVS 4720), descargó `ldem_16_uint.tif` a `raw/svs/` (fuera de git) y comprobó que se lee | Angela pidió descargarlo | 33.201.026 bytes, como anuncia el servidor; 5760×2880 (16 px/grado); alturas de −9,0 a +10,7 km, el rango conocido de la Luna. SHA‑256 `45a2b32d…5d62` |
| Sombras proyectadas en la Luna 3D | Escribió `moon_polar_height.py` (mapa de alturas del casquete polar desde LOLA `ldem_16`) y un shader que avanza por el relieve hacia el Sol real de la hora elegida; la sombra se recalcula solo cuando el Sol se mueve | **Angela lo pidió** («que sean realistas») | Copia del algoritmo en Python frente a la visibilidad del Sol de la app (horizontes LOLA de 80 m): coinciden en luz o sombra el 92 % de las horas (mediana de 130 sitios × 2.050 horas). Con el Sol reflejado a propósito, el 54 %: la orientación es correcta. A 1,9 km/píxel, el globo sale 2 puntos más iluminado. ⚠️ Sin ver en pantalla: falta revisarlo en escritorio y en móvil |
| Barra de tiempo sobre la Luna (`TimeBar.tsx`) | Programó la barra: fecha y hora UTC, deslizador por los 14 meses de datos (al arrastrar solo cambia la luz de la Luna; al soltar se fija el alunizaje y se recalculan las cifras) y franja con la luz diaria del sitio elegido; textos en inglés y español | **Idea de Angela** | Compila y pasa el lint. ⚠️ Sin ver en pantalla |
| Cabecera con menú hamburguesa y barra de tiempo compacta | Pasó idioma, acciones («More») y el aviso de datos preliminares a un menú hamburguesa a la izquierda, y subió la barra de tiempo a la cabecera en una sola línea (segunda línea en móvil) | **Petición de Angela** («es demasiado grande, súbelo más») | Compila y pasa el lint. ⚠️ Sin ver en pantalla |
| Días de estancia en la barra de tiempo | Añadió los días en la superficie a la barra, con un recuadro sobre la franja que marca el tramo de la estancia, y quitó la fecha y los días de la ficha de la izquierda (el retraso se queda allí) | **Petición de Angela** | Compila y pasa el lint. ⚠️ Sin ver en pantalla |
| Barra de tiempo limitada a la estancia | El deslizador recorre solo los días elegidos, hora a hora, con el mismo cursor que «play» (Luna, gráfica del cielo); la franja muestra las horas con Sol en el sitio | **Petición de Angela** | Compila y pasa el lint. ⚠️ Sin ver en pantalla |
| Indicador del día en la barra de tiempo | Añadió «Day n/N · fecha, hora UTC» que sigue a la bola del deslizador | **Petición de Angela** | Compila y pasa el lint. ⚠️ Sin ver en pantalla |
| Fusión con `main` | Resolvió los conflictos con el relieve real del casquete de Juan Bautista: se quedan su malla con relieve y sus sombras de three.js, ahora con el Sol real de la fecha; se retiran las sombras por shader de Angela y su `polar_height.bin`, que duplicaban la función | Angela pidió fusionar con `main` | Compila; el lint da los mismos 4 avisos que `main`. ⚠️ Sin ver en pantalla. Las sombras salen del relieve exagerado ×2,5, así que son más largas que las reales |
| Calendario de alunizaje en verde, naranja y rojo (`LandingCalendar.tsx`, `landingCalendar()` en `model.ts`) | Para el sitio elegido y los días de estancia, calcula cada hora de alunizaje con los mismos umbrales que el veredicto, más una ventana de alunizaje (Sol y Tierra a la vista al alunizar). Colorea cada día con su mejor hora y muestra las 24 horas del día elegido para escoger la hora | **Idea de Angela** | En 1.170 horas de alunizaje al azar (10 sitios, estancias de 6 y 14 días), 0 diferencias con el veredicto de la app; 31 ms por sitio. ⚠️ Sin ver en pantalla |
| Horas junto a cada porcentaje en la respuesta («225 h de 337 h», «% de la estancia» en la oscuridad más larga) y escala de tiempo con leyenda de Madrid en la barra de la estancia | Programado y probado en móvil emulado | Petición de Juan Bautista | Cifras comprobadas contra las muestras horarias |
| Relieve real en el casquete polar: mapa de alturas LOLA (`ldem_16_uint.tif`, NASA SVS) que eleva la malla ×2,5, con sombras del Sol rasante; nivel de calidad según el equipo (GPU, núcleos, memoria) que baja solo si va lento | Programado (script `moon_polar_cap.py` ampliado) y probado | Petición de Juan Bautista | Capturas a nivel 0 y 2 sin errores; marcadores sobre el terreno elevado |
| Carga en móvil: medida en la web publicada con 4G simulado (2,3 MB). Quitado Plotly, que ya no usaba ninguna gráfica (−471 KB), y mapas globales de 1K para móviles y equipos débiles (−1 MB sin comprimir) | Medido, programado y probado | Petición de Juan Bautista; Plotly lo había decidido el equipo (`STACK.md` actualizado) | Pantalla de carga y app sin errores en móvil emulado; medición antes y después |
| Cámara «de pie» en la Luna: al acercarse se inclina hacia el horizonte y gira sobre su eje para dejar el suelo abajo y el cielo arriba; el arrastre se invierte con ella para seguir «agarrando el suelo» | Programado y probado | Petición de Juan Bautista | Capturas a distancia normal, media y mínima |
| Todo abre y cierra suave: desplegables que crecen y encogen, modal con entrada y salida, y paneles, street view, curvas del cielo, tarjeta y menú que se desvanecen antes de desaparecer (hook `useStay`) | Programado y probado | Petición de Juan Bautista | Medidas de altura y opacidad durante la animación; sin errores |
| El giro de cámara «de pie» pasa a darse solo al entrar en street view (el zoom a mano mantiene la vista de mapa). Botón «Street view» dentro de la ficha que sale al pasar el ratón por un sitio, que se puede alcanzar sin que la ficha se cierre (primero se probó un muñeco flotante y el equipo lo descartó) | Programado y probado | Petición de Juan Bautista | Capturas del zoom sin giro y del picado; ficha alcanzable con el ratón y botón que abre el street view |

### 15‑nov · domingo

*(rellenar durante el día)*

## Cómo se marca durante el hackathon

| Qué | Cómo |
|---|---|
| **Este registro** | Cada vez que la IA haga algo con peso (una pieza de código, un texto de la página del proyecto, un cálculo, una imagen), una línea aquí: qué hizo la IA, qué hizo el equipo, qué se comprobó |
| **Código** | Cabecera en los ficheros escritos sobre todo con IA: `// Written with Claude Code (Claude Opus 5.5); reviewed by <name>` |
| **Commits** | En el cuerpo del mensaje, una línea `IA: <qué hizo>` cuando el cambio salga de la IA (no se usa `Co-Authored-By`) |
| **Datos** | Los datos calculados por código desde la NASA (Horizons, LOLA) **no son IA**: decir la fuente y el script. Si la IA genera datos, un campo `generated_by` en el fichero y una nota en el README |
| **IA dentro del producto** | Si la herramienta usa un modelo para explicar resultados, la interfaz lo dice junto al texto («Explanation generated by SI from JPL Horizons data») y muestra la cifra de origen |
| **Imágenes y vídeo** | Marca de agua visible «SI‑generated» en todo lo generado. Nada con logos ni insignias de la NASA |
| **Audio** | Si la voz del vídeo es sintética, decirlo en la descripción del vídeo y en la página del proyecto |
| **Textos de la entrega** | Si la IA redacta o traduce la página del proyecto o las diapositivas, apuntarlo aquí y que una persona del equipo lo revise antes de enviar |
