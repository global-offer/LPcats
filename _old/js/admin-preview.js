/**
 * LPcats - プレビュー機能
 * Promise対応
 */
window.LPCats = window.LPCats || {};

window.LPCats.AdminPreview = (function () {
    var _modal = null;

    function openPreview(lpId) {
        window.LPCats.Store.getLP(lpId).then(function (lp) {
            if (!lp || lp.steps.length === 0) {
                alert('ステップを追加してからプレビューしてください');
                return;
            }
            _createModal(lpId);
        }).catch(function () {
            alert('LPの読み込みに失敗しました');
        });
    }

    function openInNewTab(lpId) {
        window.LPCats.Store.getLP(lpId).then(function (lp) {
            if (!lp || lp.steps.length === 0) {
                alert('ステップを追加してからプレビューしてください');
                return;
            }
            window.open('viewer.html?id=' + encodeURIComponent(lpId), '_blank');
        }).catch(function () {
            alert('LPの読み込みに失敗しました');
        });
    }

    function _createModal(lpId) {
        closePreview();

        _modal = document.createElement('div');
        _modal.className = 'preview-modal';
        _modal.innerHTML =
            '<div class="preview-modal__backdrop"></div>' +
            '<div class="preview-modal__content">' +
                '<div class="preview-modal__header">' +
                    '<span class="preview-modal__title">LP プレビュー</span>' +
                    '<div class="preview-modal__actions">' +
                        '<button class="btn btn-sm btn-secondary" id="preview-new-tab">新しいタブで開く</button>' +
                        '<button class="btn btn-sm btn-secondary" id="preview-close">&#10005; 閉じる</button>' +
                    '</div>' +
                '</div>' +
                '<div class="preview-modal__frame-wrapper">' +
                    '<div class="preview-modal__device-frame">' +
                        '<iframe src="viewer.html?id=' + encodeURIComponent(lpId) + '" class="preview-modal__iframe"></iframe>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(_modal);

        document.getElementById('preview-close').addEventListener('click', closePreview);

        document.getElementById('preview-new-tab').addEventListener('click', function () {
            openInNewTab(lpId);
        });

        _modal.querySelector('.preview-modal__backdrop').addEventListener('click', closePreview);

        document.addEventListener('keydown', _onKeyDown);

        requestAnimationFrame(function () {
            _modal.classList.add('preview-modal--visible');
        });
    }

    function closePreview() {
        if (!_modal) return;
        document.removeEventListener('keydown', _onKeyDown);
        _modal.classList.remove('preview-modal--visible');
        setTimeout(function () {
            if (_modal && _modal.parentNode) {
                _modal.parentNode.removeChild(_modal);
            }
            _modal = null;
        }, 200);
    }

    function _onKeyDown(e) {
        if (e.key === 'Escape') closePreview();
    }

    return {
        openPreview: openPreview,
        openInNewTab: openInNewTab,
        closePreview: closePreview
    };
})();
