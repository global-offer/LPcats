<?php
/**
 * LPcats - データ読み取りAPI
 * GET ?action=list    → 全LP一覧（メタデータのみ、画像データ除外）
 * GET ?action=get&id= → 個別LP（steps内の画像はファイルパス）
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$dataFile = __DIR__ . '/../data/projects.json';

// データファイルがなければ空で初期化（LOCK_EX付き）
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(new stdClass(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'list':
        handleList($dataFile);
        break;
    case 'get':
        $id = isset($_GET['id']) ? $_GET['id'] : '';
        handleGet($dataFile, $id);
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'action パラメータが必要です (list / get)']);
        break;
}

function loadData($dataFile) {
    $fp = fopen($dataFile, 'r');
    if (!$fp) {
        return [];
    }
    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $content ? json_decode($content, true) : [];
}

function handleList($dataFile) {
    $data = loadData($dataFile);

    // メタデータのみ返す（steps内の画像パスは含むがサイズは小さい）
    $list = [];
    foreach ($data as $id => $lp) {
        $stepsSummary = [];
        if (isset($lp['steps']) && is_array($lp['steps'])) {
            foreach ($lp['steps'] as $step) {
                $stepsSummary[] = [
                    'id' => $step['id'],
                    'order' => $step['order'],
                    'image' => isset($step['image']) ? $step['image'] : '',
                    'fileName' => isset($step['fileName']) ? $step['fileName'] : ''
                ];
            }
        }
        $list[] = [
            'id' => $lp['id'],
            'title' => isset($lp['title']) ? $lp['title'] : '',
            'direction' => isset($lp['direction']) ? $lp['direction'] : 'vertical',
            'cta' => isset($lp['cta']) ? $lp['cta'] : [],
            'steps' => $stepsSummary,
            'createdAt' => isset($lp['createdAt']) ? $lp['createdAt'] : '',
            'updatedAt' => isset($lp['updatedAt']) ? $lp['updatedAt'] : ''
        ];
    }

    // 更新日時の降順でソート
    usort($list, function ($a, $b) {
        return strcmp($b['updatedAt'], $a['updatedAt']);
    });

    echo json_encode($list, JSON_UNESCAPED_UNICODE);
}

function handleGet($dataFile, $id) {
    if (!$id || !validateId($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'IDが不正です']);
        return;
    }

    $data = loadData($dataFile);

    if (!isset($data[$id])) {
        http_response_code(404);
        echo json_encode(['error' => 'LPが見つかりません']);
        return;
    }

    echo json_encode($data[$id], JSON_UNESCAPED_UNICODE);
}

function validateId($id) {
    return preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $id);
}
