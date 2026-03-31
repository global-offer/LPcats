<?php
/**
 * LPcats - 分析データ取得API
 * GET ?id=xxx → LP別の分析サマリーを返す
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

$id = isset($_GET['id']) ? $_GET['id'] : '';
if (!$id || !preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'IDが不正です']);
    exit;
}

$analyticsFile = __DIR__ . '/../data/analytics/' . $id . '.json';

if (!file_exists($analyticsFile)) {
    // データなし = まだ閲覧がない
    echo json_encode([
        'lpId' => $id,
        'summary' => [
            'totalSessions' => 0,
            'totalCtaClicks' => 0,
            'steps' => []
        ],
        'computed' => []
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$fp = fopen($analyticsFile, 'r');
flock($fp, LOCK_SH);
$content = stream_get_contents($fp);
flock($fp, LOCK_UN);
fclose($fp);

$analytics = json_decode($content, true);
if (!$analytics || !isset($analytics['summary'])) {
    echo json_encode(['lpId' => $id, 'summary' => [], 'computed' => []]);
    exit;
}

$summary = $analytics['summary'];
$totalSessions = max($summary['totalSessions'], 1);

// 計算済みメトリクスを生成
$computed = [];
$stepKeys = array_keys($summary['steps'] ?? []);

// ステップをインデックス順にソート
usort($stepKeys, function($a, $b) use ($summary) {
    return ($summary['steps'][$a]['index'] ?? 0) - ($summary['steps'][$b]['index'] ?? 0);
});

foreach ($stepKeys as $key) {
    $step = $summary['steps'][$key];
    $views = $step['views'] ?? 0;
    $avgDuration = ($step['durationCount'] ?? 0) > 0
        ? round($step['totalDuration'] / $step['durationCount'])
        : 0;
    $ctaClicks = $step['ctaClicks'] ?? 0;

    $computed[] = [
        'index' => $step['index'],
        'views' => $views,
        'reachRate' => round(($views / $totalSessions) * 100, 1),
        'avgDuration' => $avgDuration,
        'avgDurationFormatted' => formatDuration($avgDuration),
        'ctaClicks' => $ctaClicks,
        'ctaClickRate' => $views > 0 ? round(($ctaClicks / $views) * 100, 2) : 0
    ];
}

// 離脱率を計算（前のステップとの差分）
for ($i = 0; $i < count($computed); $i++) {
    if ($i === 0) {
        $computed[$i]['dropRate'] = 0;
    } else {
        $prevViews = $computed[$i - 1]['views'];
        $currViews = $computed[$i]['views'];
        $computed[$i]['dropRate'] = $prevViews > 0
            ? round((1 - $currViews / $prevViews) * 100, 1)
            : 0;
    }
}

echo json_encode([
    'lpId' => $id,
    'summary' => [
        'totalSessions' => $summary['totalSessions'],
        'totalCtaClicks' => $summary['totalCtaClicks'],
        'ctaClickRate' => round(($summary['totalCtaClicks'] / $totalSessions) * 100, 2)
    ],
    'computed' => $computed
], JSON_UNESCAPED_UNICODE);

function formatDuration($ms) {
    if ($ms < 1000) return $ms . 'ms';
    return round($ms / 1000, 1) . '秒';
}
