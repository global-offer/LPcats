<?php
/**
 * LPcats - 画像アップロードAPI（認証必須）
 * POST multipart/form-data
 * finfo_file()でMIMEタイプ実検証 + GDリサイズ・WebP変換
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

$maxFileSize = 10 * 1024 * 1024; // 10MB（最適化前の上限を緩和）
$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp'
];

if (!is_dir(UPLOADS_DIR)) {
    mkdir(UPLOADS_DIR, 0777, true);
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    $errorCode = isset($_FILES['image']) ? $_FILES['image']['error'] : -1;
    http_response_code(400);
    echo json_encode(['error' => '画像ファイルのアップロードに失敗しました (code: ' . $errorCode . ')']);
    exit;
}

$file = $_FILES['image'];

if ($file['size'] > $maxFileSize) {
    http_response_code(400);
    echo json_encode(['error' => 'ファイルサイズは10MB以下にしてください']);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!isset($allowedMimes[$mime])) {
    http_response_code(400);
    echo json_encode(['error' => '許可されていないファイル形式です（JPEG/PNG/WebPのみ）。検出: ' . $mime]);
    exit;
}

$uuid = sprintf('%s_%s', bin2hex(random_bytes(8)), time());

// GDで画像最適化（リサイズ + WebP変換）
$optimized = optimizeImage($file['tmp_name'], $mime);

if ($optimized) {
    $fileName = $uuid . '.webp';
    $destPath = UPLOADS_DIR . $fileName;
    file_put_contents($destPath, $optimized['data']);
    $finalMime = 'image/webp';
    $finalSize = strlen($optimized['data']);
} else {
    // GD未対応の場合はそのまま保存
    $ext = $allowedMimes[$mime];
    $fileName = $uuid . '.' . $ext;
    $destPath = UPLOADS_DIR . $fileName;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'ファイルの保存に失敗しました']);
        exit;
    }
    $finalMime = $mime;
    $finalSize = $file['size'];
}

$relativePath = 'data/uploads/' . $fileName;

echo json_encode([
    'success' => true,
    'path' => $relativePath,
    'fileName' => $file['name'],
    'size' => $finalSize,
    'mime' => $finalMime
], JSON_UNESCAPED_UNICODE);

/**
 * GDで画像をリサイズ + WebP変換
 */
function optimizeImage($tmpPath, $mime) {
    if (!function_exists('imagecreatefromjpeg')) return null;

    switch ($mime) {
        case 'image/jpeg': $src = @imagecreatefromjpeg($tmpPath); break;
        case 'image/png':  $src = @imagecreatefrompng($tmpPath); break;
        case 'image/webp': $src = @imagecreatefromwebp($tmpPath); break;
        default: return null;
    }

    if (!$src) return null;

    $origW = imagesx($src);
    $origH = imagesy($src);

    // リサイズ（最大幅制限）
    if ($origW > IMAGE_MAX_WIDTH) {
        $newW = IMAGE_MAX_WIDTH;
        $newH = intval($origH * ($newW / $origW));
        $resized = imagecreatetruecolor($newW, $newH);
        // 透過保持
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        imagecopyresampled($resized, $src, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
        imagedestroy($src);
        $src = $resized;
    }

    // WebP出力
    if (!function_exists('imagewebp')) {
        imagedestroy($src);
        return null;
    }

    ob_start();
    imagewebp($src, null, IMAGE_QUALITY_WEBP);
    $data = ob_get_clean();
    imagedestroy($src);

    return ['data' => $data];
}
