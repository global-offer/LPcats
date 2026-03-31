<?php
/**
 * LPcats - LPビューアー（フルページHTML）
 * GET ?id=xxx → LP表示用HTMLページを返す
 * embed.phpのJSを<script>タグで読み込むラッパー
 */

require_once __DIR__ . '/config.php';
migrateIfNeeded();

$id = isset($_GET['id']) ? $_GET['id'] : '';

if (!$id || !validateId($id)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body><p>Invalid LP ID</p></body></html>';
    exit;
}

$lp = loadLP($id);
if (!$lp) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><body><p>LP not found</p></body></html>';
    exit;
}

$title = htmlspecialchars($lp['title'] ?? 'LP', ENT_QUOTES, 'UTF-8');
$embedUrl = 'embed.php?id=' . urlencode($id);

header('Content-Type: text/html; charset=utf-8');
echo <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$title} - LPcats</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0F0F0F;overflow:hidden}</style>
</head>
<body>
<script src="{$embedUrl}"></script>
</body>
</html>
HTML;
