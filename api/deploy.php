<?php
/**
 * LPcats - デプロイファイルZIP生成
 * GET ?id=xxx → LP単体のデプロイ用ZIPをダウンロード
 * CTA: 上80% LP + 下20% CTAバー分割レイアウト、出現ステップ設定対応
 */

require_once __DIR__ . '/config.php';

setCorsHeaders();
requireAuth();
migrateIfNeeded();

$id = isset($_GET['id']) ? $_GET['id'] : '';

if (!$id || !validateId($id)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'IDが不正です']);
    exit;
}

$lp = loadLP($id);
if (!$lp) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'LPが見つかりません']);
    exit;
}
$steps = $lp['steps'] ?? [];
usort($steps, function($a, $b) { return $a['order'] - $b['order']; });

$tmpFile = tempnam(sys_get_temp_dir(), 'lpcats_');
$zip = new ZipArchive();
if ($zip->open($tmpFile, ZipArchive::OVERWRITE) !== true) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'ZIPファイルの作成に失敗しました']);
    exit;
}

// ファイルサイズ上限チェック
$totalSize = 0;
foreach ($steps as $s) {
    if (!empty($s['image'])) {
        $p = __DIR__ . '/../' . $s['image'];
        if (file_exists($p)) $totalSize += filesize($p);
    }
}
if (!empty($lp['cta']['image'])) {
    $p = __DIR__ . '/../' . $lp['cta']['image'];
    if (file_exists($p)) $totalSize += filesize($p);
}
if ($totalSize > DEPLOY_MAX_SIZE) {
    http_response_code(413);
    header('Content-Type: application/json');
    echo json_encode(['error' => '画像の合計サイズが上限(' . round(DEPLOY_MAX_SIZE / 1024 / 1024) . 'MB)を超えています']);
    exit;
}

$imageIndex = 0;
foreach ($steps as &$step) {
    if (!empty($step['image'])) {
        $srcPath = __DIR__ . '/../' . $step['image'];
        if (file_exists($srcPath)) {
            $ext = pathinfo($srcPath, PATHINFO_EXTENSION) ?: 'jpg';
            $zipImagePath = 'images/step_' . str_pad($imageIndex, 2, '0', STR_PAD_LEFT) . '.' . $ext;
            $zip->addFile($srcPath, $zipImagePath);
            $step['_zipImage'] = $zipImagePath;
            $imageIndex++;
        }
    }
}
unset($step);

$ctaZipPath = '';
if (!empty($lp['cta']['image'])) {
    $ctaSrc = __DIR__ . '/../' . $lp['cta']['image'];
    if (file_exists($ctaSrc)) {
        $ext = pathinfo($ctaSrc, PATHINFO_EXTENSION) ?: 'jpg';
        $ctaZipPath = 'images/cta.' . $ext;
        $zip->addFile($ctaSrc, $ctaZipPath);
    }
}

$html = generateStaticHTML($lp, $steps, $ctaZipPath);
$zip->addFromString('index.html', $html);
$zip->close();

$safeTitle = preg_replace('/[^\w\-]/', '_', $lp['title'] ?? 'LP');
$filename = 'LPcats_' . $safeTitle . '_' . date('Ymd') . '.zip';

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($tmpFile));
header('Cache-Control: no-cache');

readfile($tmpFile);
unlink($tmpFile);

function generateStaticHTML($lp, $steps, $ctaZipPath) {
    $direction = $lp['direction'] ?? 'vertical';
    $ctaText = $lp['cta']['text'] ?? '';
    $ctaUrl = $lp['cta']['url'] ?? '#';
    $ctaBgColor = $lp['cta']['bgColor'] ?? '#FF6B35';
    $ctaTextColor = $lp['cta']['textColor'] ?? '#FFFFFF';
    $ctaImage = $ctaZipPath;
    $showFromStep = intval($lp['cta']['showFromStep'] ?? 0);
    $title = htmlspecialchars($lp['title'] ?? 'LP', ENT_QUOTES, 'UTF-8');
    $hasCta = !empty($ctaText);

    // ステップHTML
    $stepsHtml = '';
    foreach ($steps as $i => $step) {
        $imgPath = htmlspecialchars($step['_zipImage'] ?? '', ENT_QUOTES, 'UTF-8');
        $alt = htmlspecialchars($step['fileName'] ?? ('Step ' . ($i + 1)), ENT_QUOTES, 'UTF-8');
        $loading = $i > 2 ? 'lazy' : 'eager';
        $stepsHtml .= '<div class="lpcats-step" data-step-index="' . $i . '"><img src="' . $imgPath . '" alt="' . $alt . '" draggable="false" loading="' . $loading . '" onload="this.classList.add(\'loaded\')"></div>' . "\n";
    }

    // プログレスバー
    $progressHtml = '<div class="lpcats-progress" id="progress">';
    for ($i = 0; $i < count($steps); $i++) {
        $cls = $i === 0 ? ' active' : '';
        $progressHtml .= '<div class="lpcats-progress-seg' . $cls . '"></div>';
    }
    $progressHtml .= '</div>';

    // CTAバー
    $ctaHtml = '';
    if ($hasCta) {
        if ($ctaImage) {
            $ctaInner = '<img src="' . htmlspecialchars($ctaImage, ENT_QUOTES, 'UTF-8') . '" alt="' . htmlspecialchars($ctaText, ENT_QUOTES, 'UTF-8') . '" class="lpcats-cta-image">';
        } else {
            $ctaInner = htmlspecialchars($ctaText, ENT_QUOTES, 'UTF-8');
        }
        $safeUrl = htmlspecialchars($ctaUrl, ENT_QUOTES, 'UTF-8');
        $style = $ctaImage ? '' : ' style="background-color:' . htmlspecialchars($ctaBgColor, ENT_QUOTES, 'UTF-8') . ';color:' . htmlspecialchars($ctaTextColor, ENT_QUOTES, 'UTF-8') . '"';
        $hiddenClass = $showFromStep > 0 ? ' lpcats-cta-hidden' : '';
        $ctaHtml = '<div class="lpcats-cta-bar' . $hiddenClass . '" id="ctabar"><a class="lpcats-cta-button" href="' . $safeUrl . '" target="_blank" rel="noopener noreferrer"' . $style . '>' . $ctaInner . '</a></div>';
    }

    // インジケーター
    $dotCount = count($steps);
    $dotsHtml = '';
    for ($i = 0; $i < $dotCount; $i++) {
        $active = $i === 0 ? ' active' : '';
        $dotsHtml .= '<div class="lpcats-dot' . $active . '" onclick="goToStep(' . $i . ')"></div>';
    }

    $totalSteps = count($steps);
    $showFromStepJs = $showFromStep;

    return <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@keyframes lpcats-img-in{from{opacity:0;transform:scale(1.01)}to{opacity:1;transform:scale(1)}}
@keyframes lpcats-skeleton{0%{opacity:.12}50%{opacity:.05}100%{opacity:.12}}
@keyframes lpcats-hint-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes lpcats-ripple{to{transform:scale(4);opacity:0}}
@keyframes lpcats-cta-glow{0%,100%{box-shadow:0 4px 16px rgba(0,0,0,.3)}50%{box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 40px rgba(255,255,255,.03)}}
.lpcats-embed{position:relative;width:100%;max-width:100vw;height:100vh;height:100dvh;overflow:hidden;display:flex;flex-direction:column}
.lpcats-container{width:100%;flex:1;min-height:0;overflow-y:scroll;overflow-x:hidden;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior:none;scrollbar-width:none;-ms-overflow-style:none}
.lpcats-container::-webkit-scrollbar{display:none}
.lpcats-container[data-direction="horizontal"]{overflow-y:hidden;overflow-x:scroll;scroll-snap-type:x mandatory;display:flex}
.lpcats-container[data-direction="horizontal"] .lpcats-step{width:100%;flex-shrink:0}
.lpcats-container[data-direction="horizontal"]{touch-action:pan-x pinch-zoom}
.lpcats-container[data-direction="vertical"]{touch-action:pan-y pinch-zoom}
.lpcats-container[data-direction="fullscreen"]{touch-action:pan-y pinch-zoom}
.lpcats-step{width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;background:#0a0a0a;overflow:hidden;flex-shrink:0;position:relative}
.lpcats-step::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.03) 0%,transparent 50%);animation:lpcats-skeleton 2s ease-in-out infinite;z-index:0}
.lpcats-step img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;user-select:none;pointer-events:none;-webkit-user-drag:none;opacity:0}
.lpcats-step img.loaded{animation:lpcats-img-in .5s cubic-bezier(.4,0,.2,1) forwards}
.lpcats-progress{position:absolute;top:0;left:0;right:0;z-index:10001;display:flex;gap:3px;padding:8px 8px 0;pointer-events:none}
.lpcats-progress-seg{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.15);transition:background .4s cubic-bezier(.4,0,.2,1)}
.lpcats-progress-seg.past{background:rgba(255,255,255,.5)}
.lpcats-progress-seg.active{background:rgba(255,255,255,.95);box-shadow:0 0 8px rgba(255,255,255,.2)}
.lpcats-counter{position:fixed;bottom:16px;right:16px;z-index:10001;padding:6px 12px;border-radius:20px;background:rgba(0,0,0,.35);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-size:12px;font-weight:600;color:rgba(255,255,255,.7);pointer-events:none;font-variant-numeric:tabular-nums}
.lpcats-counter-current{display:inline-block;transition:opacity .15s ease;color:rgba(255,255,255,.95)}
.lpcats-counter-sep{opacity:.4}
.lpcats-hint{position:fixed;bottom:25%;left:50%;transform:translateX(-50%);z-index:10001;display:flex;flex-direction:column;align-items:center;gap:6px;color:rgba(255,255,255,.6);font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;pointer-events:none;opacity:0;transition:opacity .5s ease}
.lpcats-hint.visible{opacity:1;animation:lpcats-hint-float 2s ease-in-out infinite}
.lpcats-hint.gone{opacity:0!important;transition:opacity .3s ease}
.lpcats-cta-bar{width:100%;height:20vh;height:20dvh;background:linear-gradient(180deg,#0d0d0d 0%,#111 50%,#0d0d0d 100%);display:flex;align-items:center;justify-content:center;padding:10px 20px calc(10px + env(safe-area-inset-bottom,0px));flex-shrink:0;transition:height .5s cubic-bezier(.34,1.56,.64,1),padding .4s ease,opacity .3s ease;overflow:hidden;border-top:1px solid rgba(255,255,255,.06)}
.lpcats-cta-hidden{height:0!important;padding:0!important;opacity:0;pointer-events:none;border-top-color:transparent}
.lpcats-cta-button{position:relative;display:block;width:100%;max-width:600px;padding:18px 24px;border:none;border-radius:16px;font-family:inherit;font-size:17px;font-weight:800;letter-spacing:.3px;text-align:center;text-decoration:none;cursor:pointer;overflow:hidden;animation:lpcats-cta-glow 3s ease-in-out infinite;will-change:box-shadow;transition:transform .15s cubic-bezier(.4,0,.2,1)}
.lpcats-cta-button:active{animation:none;transform:scale(.96)}
.lpcats-cta-image{width:100%;height:auto;border-radius:14px;display:block}
.lpcats-ripple{position:absolute;width:100px;height:100px;margin:-50px 0 0 -50px;border-radius:50%;background:rgba(255,255,255,.2);pointer-events:none;animation:lpcats-ripple .7s cubic-bezier(.4,0,.2,1) forwards}
.lpcats-indicator{position:fixed;z-index:10001;display:flex;gap:6px;pointer-events:auto;padding:8px;border-radius:20px;background:rgba(0,0,0,.25);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.lpcats-indicator[data-direction="vertical"]{right:10px;top:40%;transform:translateY(-50%);flex-direction:column}
.lpcats-indicator[data-direction="horizontal"]{top:14px;left:50%;transform:translateX(-50%);flex-direction:row}
.lpcats-indicator[data-direction="fullscreen"]{right:10px;top:40%;transform:translateY(-50%);flex-direction:column}
.lpcats-dot{width:5px;height:5px;border-radius:3px;background:rgba(255,255,255,.25);cursor:pointer;transition:all .35s cubic-bezier(.4,0,.2,1)}
.lpcats-dot:hover{background:rgba(255,255,255,.5)}
.lpcats-dot.active{background:rgba(255,255,255,.95);box-shadow:0 0 6px rgba(255,255,255,.25)}
.lpcats-indicator[data-direction="vertical"] .lpcats-dot.active,.lpcats-indicator[data-direction="fullscreen"] .lpcats-dot.active{height:22px}
.lpcats-indicator[data-direction="horizontal"] .lpcats-dot.active{width:22px}
@media(min-width:768px){.lpcats-embed{align-items:center}.lpcats-container{width:375px}.lpcats-container[data-direction="horizontal"] .lpcats-step{width:375px}.lpcats-cta-bar{width:375px}.lpcats-progress{max-width:375px;left:50%;right:auto;transform:translateX(-50%)}}
</style>
</head>
<body>
<div class="lpcats-embed">
{$progressHtml}
<div class="lpcats-container" data-direction="{$direction}" id="container">
{$stepsHtml}
</div>
{$ctaHtml}
<div class="lpcats-counter" id="counter"><span class="lpcats-counter-current">1</span><span class="lpcats-counter-sep"> / </span>{$totalSteps}</div>
<div class="lpcats-hint" id="hint"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span>Swipe</span></div>
<div class="lpcats-indicator" data-direction="{$direction}" id="indicator">
{$dotsHtml}
</div>
</div>
<script>
(function(){
var container=document.getElementById('container');
var indicator=document.getElementById('indicator');
var ctaBar=document.getElementById('ctabar');
var progress=document.getElementById('progress');
var counterEl=document.getElementById('counter');
var hint=document.getElementById('hint');
var steps=container.querySelectorAll('.lpcats-step');
var currentStep=0;
var direction=container.dataset.direction||'vertical';
var showFromStep={$showFromStepJs};
var imgSrcs=[];
steps.forEach(function(s){var img=s.querySelector('img');if(img)imgSrcs.push(img.src);});

// Hint
var hintTimer=setTimeout(function(){hint.classList.add('visible');},2500);

// Preload
function preloadNext(idx){
if(idx+1<imgSrcs.length){var p=new Image();p.src=imgSrcs[idx+1];}
if(idx+2<imgSrcs.length){var p2=new Image();p2.src=imgSrcs[idx+2];}
}
preloadNext(0);

// CTA ripple
if(ctaBar){
var btn=ctaBar.querySelector('.lpcats-cta-button');
if(btn)btn.addEventListener('click',function(e){
var r=this.getBoundingClientRect();var rp=document.createElement('span');
rp.className='lpcats-ripple';rp.style.left=(e.clientX-r.left)+'px';rp.style.top=(e.clientY-r.top)+'px';
this.appendChild(rp);setTimeout(function(){rp.remove();},700);
});
}

function onStepChange(idx){
currentStep=idx;
// Progress
var segs=progress.querySelectorAll('.lpcats-progress-seg');
segs.forEach(function(s,i){s.classList.toggle('active',i===idx);s.classList.toggle('past',i<idx);});
// Indicator
var dots=indicator.querySelectorAll('.lpcats-dot');
dots.forEach(function(d,i){d.classList.toggle('active',i===idx);});
// Counter
var cur=counterEl.querySelector('.lpcats-counter-current');
if(cur){cur.style.opacity='0';setTimeout(function(){cur.textContent=idx+1;cur.style.opacity='1';},150);}
// CTA
if(ctaBar){if(idx>=showFromStep)ctaBar.classList.remove('lpcats-cta-hidden');else ctaBar.classList.add('lpcats-cta-hidden');}
// Preload
preloadNext(idx);
// Hint
if(idx>0&&hint.parentNode){hint.classList.remove('visible');hint.classList.add('gone');clearTimeout(hintTimer);}
}

var observer=new IntersectionObserver(function(entries){
entries.forEach(function(entry){
if(entry.isIntersecting&&entry.intersectionRatio>0.5){
var idx=parseInt(entry.target.dataset.stepIndex,10);
if(idx!==currentStep)onStepChange(idx);
}
});
},{root:container,threshold:0.5});
steps.forEach(function(s){observer.observe(s);});

var scrolling=false;
container.addEventListener('wheel',function(e){
if(scrolling){e.preventDefault();return;}
var delta=direction==='horizontal'?(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY):e.deltaY;
if(Math.abs(delta)<10)return;
scrolling=true;e.preventDefault();
var next=delta>0?Math.min(currentStep+1,steps.length-1):Math.max(currentStep-1,0);
if(next!==currentStep)goToStep(next);
setTimeout(function(){scrolling=false;},600);
},{passive:false});

window.goToStep=function(index){
if(!steps[index])return;
if(direction==='horizontal')container.scrollTo({left:container.clientWidth*index,behavior:'smooth'});
else container.scrollTo({top:container.clientHeight*index,behavior:'smooth'});
};
})();
</script>
</body>
</html>
HTML;
}
