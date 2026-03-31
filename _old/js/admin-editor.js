/**
 * LPcats - ステップエディター（画像アップロード、D&D並べ替え、削除）
 * PHP API経由・ファイルパス参照
 */
window.LPCats = window.LPCats || {};

window.LPCats.AdminEditor = (function () {
    var _lpId = null;
    var _dragState = null;

    function init(lpId) {
        _lpId = lpId;
        _setupDropZone();
        _setupFileInput();
        renderSteps();
    }

    function _setupDropZone() {
        var dropZone = document.getElementById('drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(function (evt) {
            dropZone.addEventListener(evt, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drop-zone--active');
            });
        });

        ['dragleave', 'drop'].forEach(function (evt) {
            dropZone.addEventListener(evt, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drop-zone--active');
            });
        });

        dropZone.addEventListener('drop', function (e) {
            _handleFiles(e.dataTransfer.files);
        });

        dropZone.addEventListener('click', function () {
            document.getElementById('file-input').click();
        });
    }

    function _setupFileInput() {
        var input = document.getElementById('file-input');
        if (!input) return;

        input.addEventListener('change', function (e) {
            _handleFiles(e.target.files);
            e.target.value = '';
        });
    }

    function _handleFiles(fileList) {
        var files = Array.from(fileList).filter(function (f) {
            return f.type.startsWith('image/');
        });

        if (files.length === 0) {
            _toast('画像ファイルを選択してください', 'error');
            return;
        }

        var processed = 0;
        var total = files.length;
        _showProgress(0, total);

        files.forEach(function (file) {
            if (file.size > 5 * 1024 * 1024) {
                _toast(file.name + ': 5MB以下にしてください', 'error');
                processed++;
                _showProgress(processed, total);
                if (processed === total) { _hideProgress(); renderSteps(); }
                return;
            }

            // FormData + fetch でサーバーにアップロード
            window.LPCats.Store.uploadImage(file)
                .then(function (result) {
                    // アップロード成功 → ステップ追加（ファイルパスを格納）
                    return window.LPCats.Store.addStep(_lpId, result.path, result.fileName || file.name);
                })
                .then(function () {
                    // 成功
                })
                .catch(function (err) {
                    _toast(file.name + ': ' + err.message, 'error');
                })
                .finally(function () {
                    processed++;
                    _showProgress(processed, total);
                    if (processed === total) {
                        _hideProgress();
                        renderSteps();
                    }
                });
        });
    }

    function renderSteps() {
        var list = document.getElementById('step-list');
        if (!list) return;

        window.LPCats.Store.getLP(_lpId).then(function (lp) {
            if (!lp) return;

            var sortedSteps = lp.steps.slice().sort(function (a, b) {
                return a.order - b.order;
            });

            if (sortedSteps.length === 0) {
                list.innerHTML = '<div class="step-list-empty">' +
                    '<p>画像をアップロードしてステップを追加</p>' +
                    '</div>';
                return;
            }

            list.innerHTML = '';
            var totalSteps = sortedSteps.length;
            sortedSteps.forEach(function (step, index) {
                var item = _createStepItem(step, index, totalSteps);
                list.appendChild(item);
            });

            _setupDragAndDrop(list);
        }).catch(function (err) {
            _toast('ステップの読み込みに失敗: ' + err.message, 'error');
        });
    }

    function _createStepItem(step, index, totalSteps) {
        var item = document.createElement('div');
        item.className = 'step-item';
        item.dataset.stepId = step.id;
        item.dataset.order = index;

        // DOM APIで構築（XSS防止）
        var handle = document.createElement('div');
        handle.className = 'step-item__handle';
        handle.title = 'ドラッグで並べ替え';
        handle.innerHTML = '&#9776;';

        var number = document.createElement('div');
        number.className = 'step-item__number';
        number.textContent = index + 1;

        var thumbWrap = document.createElement('div');
        thumbWrap.className = 'step-item__thumb';
        var thumbImg = document.createElement('img');
        thumbImg.src = step.image || '';
        thumbImg.alt = step.fileName || '';
        thumbWrap.appendChild(thumbImg);

        var info = document.createElement('div');
        info.className = 'step-item__info';
        var nameEl = document.createElement('div');
        nameEl.className = 'step-item__name';
        nameEl.textContent = step.fileName || '';
        info.appendChild(nameEl);

        var actions = document.createElement('div');
        actions.className = 'step-item__actions';
        actions.innerHTML =
            '<button class="btn btn-sm btn-secondary step-move-up" title="上へ" ' + (index === 0 ? 'disabled' : '') + '>&#9650;</button>' +
            '<button class="btn btn-sm btn-secondary step-move-down" title="下へ" ' + (index === totalSteps - 1 ? 'disabled' : '') + '>&#9660;</button>' +
            '<button class="btn btn-sm btn-danger step-delete" title="削除">&#10005;</button>';

        item.appendChild(handle);
        item.appendChild(number);
        item.appendChild(thumbWrap);
        item.appendChild(info);
        item.appendChild(actions);

        // 上へ
        actions.querySelector('.step-move-up').addEventListener('click', function () {
            _moveStep(step.id, -1);
        });

        // 下へ
        actions.querySelector('.step-move-down').addEventListener('click', function () {
            _moveStep(step.id, 1);
        });

        // 削除
        actions.querySelector('.step-delete').addEventListener('click', function () {
            if (confirm('ステップ ' + (index + 1) + ' を削除しますか？')) {
                window.LPCats.Store.removeStep(_lpId, step.id)
                    .then(function () {
                        renderSteps();
                        _toast('ステップを削除しました', 'success');
                    })
                    .catch(function (err) {
                        _toast('削除に失敗: ' + err.message, 'error');
                    });
            }
        });

        return item;
    }

    function _moveStep(stepId, direction) {
        window.LPCats.Store.getLP(_lpId).then(function (lp) {
            if (!lp) return;

            var sorted = lp.steps.slice().sort(function (a, b) { return a.order - b.order; });
            var ids = sorted.map(function (s) { return s.id; });
            var idx = ids.indexOf(stepId);
            var newIdx = idx + direction;

            if (newIdx < 0 || newIdx >= ids.length) return;

            var tmp = ids[idx];
            ids[idx] = ids[newIdx];
            ids[newIdx] = tmp;

            return window.LPCats.Store.reorderSteps(_lpId, ids);
        }).then(function () {
            renderSteps();
        }).catch(function (err) {
            _toast('並べ替えに失敗: ' + err.message, 'error');
        });
    }

    function _setupDragAndDrop(list) {
        var items = list.querySelectorAll('.step-item');

        items.forEach(function (item) {
            var handle = item.querySelector('.step-item__handle');

            handle.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                _dragStart(item, list, e);
            });
        });
    }

    function _dragStart(item, list, startEvent) {
        var items = Array.from(list.querySelectorAll('.step-item'));
        var startY = startEvent.clientY;

        item.classList.add('step-item--dragging');
        item.style.zIndex = '100';

        _dragState = { item: item, list: list, startY: startY };

        var onMove = function (e) {
            var deltaY = e.clientY - startY;
            item.style.transform = 'translateY(' + deltaY + 'px)';

            items.forEach(function (other) {
                if (other === item) return;
                var otherRect = other.getBoundingClientRect();
                var otherMid = otherRect.top + otherRect.height / 2;
                other.classList.toggle('step-item--insert-above', e.clientY < otherMid && e.clientY > otherRect.top - 10);
                other.classList.toggle('step-item--insert-below', e.clientY > otherMid && e.clientY < otherRect.bottom + 10);
            });
        };

        var onUp = function (e) {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);

            item.classList.remove('step-item--dragging');
            item.style.transform = '';
            item.style.zIndex = '';

            items.forEach(function (other) {
                other.classList.remove('step-item--insert-above', 'step-item--insert-below');
            });

            var finalY = e.clientY;
            var newOrder = [];
            var draggedId = item.dataset.stepId;

            var positions = items.filter(function (i) { return i !== item; }).map(function (i) {
                var r = i.getBoundingClientRect();
                return { id: i.dataset.stepId, midY: r.top + r.height / 2 };
            });

            var inserted = false;
            positions.forEach(function (pos) {
                if (!inserted && finalY < pos.midY) {
                    newOrder.push(draggedId);
                    inserted = true;
                }
                newOrder.push(pos.id);
            });
            if (!inserted) newOrder.push(draggedId);

            window.LPCats.Store.reorderSteps(_lpId, newOrder)
                .then(function () { renderSteps(); })
                .catch(function (err) { _toast('並べ替えに失敗: ' + err.message, 'error'); });

            _dragState = null;
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }

    function _showProgress(current, total) {
        var el = document.getElementById('upload-progress');
        if (!el) return;
        el.style.display = 'block';
        el.textContent = 'アップロード中... ' + current + ' / ' + total;
    }

    function _hideProgress() {
        var el = document.getElementById('upload-progress');
        if (el) el.style.display = 'none';
    }

    function _toast(message, type) {
        if (window.LPCats.AdminApp && window.LPCats.AdminApp.toast) {
            window.LPCats.AdminApp.toast(message, type);
        } else {
            alert(message);
        }
    }

    return {
        init: init,
        renderSteps: renderSteps
    };
})();
