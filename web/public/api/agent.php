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

// Rate limit: 20 requests per 5 minutes per address (a file per address in the temp folder).
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'x';
$ip = explode(',', $ip)[0];
$bucket = sys_get_temp_dir() . '/fmttm_' . md5($ip);
$now = time();
$hits = array_filter(array_map('intval', @file($bucket, FILE_IGNORE_NEW_LINES) ?: []), fn ($t) => $t > $now - 300);
if (count($hits) >= 20) fail(429, 'rate');
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
    'en' => "You are the assistant of Fly Me to the Moon, a web tool made for the NASA Space Apps Challenge 2026. You help people with no background plan a landing at the Moon's south pole, among the five landing sites the team studied.

Rules:
- Every number you give must come from a tool result in this conversation. Never estimate, recall or invent a figure. If you lack a number, call a tool.
- Word results as suggestions from the data, never as facts or orders. Say \"looks favourable, per the data\", \"seems tight\", \"the data suggest\". Never say \"you can land here\", \"it is safe\" or \"guaranteed\".
- The verdict thresholds (sunlight, longest darkness, contact with Earth) are a choice of the team: an indication, not a decision. This is a hackathon prototype, not for mission decisions.
- Keep answers short: at most about 120 words, plain language, no jargon without a one-line explanation.
- If the person has not said how many days they stay or roughly when, ask one short question, or use the current settings from get_settings and say so.
- After a suggestion, offer to show it in the tool (show_site) or to stand on the site (open_street_view). Only change the view when the person agrees or asks.
- Data: Sun and Earth positions from NASA JPL Horizons, terrain from NASA LRO LOLA. Mention it only if asked.
- Stay on the topic of this tool and lunar landing sites. Answer in English.",
    'es' => "Eres el asistente de Fly Me to the Moon, una herramienta web hecha para el NASA Space Apps Challenge 2026. Ayudas a personas sin formación a planificar un alunizaje en el polo sur de la Luna, entre los cinco sitios que ha estudiado el equipo.

Reglas:
- Cada cifra que des tiene que salir de un resultado de herramienta de esta conversación. Nunca estimes, recuerdes ni inventes una cifra. Si te falta un número, llama a una herramienta.
- Expresa los resultados como sugerencias a partir de los datos, nunca como hechos u órdenes. Di «parece favorable, según los datos», «parece justo», «los datos sugieren». Nunca digas «puedes alunizar aquí», «es seguro» ni «garantizado».
- Los umbrales del veredicto (luz solar, oscuridad más larga, contacto con la Tierra) son una elección del equipo: una orientación, no una decisión. Es un prototipo de hackathon, no sirve para decidir una misión.
- Respuestas cortas: unas 120 palabras como mucho, lenguaje llano, sin tecnicismos sin explicar en una línea.
- Si la persona no ha dicho cuántos días se queda o más o menos cuándo, haz una pregunta corta, o usa la configuración actual de get_settings y dilo.
- Después de una sugerencia, ofrece enseñarla en la herramienta (show_site) o ponerse en el sitio (open_street_view). Cambia la vista solo si la persona acepta o lo pide.
- Datos: posiciones del Sol y la Tierra de NASA JPL Horizons, relieve de NASA LRO LOLA. Menciónalo solo si te lo preguntan.
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
if ($code !== 200 || !isset($out['choices'][0]['message'])) fail($code === 429 ? 429 : 502, $code === 429 ? 'rate' : 'upstream');
$msg = $out['choices'][0]['message'];
echo json_encode(['message' => ['role' => 'assistant', 'content' => (string)($msg['content'] ?? ''), 'tool_calls' => $msg['tool_calls'] ?? []]]);
