<?php
/**
 * LPcats - 埋め込みJSエンドポイント
 * GET ?id=xxx → LPデータを含むJavaScriptを返す
 * 使い方: <script src="api/embed.php?id=xxx"></script>
 */

header('Content-Type: application/javascript; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300');

$id = isset($_GET['id']) ? $_GET['id'] : '';

if (!$id || !preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $id)) {
    echo 'console.error("LPcats: Invalid LP ID");';
    exit;
}

$dataFile = __DIR__ . '/../data/projects.json';
if (!file_exists($dataFile)) {
    echo 'console.error("LPcats: Data file not found");';
    exit;
}

$fp = fopen($dataFile, 'r');
flock($fp, LOCK_SH);
$content = stream_get_contents($fp);
flock($fp, LOCK_UN);
fclose($fp);

$data = json_decode($content, true);
if (!isset($data[$id])) {
    echo 'console.error("LPcats: LP not found");';
    exit;
}

$lp = $data[$id];

// ベースURL（埋め込み先から画像を参照するため）
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname(dirname($_SERVER['SCRIPT_NAME'])) . '/';

// トラッキングAPIのURL
$trackUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['SCRIPT_NAME']) . '/track.php';

// モバイルのみ表示オプション
$mobileOnly = isset($_GET['mobile']) && $_GET['mobile'] === '1';

$lpJson = json_encode($lp, JSON_UNESCAPED_UNICODE);
$baseUrlJson = json_encode($baseUrl);
$trackUrlJson = json_encode($trackUrl);
$mobileOnlyJson = $mobileOnly ? 'true' : 'false';

// 埋め込みJS出力
echo <<<JS
(function() {
    'use strict';

    var LP_DATA = {$lpJson};
    var BASE_URL = {$baseUrlJson};
    var TRACK_URL = {$trackUrlJson};
    var MOBILE_ONLY = {$mobileOnlyJson};

    // モバイル判定
    if (MOBILE_ONLY && window.innerWidth > 767) return;

    // 既に初期化済みなら中断
    if (document.getElementById('lpcats-embed-' + LP_DATA.id)) return;

    // CSS注入
    var style = document.createElement('style');
    style.textContent = getLPCatsCSS();
    document.head.appendChild(style);

    // コンテナ作成
    var wrapper = document.createElement('div');
    wrapper.id = 'lpcats-embed-' + LP_DATA.id;
    wrapper.className = 'lpcats-embed';

    var container = document.createElement('div');
    container.className = 'lpcats-container';
    container.dataset.direction = LP_DATA.direction || 'vertical';

    // ステップをソート
    var steps = (LP_DATA.steps || []).slice().sort(function(a, b) { return a.order - b.order; });

    if (steps.length === 0) return;

    // トラッキング用変数
    var sessionId = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6);
    var stepEnterTimes = {};
    var trackedSteps = {};
    var currentStep = 0;

    // ステップDOM構築
    steps.forEach(function(step, index) {
        var stepEl = document.createElement('div');
        stepEl.className = 'lpcats-step';
        stepEl.dataset.stepIndex = index;
        stepEl.dataset.stepId = step.id;

        var img = document.createElement('img');
        var imgSrc = step.image || '';
        if (imgSrc && imgSrc.indexOf('http') !== 0 && imgSrc.indexOf('data:') !== 0) {
            imgSrc = BASE_URL + imgSrc;
        }
        img.alt = step.fileName || ('Step ' + (index + 1));
        img.draggable = false;
        img.loading = index > 1 ? 'lazy' : 'eager';
        img.addEventListener('load', function() { this.classList.add('loaded'); });
        img.src = imgSrc;

        stepEl.appendChild(img);
        container.appendChild(stepEl);
    });

    wrapper.appendChild(container);

    // CTA
    if (LP_DATA.cta && LP_DATA.cta.text) {
        var ctaBar = document.createElement('div');
        ctaBar.className = 'lpcats-cta-bar';

        var ctaBtn = document.createElement('a');
        ctaBtn.className = 'lpcats-cta-button';

        if (LP_DATA.cta.image) {
            var ctaImg = document.createElement('img');
            var ctaImgSrc = LP_DATA.cta.image;
            if (ctaImgSrc.indexOf('http') !== 0 && ctaImgSrc.indexOf('data:') !== 0) {
                ctaImgSrc = BASE_URL + ctaImgSrc;
            }
            ctaImg.src = ctaImgSrc;
            ctaImg.alt = LP_DATA.cta.text;
            ctaImg.className = 'lpcats-cta-image';
            ctaBtn.appendChild(ctaImg);
        } else {
            ctaBtn.textContent = LP_DATA.cta.text;
            ctaBtn.style.backgroundColor = LP_DATA.cta.bgColor || '#FF6B35';
            ctaBtn.style.color = LP_DATA.cta.textColor || '#FFFFFF';
        }

        var url = LP_DATA.cta.url || '#';
        if (isSafeURL(url)) {
            ctaBtn.href = url;
            ctaBtn.target = '_blank';
            ctaBtn.rel = 'noopener noreferrer';
        } else {
            ctaBtn.href = '#';
        }

        // CTAクリックトラッキング
        ctaBtn.addEventListener('click', function() {
            track('cta_click', { step: currentStep, url: url });
        });

        ctaBar.appendChild(ctaBtn);
        wrapper.appendChild(ctaBar);
    }

    // インジケーター
    var indicator = document.createElement('div');
    indicator.className = 'lpcats-indicator';
    var dir = LP_DATA.direction || 'vertical';
    indicator.dataset.direction = dir;

    steps.forEach(function(_, i) {
        var dot = document.createElement('div');
        dot.className = 'lpcats-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', function() { goToStep(i); });
        indicator.appendChild(dot);
    });
    wrapper.appendChild(indicator);

    // ページに挿入（scriptタグの位置に）
    var currentScript = document.currentScript || (function() {
        var scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();
    currentScript.parentNode.insertBefore(wrapper, currentScript);

    // スワイプエンジン初期化
    initSwipe(container, dir);

    // トラッキング: 最初のステップ
    onStepEnter(0);

    // === スワイプエンジン ===
    function initSwipe(el, direction) {
        // IntersectionObserver でステップ検知
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    var idx = parseInt(entry.target.dataset.stepIndex, 10);
                    if (idx !== currentStep) {
                        onStepLeave(currentStep);
                        currentStep = idx;
                        onStepEnter(idx);
                        updateIndicator(idx);
                    }
                }
            });
        }, { root: el, threshold: 0.5 });

        el.querySelectorAll('.lpcats-step').forEach(function(s) { observer.observe(s); });

        // ホイール補助（デスクトップ）
        var scrolling = false;
        el.addEventListener('wheel', function(e) {
            if (scrolling) { e.preventDefault(); return; }
            var delta = direction === 'vertical' ? e.deltaY : e.deltaX;
            if (direction === 'horizontal' && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                delta = e.deltaY;
            }
            if (Math.abs(delta) < 10) return;
            scrolling = true;
            e.preventDefault();
            var next = delta > 0
                ? Math.min(currentStep + 1, steps.length - 1)
                : Math.max(currentStep - 1, 0);
            if (next !== currentStep) goToStep(next);
            setTimeout(function() { scrolling = false; }, 600);
        }, { passive: false });
    }

    function goToStep(index) {
        var stepEls = container.querySelectorAll('.lpcats-step');
        if (stepEls[index]) stepEls[index].scrollIntoView({ behavior: 'smooth' });
    }

    function updateIndicator(index) {
        var dots = indicator.querySelectorAll('.lpcats-dot');
        dots.forEach(function(d, i) { d.classList.toggle('active', i === index); });
    }

    // === トラッキング ===
    function onStepEnter(index) {
        stepEnterTimes[index] = Date.now();
        if (!trackedSteps[index]) {
            trackedSteps[index] = true;
            track('step_view', { step: index, stepId: steps[index].id });
        }
    }

    function onStepLeave(index) {
        if (stepEnterTimes[index]) {
            var duration = Date.now() - stepEnterTimes[index];
            track('step_leave', { step: index, stepId: steps[index].id, duration: duration });
            delete stepEnterTimes[index];
        }
    }

    // ページ離脱時に最後のステップの滞在時間を送信
    window.addEventListener('beforeunload', function() {
        onStepLeave(currentStep);
    });

    function track(event, data) {
        data = data || {};
        data.event = event;
        data.lpId = LP_DATA.id;
        data.sessionId = sessionId;
        data.timestamp = Date.now();
        data.totalSteps = steps.length;

        // sendBeacon（確実に送信）
        if (navigator.sendBeacon) {
            navigator.sendBeacon(TRACK_URL, JSON.stringify(data));
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', TRACK_URL, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(data));
        }
    }

    function isSafeURL(url) {
        if (!url) return false;
        try {
            var p = new URL(url);
            return ['http:', 'https:', 'tel:', 'mailto:'].indexOf(p.protocol) !== -1;
        } catch(e) { return false; }
    }

    // === 埋め込み用CSS ===
    function getLPCatsCSS() {
        return '' +
        '.lpcats-embed{position:relative;width:100%;max-width:100vw;overflow:hidden}' +
        '.lpcats-container{width:100%;height:100vh;height:100dvh;overflow-y:scroll;overflow-x:hidden;' +
            'scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior:none;' +
            'scrollbar-width:none;-ms-overflow-style:none}' +
        '.lpcats-container::-webkit-scrollbar{display:none}' +
        '.lpcats-container[data-direction="horizontal"]{overflow-y:hidden;overflow-x:scroll;' +
            'scroll-snap-type:x mandatory;display:flex}' +
        '.lpcats-container[data-direction="horizontal"] .lpcats-step{min-width:100%;flex-shrink:0}' +
        '.lpcats-container[data-direction="horizontal"]{touch-action:pan-y}' +
        '.lpcats-container[data-direction="vertical"]{touch-action:pan-x}' +
        '.lpcats-container[data-direction="fullscreen"] .lpcats-step img{object-fit:cover}' +
        '.lpcats-step{width:100%;height:100vh;height:100dvh;scroll-snap-align:start;scroll-snap-stop:always;' +
            'display:flex;align-items:center;justify-content:center;background:#0F0F0F}' +
        '.lpcats-step img{width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none;' +
            '-webkit-user-drag:none;opacity:0;transition:opacity .4s ease}' +
        '.lpcats-step img.loaded{opacity:1}' +
        '.lpcats-cta-bar{position:fixed;bottom:0;left:0;right:0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));' +
            'z-index:10000;background:linear-gradient(transparent 0%,rgba(0,0,0,.4) 30%,rgba(0,0,0,.85) 100%);pointer-events:none}' +
        '.lpcats-cta-button{display:block;width:100%;padding:18px;border:none;border-radius:14px;font-size:18px;' +
            'font-weight:800;letter-spacing:.5px;text-align:center;text-decoration:none;cursor:pointer;pointer-events:auto;' +
            'box-shadow:0 4px 20px rgba(0,0,0,.4),0 0 40px rgba(255,107,53,.15);' +
            'animation:lpcats-cta-pulse 2.5s ease-in-out infinite;will-change:transform,box-shadow}' +
        '@keyframes lpcats-cta-pulse{0%,100%{transform:translateY(0);box-shadow:0 4px 20px rgba(0,0,0,.4),0 0 40px rgba(255,107,53,.15)}' +
            '50%{transform:translateY(-2px);box-shadow:0 6px 28px rgba(0,0,0,.5),0 0 60px rgba(255,107,53,.25)}}' +
        '.lpcats-cta-button:active{animation:none;transform:scale(.97)}' +
        '.lpcats-cta-image{width:100%;height:auto;border-radius:12px}' +
        '.lpcats-indicator{position:fixed;z-index:10000;display:flex;gap:8px;pointer-events:auto}' +
        '.lpcats-indicator[data-direction="vertical"]{right:12px;top:50%;transform:translateY(-50%);flex-direction:column}' +
        '.lpcats-indicator[data-direction="horizontal"]{top:16px;left:50%;transform:translateX(-50%);flex-direction:row}' +
        '.lpcats-indicator[data-direction="fullscreen"]{right:12px;top:50%;transform:translateY(-50%);flex-direction:column}' +
        '.lpcats-dot{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);cursor:pointer;' +
            'transition:all .3s cubic-bezier(.4,0,.2,1)}' +
        '.lpcats-dot.active{background:#fff}' +
        '.lpcats-indicator[data-direction="vertical"] .lpcats-dot.active,' +
            '.lpcats-indicator[data-direction="fullscreen"] .lpcats-dot.active{height:20px}' +
        '.lpcats-indicator[data-direction="horizontal"] .lpcats-dot.active{width:20px}' +
        '@media(min-width:768px){.lpcats-embed{display:flex;justify-content:center}.lpcats-container{width:375px}' +
            '.lpcats-container[data-direction="horizontal"] .lpcats-step{min-width:375px}' +
            '.lpcats-cta-bar{width:375px;left:50%;transform:translateX(-50%)}}';
    }
})();
JS;
