<?php
/**
 * LPcats - トラッキングAPI
 * POST: ステップ閲覧・離脱・CTAクリックのイベントを記録
 * data/analytics/{lp_id}.json にLP別で保存
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

$analyticsDir = __DIR__ . '/../data/analytics/';
if (!is_dir($analyticsDir)) {
    mkdir($analyticsDir, 0755, true);
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input || !isset($input['lpId']) || !isset($input['event'])) {
    http_response_code(400);
    echo json_encode(['error' => 'lpId and event are required']);
    exit;
}

$lpId = $input['lpId'];
if (!preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $lpId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid LP ID']);
    exit;
}

$event = $input['event'];
$allowedEvents = ['step_view', 'step_leave', 'cta_click', 'page_view'];
if (!in_array($event, $allowedEvents)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid event type']);
    exit;
}

$analyticsFile = $analyticsDir . $lpId . '.json';

// flock排他ロック付きで読み書き
$fp = fopen($analyticsFile, 'c+');
if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'Cannot open analytics file']);
    exit;
}

flock($fp, LOCK_EX);

$content = stream_get_contents($fp);
$analytics = $content ? json_decode($content, true) : [];
if (!is_array($analytics)) $analytics = [];

// 初期化
if (!isset($analytics['summary'])) {
    $analytics['summary'] = [
        'totalSessions' => 0,
        'totalCtaClicks' => 0,
        'steps' => []
    ];
}

$sessionId = isset($input['sessionId']) ? $input['sessionId'] : '';
if (!preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $sessionId)) {
    $sessionId = 'anon_' . bin2hex(random_bytes(4));
}
$stepIndex = isset($input['step']) ? intval($input['step']) : -1;
$stepId = isset($input['stepId']) ? $input['stepId'] : '';
$totalSteps = isset($input['totalSteps']) ? intval($input['totalSteps']) : 0;
$duration = isset($input['duration']) ? intval($input['duration']) : 0;
$variant = isset($input['variant']) ? $input['variant'] : 'default';

// セッション管理
if (!isset($analytics['sessions'])) $analytics['sessions'] = [];

$isNewSession = !isset($analytics['sessions'][$sessionId]);
if ($isNewSession) {
    $analytics['sessions'][$sessionId] = [
        'startedAt' => date('c'),
        'variant' => $variant,
        'maxStep' => 0
    ];
    $analytics['summary']['totalSessions']++;
}

// ステップサマリー初期化
$stepKey = 'step_' . $stepIndex;
if ($stepIndex >= 0 && !isset($analytics['summary']['steps'][$stepKey])) {
    $analytics['summary']['steps'][$stepKey] = [
        'index' => $stepIndex,
        'views' => 0,
        'totalDuration' => 0,
        'durationCount' => 0,
        'ctaClicks' => 0
    ];
}

// イベント処理
switch ($event) {
    case 'step_view':
        if ($stepIndex >= 0) {
            $analytics['summary']['steps'][$stepKey]['views']++;
            // セッション最大到達ステップ更新
            if ($stepIndex > $analytics['sessions'][$sessionId]['maxStep']) {
                $analytics['sessions'][$sessionId]['maxStep'] = $stepIndex;
            }
        }
        break;

    case 'step_leave':
        if ($stepIndex >= 0 && $duration > 0) {
            $analytics['summary']['steps'][$stepKey]['totalDuration'] += $duration;
            $analytics['summary']['steps'][$stepKey]['durationCount']++;
        }
        break;

    case 'cta_click':
        $analytics['summary']['totalCtaClicks']++;
        if ($stepIndex >= 0) {
            $analytics['summary']['steps'][$stepKey]['ctaClicks']++;
        }
        break;
}

// 古いセッション情報を整理（24時間以上前のセッション詳細を削除、サマリーは残す）
$cutoff = time() - 86400;
foreach ($analytics['sessions'] as $sid => $ses) {
    if (isset($ses['startedAt']) && strtotime($ses['startedAt']) < $cutoff) {
        unset($analytics['sessions'][$sid]);
    }
}

// セッション数上限（DoS対策）
if (count($analytics['sessions']) > 10000) {
    uasort($analytics['sessions'], function($a, $b) {
        return strcmp($b['startedAt'] ?? '', $a['startedAt'] ?? '');
    });
    $analytics['sessions'] = array_slice($analytics['sessions'], 0, 10000, true);
}

// 書き戻し
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($analytics, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['success' => true]);
