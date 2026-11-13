# Reparto: qué hace cada uno

**Propuesta de Claude, pendiente del equipo.** Se cierra el sábado a las 9:30.
Cada tarea dice qué hay que entregar y cuándo está hecha. Contexto en
[`PLAN.md`](PLAN.md), [`DATOS.md`](DATOS.md) e [`INTERFAZ.md`](INTERFAZ.md).

## Cómo se reparte el software

Juan y Luna manejan **algo de Python** (13‑nov). Lo complejo es de Juan
Bautista; ellos hacen las fórmulas cortas y la verificación, con ayuda de IA.

| Quién | Qué |
|---|---|
| **Juan Bautista** | Efemérides con SPICE, trazado de rayos del horizonte, carga de los mapas de LOLA, exportación a JSON, IA, despliegue e integración |
| **Juan y Luna** | **Fórmulas de ingeniería** (funciones cortas): fracción del disco solar visible, potencia, noche más larga, batería, ventanas de comunicación y de operación. **Notebooks de verificación** |
| **Angela** | La web |

### El kit de verificación (sin leer el código de Juan Bautista)

1. **Fichero de parámetros, suyo:** sitios y coordenadas, umbrales del
   semáforo, modelo de paneles, consumo, margen de antena. Lo editan; el
   código lo lee.
2. **CSV legibles por sitio:** hora UTC, acimut y elevación del Sol y de la
   Tierra, altura del horizonte en esa dirección.
3. **Comparación independiente con Horizons:** sacan sus propios datos de la
   web de Horizons y los comparan con los CSV en un notebook. Otra persona y
   otra herramienta: por eso es fiable.
4. **Pruebas de sentido físico**, predichas a mano antes de ver resultados
   (⚠️ confirmar las cifras exactas):
   - Eje lunar inclinado ~1,54°: en el polo, el Sol no sube más de ~1,5° sobre
     el horizonte ideal.
   - Cada ~29,5 días (mes sinódico), el Sol da una vuelta de acimut.
   - Por la libración, la Tierra vista desde el polo sur sube y baja unos
     pocos grados en ciclos de ~27 días.
   - En un sitio ecuatorial (Apolo), las noches duran ~14,8 días.
5. **Gráficas automáticas** por sitio: panorama con silueta y trayectorias;
   nuestro % frente al de la NASA.
6. **Tabla de validación contra PGDA**, montada por ellos: la diapositiva de
   Validez.

**Puntos de control:** 13:30 (posiciones contra Horizons) y 20:00 (horizonte e
iluminación contra la NASA). Dan el visto bueno ellos.

### Errores que solo ve quien sabe de esto (para revisar siempre)

- Mezclar los sistemas de la Luna **MOON_ME** y **MOON_PA** (~875 m de
  diferencia). Los mapas de PGDA 78 vienen en MOON_ME (DE421).
- Criterio del **acimut** (desde el norte, sentido horario) y de la elevación.
- **Escalas de tiempo** (UTC frente a TDB).
- Conversión de las coordenadas **estereográficas polares** a latitud y longitud.
- Cifras poco creíbles frente a la NASA (un 95 % de luz donde PGDA da 60 %).

## Juan y Luna: que las cifras sean correctas y se puedan defender

El jurado puntúa **Validez** (base científica, viabilidad real) y
**Relevancia** (datos de la NASA en el centro). Esas dos notas dependen de
vosotros: decidís qué se calcula, con qué criterios, y demostráis que está bien.
No hace falta programar: Juan Bautista convierte vuestras decisiones en código.

### Sábado por la mañana (10:30–13:30): las bases

**1. La lista de sitios** · *los dos*
- Elegir 8–10 sitios de la lista de PGDA 78 ([`DATOS.md`](DATOS.md#1-relieve-de-5-mpíxel-de-los-sitios-candidatos-del-polo-sur)):
  los más interesantes para contar una historia (muy iluminados, marginales,
  malos). Ideas: Shackleton rim, Connecting ridge, Malapert massif, Nobile rim
  1, de Gerlache rim, Haworth, Leibnitz β plateau.
- Para cada uno: **latitud, longitud y altura** del punto exacto, con su fuente
  (README de PGDA, Mazarico et al. 2011).
- Añadir 1–2 de contraste fuera del polo (un Apolo) y, si existe, un sitio
  real de CLPS en el polo ⚠️ (comprobar cuál).
- **Entregable:** tabla `sitio · lat · lon · altura · fuente · por qué`.
  **Hecho cuando** Juan Bautista la tenga a las 11:30.

**2. La comprobación con Horizons** · *Juan*
- En [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), con un sitio del
  polo sur como observador (centro de observación en la superficie de la Luna,
  cuerpo 301, con sus coordenadas) ⚠️ comprobar el formato, pedir **acimut y
  elevación aparentes del Sol y de la Tierra** cada hora durante un mes.
- Guardarlo en CSV. Es la referencia con la que se compara lo que calcula
  Juan Bautista con SPICE.
- **Hecho cuando** las diferencias con SPICE se hayan comparado y estén por
  debajo de 0,1°. **A las 13:30 se decide** si seguimos con SPICE o con
  Horizons precalculado.

**3. El modelo de ingeniería** · *Luna*
Decidir y **justificar con una fuente** cada parámetro. Son los números de las
tarjetas, y el jurado puede preguntar por cualquiera:
- **Paneles:** verticales, con seguimiento en un eje u horizontales. Potencia
  nominal y eficiencia de ejemplo.
- **Sol visible:** desde cuándo cuenta (centro del disco, borde, fracción del
  disco). El disco mide ~0,53°.
- **Tierra visible:** elevación mínima de antena (margen sobre el horizonte).
  Ojo: el mapa de la NASA cuenta la Tierra como visible si se ve **cualquier
  parte** del disco; para validar hay que usar el mismo criterio.
- **Batería:** consumo de supervivencia por defecto (valor típico de un
  módulo de alunizaje, con fuente) × noche más larga.
- **Semáforo:** qué es viable, marginal y no viable (umbrales de % de Sol,
  noche máxima y % de comunicación).
- **Entregable:** una tabla `parámetro · valor por defecto · por qué · fuente`.

**4. Revisar el método del horizonte** · *los dos*
- Revisar con Juan Bautista la fórmula del ángulo del terreno con la curvatura
  de la Luna (radio 1737,4 km): ángulo ≈ atan((h_terreno − h_sitio) / d) − d / (2R).
- Confirmar las dos resoluciones (5 m cerca, 60–240 m lejos) y hasta qué
  distancia mirar.

### Sábado por la tarde (14:30–20:00): la validación

**5. Validar contra la NASA** · *los dos*
- Para cada sitio, comparar **nuestro % medio de Sol y de Tierra** con el valor
  del mapa de PGDA 69 en ese punto. Nuestro periodo será más corto que sus
  18,6 años: explicar la diferencia que eso introduce.
- Comprobar la sensibilidad: la silueta con el mapa lejano de 60 m frente al de
  120 m (debe cambiar décimas de grado).
- Contrastar visualmente 2–3 sitios con la capa de iluminación de
  **Quickmap**.
- **Entregable:** tabla `sitio · nuestro % Sol · NASA % Sol · nuestro % Tierra ·
  NASA % Tierra · diferencia · explicación`. Es una diapositiva del pitch y el
  sello «Validated vs NASA».

**6. El escenario de la demo** · *Luna*
- Una misión de ejemplo creíble (sitio, fecha de alunizaje, duración) y un
  **retraso** que cambie el veredicto de forma clara: «con 9 días de retraso,
  Connecting ridge pasa de viable a marginal porque…».
- Es el corazón del pitch: tiene que entenderse en 30 segundos.

### Domingo: explicar y defender

**7. Revisar lo que dice la IA** · *Juan* (mañana)
- Leer las explicaciones «Why?» de cada sitio y comprobar que cada frase es
  física y numéricamente correcta. Lo que no esté bien, se corrige o se quita.

**8. Los textos de ciencia** · *Luna* (mañana)
- Los ⓘ de cada cifra (qué es, fórmula, unidad) y los textos sencillos del
  modo Explore, **en inglés**.
- La sección «Method & Validation» del README y de la página del proyecto.

**9. El cronómetro** · *Juan* (mañana)
- Hacer a mano la comparación de la demo (3 sitios, un retraso) con Horizons y
  Quickmap, cronometrarla, y luego con nuestra herramienta. Es la cifra del
  pitch: «de N minutos a segundos».

**10. El pitch** · *uno de los dos sale con Juan Bautista* (14:00–16:00)
- Contar la parte de ingeniería y responder las preguntas técnicas.
- Preparar respuestas a las preguntas probables del jurado:
  - ¿Por qué no usar Horizons directamente?
  - ¿Cuánta precisión tiene? ¿Qué se aproxima?
  - ¿Tenéis en cuenta la libración? ¿Y la refracción? (no hay atmósfera)
  - ¿Qué pasa a 1 m o a 5 m sobre el suelo (paneles en un mástil)?
  - ¿Cómo sabéis que las cifras están bien? → la tabla de validación

### Qué necesitáis tener a mano

- Cuenta en spaceappschallenge.org, en el equipo y en el evento de Madrid.
- La interfaz web de Horizons (no hace falta instalar nada).
- Opcional: **QGIS** para abrir los mapas GeoTIFF de la NASA y ver los sitios.
- Las fuentes: Mazarico et al. (2011), Barker et al. (2021), Speyerer y
  Robinson (2013) (en [`DATOS.md`](DATOS.md)).

## Angela: la interfaz

Pendiente de concretar con ella. Según [`INTERFAZ.md`](INTERFAZ.md): mapa,
tarjetas de veredicto, cronograma, panorama del horizonte y deslizador de
retraso, primero con datos de prueba y luego con los reales.

## Juan Bautista: los datos, la IA y el despliegue

Pendiente de concretar. Según [`PLAN.md`](PLAN.md): efemérides con SPICE,
horizonte con LOLA, exportación a JSON, capa de IA, despliegue en
`nasaspaceapps.volmer.es` y FortiGuard.

## De todos

- **Responsable de la demo y de la página del proyecto:** decidirlo a las
  10:30.
- **Registro de IA:** cada uno apunta en [`IA.md`](IA.md) lo que haga con IA.
