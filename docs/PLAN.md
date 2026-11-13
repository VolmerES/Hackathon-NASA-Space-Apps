# Plan: Lunar Landing Site Navigator

**Propuesta de Claude, pendiente del equipo.** Redactada la noche del 13‑nov:
es un plan, no código. Según las reglas, el proyecto empieza el sábado 14 a las
9:00. Lo marcado ⚠️ está sin comprobar y se verifica el sábado a primera hora.

> **El alcance** (MVP, si da tiempo, fuera) está en [`ALCANCE.md`](ALCANCE.md)
> y se cierra antes que las tecnologías.

## 1. El problema que resolvemos de verdad

Del enunciado: cuando una misión CLPS se retrasa o cambia de sitio, los
ingenieros tienen que evaluar **rápido** otras fechas y otros sitios del polo
sur. Para cada combinación necesitan saber si habrá **luz para los paneles** y
**comunicación directa con la Tierra**, y durante cuánto tiempo. Las
herramientas de la NASA (Horizons, Quickmap, Moon Trek) tienen los datos, pero
cada caso obliga a pasar por varias interfaces e interpretar datos en bruto.

**Lo que hace que sea difícil, y que una app bonita no resuelve:** en el polo
sur el Sol y la Tierra van rozando el horizonte, a pocos grados. **El horizonte
lo marca el relieve**: una montaña a 50 km tapa el Sol durante días. Con un
horizonte ideal (la esfera lunar), las ventanas salen **mal**. El enunciado lo
dice: «*terrain elevation can significantly affect horizon positions and
visibility windows*».

**Nuestra respuesta:** para cualquier sitio de la lista y cualquier fecha, en
segundos, la visibilidad del Sol y de la Tierra **con el horizonte real**, y
las cifras que deciden si la misión es viable. Todo comprobado contra fuentes
de la NASA.

### Las preguntas que la herramienta contesta

1. **¿Habrá luz?** Elevación del Sol sobre el horizonte real y fracción del
   disco solar visible, a lo largo del tiempo.
2. **¿Cuánta energía?** Potencia de los paneles según su orientación (en el
   polo, paneles verticales) y horas de luz.
3. **¿Cuánto dura la noche más larga?** Es lo que dimensiona la batería: la
   energía necesaria para sobrevivir = consumo mínimo × duración de la noche.
4. **¿Hay comunicación directa con la Tierra?** Ventanas en que la Tierra está
   sobre el horizonte real.
5. **¿Cuándo se puede operar?** Ventanas con Sol **y** Tierra a la vez.
6. **¿Cuánto falta para la puesta de Sol o de Tierra?** Desde la hora de
   alunizaje elegida.
7. **¿Y si la misión se retrasa N días?** Mover la fecha y ver cómo cambian
   todas las cifras, para varios sitios a la vez.

### Cómo sabremos que funciona (criterio de Validez)

- **Efemérides:** comparar la posición del Sol y de la Tierra que calculamos con
  la de **JPL Horizons** para varios sitios y fechas. Objetivo: diferencia por
  debajo de 0,1°.
- **Iluminación con relieve:** comparar el porcentaje de iluminación de sitios
  conocidos (borde del cráter Shackleton, por ejemplo) con los estudios
  publicados con datos de LOLA ⚠️ (p. ej. Mazarico et al., 2011) y con la capa
  de iluminación de **Quickmap**.
- **Rapidez:** cronometrar la misma comparación (3 sitios, retraso de 7 días)
  hecha a mano con Horizons y Quickmap frente a nuestra herramienta. Es la
  cifra del pitch.

## 2. Cómo funciona por dentro

```text
                 PREPARACIÓN (Python, antes de servir)                  WEB (navegador)
 ┌──────────────────────────────┐   ┌──────────────────────────┐   ┌────────────────────────────┐
 │ SPICE (kernels de NAIF/JPL)  │──▶│ Sol y Tierra vistos desde │──▶│ Cielo del sitio: horizonte  │
 │ efemérides Sol, Tierra, Luna │   │ la Luna, cada 10 min,     │   │ real + trayectorias         │
 │ con libración                │   │ 1 año (JSON)              │   │ Cronograma de ventanas      │
 └──────────────────────────────┘   └──────────────────────────┘   │ Comparador de sitios        │
 ┌──────────────────────────────┐   ┌──────────────────────────┐   │ Retraso de fecha (deslizador)│
 │ LOLA: relieve del polo sur   │──▶│ Horizonte real de cada    │──▶│ Cifras: % luz, noche más    │
 │ (mapas de elevación)         │   │ sitio (720 acimuts)       │   │ larga, batería, ventanas    │
 └──────────────────────────────┘   └──────────────────────────┘   │ Explicación con IA          │
                                                                    └────────────────────────────┘
          Horizons: se usa para VALIDAR las efemérides, no en cada consulta
```

### Efemérides: SPICE, y Horizons para validar

- **SPICE** es la librería de navegación de la NASA/JPL. Con `spiceypy`
  (Python) y los kernels públicos de NAIF se calcula la dirección del Sol y de
  la Tierra desde cualquier punto de la Luna, **con la libración incluida** (el
  enunciado pide tenerla en cuenta). ⚠️ Comprobar el sábado qué kernels hacen
  falta: efemérides planetarias (DE440) y orientación de la Luna.
- **¿Por qué no llamar a Horizons en cada consulta?** Porque es lento para una
  comparación «en segundos», depende de internet y tiene límites de uso.
  Horizons es la **referencia**: con él se validan nuestras cifras y se cita como
  fuente.
- **Truco para que cualquier coordenada funcione en el navegador:** se exportan
  una vez las posiciones del Sol y de la Tierra respecto al centro de la Luna
  (un año, cada 10 min). Para un sitio cualquiera, el navegador resta la
  posición del sitio y obtiene acimut y elevación al instante. Es exacto e
  incluye la paralaje de la Tierra (hasta ~0,26°, nada despreciable cuando la
  Tierra está a 1–2° del horizonte).

### Si se cae Horizons, la app sigue

**La app no llama a Horizons en tiempo de uso.** Las efemérides salen de SPICE
(kernels descargados una vez), se precalculan a JSON y van dentro de la web
estática. Horizons solo se usa para **validar**, una vez.

- En el **plan B** (efemérides desde Horizons si SPICE no cuadra), las
  respuestas se descargan una vez y se guardan en el repo: tampoco hay llamada
  en tiempo de uso.
- **Fuera del MVP, si da tiempo:** botón «Check against JPL Horizons» que
  consulta Horizons en directo para el sitio y la fecha en pantalla y muestra
  la diferencia con nuestro cálculo. Si Horizons no responde, el botón lo dice
  y todo lo demás sigue igual. Suma en Validez.

### Horizonte real: LOLA

> **Actualizado:** las fuentes concretas están en [`DATOS.md`](DATOS.md). El
> relieve de 5 m/píxel de los sitios (PGDA 78) y los mapas de iluminación y
> visibilidad de la Tierra ya calculados por el equipo de LOLA (PGDA 69), que
> son nuestra validación principal.

- Para cada sitio, se trazan **720 rayos** (cada 0,5° de acimut) sobre el mapa
  de elevación de LOLA y se guarda el ángulo máximo del relieve en cada
  dirección, **teniendo en cuenta la curvatura de la Luna** (radio 1737,4 km).
- Se usan dos resoluciones: fina cerca del sitio y gruesa para las montañas
  lejanas (hasta 150–200 km).
- ⚠️ Comprobar el sábado qué producto de LOLA usar (mapas polares del PDS, con
  resoluciones de 5 a 240 m/píxel según el producto) y cuánto pesa. **Es la
  pieza con más riesgo:** se acota a una lista de 8–10 sitios precalculados.
- **Coordenadas propias:** horizonte ideal en el navegador, con un aviso claro
  («sin relieve: las ventanas pueden ser optimistas»). Si da tiempo, cálculo
  del horizonte real en un pequeño servidor.

### Sitios de la lista

Regiones candidatas de Artemis III en el polo sur ⚠️ (lista de la NASA, a
confirmar), sitios de CLPS e Intuitive Machines en el polo, el borde de
Shackleton, Chandrayaan‑3 (India) como referencia, y algún Apolo para mostrar
el contraste con el ecuador. Juan y Luna eligen la lista final.

### Las cifras de ingeniería

- **Sol visible:** elevación del centro del Sol sobre el horizonte real, y
  fracción del disco visible (el Sol mide ~0,53°: a ras de horizonte importa).
- **Potencia:** P = P₀ × fracción visible × cos(ángulo de incidencia), para
  paneles verticales u orientables (lo deciden Juan y Luna).
- **Noche más larga** y **batería mínima** = consumo de supervivencia × noche
  más larga (consumo como parámetro).
- **Comunicación directa:** Tierra sobre el horizonte real, con un margen de
  elevación mínima de antena configurable.
- **Ventanas de operación:** Sol y Tierra a la vez.

### IA: explica, no calcula

Un modelo (Claude, de Anthropic) **explica en lenguaje llano** las cifras ya
calculadas y responde preguntas sobre ellas, citando el dato de origen: «Este
sitio pierde la Tierra el día 6 a las 14:00 porque el macizo de Malapert la tapa
por el norte; vuelve a verse 4 días después». **Nunca calcula ni inventa una
cifra.** Es el patrón de Medicci.

- En la web publicada, las explicaciones de los sitios de la lista van
  **precalculadas** y marcadas como generadas por IA (no hay que esconder una
  clave de API en una web estática).
- En la demo, un pequeño servidor permite preguntar en directo. Si falla, se
  muestra la explicación precalculada.

> La interfaz (recorrido, boceto y piezas) está en [`INTERFAZ.md`](INTERFAZ.md).

## 3. Tecnologías

> El detalle (plataforma, estructura del repo, contrato de datos) está en
> [`STACK.md`](STACK.md).

| Parte | Tecnología | Por qué |
|---|---|---|
| Efemérides | Python 3.12 + **spiceypy** + kernels de NAIF | Estándar de la NASA, sin red, con libración |
| Relieve | **numpy** + **rasterio** sobre mapas de LOLA | Lectura de mapas de elevación y trazado de rayos |
| Validación | API de **JPL Horizons** + capas de **Quickmap** | Las fuentes de la NASA que da el reto |
| Web | **Vite + React + TypeScript** | Rápido de montar y de desplegar como web estática |
| Gráficas | **Plotly.js** | Gráfica polar del cielo y cronogramas sin dibujarlos a mano |
| Mapa | Teselas WMTS de Moon Trek, o imagen del relieve de LOLA | Sin servidor de mapas propio; la imagen es la reserva |
| 3D (opcional) | **three.js** con **React Three Fiber** y **drei** | Escena local alrededor del sitio, integrada en React. Relieve exportado desde Python como mapa de alturas; malla lejana **con la curvatura de la Luna** (a 100 km el suelo cae ~2,9 km); luz desde el Sol de SPICE, sin luz ambiente. Descartados CesiumJS (globos, pesado), Babylon.js y deck.gl |
| IA | **API de Claude** (servidor pequeño con FastAPI para la demo) | Explicaciones basadas en las cifras calculadas |
| Web publicada | **Hostinger**, en **`nasaspaceapps.volmer.es`** | Web estática con HTTPS automático: sin servidor que se caiga en el pitch |
| Servidor (opcional) | **Contabo**: el VPS de whoshuman y telegrupos (alias SSH `whoshuman-vps`), en un contenedor Docker propio y un subdominio aparte (p. ej. `api.nasaspaceapps.volmer.es`) | Solo para la IA en directo o el horizonte con coordenadas propias. **Sin tocar whoshuman ni telegrupos**; el cálculo pesado de LOLA se hace en local. Si cae, la web sigue con lo precalculado |
| Copia de reserva | **GitHub Pages** (el repo ya es público) | Segunda dirección si falla el dominio |

**FortiGuard:** la guía oficial recomienda pedir la clasificación de las webs
nuevas en el formulario de FortiGuard Web Filter, para que los filtros de red
del jurado no las bloqueen. Pedirla para `nasaspaceapps.volmer.es` en cuanto el
subdominio exista (categoría: *education* o *web-based application*; *Company
Name*: «N/A»). ⚠️ Comprobar dónde están las DNS de `volmer.es`.

## 4. Qué entregamos exactamente

| Entregable | Qué es | Campo de la página |
|---|---|---|
| **La web** | Pública en `nasaspaceapps.volmer.es` (copia en GitHub Pages): lista de sitios, cielo con horizonte real, cronograma, comparador, deslizador de retraso, cifras y explicación | *Link to Final Project* |
| **El repo** | Código, datos precalculados, scripts para regenerarlos y README en inglés con método, fuentes, validación y uso de IA | *Link to Final Project* / *References* |
| **La validación** | Una página corta: nuestras cifras frente a Horizons, Quickmap y la literatura; el cronómetro | Página del proyecto y diapositiva |
| **La demo** | **7 diapositivas** para el pitch, subidas como PDF público. Vídeo de 30 s como copia de seguridad | *Link to Project Demo* |
| **La página del proyecto** | En inglés: resumen, descripción detallada, datos de la NASA usados, referencias, uso de IA | Todos los campos |

## 5. Quién hace qué (propuesta)

> El detalle por persona, con entregables y horas, está en [`REPARTO.md`](REPARTO.md).

| Quién | Qué |
|---|---|
| **Juan y Luna** | El modelo físico: cifras, potencia, batería, márgenes de antena. La lista de sitios y fechas. La **validación** (Horizons, Quickmap, literatura). La sección de método. Uno de ellos sale al pitch |
| **Angela** | La web: cielo con horizonte, cronograma, comparador, deslizador, diseño |
| **Juan Bautista** | Los datos: SPICE, horizonte con LOLA, exportación a JSON; la capa de IA; despliegue e integración. Sale al pitch con uno de los de aeronáutica |
| **Todos, desde el sábado por la tarde** | Una persona responsable de la demo y de la página del proyecto (decidirlo a las 10:30) |

## 6. Calendario, con puntos de decisión

| Cuándo | Qué | Decisión |
|---|---|---|
| Sáb 9:00–9:30 | Equipo creado en la web con el reto | |
| Sáb 9:30–10:30 | Revisar este plan entre los cuatro y cerrarlo | |
| Sáb 10:30–13:30 | Efemérides con SPICE para 1 sitio, comparadas con Horizons. Horizonte de LOLA para 1 sitio. Esqueleto de la web con datos de prueba | **13:30: ¿cuadra con Horizons?** Si no, efemérides directamente de Horizons, precalculadas |
| Sáb 14:30–20:00 | Horizontes de los 8–10 sitios, cifras de ingeniería, cielo y cronograma en la web, primer despliegue | **20:00: ¿hay relieve?** Si LOLA se atasca, horizonte ideal para todo y explicarlo como limitación |
| Sáb noche | Comparador y deslizador de retraso; todo funcionando de punta a punta | |
| Dom 10:00–12:00 | Validación con cifras, explicación con IA, pulido | |
| Dom 12:00 | **Primera versión de la página del proyecto** | |
| Dom 14:00 | Diapositivas cerradas; vídeo de copia de seguridad grabado | |
| Dom 16:00 | Página del proyecto lista (requisito para presentar) | |
| Dom 16:15 | Pitch | |
| Dom antes de las 23:59 | Versión definitiva y **Submit for Judging** | |

## 7. Riesgos y planes B

| Riesgo | Plan B |
|---|---|
| SPICE no cuadra o los kernels dan guerra | Efemérides precalculadas desde la API de Horizons para los sitios de la lista |
| LOLA demasiado grande o lenta | Menos resolución, menos sitios, o la capa de iluminación de Quickmap como referencia |
| Falla el wifi o el servidor en el pitch | Web estática con todo precalculado y vídeo grabado |
| El dominio no carga o el filtro del jurado lo bloquea | Copia en GitHub Pages; clasificación en FortiGuard pedida el sábado |
| La IA no responde | Explicaciones precalculadas |
| No llegamos a todo | Orden de recorte: primero cae la IA en directo, luego el comparador múltiple, luego las coordenadas propias. **El cielo con horizonte real y las cifras no se recortan** |
