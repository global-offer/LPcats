<?php
/**
 * LPcats - 設定ファイル
 * デプロイ時にAPI_KEYとALLOWED_ORIGINSを環境に合わせて変更すること
 */

// APIキー（書き込み系APIの認証に使用。空文字の場合は認証スキップ）
define('API_KEY', 'lpcats_change_me_on_deploy');

// 許可するオリジン（空配列の場合は * を返す）
define('ALLOWED_ORIGINS', [
    // 'https://miraikirei-test.maeni.jp',
    // 'https://example.com',
]);

// データディレクトリ
define('DATA_DIR', __DIR__ . '/../data/');
define('PROJECTS_DIR', DATA_DIR . 'projects/');
define('UPLOADS_DIR', DATA_DIR . 'uploads/');
define('META_FILE', DATA_DIR . 'meta.json');
// レガシー（マイグレーション用）
define('LEGACY_FILE', DATA_DIR . 'projects.json');

// 画像最適化
define('IMAGE_MAX_WIDTH', 1200);
define('IMAGE_QUALITY_WEBP', 85);
define('IMAGE_QUALITY_JPEG', 90);

// デプロイZIP上限（バイト）
define('DEPLOY_MAX_SIZE', 100 * 1024 * 1024); // 100MB

/**
 * CORS ヘッダーを設定
 */
function setCorsHeaders() {
    $origins = ALLOWED_ORIGINS;
    if (empty($origins)) {
        header('Access-Control-Allow-Origin: *');
    } else {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array($origin, $origins, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
}

/**
 * APIキー認証（書き込み系エンドポイント用）
 * API_KEYが空文字の場合は認証をスキップ
 */
function requireAuth() {
    if (API_KEY === '' || API_KEY === 'lpcats_change_me_on_deploy') {
        // 未設定時は認証スキップ（開発環境向け）
        return;
    }
    $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['key'] ?? '';
    if ($key !== API_KEY) {
        http_response_code(401);
        echo json_encode(['error' => '認証エラー: APIキーが正しくありません']);
        exit;
    }
}

/**
 * レガシー projects.json → 分割ファイルへのマイグレーション
 */
function migrateIfNeeded() {
    if (!file_exists(LEGACY_FILE) || file_exists(META_FILE)) {
        return;
    }

    $content = file_get_contents(LEGACY_FILE);
    $data = json_decode($content, true);
    if (!is_array($data)) return;

    // プロジェクトディレクトリ作成
    if (!is_dir(PROJECTS_DIR)) {
        mkdir(PROJECTS_DIR, 0755, true);
    }

    // フォルダ情報を meta.json に保存
    $folders = $data['_folders'] ?? [];
    file_put_contents(META_FILE, json_encode(['folders' => $folders], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    // 各LPを個別ファイルに分割
    foreach ($data as $key => $val) {
        if ($key === '_folders') continue;
        if (!is_array($val) || !isset($val['id'])) continue;
        $lpFile = PROJECTS_DIR . $val['id'] . '.json';
        file_put_contents($lpFile, json_encode($val, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }

    // レガシーファイルをリネーム（バックアップとして残す）
    rename(LEGACY_FILE, LEGACY_FILE . '.bak');
}

/**
 * meta.json を読み込む（なければ初期化）
 */
function loadMeta() {
    if (!file_exists(META_FILE)) {
        $meta = ['folders' => []];
        if (!is_dir(dirname(META_FILE))) mkdir(dirname(META_FILE), 0755, true);
        file_put_contents(META_FILE, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        return $meta;
    }
    $content = file_get_contents(META_FILE);
    $meta = json_decode($content, true);
    return is_array($meta) ? $meta : ['folders' => []];
}

/**
 * meta.json をflock付きで更新
 */
function saveMeta($meta) {
    $fp = fopen(META_FILE, 'c+');
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    fclose($fp);
}

/**
 * LP個別ファイルを読み込む
 */
function loadLP($id) {
    $file = PROJECTS_DIR . $id . '.json';
    if (!file_exists($file)) return null;
    $content = file_get_contents($file);
    return json_decode($content, true);
}

/**
 * LP個別ファイルをflock付きで保存
 */
function saveLP($id, $lpData) {
    if (!is_dir(PROJECTS_DIR)) mkdir(PROJECTS_DIR, 0755, true);
    $file = PROJECTS_DIR . $id . '.json';
    $fp = fopen($file, 'c+');
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($lpData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    fclose($fp);
}

/**
 * LP個別ファイルを削除
 */
function deleteLP($id) {
    $file = PROJECTS_DIR . $id . '.json';
    if (file_exists($file)) unlink($file);
}

/**
 * 全LP一覧を取得（軽量版）
 */
function listAllLPs() {
    if (!is_dir(PROJECTS_DIR)) return [];
    $files = glob(PROJECTS_DIR . '*.json');
    $list = [];
    foreach ($files as $file) {
        $content = file_get_contents($file);
        $lp = json_decode($content, true);
        if (!is_array($lp) || !isset($lp['id'])) continue;

        $stepsSummary = [];
        if (isset($lp['steps']) && is_array($lp['steps'])) {
            foreach ($lp['steps'] as $step) {
                $stepsSummary[] = [
                    'id' => $step['id'],
                    'order' => $step['order'],
                    'image' => $step['image'] ?? '',
                    'fileName' => $step['fileName'] ?? ''
                ];
            }
        }
        $list[] = [
            'id' => $lp['id'],
            'title' => $lp['title'] ?? '',
            'direction' => $lp['direction'] ?? 'vertical',
            'folderId' => $lp['folderId'] ?? null,
            'cta' => $lp['cta'] ?? [],
            'steps' => $stepsSummary,
            'version' => $lp['version'] ?? 1,
            'createdAt' => $lp['createdAt'] ?? '',
            'updatedAt' => $lp['updatedAt'] ?? ''
        ];
    }

    usort($list, function ($a, $b) {
        return strcmp($b['updatedAt'], $a['updatedAt']);
    });

    return $list;
}

function validateId($id) {
    return preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $id);
}
