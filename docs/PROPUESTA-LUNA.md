# Propuesta de Luna

Documento de Luna (`HACKATHON.docx`), pasado a Markdown. Debajo, cómo queda
recogido en la web y en el plan, y lo que choca con lo anterior y hay que
decidir entre los cuatro.

## El documento

### Herramientas para obtener los datos

- **NASA JPL Horizons:** dónde están el Sol y la Tierra en cada momento.
- **NASA LOLA:** el relieve lunar, para saber si una montaña tapa la línea de
  visión.

### El perfil de horizonte de 360°

Cuántos grados se eleva el terreno alrededor del observador en cada dirección.
Se puede calcular una dirección por grado (360 valores). Cuando Horizons dice
que el Sol está a 120° de acimut, se mira la altura del horizonte en esa
dirección y se comprueba si queda oculto.

| Dirección | Elevación del obstáculo más alto |
|---|---|
| 0° (norte) | 3° |
| 90° (este) | 8° |
| 180° (sur) | 1° |
| 270° (oeste) | 6° |

*Valores de ejemplo, no medidos.*

> **Ojo:** el horizonte puede depender de montañas a muchos kilómetros. No
> basta con las celdas más próximas y hay que tener en cuenta la curvatura
> lunar.

### Por qué cada hora durante 14 meses

Una foto de un momento no dice cuándo conviene operar: hay que ver cómo cambia
la visibilidad con el tiempo. El programa repite el análisis cada hora, cada
día y en cada uno de los **cinco lugares**:

| Hora | Sol visible | Tierra visible | Ambos |
|---|---|---|---|
| 08:00 | Sí | Sí | Sí |
| 09:00 | Sí | Sí | Sí |
| 10:00 | Sí | No | No |
| 11:00 | No | No | No |
| 12:00 | No | Sí | No |
| 13:00 | Sí | Sí | Sí |

Preguntas que responde:

- **¿Qué lugar tiene más horas de luz?** Se cuentan las horas con Sol.
- **¿Cuál tiene más comunicación directa?** Se cuentan las horas con la Tierra
  visible.
- **¿Cuándo coinciden las dos?** Horas con Sol y Tierra a la vez.
- **¿Qué sitio tiene la noche más larga?** El periodo continuo más largo sin
  Sol.

Son aproximaciones horarias. **Ver la Tierra no garantiza un enlace de radio
operativo, y estar iluminado no garantiza suficiente producción eléctrica.**

### Página web o app

- Si es posible, una vista del horizonte.
- Una línea temporal de visibilidad.
- Una comparación de los cinco sitios.

### Opcional: la estación de Madrid

¿Puede la estación de Madrid ver la Luna a la vez que el sitio lunar ve la
Tierra? Hace falta:

1. Las coordenadas de la estación de Robledo de Chavela.
2. La posición de la Luna vista desde la estación, cada hora.
3. La elevación de la Luna sobre el horizonte de la estación.
4. Comprobar si supera un umbral mínimo de elevación.

### Reparto

| Persona | Qué hace | Qué entrega |
|---|---|---|
| **Juan** | Entender la física, verificar Horizons, explicar qué representan los resultados y estudiar la capa DSN | Tabla de validación y explicación científica |
| **Luna** | Buscar los lugares y sus coordenadas, revisar las fuentes LOLA, preparar la narrativa y validar resultados | `sites.json`, documentación y presentación |
| **Juan Bautista** | Programar la extracción de datos, el cálculo del horizonte y las métricas | Archivos JSON con resultados reales |
| **Angela** | Construir la interfaz y representar los resultados | Página web pública funcional |

## Cómo queda recogido

| Punto de Luna | En la web (datos de demostración) |
|---|---|
| Horas de luz, Tierra, ambas y noche más larga | Tabla de comparación: luz solar, oscuridad más larga, batería, contacto con la Tierra y **«Sun and Earth together»** |
| Aviso de que ver la Tierra no es enlace y luz no es energía | Frase bajo la tabla, en los dos idiomas |
| Vista del horizonte | Panorama 2D y vista 3D desde el sitio |
| Línea temporal de visibilidad | Barras de la estancia en cada fila y sección **«When is the best time to land?»**: 14 meses, hora a hora, una columna por día; pulsar un día cambia la fecha de alunizaje |
| La tabla hora a hora | Botón para **descargar la tabla horaria en CSV** del sitio seleccionado (hora, Sol, Tierra, ambos, Madrid, acimut y elevación). Sirve también para que Juan valide contra Horizons |
| Comparación de sitios | La tabla admite hasta 4 a la vez; la lista sale de `sites.json` |
| Estación de Madrid (opcional) | Casilla **«Show the Madrid deep space station»**: tercera barra con las horas en que el sitio ve la Tierra y la Luna está a ≥ 10° sobre Robledo (DSS‑63: 40,431° N, 4,248° O) |

## Lo que hay que decidir entre los cuatro

| Tema | Luna | Plan anterior | Propuesta |
|---|---|---|---|
| Periodo y paso | Cada hora, 14 meses | 2026–2028 cada 10 min (`ALCANCE.md`) | 14 meses cada hora para el resumen largo; la estancia, más fina si da tiempo |
| Resolución del horizonte | 1° (360 valores) | 0,5° (720 valores) | 0,5°: cuesta lo mismo y el Sol mide 0,53° |
| Efemérides | Horizons | SPICE como fuente y Horizons para validar | SPICE como fuente (no depende de que Horizons responda); Horizons para validar, como dice Luna |
| Número de sitios | Cinco | Seis en la demo | Los que diga `sites.json` |
| Umbral de la estación de Madrid | Sin fijar | — | 10° de elevación ⚠️ confirmar con Juan |

⚠️ Las cifras de la web son de demostración hasta que lleguen los JSON reales.
