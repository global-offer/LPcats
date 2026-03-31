<?php
/**
 * LPcats - データ読み取りAPI（認証不要・公開）
 * GET ?action=list    → 全LP一覧 + フォルダ一覧
 * GET ?action=get&id= → 個別LP
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

migrateIfNeeded();

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'list':
        $meta = loadMeta();
        $projects = listAllLPs();
        echo json_encode([
            'projects' => $projects,
            'folders' => $meta['folders'] ?? [],
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'get':
        $id = isset($_GET['id']) ? $_GET['id'] : '';
        if (!$id || !validateId($id)) {
            http_response_code(400);
            echo json_encode(['error' => 'IDが不正です']);
            break;
        }
        $lp = loadLP($id);
        if (!$lp) {
            http_response_code(404);
            echo json_encode(['error' => 'LPが見つかりません']);
            break;
        }
        echo json_encode($lp, JSON_UNESCAPED_UNICODE);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'action パラメータが必要です (list / get)']);
        break;
}
