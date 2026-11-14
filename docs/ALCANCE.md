# Alcance: qué entra en el MVP, qué si da tiempo y qué se queda fuera

**Propuesta de Claude, pendiente del equipo.** Se cierra el sábado a las 9:30,
antes que las tecnologías. Repasa **cada punto** de los objetivos y de las
consideraciones del [enunciado](retos/lunar-landing-site-navigator.md).

## El MVP en una frase

> Para **8–10 sitios del polo sur** y **cualquier fecha entre 2026 y 2028**,
> comparar **hasta 4 sitios** con el **horizonte real de LOLA**: tarjetas de
> veredicto (Sol, noche más larga, batería, Tierra, tiempo hasta la puesta),
> cronograma, panorama del horizonte y **deslizador de retraso**. Cifras
> **validadas contra Horizons y los mapas de la NASA**. Web estática publicada.

### Cuándo está hecho el MVP

1. Se elige un sitio y una fecha y salen las cifras en menos de un segundo.
2. El retraso cambia todas las cifras al instante y muestra cuánto cambian.
3. El panorama enseña la silueta real y por qué se pierde el Sol o la Tierra.
4. Las posiciones del Sol y la Tierra difieren de Horizons menos de 0,1°.
5. El % de Sol y de Tierra de cada sitio está comparado con el mapa de PGDA 69,
   y la diferencia, explicada.
6. Está publicado en `nasaspaceapps.volmer.es` y funciona sin servidor.
7. **Se usa entero en el móvil:** probado en un iPhone (Safari) y un Android
   (Chrome) de verdad.

## Lo que pide el enunciado (objetivos)

| # | Lo que pide | Decisión | Cómo / por qué |
|---|---|---|---|
| O1 | Lista de sitios notables: **Apolo, objetivos de CLPS, otras misiones comerciales, programas de otros países** | 🟢 MVP: sitios del polo sur (PGDA 78) · 🟡 Si da tiempo: 1–2 Apolo y Chandrayaan‑3 de contraste | El reto es el polo sur. Los de fuera necesitan otro mapa de relieve |
| O2 | **Coordenadas propias** | 🟢 MVP con horizonte ideal y aviso · ⚪ Fuera: con relieve real | Las efemérides ya están en el navegador: sale casi gratis. Con relieve haría falta servidor y descargas |
| O3 | **Comparar sitios** lado a lado o en secuencia | 🟢 MVP: hasta 4 | Es el corazón del caso de uso |
| O4 | **Elegir fecha y hora** | 🟢 MVP | Rango 2026–2028 |
| O5 | Ver cómo cambia **a lo largo de días lunares y estaciones** | 🟢 MVP: cronograma de la misión · 🟡 Si da tiempo: vista de un año entero | Los datos cubren el rango; la vista anual es solo interfaz |
| O6 | **Sol y Tierra respecto al horizonte** en el sitio y la fecha | 🟢 MVP: panorama del horizonte | Lo que convence |
| O7 | **Tiempo hasta la puesta de Sol o de Tierra** | 🟢 MVP | Lo pide dos veces |
| O8 | **Elevación solar, horas de Sol y ventanas de visibilidad de la Tierra** | 🟢 MVP | Las tarjetas |
| O9 | **Mapas 2D, 3D** u otras representaciones | 🟢 MVP: mapa 2D · 🟡 Si da tiempo: vista 3D desde el sitio | El 3D no decide nada que no muestre el panorama |
| O10 | **Animaciones o cronogramas** del día lunar | 🟢 MVP: cronograma · 🟡 Si da tiempo: animación | La animación es para el vídeo |
| O11 | Servir a **planificadores y a público y profesores** | 🟢 MVP: modo Planner con ⓘ en cada cifra · 🟡 Si da tiempo: modo Explore | |
| O12 | Formato libre (web, móvil, visualización, juego…) | 🟢 MVP: **web móvil primero, usable entera en el móvil** · 🟡 Si da tiempo (la primera): PWA instalable y sin conexión · ⚪ Fuera: app nativa, juego | |

## Lo que sugiere (consideraciones técnicas)

| # | Sugerencia | Decisión | Cómo / por qué |
|---|---|---|---|
| C1 | Efemérides con **Horizons** o precalculadas | 🟢 MVP | SPICE precalculado, validado con Horizons ([`PLAN.md`](PLAN.md)) |
| C2 | Relieve de **LOLA** para el horizonte | 🟢 MVP | 5 m cerca + regional lejos ([`DATOS.md`](DATOS.md)) |
| C3 | Sin atmósfera: **sin refracción** | 🟢 MVP | No aplicar refracción y decirlo |
| C4 | **Elevación solar** destacada | 🟢 MVP | |
| C5 | Comparar escenarios **rápido** | 🟢 MVP | Todo en el navegador; el cronómetro lo demuestra |
| C6 | Dejar claro el **tiempo hasta la puesta** | 🟢 MVP | Cuenta atrás en tarjeta y panorama |
| C7 | Hacer evidentes las **condiciones extremas** | 🟢 MVP: panorama · 🟡 Si da tiempo: 3D y modo Explore | |
| C8 | Explicar **por qué un pequeño cambio** de sitio o fecha cambia tanto | 🟢 MVP: deltas del retraso y texto de plantilla · 🟡 Si da tiempo: «Why?» con IA | |
| C9 | Tener en cuenta el **relieve real** | 🟢 MVP | Es lo que nos diferencia |
| C10 | **Libración** de la Tierra y variaciones orbitales | 🟢 MVP | SPICE con la orientación real de la Luna lo incluye |
| C11 | **Pendientes fuertes y cráteres** con sombra extrema | 🟢 MVP: el horizonte · 🟡 Si da tiempo: capa de sombra permanente (PGDA) en el mapa | La capa es un fichero ya hecho |
| C12 | Apoyar la **coordinación entre ciencia e ingeniería** | 🟡 Si da tiempo: escenario en la URL · ⚪ Fuera: exportar CSV, cuentas | |
| C13 | Responder a **cambios de calendario** | 🟢 MVP | El deslizador de retraso |
| C14 | **Herramienta educativa** | 🟡 Si da tiempo: modo Explore y animación | |

## Lo que añadimos nosotros

| Qué | Decisión | Por qué |
|---|---|---|
| **Noche más larga y batería** | 🟢 MVP | Es la cifra que decide si una misión sobrevive. Cálculo trivial |
| **Validación visible** (tabla y sello) | 🟢 MVP: tabla · 🟡 Si da tiempo: sello en la interfaz | La tabla es la diapositiva de Validez |
| **Semáforo** con umbrales editables | 🟢 MVP | Convierte cifras en decisión |
| **Altura sobre el suelo** (paneles en un mástil de 1, 5 o 10 m) | 🟡 Si da tiempo | Muy relevante para ingeniería: el estudio de PGDA 78 muestra que cambia mucho la iluminación. Cuesta recalcular el horizonte por altura |
| «Why?» con IA | 🟡 Si da tiempo | Siempre con plantilla de reserva |
| Botón «Check against Horizons» en directo | ⚪ Fuera del fin de semana | Solo si sobra tiempo; la validación ya está hecha |

## Lo que se queda fuera, a propósito

- **Coordenadas propias con relieve real:** servidor y descargas grandes.
- **Ciclo completo de 18,6 años:** con 2026–2028 basta para planificar misiones;
  lo largo ya lo da el mapa de la NASA.
- **Planificación de recorridos de un rover.**
- **Satélites de retransmisión** (comunicación por relé): solo comunicación
  directa con la Tierra, como pide el enunciado.
- **Estaciones concretas de la Red de Espacio Profundo:** contamos «Tierra
  visible», como el mapa de la NASA (el mismo criterio que usan ellos).
- **Térmico** (temperaturas): fuera del reto.
- **App móvil nativa y juego.**

## Lo que hay que definir antes de las tecnologías

1. **Este alcance**, cerrado entre los cuatro.
2. **La lista de sitios** con coordenadas (Juan y Luna, [`REPARTO.md`](REPARTO.md)).
3. **El rango de fechas** y el paso de tiempo: propuesta 2026–2028 cada 10 min.
4. **El modelo de ingeniería** y los umbrales del semáforo (Luna).
5. **El contrato de datos:** la forma exacta de los JSON que genera Python y lee
   la web. **Es lo más urgente**: con él, Angela trabaja desde las 10:30 con
   datos de prueba mientras se calculan los reales, sin esperar a nadie.
6. **Quién lleva la demo y la página del proyecto.**
