/**
 * LPcats - LP表示アプリケーション
 * PHP API経由・ファイルパス参照
 */
window.LPCats = window.LPCats || {};

window.LPCats.ViewerApp = (function () {
    var _lp = null;

    function init() {
        var params = new URLSearchParams(window.location.search);
        var lpId = params.get('id');

        if (!lpId) {
            _showError('LP IDが指定されていません');
            return;
        }

        console.log('[ViewerApp] init, lpId:', lpId);
        window.LPCats.Store.getLP(lpId)
            .then(function (lp) {
                _lp = lp;
                console.log('[ViewerApp] LP loaded', { id: lp.id, title: lp.title, direction: lp.direction, steps: lp.steps.length });

                if (_lp.steps.length === 0) {
                    console.log('[ViewerApp] no steps, showing empty');
                    _showEmpty();
                    return;
                }

                document.body.dataset.direction = _lp.direction;
                console.log('[ViewerApp] rendering, direction:', _lp.direction);
                _render();
            })
            .catch(function (err) {
                console.error('[ViewerApp] LP load failed', err);
                _showError('LPの読み込みに失敗しました: ' + err.message);
            });
    }

    function _render() {
        var wrapper = document.getElementById('lp-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'lp-wrapper';
            wrapper.className = 'lp-wrapper';
            document.body.appendChild(wrapper);
        }

        // コンテナ
        var container = document.createElement('div');
        container.className = 'lp-container';
        container.dataset.direction = _lp.direction;

        // ステップをソート
        var sortedSteps = _lp.steps.slice().sort(function (a, b) {
            return a.order - b.order;
        });

        // ステップDOM構築
        sortedSteps.forEach(function (step, index) {
            var stepEl = document.createElement('div');
            stepEl.className = 'lp-step';
            stepEl.dataset.stepIndex = index;
            stepEl.dataset.stepId = step.id;

            var img = document.createElement('img');
            img.alt = step.fileName || ('ステップ ' + (index + 1));
            img.draggable = false;
            img.addEventListener('load', function () {
                this.classList.add('loaded');
                console.log('[ViewerApp] image loaded', { step: index, src: this.src.substring(0, 60) });
            });
            if (step.image) {
                img.src = step.image;
            }

            stepEl.appendChild(img);
            container.appendChild(stepEl);
        });

        wrapper.appendChild(container);

        // CTA
        if (_lp.cta && _lp.cta.text) {
            _renderCTA();
        }

        // スワイプエンジン初期化
        window.LPCats.SwipeEngine.init(container, {
            onStepChange: function (index) {
                // 将来の分析機能用フック
            }
        });
    }

    function _renderCTA() {
        var ctaBar = document.createElement('div');
        ctaBar.className = 'cta-bar';

        var ctaBtn = document.createElement('a');
        ctaBtn.className = 'cta-button';

        if (_lp.cta.image) {
            var ctaImg = document.createElement('img');
            ctaImg.src = _lp.cta.image;
            ctaImg.alt = _lp.cta.text || 'CTA';
            ctaImg.style.width = '100%';
            ctaImg.style.height = 'auto';
            ctaImg.style.borderRadius = '12px';
            ctaBtn.appendChild(ctaImg);
        } else {
            ctaBtn.textContent = _lp.cta.text;
            ctaBtn.style.backgroundColor = _lp.cta.bgColor || '#FF6B35';
            ctaBtn.style.color = _lp.cta.textColor || '#FFFFFF';
        }

        var safeUrl = _isSafeURL(_lp.cta.url) ? _lp.cta.url : '#';
        ctaBtn.href = safeUrl;
        if (safeUrl && safeUrl !== '#') {
            ctaBtn.target = '_blank';
            ctaBtn.rel = 'noopener noreferrer';
        }

        ctaBar.appendChild(ctaBtn);

        var wrapper = document.getElementById('lp-wrapper') || document.body;
        wrapper.appendChild(ctaBar);
    }

    function _isSafeURL(url) {
        if (!url) return false;
        try {
            var parsed = new URL(url);
            return ['http:', 'https:', 'tel:', 'mailto:'].indexOf(parsed.protocol) !== -1;
        } catch (e) {
            return false;
        }
    }

    function _showError(message) {
        document.body.innerHTML = '<div class="lp-empty">' +
            '<div class="lp-empty-icon">&#9888;</div>' +
            '<div class="lp-empty-text">' + window.LPCats.Utils.sanitizeText(message) + '</div>' +
            '</div>';
    }

    function _showEmpty() {
        document.body.innerHTML = '<div class="lp-empty">' +
            '<div class="lp-empty-icon">&#128196;</div>' +
            '<div class="lp-empty-text">ステップが追加されていません</div>' +
            '</div>';
    }

    return {
        init: init
    };
})();

// 起動
document.addEventListener('DOMContentLoaded', function () {
    window.LPCats.ViewerApp.init();
});
