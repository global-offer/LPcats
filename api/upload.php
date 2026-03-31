<?php
/**
 * LPcats - 画像アップロードAPI
 * POST multipart/form-data
 * finfo_file()でMIMEタイプ実検証
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

$uploadsDir = __DIR__ . '/../data/uploads/';
$maxFileSize = 5 * 1024 * 1024; // 5MB
$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp'
];

// uploadsディレクトリがなければ作成
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0777, true);
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    $errorCode = isset($_FILES['image']) ? $_FILES['image']['error'] : -1;
    http_response_code(400);
    echo json_encode(['error' => '画像ファイルのアップロードに失敗しました (code: ' . $errorCode . ')']);
    exit;
}

$file = $_FILES['image'];

// ファイルサイズチェック
if ($file['size'] > $maxFileSize) {
    http_response_code(400);
    echo json_encode(['error' => 'ファイルサイズは5MB以下にしてください']);
    exit;
}

// finfo_file()でMIMEタイプを実検証（$_FILES['type']を信用しない）
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!isset($allowedMimes[$mime])) {
    http_response_code(400);
    echo json_encode(['error' => '許可されていないファイル形式です（JPEG/PNG/WebPのみ）。検出: ' . $mime]);
    exit;
}

$ext = $allowedMimes[$mime];

// UUID生成
$uuid = sprintf('%s_%s', bin2hex(random_bytes(8)), time());

$fileName = $uuid . '.' . $ext;
$destPath = $uploadsDir . $fileName;
$relativePath = 'data/uploads/' . $fileName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'ファイルの保存に失敗しました']);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => $relativePath,
    'fileName' => $file['name'],
    'size' => $file['size'],
    'mime' => $mime
], JSON_UNESCAPED_UNICODE);
