# Los 14 retos de 2026

Tema del año: **«The Next Frontier»**. Títulos, niveles y temas, de la web oficial
y de la lista del evento de Kandy (verificada el 10‑oct‑2026). Enunciados
completos copiados de la web oficial el 13‑nov en [`retos/`](retos/): contexto,
objetivos, consideraciones y **la pestaña de recursos con los datos de la NASA y
de las agencias**.

| # | Reto | Nivel | Tema | En una línea | Enunciado |
|---|---|---|---|---|---|
| 1 | Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars | Principiante · Intermedio | Astrofísica, planetas | Contar a jóvenes exploradores la historia del material que la NASA ha dejado en la Luna, Marte y más allá | ⚠️ no descargado |
| 2 | Be An Earth System Trend Detective! | Avanzado | Tierra, software | Series temporales de variables de la NASA y si sus tendencias son estadísticamente significativas | [ficha](retos/earth-system-trend-detective.md) |
| 3 | Build a Junior Astronaut Mission Trainer | Principiante · Intermedio | Juegos, planetas | Juego para niños de 7–12 años que gestionan energía, comida, blindaje y soporte vital de una base lunar o marciana | [ficha](retos/junior-astronaut-mission-trainer.md) |
| 4 | **Lunar Landing Site Navigator** (en Kandy: «CLPS Lunar Mission Browser») | Intermedio · Avanzado | Exploración humana, Luna, software | Herramienta intuitiva para comparar sitios y fechas de alunizaje en el polo sur viendo el Sol y la Tierra sobre el horizonte: energía y ventanas de comunicación | [ficha](retos/lunar-landing-site-navigator.md) |
| 5 | Create Health Monitoring Software for Astronauts on Space Missions | Intermedio | Exploración humana, software | Herramienta para que los astronautas evalúen su salud y actúen ante cambios | [ficha](retos/health-monitoring-software.md) |
| 6 | Dancing with the SARs | Intermedio · Avanzado | Tierra | App interactiva con radar NISAR (NASA‑ISRO) para ver cambios en la superficie: glaciares, bosques, subsidencia… | [ficha](retos/dancing-with-the-sars.md) |
| 7 | Field Shift: Adapting Farms with NASA Data | Intermedio · Avanzado | Arte, Tierra, software | Ayuda a la decisión para rotaciones de cultivo con SMAP, ECOSTRESS, GPM, Landsat, MODIS, POWER, GRACE… | [ficha](retos/adapting-farms-with-nasa-data.md) |
| 8 | Flame in Freefall: SI‑Powered Fire Safety Insights from Microgravity Combustion Data | Intermedio · Avanzado | Exploración espacial | Panel con IA que resume y ordena los experimentos de combustión en microgravedad (base PSI) para la seguridad contra incendios | [ficha](retos/flame-in-freefall.md) |
| 9 | Harmonization of MODIS and VIIRS Hot Spots | Intermedio · Avanzado | Tierra, software | Unificar los focos de incendio de MODIS y VIIRS en un calendario coherente desde 2000, en una web | [ficha](retos/modis-and-viirs-hot-spots.md) |
| 10 | Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars | Principiante · Intermedio · Avanzado | Tierra, planetas | Encontrar y caracterizar lugares de la Tierra análogos a futuras bases en la Luna o Marte | [ficha](retos/permanent-moon-base-locations-and-mars.md) |
| 11 | Interplanetary Survival Guide: Martian Map | Intermedio | Exploración humana, Marte | Mapa por capas con varios datos de la NASA para que un astronauta planifique rutas en Marte | [ficha](retos/interplanetary-survival-guide-martian-map.md) |
| 12 | **Planet X and SPHEREx** | Avanzado | Astrofísica, planetas, software | Web pública que muestra imágenes de SPHEREx de una zona del cielo a lo largo del tiempo para ver lo que se mueve o cambia | [ficha](retos/planet-x-and-spherex.md) |
| 13 | **Space Mission Design Game** | Principiante · Intermedio | Juegos | Juego en el que se diseña una misión completa equilibrando decisiones de ingeniería y recursos limitados | [ficha](retos/space-mission-design-game.md) |
| 14 | The Earth Information Jukebox | Principiante · Intermedio | Arte, Tierra | Sonificar en directo las visualizaciones del Earth Information Center | [ficha](retos/the-earth-information-jukebox.md) |

En negrita, los tres que proponen Juan y Luna.

## Los tres candidatos del equipo

> ✅ **Decidido el 14‑nov: Lunar Landing Site Navigator.** Plan B: Space
> Mission Design Game. Lo de abajo queda como registro de cómo se eligió.

Propuesta de Juan y Luna (13‑nov, 22:00), tal cual:

- **«Lunar Navigator»** (= Lunar Landing Site Navigator): «el que más cálculo
  nos exigiría, habría que controlar los tiempos».
- **SPHEREx**: «muchos datos a procesar, imágenes infrarrojo, comparativa; los
  aeros aportaríamos la mirada crítica, los movimientos esperados y significado
  físico».
- **Space Mission Design**: «poner las reglas y el objetivo; el peso está en lo
  inspirados que estemos».

Equipos apuntados en todo el mundo (pestaña *Teams*, 13‑nov por la noche,
contado por Juan Bautista): **Space Mission Design Game 2000 · Lunar Landing
Site Navigator 1016 · Planet X and SPHEREx 838.** El juego tiene el doble: en
el juicio global será más difícil destacar (Creatividad). En Madrid importa
menos, porque los ganadores locales se eligen entre todos los proyectos de la
sede, no por reto. ⚠️ Falta la cifra filtrada por el evento de Madrid.

Abajo, lo que pide cada uno, sus datos y sus riesgos para 2 días.

### Planet X and SPHEREx · Avanzado

**Qué pide (lo obligatorio):** una web pública donde el usuario mete
coordenadas (ascensión recta y declinación) y ve una **secuencia de imágenes de
SPHEREx de esa zona como un vídeo corto**, para detectar lo que se mueve.
**Hay que probarla con 5 objetos concretos:** la estrella de Barnard, Epsilon
Indi B, WISE 0855 (coordenadas dadas), RW Aurigae y R Draconis.

**Extras que sugiere:** sumar bandas por detector para mejorar la señal,
espectros al vuelo, sumar o restar imágenes de fechas distintas, elegir el
campo de visión, superponer Gaia o WISE, coordenadas en la URL, banderas de
contaminación, usar Astropy y Aladin.

**Datos:** archivo IRSA de SPHEREx y sus *notebooks* de Python, Gaia DR3.
**Modelo a imitar:** WiseView, la misma idea con datos de WISE, con cientos de
descubrimientos del público. Agencia socia: NEOSSat y CADC (Canadá).

| | |
|---|---|
| A favor | El objetivo está **muy acotado y es comprobable**: 5 objetos de prueba con respuesta conocida (Validez). Los datos de la NASA **son** el producto (Relevancia y *Best Use of Data*). Encaja con la ciencia ciudadana, como Galaxy Quest, ganador de Madrid en 2018. Los de aeronáutica aportan el sentido físico del movimiento propio y la paralaje |
| En contra | **El riesgo está en los datos:** formatos astronómicos (FITS, coordenadas WCS), 102 bandas, recortes por coordenadas y volumen de descarga. Si el acceso a IRSA se atasca el sábado por la mañana, se pierde el día. Al existir WiseView, la Creatividad tiene que venir de algo propio |
| Detalle de los riesgos | **Pocas fechas:** barre el cielo cada 6 meses desde mayo de 2025, así que cada punto tiene ~3 pasadas, no una película. **Bandas en momentos distintos:** cada banda se observa en otra fecha; sin cuidado se confunde un cambio de longitud de onda con un movimiento (por eso sugiere sumar por detector) ⚠️ deducido, sin comprobar. **Movimientos pequeños:** Barnard se mueve ~10″/año y el píxel mide ~6″ ⚠️ de memoria: 2–3 píxeles en todo el periodo. **Arquitectura:** hace falta un servidor en Python que pida y procese recortes antes de servirlos a la web. **No aprovecha a los de aeronáutica:** la física es de astronomía |
| Antes de elegirlo | Comprobar el **sábado a las 9:00** que un *notebook* de IRSA descarga un recorte de SPHEREx de una de las 5 estrellas en menos de una hora. Si no sale, cambiar de reto |

### Space Mission Design Game · Principiante · Intermedio

**Qué pide:** un juego interactivo en el que se diseña y gestiona una misión
completa: objetivo, requisitos, nave, instrumentos, lanzador, órbita, y los
recursos **masa, potencia, presupuesto, datos, comunicaciones y vida útil**.
Cada decisión tiene consecuencias en las demás. Sugiere modo de hasta 4
jugadores con roles, simulación, puntuación y explicar **por qué** una misión
sale bien o mal.

**Recursos:** guía de la NASA de diseño de misiones científicas, GMAT
(análisis de misiones), los *Concept Maturity Levels* de JPL, el Mission Design
Lab de Goddard, NASA Mission Viz, el juego de telescopios del Webb, CubeSat 101
y el reto de 2023 de misiones en realidad virtual. Agencia socia: juegos de la
CSA.

| | |
|---|---|
| A favor | **Es literalmente la carrera de Juan y Luna**: ingeniería de sistemas y compromisos de diseño. Los juegos ganan a menudo (ver [ganadores](GANADORES.md)): Galaxy Quest y Galaxy Expedition Tour en Madrid, y varios globales. Sin riesgo de datos: no hay que descargar nada para empezar |
| En contra | **Relevancia:** los recursos son guías y herramientas, **no conjuntos de datos**. El jurado puntúa que los datos de la NASA sean el núcleo, no un adorno. Habría que basar los números del juego en datos reales de la NASA (lanzadores, instrumentos, misiones) y decirlo. **Alcance:** la lista de «extras» es enorme y es fácil querer hacerlo todo |
| Antes de elegirlo | Decidir qué datos reales de la NASA alimentan el juego, y recortar a **una** misión jugable de principio a fin |

### Lunar Landing Site Navigator · Intermedio · Avanzado

**Qué pide:** una herramienta **intuitiva** para que planificadores de misión,
profesores y público comparen **sitios y fechas de alunizaje** en el polo sur
lunar viendo **dónde están el Sol y la Tierra respecto al horizonte**: si hay
luz para los paneles y si hay comunicación directa con la Tierra. El caso real
que plantea: una misión CLPS se retrasa o cambia de sitio y los ingenieros
necesitan evaluar alternativas **rápido**.

**Puede incluir (todo opcional):** lista de sitios notables (Apolo, objetivos
CLPS, misiones de otros países) y coordenadas propias; comparar sitios lado a
lado; elegir fecha y hora y ver cómo cambia a lo largo del día lunar; **tiempo
que queda hasta la puesta de Sol o de Tierra**; elevación solar, horas de luz y
ventanas de visibilidad de la Tierra; mapas 2D, 3D o animaciones. Acepta
cualquier formato: web, móvil, visualización o **juego educativo**.

**Detalles técnicos que menciona:** las efemérides se pueden sacar de **JPL
Horizons** o de datos precalculados; el relieve de **LOLA** permite calcular el
horizonte real (sin atmósfera no hay refracción: el horizonte es el relieve o
el borde de la esfera); considerar la libración y las variaciones orbitales;
cráteres profundos con sombra extrema.

**Datos:** Quickmap (LRO), Moon Trek y JPL Horizons. Agencia socia: portal de
exploración lunar de la CSA. **El problema que señala el propio enunciado:**
estas herramientas ya existen, pero son difíciles para no especialistas. El
reto es la **interfaz**, no inventar los datos.

| | |
|---|---|
| A favor | **El cálculo pesado ya lo hace la NASA:** Horizons devuelve la posición del Sol y la Tierra vista desde un punto de la Luna. Datos de la NASA en el centro (Relevancia). Es **ingeniería de misión pura**: potencia, comunicaciones, ventanas de operación; Juan y Luna validan y explican los números. Usuario claro y caso real (retrasos de CLPS, Artemis). Muy parecido a **Landsat Connect**, el ganador español de 2024 (*Best Mission Concept*): ventanas de paso de un satélite sobre un sitio |
| En contra | **El horizonte real con relieve (LOLA)** es la parte difícil: mapas de elevación grandes del polo sur y cálculo de horizonte por sitio. Sin él, las ventanas salen con horizonte ideal y pueden ser falsas en un cráter (Validez). Libración y precisión: hay que saber explicar qué se aproxima |
| Antes de elegirlo | El sábado a las 9:00, pedir a Horizons la elevación del Sol y de la Tierra para un sitio del polo sur (p. ej. el de una misión CLPS) a lo largo de un mes y comprobar que tiene sentido físico. Decidir si el relieve entra (precalculado para unos pocos sitios) o queda para después |

### Recomendación (de Claude, pendiente del equipo)

*Rehecha el 13‑nov al leer el enunciado del reto lunar.*

**1.º Lunar Landing Site Navigator · plan B: Space Mission Design Game ·
SPHEREx, tercero.**

- **El reto lunar es el que mejor junta a los cuatro.** Juan y Luna aportan lo
  que estudian (geometría Sol‑Tierra‑Luna, potencia, comunicaciones, ventanas
  de operación) y dan la Validez. Angela y Juan Bautista construyen lo que el
  enunciado pide de verdad: **una interfaz clara** sobre datos que ya existen.
- **El «mucho cálculo» que temía Juan es menor de lo que parecía:** las
  posiciones del Sol y la Tierra las da Horizons. Lo único caro es el horizonte
  con relieve, y se puede acotar a unos pocos sitios.
- **Cumple todos los patrones de los ganadores** ([`GANADORES.md`](GANADORES.md)):
  dato de la NASA en el centro, usuario claro, alcance acotable y web
  interactiva. Y tiene un precedente español muy cercano: Landsat Connect.
- **Relevancia fuerte**, que es justo el punto débil de Mission Design.
- **Riesgos:** el relieve (ver arriba) y la precisión. Hay que poder explicar
  al jurado qué es exacto y qué es aproximado.

**Mission Design como plan B:** encaja muy bien con el equipo y los juegos
ganan, pero sus recursos son guías y no datos, y el alcance se dispara.
**SPHEREx, tercero:** la física es de astronomía y el peso cae entero en los
dos de software.

**Revisada con dos criterios más** (uso de IA y planes de recuperación, ver
[`CONTEXTO.md`](CONTEXTO.md#estrategia-ia-y-planes-de-recuperación-propuesta-de-claude-pendiente-del-equipo)):
el orden se mantiene.

- **Lunar, reforzado:** la IA encaja de forma natural explicando en lenguaje
  llano los números de Horizons, y los datos se pueden precalcular para que
  funcione sin internet.
- **Mission Design, igual:** la IA encaja (asesor, eventos, informe), pero no
  arregla la Relevancia y puede inventar números de ingeniería.
- **SPHEREx, recorta distancia:** tiene el uso de IA más vistoso (detectar lo
  que se mueve) y los recortes de los 5 objetos de prueba se pueden
  precalcular. Sigue tercero por el riesgo de los datos.
- **Fuera de los tres, Flame in Freefall:** es el único que pide IA en el
  enunciado y toca la combustión (propulsión). ⚠️ Antes, comprobar cómo se
  descarga la base PSI.

## Qué retos dan un buen MVP en un fin de semana con IA

Con asistentes de código, **la interfaz y el código de pegamento salen muy
rápido**. Lo que la IA **no** acelera es conseguir y entender los datos, ni
comprobar que la ciencia está bien. Así que el MVP sale bien donde **los datos
son fáciles de obtener** y **el producto es sobre todo interfaz o lógica**.

| | Reto | Por qué |
|---|---|---|
| 🟢 | **Lunar Landing Site Navigator** | Horizons es una API de texto sencilla; el resto es interfaz (gráficas, comparador, cuenta atrás), que la IA hace muy bien. El relieve con LOLA es lo único que no se acelera |
| 🟢 | **Space Mission Design Game** | Sin dependencia de datos: es lógica de juego y UI, el terreno donde más rinde la IA. El límite es el alcance, no la técnica |
| 🟢 | Build a Junior Astronaut Mission Trainer | Igual que el anterior (juego de gestión de recursos). DONKI, la API de clima espacial que sugiere, es sencilla |
| 🟢 | Flame in Freefall | El propio reto pide un panel **con IA** que resuma y ordene experimentos: un LLM sobre los documentos de la base PSI. ⚠️ Comprobar cómo se descarga PSI |
| 🟢 | The Earth Information Jukebox | Imágenes del EIC + Web Audio para sonificar: poco dato y mucha creatividad |
| 🟢 | Create Health Monitoring Software | Una app de formularios y visualización; los datos los mete el usuario. Riesgo: que quede genérica y floja en Relevancia |
| 🟡 | Interplanetary Survival Guide: Martian Map | Las capas de Mars Trek se sirven como mapas web; montar el mapa es rápido. Elegir y cruzar 3 capas con sentido lleva tiempo |
| 🟡 | Be An Earth System Trend Detective! | Series y estadística (Mann‑Kendall) se programan rápido; conseguir la serie de la variable y la región elegidas es lo lento |
| 🟡 | Field Shift: Adapting Farms | NASA POWER es una API fácil; juntar SMAP, ECOSTRESS, GRACE… no lo es |
| 🟡 | Harmonization of MODIS and VIIRS Hot Spots | FIRMS da CSV descargables; la armonización entre sensores es ciencia, no código |
| 🟡 | Identify Earth Analogs for Moon/Mars | Más investigación y relato que software |
| 🔴 | Planet X and SPHEREx | Imágenes FITS, 102 bandas, coordenadas WCS y descargas grandes: el cuello de botella son los datos |
| 🔴 | Dancing with the SARs | Radar NISAR: ficheros enormes y procesado especializado |
| ⚪ | Abandoned but not Forgotten | Sin enunciado leído; por el resumen (contar historias a jóvenes) sería 🟢 |

**De los tres candidatos del equipo:** el lunar y Mission Design son 🟢;
SPHEREx es 🔴. Coincide con la recomendación de arriba.

Recordar: la IA se puede usar a fondo, pero **hay que declararla** en la
página del proyecto, y las imágenes o vídeos generados llevan **marca de agua
visible** ([reglas](CONTEXTO.md#las-6-reglas-que-no-se-pueden-saltar)).

## Lo que dice la experiencia de otros hackathons

Lo que suele romper un hackathon de 2 días, aplicado a estos tres:

1. **Los datos el primer día.** El reto que depende de descargar y entender
   datos nuevos (SPHEREx y, si entra el relieve, el lunar) se decide en las primeras
   horas. Hay que probar el acceso antes de comprometerse.
2. **El alcance.** El reto abierto (Mission Design) muere por querer hacerlo
   todo. Hay que tener algo jugable el sábado por la noche.
3. **La entrega cuenta tanto como el producto.** El jurado mira sobre todo la
   página del proyecto; el domingo a las 16:00 ya tiene que estar escrita. Hay
   que reservar a alguien para eso desde el sábado.
4. **Un plan B.** Elegir también un segundo reto por si el primero se atasca
   antes del sábado a mediodía (la diapositiva «6. Decisión» lo dice: a veces lo
   mejor es pivotar).
