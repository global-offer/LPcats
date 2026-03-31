<?php
/**
 * LPcats - データ書き込みAPI（認証必須）
 * POST: LP保存・削除、フォルダCRUD
 * 分割ファイルストレージ + バージョン管理
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

requireAuth();
migrateIfNeeded();

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input || !isset($input['id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'リクエストボディにidが必要です']);
    exit;
}

$id = $input['id'];
$type = $input['_type'] ?? 'project';

// === フォルダ操作 ===
if ($type === 'folder') {
    if (!validateId($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'IDが不正です']);
        exit;
    }

    $meta = loadMeta();

    if (isset($input['_delete']) && $input['_delete']) {
        $meta['folders'] = array_values(array_filter($meta['folders'], function($f) use ($id) {
            return $f['id'] !== $id;
        }));
        // 中のLPをルートに移動
        if (is_dir(PROJECTS_DIR)) {
            foreach (glob(PROJECTS_DIR . '*.json') as $file) {
                $lp = json_decode(file_get_contents($file), true);
                if ($lp && isset($lp['folderId']) && $lp['folderId'] === $id) {
                    unset($lp['folderId']);
                    saveLP($lp['id'], $lp);
                }
            }
        }
        $result = ['success' => true, 'action' => 'folder_deleted'];
    } else {
        $found = false;
        foreach ($meta['folders'] as &$f) {
            if ($f['id'] === $id) {
                $f['name'] = $input['name'] ?? $f['name'];
                if (isset($input['parentId'])) $f['parentId'] = $input['parentId'] ?: null;
                $found = true;
                break;
            }
        }
        unset($f);
        if (!$found) {
            $folder = [
                'id' => $id,
                'name' => $input['name'] ?? '',
                'createdAt' => $input['createdAt'] ?? date('c'),
            ];
            if (isset($input['parentId']) && $input['parentId']) {
                $folder['parentId'] = $input['parentId'];
            }
            $meta['folders'][] = $folder;
        }
        $result = ['success' => true, 'action' => $found ? 'folder_updated' : 'folder_created'];
    }

    saveMeta($meta);
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

// === LP操作 ===
if (!validateId($id)) {
    http_response_code(400);
    echo json_encode(['error' => 'IDが不正です']);
    exit;
}

if (isset($input['_delete']) && $input['_delete']) {
    $lp = loadLP($id);
    if ($lp) {
        // 関連画像ファイルも削除
        if (isset($lp['cta']['image']) && $lp['cta']['image']) {
            $ctaPath = __DIR__ . '/../' . $lp['cta']['image'];
            if (file_exists($ctaPath) && strpos(realpath($ctaPath), realpath(UPLOADS_DIR)) === 0) {
                unlink($ctaPath);
            }
        }
        if (isset($lp['steps']) && is_array($lp['steps'])) {
            foreach ($lp['steps'] as $step) {
                if (isset($step['image']) && $step['image']) {
                    $imagePath = __DIR__ . '/../' . $step['image'];
                    if (file_exists($imagePath) && strpos(realpath($imagePath), realpath(UPLOADS_DIR)) === 0) {
                        unlink($imagePath);
                    }
                }
            }
        }
        deleteLP($id);
        $result = ['success' => true, 'action' => 'deleted'];
    } else {
        $result = ['success' => false, 'error' => 'LPが見つかりません'];
    }
} elseif (isset($input['_moveToFolder']) && $input['_moveToFolder']) {
    $lp = loadLP($id);
    if ($lp) {
        if ($input['folderId']) {
            $lp['folderId'] = $input['folderId'];
        } else {
            unset($lp['folderId']);
        }
        saveLP($id, $lp);
        $result = ['success' => true, 'action' => 'moved'];
    } else {
        $result = ['success' => false, 'error' => 'LPが見つかりません'];
    }
} else {
    // 保存（新規作成・更新）
    if (!isset($input['direction']) || !in_array($input['direction'], ['vertical', 'horizontal', 'fullscreen'])) {
        $input['direction'] = 'vertical';
    }

    $existing = loadLP($id);

    // バージョン管理: クライアントが送ったversionと既存のversionを比較
    if ($existing && isset($input['version'])) {
        $existingVersion = $existing['version'] ?? 1;
        $clientVersion = intval($input['version']);
        if ($clientVersion > 0 && $clientVersion < $existingVersion) {
            http_response_code(409);
            echo json_encode([
                'error' => '他の編集と競合しました。ページをリロードしてください。',
                'currentVersion' => $existingVersion
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $newVersion = ($existing['version'] ?? 1) + ($existing ? 1 : 0);

    $lpData = [
        'id' => $id,
        'title' => $input['title'] ?? '無題のLP',
        'direction' => $input['direction'],
        'cta' => $input['cta'] ?? ['text' => '今すぐ申し込む', 'url' => 'https://example.com', 'bgColor' => '#FF6B35', 'textColor' => '#FFFFFF'],
        'steps' => $input['steps'] ?? [],
        'version' => $newVersion,
        'createdAt' => $input['createdAt'] ?? ($existing['createdAt'] ?? date('c')),
        'updatedAt' => date('c')
    ];

    if (isset($input['folderId'])) {
        $lpData['folderId'] = $input['folderId'];
    } elseif ($existing && isset($existing['folderId'])) {
        $lpData['folderId'] = $existing['folderId'];
    }

    saveLP($id, $lpData);
    $result = ['success' => true, 'action' => 'saved', 'lp' => $lpData];
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);
