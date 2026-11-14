# Instrucciones para asistentes de código

- La fuente de verdad es [`docs/CONTEXTO.md`](docs/CONTEXTO.md). Cualquier dato
  nuevo del evento va ahí, con su fuente; lo no confirmado, con ⚠️.
- Separar siempre **construido / decidido / propuesto**.
- Imágenes o vídeos generados con IA llevan **marca de agua visible**; el
  código y los datos generados se declaran en el texto y en los metadatos.
  Nada generado puede usar la marca de la NASA.
- Las guías con «LOCAL LEAD(S) ONLY» en el título (`judging-and-awards.pdf`,
  `project-submission-guide.pdf`) no se suben a git ni se publican. El resto
  de PDF de `docs/organizacion/` son páginas públicas de la web y sí van.
- Todo lo que se entrega (página de equipo, pitch, vídeo, la web y su README)
  va **siempre en inglés**, sin excepción. Además, el equipo lo quiere todo
  también **en español**: la web es bilingüe (inglés por defecto, español con
  el selector o `l=es` en el enlace) y cada texto entregable tiene su versión
  en español al lado. Los documentos internos de `docs/` siguen en español.
- Space Apps exige declarar dónde y cómo se ha usado la IA («SI tools»). **Cada
  vez que hagas algo con peso, añade una línea al registro de
  [`docs/IA.md`](docs/IA.md)**: qué hizo la IA, qué hizo el equipo y qué se
  comprobó. Sigue las marcas de su tabla final (cabeceras de código, línea
  `IA:` en los commits, marca de agua en imágenes).
- Para ser elegible a premio global hay que usar **al menos un dato o recurso de
  la NASA**, y listar todos los datos, recursos y herramientas usados.
- Commits sin `Co-Authored-By:`.
