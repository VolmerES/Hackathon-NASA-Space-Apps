# Interfaz: Lunar Landing Site Navigator

**Propuesta de Claude, pendiente del equipo (la decide Angela).** Textos de la
interfaz en inglés, porque es lo que ve el jurado.

## La pregunta que contesta

> «¿Este sitio en esta fecha es viable, y qué pasa si nos retrasamos N días?»

En segundos y sin interpretar datos en bruto. Todo lo demás es secundario.

## El recorrido (el caso del enunciado)

1. **Elegir sitios:** uno o varios (hasta 4) en el mapa del polo sur o en la
   lista.
2. **Poner la misión:** fecha de alunizaje, duración, consumo de supervivencia
   y elevación mínima de antena.
3. **Ver el veredicto:** una tarjeta por sitio con las cifras y un semáforo.
4. **Mover el deslizador de retraso** (−30 a +60 días): todo se recalcula al
   instante, porque los datos ya están en el navegador.
5. **Entender por qué:** el panorama del horizonte y la explicación.

## Pantalla principal

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ LUNAR LANDING SITE NAVIGATOR          [Planner | Explore]           Validated vs NASA ✓  │
├──────────────────────┬───────────────────────────────────────────────────────────────────┤
│  MAPA POLO SUR       │  MISSION  Landing [2027‑03‑12 06:00 UTC]  Duration [14 d]          │
│  (relieve, teselas   │           Survival power [120 W]   Min antenna elev. [2°]         │
│   de Moon Trek)      │  SLIP     ├────────────●──────────────────┤  +9 days                │
│   ● Shackleton rim   ├───────────────────────────────────────────────────────────────────┤
│   ● Connecting ridge │  ┌ Shackleton rim ──┐ ┌ Connecting ridge ┐ ┌ Malapert massif ─┐    │
│   ● Malapert massif  │  │ 🟢 VIABLE        │ │ 🟡 MARGINAL      │ │ 🔴 NOT VIABLE    │    │
│   ○ Nobile rim 1     │  │ Sunlight   86 %  │ │ Sunlight   71 %  │ │ Sunlight   38 %  │    │
│   ○ Haworth          │  │ Longest night 9h │ │ Longest night 41h│ │ Longest night 6d │    │
│                      │  │ Battery  1.1 kWh │ │ Battery  4.9 kWh │ │ Battery  17 kWh  │    │
│  color = % de Sol    │  │ Earth link 62 %  │ │ Earth link 100 % │ │ Earth link 48 %  │    │
│  medio (PGDA)        │  │ Sunset in 3d 4h  │ │ Sunset in 19h    │ │ Sunset in 2d 1h  │    │
│                      │  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│  [+ custom coords]   ├───────────────────────────────────────────────────────────────────┤
│                      │  TIMELINE (misión, con el retraso aplicado)                        │
│                      │  Shackleton   Sun   ████████████░░░████████████████   Earth ██░░██ │
│                      │  Connecting   Sun   ███████░░░░░░░░░░██████████████   Earth ██████ │
│                      │  Malapert     Sun   ███░░░░░░░░░░░░░░░░░░░░░███████   Earth █░░░██ │
│                      │               ▲ landing                                  ▲ end     │
├──────────────────────┴───────────────────────────────────────────────────────────────────┤
│  HORIZON PANORAMA · Shackleton rim                       [▶ play lunar day]              │
│   5°│                                    ☀ ·· trayectoria del Sol ··                      │
│     │      🌍 ·· Tierra ··                                                                │
│   0°│▁▂▃▅▆▇▆▅▃▂▁▁▂▃▄▃▂▁▁▁▁▂▄▆█▇▅▃▂▁▁▁▁▂▃▅▇▇▆▄▂▁   ← silueta real del relieve (LOLA)       │
│     └ N ────── E ────── S ────── W ────── N   (escala vertical exagerada)               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  WHY?  «Malapert pierde el Sol el día 3: el borde de Shackleton lo tapa al SE durante    │
│        6 días. La Tierra se ve el 48 % del tiempo porque…»   [SI‑generated from data] ⓘ   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Las cifras del boceto son inventadas: solo muestran la forma.

## Las piezas

### 1. Mapa del polo sur

- Relieve sombreado del polo sur (teselas WMTS de **Moon Trek**, o imagen
  estática si fallan).
- Los sitios como puntos, **coloreados por el % medio de Sol** del mapa de la
  NASA (PGDA 69): de un vistazo se ve qué zonas reciben luz.
- Clic para añadir o quitar un sitio de la comparación.
- **Coordenadas propias:** con aviso «sin relieve: las ventanas pueden ser
  optimistas» si no hay horizonte calculado.

### 2. Tarjetas de veredicto (lo más importante)

Una por sitio, con **semáforo** según umbrales que el usuario puede cambiar:

| Cifra | Qué es |
|---|---|
| Sunlight | % de la misión con Sol sobre el horizonte real |
| Longest night | Noche más larga dentro de la misión |
| Battery | Consumo de supervivencia × noche más larga |
| Earth link | % de la misión con la Tierra por encima de la elevación mínima |
| Sunset / Earthset in | Cuánto falta desde el alunizaje |
| Ops windows | Horas con Sol **y** Tierra a la vez |

Al mover el retraso, cada cifra muestra **cuánto cambia** (▲▼) respecto a la
fecha original. Es la respuesta directa al caso de uso.

### 3. Cronograma

- Una fila por sitio, con dos bandas: Sol (intensidad = fracción del disco
  visible) y Tierra.
- Marcas de alunizaje y fin de misión. El deslizador mueve la ventana.
- Al pasar el ratón: fecha, elevación del Sol y de la Tierra, y qué los tapa.

### 4. Panorama del horizonte (lo que convence)

- **Panorama de 360°, no gráfica polar:** todo pasa entre 0° y 5° de
  elevación, y en una gráfica polar quedaría aplastado en el borde. En un
  panorama con la escala vertical exagerada se ve la montaña que tapa el Sol.
- Silueta real del relieve, trayectorias del Sol y de la Tierra durante la
  misión, y el tamaño real de sus discos (0,53° y ~1,9°).
- **Botón «play lunar day»:** anima un día lunar. Es la pieza para el vídeo de
  30 s y para el público.

### 5. «Why?»: la explicación

- Texto en lenguaje llano generado por IA **a partir de las cifras calculadas**,
  con cada dato enlazado a su origen.
- Etiqueta visible **«SI‑generated from data»** (regla de Space Apps).
- Si la IA no responde: texto de plantilla con las mismas cifras.

### 6. Sello de validación

- Arriba a la derecha, «Validated vs NASA ✓». Al pulsarlo, por cada sitio:
  nuestro % de Sol y de Tierra frente al del mapa de la NASA (PGDA 69), y
  nuestras posiciones frente a Horizons.
- Es poco habitual en un hackathon y convierte la Validez en algo que el jurado
  **ve**.

## Dos modos

| | Planner | Explore |
|---|---|---|
| Para | Ingenieros de misión | Profesores, estudiantes, público |
| Muestra | Tarjetas, cronograma, tabla comparativa, exportar CSV | Panorama grande, animación del día lunar, explicaciones sencillas |
| Lenguaje | Técnico (kWh, °, UTC) | Llano («aquí la noche dura 6 días») |

El enunciado pide servir a los dos públicos. En el MVP basta con el modo
Planner y el panorama; el modo Explore reorganiza las mismas piezas.

## Detalles que suman

- **El escenario en la URL** (sitios, fecha, retraso): un planificador lo
  comparte con su equipo con un enlace.
- **Exportar a CSV** las cifras de la comparación.
- **Paleta apta para daltónicos**: los semáforos llevan también texto e icono.
- **Unidades y fórmulas en un ⓘ** junto a cada cifra.
- **Funciona en el móvil** al menos en lectura (los jueces a veces lo abren ahí).

## Qué entra en el MVP y qué no

| MVP (sábado) | Si da tiempo (domingo) | Después |
|---|---|---|
| Lista de sitios, misión y retraso, tarjetas con semáforo, cronograma, panorama estático | Animación del día lunar, «Why?» con IA, sello de validación, URL compartible | Modo Explore completo, coordenadas propias con relieve, CSV, altura sobre el suelo (1 m / 5 m) |

El orden de recorte es el del plan: **las tarjetas, el cronograma y el
panorama con relieve real no se recortan.**
