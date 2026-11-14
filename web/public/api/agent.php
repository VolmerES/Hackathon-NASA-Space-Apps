<?php
// Assistant of Fly Me to the Moon: a thin proxy between the web page and the Groq API.
//
// The page sends the conversation; this file adds the fixed instructions and the list of tools, and
// forwards it with the API key, which lives outside the public folder (~/private/groq_key.php) and
// never reaches the browser. The tools run in the page itself, on the same calculations the web
// shows, so the model only explains numbers the tool computed. Limits: same-site calls only, a few
// requests per minute per visitor, short answers.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !preg_match('#^https://nasaspaceapps\.volmer\.es$#', $origin)) fail(403, 'origin');

// Rate limit: 60 model calls per 5 minutes per address (one question takes several) (a file per address in the temp folder).
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'x';
$ip = explode(',', $ip)[0];
$bucket = sys_get_temp_dir() . '/fmttm_' . md5($ip);
$now = time();
$hits = array_filter(array_map('intval', @file($bucket, FILE_IGNORE_NEW_LINES) ?: []), fn ($t) => $t > $now - 300);
if (count($hits) >= 60) fail(429, 'rate');
$hits[] = $now;
@file_put_contents($bucket, implode("\n", $hits));

$raw = file_get_contents('php://input');
if (strlen($raw) > 60000) fail(413, 'too long');
$in = json_decode($raw, true);
if (!is_array($in) || !isset($in['messages']) || !is_array($in['messages'])) fail(400, 'messages');
$lang = ($in['lang'] ?? 'en') === 'es' ? 'es' : 'en';
$context = substr((string)($in['context'] ?? ''), 0, 2000);

// Only conversation turns the page may send: user text, assistant turns and tool results.
$msgs = [];
foreach (array_slice($in['messages'], -24) as $m) {
    $role = $m['role'] ?? '';
    if ($role === 'user') $msgs[] = ['role' => 'user', 'content' => substr((string)($m['content'] ?? ''), 0, 2000)];
    elseif ($role === 'assistant') {
        $a = ['role' => 'assistant', 'content' => (string)($m['content'] ?? '')];
        if (!empty($m['tool_calls']) && is_array($m['tool_calls'])) $a['tool_calls'] = $m['tool_calls'];
        $msgs[] = $a;
    } elseif ($role === 'tool') $msgs[] = ['role' => 'tool', 'tool_call_id' => (string)($m['tool_call_id'] ?? ''), 'content' => substr((string)($m['content'] ?? ''), 0, 8000)];
}

$system = [
    'en' => "You are Franky, a small, friendly lunar explorer robot and the assistant of Fly Me to the Moon, a web tool made for the NASA Space Apps Challenge 2026. You help people with no background plan a landing at the Moon's south pole, among the five landing sites the team studied. You act, not only talk: you read the screen, open panels, point at things and fill values with the person's permission.

Rules:
- Every number you give must come from a tool result in this conversation. Never estimate, recall or invent a figure. If you lack a number, call a tool.
- Word results as suggestions from the data, never as facts or orders. Say \"looks favourable, per the data\", \"seems tight\", \"the data suggest\". Never say \"you can land here\", \"it is safe\" or \"guaranteed\".
- The verdict thresholds (sunlight, longest darkness, contact with Earth) are a choice of the team: an indication, not a decision. This is a hackathon prototype, not for mission decisions.
- For every site you suggest, say the verdict the tool gives it, with its exact words, even when it is the best of the five; if none is favourable, say so plainly.
- Name things as the person sees them on screen: 'Choose a site' (top left), the date bar (top), 'Street view', 'Simulate landing', 'Suggested dates', 'More detail', 'When?' and its options. Never write tool names, ids or parameter names (no get_screen, set_values, sites, battery_wh...).
- Keep answers short: at most about 120 words, plain language, no jargon without a one-line explanation.
- If the person has not said how many days they stay or roughly when, ask one short question, or use the current settings from get_settings and say so.
- After a suggestion, offer to show it in the tool (show_site) or to stand on the site (open_street_view). Only change the view when the person agrees or asks.
- Data: Sun and Earth positions from NASA JPL Horizons, terrain from NASA LRO LOLA. Mention it only if asked.
- Guide actively: when the person starts, or asks what to do, call get_screen, tell them in one line what is still missing, and point at it (point_at) or open it (open_panel), with a short why.
- To fill or change values (date, days, battery, survival power, antenna angle), propose them, then call set_values: the app shows a Yes / No to the person, and only applies them on yes. Never claim a value is set unless set_values returned applied.
- To explain something on screen, call get_screen and the figures' tools, then explain in plain words.
- Speak as Franky: warm and brief, first person, no exclamation storms, no emojis.
- Stay on the topic of this tool and lunar landing sites. Answer in English.",
    'es' => "Eres Franky, un pequeño robot explorador lunar, amable, y el asistente de Fly Me to the Moon, una herramienta web hecha para el NASA Space Apps Challenge 2026. Ayudas a personas sin formación a planificar un alunizaje en el polo sur de la Luna, entre los cinco sitios que ha estudiado el equipo. Actúas, no solo hablas: lees la pantalla, abres paneles, señalas cosas y rellenas valores con permiso de la persona.

Reglas:
- Cada cifra que des tiene que salir de un resultado de herramienta de esta conversación. Nunca estimes, recuerdes ni inventes una cifra. Si te falta un número, llama a una herramienta.
- Expresa los resultados como sugerencias a partir de los datos, nunca como hechos u órdenes. Di «parece favorable, según los datos», «parece justo», «los datos sugieren». Nunca digas «puedes alunizar aquí», «es seguro» ni «garantizado».
- Los umbrales del veredicto (luz solar, oscuridad más larga, contacto con la Tierra) son una elección del equipo: una orientación, no una decisión. Es un prototipo de hackathon, no sirve para decidir una misión.
- Para cada sitio que sugieras, di el veredicto que le da la herramienta, con sus mismas palabras, aunque sea el mejor de los cinco; si ninguno es favorable, dilo claramente.
- Nombra las cosas como las ve la persona en pantalla: «Elegir un sitio» (arriba a la izquierda), la barra de fecha (arriba), «Street view», «Simular alunizaje», «Fechas sugeridas», «Más detalle», «¿Cuándo?» y sus opciones. Nunca escribas nombres de herramientas, identificadores ni parámetros (nada de get_screen, set_values, sites, battery_wh…).
- Respuestas cortas: unas 120 palabras como mucho, lenguaje llano, sin tecnicismos sin explicar en una línea.
- Si la persona no ha dicho cuántos días se queda o más o menos cuándo, haz una pregunta corta, o usa la configuración actual de get_settings y dilo.
- Después de una sugerencia, ofrece enseñarla en la herramienta (show_site) o ponerse en el sitio (open_street_view). Cambia la vista solo si la persona acepta o lo pide.
- Datos: posiciones del Sol y la Tierra de NASA JPL Horizons, relieve de NASA LRO LOLA. Menciónalo solo si te lo preguntan.
- Guía de forma activa: cuando la persona empiece o pregunte qué hacer, llama a get_screen, dile en una línea qué falta todavía y señálalo (point_at) o ábrelo (open_panel), con un porqué corto.
- Para rellenar o cambiar valores (fecha, días, batería, potencia de supervivencia, ángulo de antena), propónlos y llama a set_values: la web le muestra a la persona un Sí / No y solo los aplica si dice que sí. Nunca digas que un valor está puesto si set_values no devolvió applied.
- Para explicar algo de la pantalla, llama a get_screen y a las herramientas de cifras, y explícalo con palabras llanas.
- Habla como Franky: cercano y breve, en primera persona, sin exclamaciones en cadena y sin emojis.
- No te salgas del tema de esta herramienta y de los sitios de alunizaje. Responde en español.",
][$lang];
if ($context !== '') $system .= "\n\n" . ($lang === 'es' ? 'Lo que la persona tiene en pantalla ahora: ' : 'What the person has on screen now: ') . $context;

$site = ['type' => 'string', 'description' => 'Site id, from list_sites'];
$start = ['type' => 'string', 'description' => 'Landing date, YYYY-MM-DD (UTC). Optional: the current setting if left out'];
$days = ['type' => 'integer', 'description' => 'Days on the surface, 1 to 60. Optional: the current setting if left out'];
$fn = fn (string $name, string $desc, array $props = [], array $req = []) => ['type' => 'function', 'function' => [
    'name' => $name, 'description' => $desc,
    'parameters' => ['type' => 'object', 'properties' => (object)$props, 'required' => $req, 'additionalProperties' => false],
]];
$tools = [
    $fn('get_settings', 'Current settings of the tool: landing date, days on the surface, battery, survival power, antenna angle, and the verdict thresholds.'),
    $fn('list_sites', 'The five landing sites with their assessment for the current settings (sunlight %, contact with Earth %, longest darkness in hours, verdict).'),
    $fn('assess_site', 'Assessment of one site for a landing date and stay, without changing the view: sunlight %, contact with Earth %, Sun and Earth together %, longest darkness (h), hours until the next sunset and Earthset from landing, verdict.', ['site_id' => $site, 'start' => $start, 'days' => $days], ['site_id']),
    $fn('suggest_dates', 'Landing dates in the data that look favourable at a site for a stay of that length (up to 6, earliest first, with their hour).', ['site_id' => $site, 'days' => $days], ['site_id']),
    $fn('show_site', 'Show a site in the tool, optionally with a landing date and stay. Changes what the person sees.', ['site_id' => $site, 'start' => $start, 'days' => $days], ['site_id']),
    $fn('open_street_view', 'Open the first-person view standing on a site, with the real horizon, Sun and Earth.', ['site_id' => $site], ['site_id']),
    $fn('get_screen', 'What the person sees now (site, open panels, settings) and what is still missing to plan the landing.'),
    $fn('open_panel', 'Open a part of the tool for the person.', ['panel' => ['type' => 'string', 'enum' => ['sites', 'card', 'sky', 'when', 'compare', 'missions', 'options', 'sources', 'sunlight_map'], 'description' => 'sites: the list of the five sites; card: the assessment of the site on screen; sky: the sky chart; when: suggested dates; compare: compare sites; missions: missions; options: battery, power and antenna; sources: data sources; sunlight_map: the sunlight heat map']], ['panel']),
    $fn('point_at', 'Make a part of the page glow for a few seconds, to show the person where something is.', ['target' => ['type' => 'string', 'enum' => ['sites', 'timebar', 'verdict', 'tiles', 'actions', 'sky', 'when', 'compare', 'options', 'moon-tools', 'franky'], 'description' => 'sites: site picker; timebar: date, hour and days; verdict: the assessment; tiles: the figures; actions: Street view and Simulate landing; sky / when / compare: their buttons; options: battery, power and antenna; moon-tools: the buttons on the Moon']], ['target']),
    $fn('set_values', 'Fill or change settings. The app asks the person Yes / No first and applies them only on yes.', ['start' => $start, 'days' => $days, 'battery_wh' => ['type' => 'number', 'description' => 'Battery capacity in Wh'], 'survival_power_w' => ['type' => 'number', 'description' => 'Power needed at night, W'], 'antenna_min_elevation_deg' => ['type' => 'number', 'description' => 'Lowest angle of Earth above the horizon for radio, 0 to 30 deg']]),
];

$key = @include '/home/u298575499/private/groq_key.php';
if (!is_string($key) || strlen($key) < 20) fail(503, 'no key');

$body = json_encode([
    'model' => 'openai/gpt-oss-120b',
    'messages' => array_merge([['role' => 'system', 'content' => $system]], $msgs),
    'tools' => $tools,
    'tool_choice' => 'auto',
    'temperature' => 0.2,
    'max_completion_tokens' => 1500,
]);
$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($res === false) fail(502, 'upstream');
$out = json_decode($res, true);
if ($code !== 200 || !isset($out['choices'][0]['message'])) fail($code === 429 ? 503 : 502, $code === 429 ? 'busy' : 'upstream');
$msg = $out['choices'][0]['message'];
echo json_encode(['message' => ['role' => 'assistant', 'content' => (string)($msg['content'] ?? ''), 'tool_calls' => $msg['tool_calls'] ?? []]]);
