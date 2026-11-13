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

Todo esto es contexto, no proyecto: no hay código del producto.

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
| Repo en GitHub | Creó el repo, hizo el commit y lo subió | Juan Bautista lo pidió y decidió hacerlo público | — |

### 14‑nov · sábado

*(rellenar durante el día)*

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
