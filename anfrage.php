<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

function reply(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, ['success' => false, 'message' => 'Methode nicht erlaubt.']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['customer'], $input['items']) || !is_array($input['customer']) || !is_array($input['items'])) {
    reply(400, ['success' => false, 'message' => 'Ungültige Anfrage.']);
}

$customer = $input['customer'];
$required = ['first_name', 'last_name', 'company', 'street', 'zip', 'city', 'phone', 'email'];
foreach ($required as $field) {
    if (empty(trim((string)($customer[$field] ?? '')))) {
        reply(422, ['success' => false, 'message' => 'Bitte füllen Sie alle Pflichtfelder aus.']);
    }
}
if (empty(trim((string)($customer['salutation'] ?? ''))) && empty(trim((string)($customer['salutation_other'] ?? '')))) {
    reply(422, ['success' => false, 'message' => 'Bitte geben Sie eine Anrede an.']);
}
if (!preg_match('/^\d{5}$/', (string)$customer['zip'])) {
    reply(422, ['success' => false, 'message' => 'Die Postleitzahl muss genau fünf Ziffern haben.']);
}
if (!preg_match('/^\d+$/', (string)$customer['phone'])) {
    reply(422, ['success' => false, 'message' => 'Die Telefonnummer darf nur Ziffern enthalten.']);
}
if (!filter_var($customer['email'], FILTER_VALIDATE_EMAIL)) {
    reply(422, ['success' => false, 'message' => 'Ungültige E-Mail-Adresse.']);
}
if (!$input['items']) {
    reply(422, ['success' => false, 'message' => 'Die Merkliste ist leer.']);
}

function clean($value): string {
    return trim(strip_tags((string)$value));
}
function html($value): string {
    return htmlspecialchars(clean($value), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$productRows = '';
foreach ($input['items'] as $item) {
    $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 999]]);
    $name = clean($item['name'] ?? '');
    if (!$name || $quantity === false) {
        reply(422, ['success' => false, 'message' => 'Ungültiges Produkt oder ungültige Menge.']);
    }
    $configuration = is_array($item['options'] ?? null) ? array_filter(array_map('clean', $item['options'])) : [];
    $productName = html($name);
    if ($configuration) {
        $productName .= '<br><small style="color:#555;">Konfiguration: ' . htmlspecialchars(implode(', ', $configuration), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</small>';
    }
    $productRows .= '<tr><td style="padding:14px;border:1px solid #ddd;">' . $productName . '</td><td style="padding:14px;border:1px solid #ddd;">' . $quantity . '</td></tr>';
}

$salutation = clean($customer['salutation'] ?? $customer['salutation_other'] ?? '');
if (!$salutation && !empty($customer['salutation_other'])) {
    $salutation = clean($customer['salutation_other']);
}
$notes = nl2br(html($customer['notes'] ?? '–'));
$title = clean($customer['title'] ?? '');
$fullName = trim($salutation . ' ' . $title . ' ' . clean($customer['first_name']) . ' ' . clean($customer['last_name']));

$body = '<!doctype html><html><body style="margin:0;background:#f7f7f7;font-family:Arial,sans-serif;color:#333;">'
    . '<div style="max-width:700px;margin:0 auto;background:#fff;">'
    . '<div style="background:#20396f;color:#fff;padding:38px 45px;font-size:28px;font-weight:bold;">Neue Merkliste-Anfrage</div>'
    . '<div style="padding:42px 45px;font-size:16px;line-height:1.55;">'
    . '<p>Es wurde eine neue Anfrage über die Merkliste gesendet.</p>'
    . '<h2 style="color:#20396f;">Produkte</h2>'
    . '<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:14px;border:1px solid #ddd;">Produkt</th><th style="text-align:left;padding:14px;border:1px solid #ddd;">Menge</th></tr></thead><tbody>' . $productRows . '</tbody></table>'
    . '<h2 style="color:#20396f;margin-top:30px;">Kontaktdaten</h2>'
    . '<p><a href="mailto:' . html($customer['email']) . '">' . html($customer['email']) . '</a><br>' . html($customer['phone']) . '</p>'
    . '<p>' . html($customer['company']) . '<br>' . html($fullName) . '<br>' . html($customer['street']) . '<br>' . html($customer['zip']) . ' ' . html($customer['city']) . '</p>'
    . '<h2 style="color:#20396f;margin-top:30px;">Anmerkungen und Hinweise</h2><p>' . $notes . '</p>'
    . '</div></div></body></html>';

$recipient = 'info@bildung-einrichten.de';
$subject = 'Neue Merkliste-Anfrage';
// Replace this address with an existing mailbox on the production domain if the host requires it.
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: Website-Anfrage <noreply@bildung-im-freien.de>',
    'Reply-To: ' . clean($customer['email']),
];

if (!mail($recipient, $subject, $body, implode("\r\n", $headers))) {
    reply(500, ['success' => false, 'message' => 'E-Mail-Versand fehlgeschlagen.']);
}
reply(200, ['success' => true]);
