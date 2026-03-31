<?php
/**
 * LPcats - 埋め込みJSエンドポイント
 * GET ?id=xxx → LPデータを含むJavaScriptを返す
 * CTA: 上80% LP + 下20% CTAバー分割レイアウト、出現ステップ設定対応
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/javascript; charset=utf-8');
setCorsHeaders();
header('Cache-Control: public, max-age=300');

$id = isset($_GET['id']) ? $_GET['id'] : '';

if (!$id || !validateId($id)) {
    echo 'console.error("LPcats: Invalid LP ID");';
    exit;
}

migrateIfNeeded();

$lp = loadLP($id);
if (!$lp) {
    echo 'console.error("LPcats: LP not found");';
    exit;
}

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname(dirname($_SERVER['SCRIPT_NAME'])) . '/';

$mobileOnly = isset($_GET['mobile']) && $_GET['mobile'] === '1';

$lpJson = json_encode($lp, JSON_UNESCAPED_UNICODE);
$baseUrlJson = json_encode($baseUrl);
$mobileOnlyJson = $mobileOnly ? 'true' : 'false';

echo <<<JS
(function() {
    'use strict';

    var LP_DATA = {$lpJson};
    var BASE_URL = {$baseUrlJson};
    var MOBILE_ONLY = {$mobileOnlyJson};

    if (MOBILE_ONLY && window.innerWidth > 767) return;
    if (document.getElementById('lpcats-embed-' + LP_DATA.id)) return;

    var hasCta = LP_DATA.cta && LP_DATA.cta.text;
    var showFromStep = (LP_DATA.cta && LP_DATA.cta.showFromStep) ? parseInt(LP_DATA.cta.showFromStep, 10) : 0;

    var style = document.createElement('style');
    style.textContent = getLPCatsCSS();
    document.head.appendChild(style);

    var wrapper = document.createElement('div');
    wrapper.id = 'lpcats-embed-' + LP_DATA.id;
    wrapper.className = 'lpcats-embed';

    // === プログレスバー（Stories風） ===
    var progressBar = document.createElement('div');
    progressBar.className = 'lpcats-progress';
    steps.forEach(function(_, i) {
        var seg = document.createElement('div');
        seg.className = 'lpcats-progress-seg' + (i === 0 ? ' active' : '');
        progressBar.appendChild(seg);
    });
    wrapper.appendChild(progressBar);

    var container = document.createElement('div');
    container.className = 'lpcats-container';
    container.dataset.direction = LP_DATA.direction || 'vertical';

    var currentStep = 0;
    var imgSrcs = [];

    steps.forEach(function(step, index) {
        var stepEl = document.createElement('div');
        stepEl.className = 'lpcats-step';
        stepEl.dataset.stepIndex = index;

        var img = document.createElement('img');
        var imgSrc = step.image || '';
        if (imgSrc && imgSrc.indexOf('http') !== 0 && imgSrc.indexOf('data:') !== 0) {
            imgSrc = BASE_URL + imgSrc;
        }
        imgSrcs.push(imgSrc);
        img.alt = step.fileName || ('Step ' + (index + 1));
        img.draggable = false;
        img.loading = index > 2 ? 'lazy' : 'eager';
        img.addEventListener('load', function() { this.classList.add('loaded'); });
        img.src = imgSrc;

        stepEl.appendChild(img);
        container.appendChild(stepEl);
    });

    wrapper.appendChild(container);

    // === ステップカウンター ===
    var counter = document.createElement('div');
    counter.className = 'lpcats-counter';
    counter.innerHTML = '<span class="lpcats-counter-current">1</span><span class="lpcats-counter-sep"> / </span><span class="lpcats-counter-total">' + steps.length + '</span>';
    wrapper.appendChild(counter);

    // === スワイプヒント ===
    var hint = document.createElement('div');
    hint.className = 'lpcats-hint';
    hint.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span>Swipe</span>';
    wrapper.appendChild(hint);
    var hintTimer = setTimeout(function() { hint.classList.add('visible'); }, 2500);

    // === CTA バー ===
    var ctaBar = null;
    if (hasCta) {
        ctaBar = document.createElement('div');
        ctaBar.className = 'lpcats-cta-bar';
        if (showFromStep > 0) ctaBar.classList.add('lpcats-cta-hidden');

        var ctaBtn = document.createElement('a');
        ctaBtn.className = 'lpcats-cta-button';

        if (LP_DATA.cta.image) {
            var ctaImg = document.createElement('img');
            var ctaImgSrc = LP_DATA.cta.image;
            if (ctaImgSrc.indexOf('http') !== 0 && ctaImgSrc.indexOf('data:') !== 0) ctaImgSrc = BASE_URL + ctaImgSrc;
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
        if (isSafeURL(url)) { ctaBtn.href = url; ctaBtn.target = '_blank'; ctaBtn.rel = 'noopener noreferrer'; }
        else { ctaBtn.href = '#'; }

        // リップルエフェクト
        ctaBtn.addEventListener('click', function(e) {
            var rect = this.getBoundingClientRect();
            var ripple = document.createElement('span');
            ripple.className = 'lpcats-ripple';
            ripple.style.left = (e.clientX - rect.left) + 'px';
            ripple.style.top = (e.clientY - rect.top) + 'px';
            this.appendChild(ripple);
            setTimeout(function() { ripple.remove(); }, 700);
        });

        ctaBar.appendChild(ctaBtn);
        wrapper.appendChild(ctaBar);
    }

    // === インジケーター ===
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

    // ページに挿入
    var currentScript = document.currentScript || (function() { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
    currentScript.parentNode.insertBefore(wrapper, currentScript);

    initSwipe(container, dir);

    // === プリロード ===
    function preloadNext(idx) {
        if (idx + 1 < imgSrcs.length) { var p = new Image(); p.src = imgSrcs[idx + 1]; }
        if (idx + 2 < imgSrcs.length) { var p2 = new Image(); p2.src = imgSrcs[idx + 2]; }
    }
    preloadNext(0);

    function onStepChange(idx) {
        currentStep = idx;
        updateProgress(idx);
        updateIndicator(idx);
        updateCounter(idx);
        updateCtaVisibility(idx);
        preloadNext(idx);
        // ヒント消去
        if (idx > 0 && hint.parentNode) {
            hint.classList.remove('visible');
            hint.classList.add('gone');
            clearTimeout(hintTimer);
        }
    }

    function initSwipe(el, direction) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    var idx = parseInt(entry.target.dataset.stepIndex, 10);
                    if (idx !== currentStep) onStepChange(idx);
                }
            });
        }, { root: el, threshold: 0.5 });
        el.querySelectorAll('.lpcats-step').forEach(function(s) { observer.observe(s); });

        var scrolling = false;
        el.addEventListener('wheel', function(e) {
            if (scrolling) { e.preventDefault(); return; }
            var delta = direction === 'horizontal'
                ? (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)
                : e.deltaY;
            if (Math.abs(delta) < 10) return;
            scrolling = true; e.preventDefault();
            var next = delta > 0 ? Math.min(currentStep + 1, steps.length - 1) : Math.max(currentStep - 1, 0);
            if (next !== currentStep) goToStep(next);
            setTimeout(function() { scrolling = false; }, 600);
        }, { passive: false });
    }

    function goToStep(index) {
        var stepEls = container.querySelectorAll('.lpcats-step');
        if (!stepEls[index]) return;
        var d = container.dataset.direction || 'vertical';
        if (d === 'horizontal') container.scrollTo({ left: container.clientWidth * index, behavior: 'smooth' });
        else container.scrollTo({ top: container.clientHeight * index, behavior: 'smooth' });
    }

    function updateProgress(index) {
        var segs = progressBar.querySelectorAll('.lpcats-progress-seg');
        segs.forEach(function(s, i) {
            s.classList.toggle('active', i === index);
            s.classList.toggle('past', i < index);
        });
    }

    function updateIndicator(index) {
        var dots = indicator.querySelectorAll('.lpcats-dot');
        dots.forEach(function(d, i) { d.classList.toggle('active', i === index); });
    }

    function updateCounter(index) {
        var el = counter.querySelector('.lpcats-counter-current');
        if (el) { el.style.opacity = '0'; setTimeout(function() { el.textContent = index + 1; el.style.opacity = '1'; }, 150); }
    }

    function updateCtaVisibility(index) {
        if (!ctaBar) return;
        if (index >= showFromStep) ctaBar.classList.remove('lpcats-cta-hidden');
        else ctaBar.classList.add('lpcats-cta-hidden');
    }

    function isSafeURL(u) { if (!u) return false; try { var p = new URL(u); return ['http:','https:','tel:','mailto:'].indexOf(p.protocol) !== -1; } catch(e) { return false; } }

    function getLPCatsCSS() {
        return '' +
        '*{margin:0;padding:0;box-sizing:border-box}' +
        'body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
        '@keyframes lpcats-img-in{from{opacity:0;transform:scale(1.01)}to{opacity:1;transform:scale(1)}}' +
        '@keyframes lpcats-skeleton{0%{opacity:.12}50%{opacity:.05}100%{opacity:.12}}' +
        '@keyframes lpcats-hint-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}' +
        '@keyframes lpcats-hint-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}' +
        '@keyframes lpcats-ripple{to{transform:scale(4);opacity:0}}' +
        '@keyframes lpcats-cta-glow{0%,100%{box-shadow:0 4px 16px rgba(0,0,0,.3)}50%{box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 40px rgba(255,255,255,.03)}}' +

        // Layout
        '.lpcats-embed{position:relative;width:100%;max-width:100vw;height:100vh;height:100dvh;overflow:hidden;display:flex;flex-direction:column}' +
        '.lpcats-container{width:100%;flex:1;min-height:0;overflow-y:scroll;overflow-x:hidden;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior:none;scrollbar-width:none;-ms-overflow-style:none}' +
        '.lpcats-container::-webkit-scrollbar{display:none}' +
        '.lpcats-container[data-direction="horizontal"]{overflow-y:hidden;overflow-x:scroll;scroll-snap-type:x mandatory;display:flex}' +
        '.lpcats-container[data-direction="horizontal"] .lpcats-step{width:100%;flex-shrink:0}' +
        '.lpcats-container[data-direction="horizontal"]{touch-action:pan-x pinch-zoom}' +
        '.lpcats-container[data-direction="vertical"]{touch-action:pan-y pinch-zoom}' +
        '.lpcats-container[data-direction="fullscreen"]{touch-action:pan-y pinch-zoom}' +

        // Steps - フルブリード
        '.lpcats-step{width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;background:#0a0a0a;overflow:hidden;flex-shrink:0;position:relative}' +
        '.lpcats-step::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.03) 0%,transparent 50%);animation:lpcats-skeleton 2s ease-in-out infinite;z-index:0}' +
        '.lpcats-step img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;user-select:none;pointer-events:none;-webkit-user-drag:none;opacity:0}' +
        '.lpcats-step img.loaded{animation:lpcats-img-in .5s cubic-bezier(.4,0,.2,1) forwards}' +

        // Progress bar (Stories風)
        '.lpcats-progress{position:absolute;top:0;left:0;right:0;z-index:10001;display:flex;gap:3px;padding:8px 8px 0;pointer-events:none}' +
        '.lpcats-progress-seg{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.15);transition:background .4s cubic-bezier(.4,0,.2,1)}' +
        '.lpcats-progress-seg.past{background:rgba(255,255,255,.5)}' +
        '.lpcats-progress-seg.active{background:rgba(255,255,255,.95);box-shadow:0 0 8px rgba(255,255,255,.2)}' +

        // Counter
        '.lpcats-counter{position:fixed;bottom:16px;right:16px;z-index:10001;padding:6px 12px;border-radius:20px;background:rgba(0,0,0,.35);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-size:12px;font-weight:600;color:rgba(255,255,255,.7);pointer-events:none;font-variant-numeric:tabular-nums}' +
        '.lpcats-counter-current{display:inline-block;transition:opacity .15s ease;color:rgba(255,255,255,.95)}' +
        '.lpcats-counter-sep{opacity:.4}' +

        // Swipe hint
        '.lpcats-hint{position:fixed;bottom:25%;left:50%;transform:translateX(-50%);z-index:10001;display:flex;flex-direction:column;align-items:center;gap:6px;color:rgba(255,255,255,.6);font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;pointer-events:none;opacity:0;transition:opacity .5s ease}' +
        '.lpcats-hint.visible{opacity:1;animation:lpcats-hint-float 2s ease-in-out infinite}' +
        '.lpcats-hint.gone{opacity:0!important;transition:opacity .3s ease}' +

        // CTA bar
        '.lpcats-cta-bar{width:100%;height:20vh;height:20dvh;background:linear-gradient(180deg,#0d0d0d 0%,#111 50%,#0d0d0d 100%);display:flex;align-items:center;justify-content:center;padding:10px 20px calc(10px + env(safe-area-inset-bottom,0px));flex-shrink:0;transition:height .5s cubic-bezier(.34,1.56,.64,1),padding .4s ease,opacity .3s ease;overflow:hidden;border-top:1px solid rgba(255,255,255,.06)}' +
        '.lpcats-cta-hidden{height:0!important;padding:0!important;opacity:0;pointer-events:none;border-top-color:transparent}' +
        '.lpcats-cta-button{position:relative;display:block;width:100%;max-width:600px;padding:18px 24px;border:none;border-radius:16px;font-family:inherit;font-size:17px;font-weight:800;letter-spacing:.3px;text-align:center;text-decoration:none;cursor:pointer;overflow:hidden;animation:lpcats-cta-glow 3s ease-in-out infinite;will-change:box-shadow;transition:transform .15s cubic-bezier(.4,0,.2,1)}' +
        '.lpcats-cta-button:active{animation:none;transform:scale(.96)}' +
        '.lpcats-cta-image{width:100%;height:auto;border-radius:14px;display:block}' +
        '.lpcats-ripple{position:absolute;width:100px;height:100px;margin:-50px 0 0 -50px;border-radius:50%;background:rgba(255,255,255,.2);pointer-events:none;animation:lpcats-ripple .7s cubic-bezier(.4,0,.2,1) forwards}' +

        // Indicator
        '.lpcats-indicator{position:fixed;z-index:10001;display:flex;gap:6px;pointer-events:auto;padding:8px;border-radius:20px;background:rgba(0,0,0,.25);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}' +
        '.lpcats-indicator[data-direction="vertical"]{right:10px;top:40%;transform:translateY(-50%);flex-direction:column}' +
        '.lpcats-indicator[data-direction="horizontal"]{top:14px;left:50%;transform:translateX(-50%);flex-direction:row}' +
        '.lpcats-indicator[data-direction="fullscreen"]{right:10px;top:40%;transform:translateY(-50%);flex-direction:column}' +
        '.lpcats-dot{width:5px;height:5px;border-radius:3px;background:rgba(255,255,255,.25);cursor:pointer;transition:all .35s cubic-bezier(.4,0,.2,1)}' +
        '.lpcats-dot:hover{background:rgba(255,255,255,.5)}' +
        '.lpcats-dot.active{background:rgba(255,255,255,.95);box-shadow:0 0 6px rgba(255,255,255,.25)}' +
        '.lpcats-indicator[data-direction="vertical"] .lpcats-dot.active,.lpcats-indicator[data-direction="fullscreen"] .lpcats-dot.active{height:22px}' +
        '.lpcats-indicator[data-direction="horizontal"] .lpcats-dot.active{width:22px}' +

        '@media(min-width:768px){.lpcats-embed{align-items:center}.lpcats-container{width:375px}.lpcats-container[data-direction="horizontal"] .lpcats-step{width:375px}.lpcats-cta-bar{width:375px}.lpcats-progress{max-width:375px;left:50%;right:auto;transform:translateX(-50%)}}';
    }
})();
JS;
