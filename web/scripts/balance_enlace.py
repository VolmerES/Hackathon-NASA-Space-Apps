"""Balance de enlace de bajada (Luna -> DSN 34 m, banda X 8,45 GHz), peor y mejor caso.
Objetivo: comprobar si, cuando la geometría lo permite, el enlace cierra. Si cierra en el peor caso,
el % de comunicación = % de contacto geométrico calculado en enlace_5sitios.py.
Parámetros de tierra: DSN 34 m BWG, ganancia 66,8 dBi (peor bocina, Imbriale/JPL, TDA PR 42) a 8,45 GHz;
Top 20,9 K en el cénit (Slobin y Richter 1989, 70 m) + 2,5 K y 0,04 dB por masa de aire (mismo documento).
Parámetros del módulo: los pone el usuario; tres terminales de referencia."""
import math
f = 8.45e9; c = 299792458; lam = c / f
def fspl(d_km): return 20 * math.log10(4 * math.pi * d_km * 1e3 / lam)
def airmass(el): return 1 / math.sin(math.radians(el))
def gt(el, G=66.8, Tz=20.9, Tper=2.5): return G - 10 * math.log10(Tz + Tper * (airmass(el) - 1))
def cn0(eirp_dbw, d_km, el): return eirp_dbw - fspl(d_km) - 0.04 * airmass(el) + gt(el) + 228.6
TERMINALES = {  # potencia RF (W), ganancia antena (dBi), pérdidas (dB)
  'Omni, 1 W': (1, 0, 2),
  'Antena fija ±11° (cubre toda la traza), 5 W': (5, 10 * math.log10(41253 / 22**2), 2),
  'Antena fija ±5° (71 % del contacto en Malapert), 5 W': (5, 10 * math.log10(41253 / 10**2), 2)}
EbN0_req, margen = 2.5, 3.0      # dB: código convolucional + Reed-Solomon (BER 1e-6) y margen de diseño
print(f'FSPL: {fspl(356400):.1f} dB (perigeo) a {fspl(406700):.1f} dB (apogeo)')
print(f'G/T DSN 34 m: {gt(10):.1f} dB/K a 10° y {gt(90):.1f} dB/K en el cénit\n')
for k, (P, G, L) in TERMINALES.items():
    eirp = 10 * math.log10(P) + G - L
    peor, mejor = cn0(eirp, 406700, 10), cn0(eirp, 356400, 90)
    rb = 10 ** ((peor - EbN0_req - margen) / 10)
    print(f'{k:55s} EIRP {eirp:5.1f} dBW · C/N0 {peor:5.1f}–{mejor:5.1f} dB-Hz · tasa con 3 dB de margen en el peor caso: {rb/1e3:,.0f} kbit/s · variación en todo el pase: {mejor-peor:.1f} dB')
