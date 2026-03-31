/**
 * LPcats - スワイプエンジン
 * CSS scroll-snap をメインに、JSは補助のみ
 */
window.LPCats = window.LPCats || {};

window.LPCats.SwipeEngine = (function () {
    var _container = null;
    var _observer = null;
    var _currentIndex = 0;
    var _totalSteps = 0;
    var _onStepChange = null;
    var _keydownHandler = null;
    var _wheelHandler = null;

    function init(container, options) {
        options = options || {};
        _container = container;
        _totalSteps = container.querySelectorAll('.lp-step').length;
        _currentIndex = 0;
        _onStepChange = options.onStepChange || function () {};

        console.log('[SwipeEngine] init', { direction: container.dataset.direction, totalSteps: _totalSteps, containerSize: container.clientWidth + 'x' + container.clientHeight });

        _setupObserver();
        _enhanceWheelBehavior();
        _setupKeyboard();
        _createIndicator();
        _updateIndicator(0);

        _onStepChange(0);
    }

    function _setupObserver() {
        if (_observer) _observer.disconnect();

        _observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                        var index = parseInt(entry.target.dataset.stepIndex, 10);
                        console.log('[SwipeEngine] step visible', { index: index, ratio: entry.intersectionRatio });
                        if (index !== _currentIndex) {
                            _currentIndex = index;
                            _updateIndicator(index);
                            _onStepChange(index);
                            console.log('[SwipeEngine] step changed to', index);
                        }
                    }
                });
            },
            { root: _container, threshold: 0.5 }
        );

        _container.querySelectorAll('.lp-step').forEach(function (step) {
            _observer.observe(step);
        });
    }

    function _enhanceWheelBehavior() {
        if (_wheelHandler && _container) {
            _container.removeEventListener('wheel', _wheelHandler);
        }
        var isScrolling = false;

        _wheelHandler = function (e) {
            if (isScrolling) { e.preventDefault(); return; }

            var direction = _container.dataset.direction || 'vertical';

            // 横スワイプ時は縦ホイールを横方向として解釈
            var delta;
            if (direction === 'horizontal') {
                delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            } else {
                delta = e.deltaY;
            }

            if (Math.abs(delta) < 10) return;

            e.preventDefault();

            var nextIndex = delta > 0
                ? Math.min(_currentIndex + 1, _totalSteps - 1)
                : Math.max(_currentIndex - 1, 0);

            console.log('[SwipeEngine] wheel', { direction: direction, delta: delta, current: _currentIndex, next: nextIndex });

            if (nextIndex !== _currentIndex) {
                isScrolling = true;
                _scrollToStep(nextIndex);
                setTimeout(function () { isScrolling = false; }, 800);
            }
        };
        _container.addEventListener('wheel', _wheelHandler, { passive: false });
    }

    function _setupKeyboard() {
        if (_keydownHandler) {
            document.removeEventListener('keydown', _keydownHandler);
        }
        _keydownHandler = function (e) {
            var direction = _container ? _container.dataset.direction : 'vertical';
            var prev = direction === 'vertical'
                ? (e.key === 'ArrowUp')
                : (e.key === 'ArrowLeft');
            var next = direction === 'vertical'
                ? (e.key === 'ArrowDown')
                : (e.key === 'ArrowRight');

            if (prev) {
                e.preventDefault();
                goTo(Math.max(0, _currentIndex - 1));
            } else if (next) {
                e.preventDefault();
                goTo(Math.min(_totalSteps - 1, _currentIndex + 1));
            }
        };
        document.addEventListener('keydown', _keydownHandler);
    }

    function _scrollToStep(index) {
        var steps = _container.querySelectorAll('.lp-step');
        if (!steps[index]) return;
        console.log('[SwipeEngine] scrollToStep', index);

        var direction = _container.dataset.direction || 'vertical';

        if (direction === 'horizontal') {
            // 横スクロール: container.scrollToで直接制御（scrollIntoViewはページ全体に影響する）
            var stepWidth = _container.clientWidth;
            _container.scrollTo({ left: stepWidth * index, behavior: 'smooth' });
        } else {
            // 縦/全画面: container.scrollToで直接制御
            var stepHeight = _container.clientHeight;
            _container.scrollTo({ top: stepHeight * index, behavior: 'smooth' });
        }
    }

    function _createIndicator() {
        var existing = document.querySelector('.lp-indicator');
        if (existing) existing.remove();

        var indicator = document.createElement('div');
        indicator.className = 'lp-indicator';

        for (var i = 0; i < _totalSteps; i++) {
            var dot = document.createElement('div');
            dot.className = 'indicator-dot';
            dot.dataset.index = i;
            dot.addEventListener('click', function () {
                goTo(parseInt(this.dataset.index, 10));
            });
            indicator.appendChild(dot);
        }

        document.body.appendChild(indicator);
    }

    function _updateIndicator(index) {
        var dots = document.querySelectorAll('.indicator-dot');
        dots.forEach(function (dot, i) {
            dot.classList.toggle('active', i === index);
        });
    }

    function goTo(index) {
        if (index < 0 || index >= _totalSteps) return;
        _scrollToStep(index);
    }

    function getCurrentIndex() {
        return _currentIndex;
    }

    function destroy() {
        if (_observer) {
            _observer.disconnect();
            _observer = null;
        }
        if (_keydownHandler) {
            document.removeEventListener('keydown', _keydownHandler);
            _keydownHandler = null;
        }
        if (_wheelHandler && _container) {
            _container.removeEventListener('wheel', _wheelHandler);
            _wheelHandler = null;
        }
        var indicator = document.querySelector('.lp-indicator');
        if (indicator) indicator.remove();
        _container = null;
    }

    return {
        init: init,
        goTo: goTo,
        getCurrentIndex: getCurrentIndex,
        destroy: destroy
    };
})();
