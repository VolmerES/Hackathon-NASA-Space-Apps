# Comunicación con la Tierra: de «Tierra a la vista» a «contacto con la DSN»

> En la app (15‑nov): el veredicto y las cifras de Tierra siguen contando la Tierra a la vista; el contacto con la DSN se muestra aparte (barra, informe, porcentaje por antena y vista «Mirar a la Tierra»).

Luna, 15 nov 2026. Cálculos sobre los 5 sitios del equipo, del 1 dic 2026 al 1 ene 2028 (9.505 h).

**Resultado:** con las tres estaciones de la Red de Espacio Profundo de NASA (DSN), el contacto posible coincide
con la visibilidad de la Tierra en el 98–100 % de las horas, y un balance de enlace de peor caso cierra con margen.
Lo que limita la comunicación es el relieve lunar, no la red ni la distancia.

## 1. Qué se calcula

Hay contacto posible en una hora si se cumplen dos condiciones:

1. **La Tierra se ve desde el sitio:** su centro está por encima del horizonte del terreno (más el ángulo de
   antena que ponga el usuario). Es lo que la app ya calculaba.
2. **La Luna se ve desde alguna estación:** está a 10° o más sobre el horizonte de Madrid (Robledo de Chavela,
   DSS-63), Goldstone (California, DSS-14) o Canberra (Australia, DSS-43). Elevación de la Luna de JPL Horizons.

Las estaciones están separadas en longitud 113° (Madrid–Goldstone), 94° (Goldstone–Canberra) y 153° (Canberra–Madrid).

## 2. Resultados por sitio (todo el periodo)

| Sitio | Tierra a la vista | Contacto DSN | Contacto / horas con Tierra | Hueco más largo sin contacto | Hueco más largo por falta de estación |
|---|---|---|---|---|---|
| Mons Mouton 07 | 80,0 % | 78,7 % | 98,4 % | 142 h | 2 h |
| Malapert Massif K2023 | 62,1 % | 61,6 % | 99,1 % | 252 h | 1 h |
| Nobile Rim 1 02 | 58,8 % | 58,4 % | 99,3 % | 274 h | 1 h |
| de Gerlache Rim 2 05 | 43,3 % | 43,1 % | 99,5 % | 369 h | 1 h |
| Haworth 09 | 3,3 % | 3,3 % | 100 % | 3.210 h | 0 h |

- Madrid sola cubre entre el 40 % y el 47 % de las horas con Tierra; por eso «Madrid station» subestima la comunicación.
- Todos los huecos de más de 24 h son la Tierra oculta tras el relieve (uno al mes, por la libración).
- Haworth 09 no admite comunicación directa: necesitaría un satélite de relé.
- La Tierra se mueve unos ±8° en acimut y 13° en elevación por la libración: una antena fija de ±11° la cubre sin apuntamiento.

## 3. Balance de enlace de peor caso (`scripts/balance_enlace.py`)

Bajada Luna → antena DSN de 34 m, banda X (8,45 GHz).

C/N0 = PIRE − pérdida en espacio libre − atmósfera + G/T + 228,6 dB

| Término | Valor de peor caso | Fuente |
|---|---|---|
| Distancia | 406.700 km (apogeo) → 223,2 dB | Geometría; pérdida = 20·log10(4πd/λ) |
| Ganancia de la antena de 34 m | 66,8 dBi (la más baja del estudio; hasta 69,2) | JPL TDA Progress Report, antena BWG de 34 m a 8,45 GHz |
| Temperatura de ruido | 20,9 K en el cénit + 2,5 K por masa de aire | Slobin y Richter, TDA PR 42-97 (1989), DSS-63 |
| Atmósfera | 0,04 dB por masa de aire; a 10° son 5,8 masas | Mismo documento |
| G/T resultante | 51,6 dB/K a 10° (53,6 en el cénit) | Cuenta |
| Eb/N0 necesaria + margen | 2,5 dB + 3 dB | Código convolucional + Reed-Solomon; margen de diseño habitual |

| Terminal de referencia del módulo | Tasa con 3 dB de margen en el peor caso |
|---|---|
| Antena omnidireccional (0 dBi), 1 W, 2 dB de pérdidas | 86 kbit/s |
| Antena fija de ±11°, 5 W | > 30 Mbit/s (limita el ancho de banda, no la distancia) |

Entre el peor caso (apogeo, 10°) y el mejor (perigeo, cénit) la señal varía 3,3 dB: si cierra en el peor caso,
cierra en todo el pase. Por eso % de comunicación = % de contacto geométrico.

## 4. Límites

- Terminales de referencia, no un diseño. La masa, la potencia y el apuntamiento reales son del diseñador.
- La DSN es compartida: no se modela la reserva de tiempo de antena.
- Sin lluvia (despreciable en banda X) ni subida (uplink), que con 20 kW en tierra es más holgada que la bajada.
- Tierra visible = centro del disco. Frente a NASA PGDA 69 nuestra Tierra sale 1–8 puntos más baja (causa abierta).

## 5. Reproducir

- `web/scripts/fetch_dsn.py`: elevación de la Luna sobre las tres estaciones, de JPL Horizons (como `fetch_madrid.py`). En el repo va la versión con las coordenadas WGS84 exactas de las antenas que pasó el equipo (en el paquete de Luna eran aproximadas); escribe `web/public/data/dsn.json`. Con él salen exactas las dos tablas de comprobación del paquete.
- `web/scripts/dsn_spice.py`: el mismo cálculo con SPICE (de440s) y GMST, independiente. Frente a Horizons en Madrid:
  diferencia máxima 0,39°; cambia de lado del umbral de 10° en 18 de 10.249 horas.
- `web/scripts/balance_enlace.py`: el balance de enlace.
