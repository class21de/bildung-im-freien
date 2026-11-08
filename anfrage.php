<?php
declare(strict_types=1);

// Fehler gehören ins Server-Log, nicht in die Antwort an den Browser.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json; charset=UTF-8');

const MAX_BODY_BYTES = 102400;
const MAX_ITEMS = 50;
const MAX_OPTIONS = 30;
const MAX_FIELD_LENGTH = 200;
const MAX_NOTES_LENGTH = 5000;
const MIN_FILL_MILLISECONDS = 3000;
const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_SECONDS = 3600;

function reply(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $status, string $message): void {
    reply($status, ['success' => false, 'message' => $message]);
}

function text_length(string $value): int {
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

// Nur einfache Adressen: Steuerzeichen, Anführungszeichen und Backslashes könnten Mail-Header verändern.
function header_safe_email(string $email): ?string {
    if (strlen($email) > 254 || preg_match('/[\x00-\x1F\x7F"\\\\]/', $email)) {
        return null;
    }
    $valid = filter_var($email, FILTER_VALIDATE_EMAIL);
    return $valid === false ? null : $valid;
}

// Zählt Anfragen je IP. Gespeichert wird nur ein Hash der IP, nach einer Stunde zählt ein Eintrag nicht mehr.
function rate_limited(string $ip): bool {
    $handle = @fopen(sys_get_temp_dir() . '/bif-anfrage-' . hash('sha256', 'bildung-im-freien|' . $ip), 'c+');
    if ($handle === false) {
        return false;
    }
    flock($handle, LOCK_EX);
    $oldest = time() - RATE_LIMIT_SECONDS;
    $hits = [];
    foreach (explode(',', (string)stream_get_contents($handle)) as $time) {
        if ((int)$time > $oldest) {
            $hits[] = (int)$time;
        }
    }
    $limited = count($hits) >= RATE_LIMIT_REQUESTS;
    if (!$limited) {
        $hits[] = time();
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, implode(',', $hits));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $limited;
}

function clean(string $value): string {
    return trim(strip_tags($value));
}

function html(string $value): string {
    return htmlspecialchars(clean($value), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'Methode nicht erlaubt.');
}
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
    fail(415, 'Ungültiges Format.');
}

// Anfragen von fremden Webseiten ablehnen.
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $serverHost = explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0];
    if (!is_string($originHost) || strcasecmp($originHost, $serverHost) !== 0) {
        fail(403, 'Nicht erlaubt.');
    }
}

$rawInput = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($rawInput === false || strlen($rawInput) > MAX_BODY_BYTES) {
    fail(413, 'Die Anfrage ist zu groß.');
}

$input = json_decode($rawInput, true);
if (!is_array($input) || !isset($input['customer'], $input['items']) || !is_array($input['customer']) || !is_array($input['items'])) {
    fail(400, 'Ungültige Anfrage.');
}

$textFields = ['salutation', 'salutation_other', 'title', 'first_name', 'last_name', 'company', 'street', 'zip', 'city', 'phone', 'email', 'notes', 'website'];
$customer = [];
foreach ($textFields as $field) {
    $value = $input['customer'][$field] ?? '';
    if (!is_string($value)) {
        fail(400, 'Ungültige Anfrage.');
    }
    $value = trim($value);
    if (text_length($value) > ($field === 'notes' ? MAX_NOTES_LENGTH : MAX_FIELD_LENGTH)) {
        fail(422, 'Eine Eingabe ist zu lang.');
    }
    $customer[$field] = $value;
}

// Dieses Feld ist für Menschen unsichtbar. Ist es gefüllt, war es ein Bot: Erfolg melden, aber nichts senden.
if ($customer['website'] !== '') {
    reply(200, ['success' => true]);
}

$elapsed = $input['elapsed_ms'] ?? null;
if (!is_int($elapsed) || $elapsed < MIN_FILL_MILLISECONDS) {
    fail(422, 'Bitte prüfen Sie Ihre Angaben und senden Sie die Anfrage in wenigen Sekunden erneut.');
}

foreach (['first_name', 'last_name', 'company', 'street', 'zip', 'city', 'phone', 'email'] as $field) {
    if ($customer[$field] === '') {
        fail(422, 'Bitte füllen Sie alle Pflichtfelder aus.');
    }
}
if ($customer['salutation'] === '' && $customer['salutation_other'] === '') {
    fail(422, 'Bitte geben Sie eine Anrede an.');
}
if (!preg_match('/^\d{5}\z/', $customer['zip'])) {
    fail(422, 'Die Postleitzahl muss genau fünf Ziffern haben.');
}
if (!preg_match('/^\d+\z/', $customer['phone'])) {
    fail(422, 'Die Telefonnummer darf nur Ziffern enthalten.');
}
$replyTo = header_safe_email($customer['email']);
if ($replyTo === null) {
    fail(422, 'Ungültige E-Mail-Adresse.');
}
if (count($input['items']) > MAX_ITEMS) {
    fail(422, 'Bitte wählen Sie höchstens ' . MAX_ITEMS . ' Produkte aus.');
}
// Ohne ausgewählte Produkte muss das Anliegen beschrieben sein (gleiche Regel in merkliste.js).
if (!$input['items'] && $customer['notes'] === '') {
    fail(422, 'Bitte beschreiben Sie Ihr Anliegen.');
}

$productRows = '';
foreach ($input['items'] as $item) {
    if (!is_array($item) || !is_string($item['name'] ?? null) || text_length($item['name']) > MAX_FIELD_LENGTH) {
        fail(422, 'Ungültiges Produkt oder ungültige Menge.');
    }
    $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 999]]);
    $name = clean($item['name']);
    if ($name === '' || $quantity === false) {
        fail(422, 'Ungültiges Produkt oder ungültige Menge.');
    }
    $configuration = [];
    foreach (array_slice(is_array($item['options'] ?? null) ? $item['options'] : [], 0, MAX_OPTIONS) as $option) {
        if (is_string($option) && text_length($option) <= MAX_FIELD_LENGTH && clean($option) !== '') {
            $configuration[] = clean($option);
        }
    }
    $productName = html($name);
    if ($configuration) {
        $productName .= '<br><small style="color:#555;">Konfiguration: ' . htmlspecialchars(implode(', ', $configuration), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</small>';
    }
    $productRows .= '<tr><td style="padding:14px;border:1px solid #ddd;">' . $productName . '</td><td style="padding:14px;border:1px solid #ddd;">' . $quantity . '</td></tr>';
}

if (rate_limited((string)($_SERVER['REMOTE_ADDR'] ?? ''))) {
    fail(429, 'Es wurden zu viele Anfragen gesendet. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns telefonisch.');
}

$salutation = clean($customer['salutation'] !== '' ? $customer['salutation'] : $customer['salutation_other']);
$notes = nl2br(html($customer['notes'] !== '' ? $customer['notes'] : '–'));
$fullName = trim($salutation . ' ' . clean($customer['title']) . ' ' . clean($customer['first_name']) . ' ' . clean($customer['last_name']));

$body = '<!doctype html><html><body style="margin:0;background:#f7f7f7;font-family:Arial,sans-serif;color:#333;">'
    . '<div style="max-width:700px;margin:0 auto;background:#fff;">'
    . '<div style="background:#20396f;color:#fff;padding:38px 45px;font-size:28px;font-weight:bold;">Neue Projektanfrage</div>'
    . '<div style="padding:42px 45px;font-size:16px;line-height:1.55;">'
    . '<p>Es wurde eine neue Projektanfrage über die Website gesendet.</p>'
    . '<h2 style="color:#20396f;">Produkte</h2>'
    . ($productRows === '' ? '<p>Es wurden keine Produkte ausgewählt.</p>' : '<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:14px;border:1px solid #ddd;">Produkt</th><th style="text-align:left;padding:14px;border:1px solid #ddd;">Menge</th></tr></thead><tbody>' . $productRows . '</tbody></table>')
    . '<h2 style="color:#20396f;margin-top:30px;">Kontaktdaten</h2>'
    . '<p><a href="mailto:' . html($replyTo) . '">' . html($replyTo) . '</a><br>' . html($customer['phone']) . '</p>'
    . '<p>' . html($customer['company']) . '<br>' . html($fullName) . '<br>' . html($customer['street']) . '<br>' . html($customer['zip']) . ' ' . html($customer['city']) . '</p>'
    . '<h2 style="color:#20396f;margin-top:30px;">Anmerkungen und Hinweise</h2><p>' . $notes . '</p>'
    . '</div></div></body></html>';

$recipient = 'info@bildung-einrichten.de';
$subject = 'Neue Projektanfrage';
// Replace this address with an existing mailbox on the production domain if the host requires it.
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: Website-Anfrage <noreply@bildung-im-freien.de>',
    'Reply-To: ' . $replyTo,
];

if (!mail($recipient, $subject, $body, implode("\r\n", $headers))) {
    fail(500, 'E-Mail-Versand fehlgeschlagen.');
}
reply(200, ['success' => true]);
