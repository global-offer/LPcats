<?php
/**
 * LPcats - データ書き込みAPI
 * POST: LP保存・削除（flock排他ロック付き）
 * アクション分岐: _delete フラグ
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$dataFile = __DIR__ . '/../data/projects.json';
$uploadsDir = __DIR__ . '/../data/uploads/';

// データファイルがなければ空で初期化（LOCK_EX付き）
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(new stdClass(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input || !isset($input['id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'リクエストボディにidが必要です']);
    exit;
}

$id = $input['id'];

if (!validateId($id)) {
    http_response_code(400);
    echo json_encode(['error' => 'IDが不正です']);
    exit;
}

// flock排他ロック付きで読み書き
$fp = fopen($dataFile, 'c+');
if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'データファイルを開けません']);
    exit;
}

flock($fp, LOCK_EX);

$content = stream_get_contents($fp);
$data = $content ? json_decode($content, true) : [];
if (!is_array($data)) {
    $data = [];
}

// アクション分岐
if (isset($input['_delete']) && $input['_delete']) {
    // 削除: 関連画像ファイルも削除
    if (isset($data[$id])) {
        $lp = $data[$id];
        // CTA画像を削除
        if (isset($lp['cta']['image']) && $lp['cta']['image']) {
            $ctaPath = __DIR__ . '/../' . $lp['cta']['image'];
            if (file_exists($ctaPath) && strpos(realpath($ctaPath), realpath($uploadsDir)) === 0) {
                unlink($ctaPath);
            }
        }
        // ステップ画像を削除
        if (isset($lp['steps']) && is_array($lp['steps'])) {
            foreach ($lp['steps'] as $step) {
                if (isset($step['image']) && $step['image']) {
                    $imagePath = __DIR__ . '/../' . $step['image'];
                    if (file_exists($imagePath) && strpos(realpath($imagePath), realpath($uploadsDir)) === 0) {
                        unlink($imagePath);
                    }
                }
            }
        }
        unset($data[$id]);
        $result = ['success' => true, 'action' => 'deleted'];
    } else {
        $result = ['success' => false, 'error' => 'LPが見つかりません'];
    }
} else {
    // 保存（新規作成・更新）
    if (!isset($input['direction']) || !in_array($input['direction'], ['vertical', 'horizontal', 'fullscreen'])) {
        $input['direction'] = 'vertical';
    }

    $data[$id] = [
        'id' => $id,
        'title' => isset($input['title']) ? $input['title'] : '無題のLP',
        'direction' => $input['direction'],
        'cta' => isset($input['cta']) ? $input['cta'] : [
            'text' => '今すぐ申し込む',
            'url' => 'https://example.com',
            'bgColor' => '#FF6B35',
            'textColor' => '#FFFFFF'
        ],
        'steps' => isset($input['steps']) ? $input['steps'] : [],
        'createdAt' => isset($input['createdAt']) ? $input['createdAt'] : date('c'),
        'updatedAt' => date('c')
    ];
    $result = ['success' => true, 'action' => 'saved', 'lp' => $data[$id]];
}

// 書き戻し
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode($result, JSON_UNESCAPED_UNICODE);

function validateId($id) {
    return preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $id);
}
