/**
 * LPcats - データストア (PHP API経由)
 * 全メソッドがPromiseを返す非同期設計
 */
window.LPCats = window.LPCats || {};

window.LPCats.Store = (function () {
    var API_BASE = 'api/';

    function _fetch(url, options) {
        console.log('[Store] fetch', url, options ? options.method : 'GET');
        return fetch(url, options).then(function (res) {
            console.log('[Store] response', url, res.status);
            if (!res.ok) {
                return res.text().then(function (text) {
                    console.error('[Store] API error', url, res.status, text);
                    try {
                        var err = JSON.parse(text);
                        throw new Error(err.error || 'APIエラー (' + res.status + ')');
                    } catch (e) {
                        if (e.message.indexOf('APIエラー') !== -1) throw e;
                        throw new Error('APIエラー (' + res.status + '): ' + text.substring(0, 100));
                    }
                });
            }
            return res.json();
        }).catch(function (err) {
            console.error('[Store] fetch failed', url, err.message);
            throw err;
        });
    }

    function _postJSON(endpoint, data) {
        return _fetch(API_BASE + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }

    function getAllLPs() {
        return _fetch(API_BASE + 'load.php?action=list');
    }

    function getLP(id) {
        return _fetch(API_BASE + 'load.php?action=get&id=' + encodeURIComponent(id));
    }

    function createLP(title) {
        var id = window.LPCats.Utils.generateId('lp');
        var now = new Date().toISOString();
        var lp = {
            id: id,
            title: title || '新規LP',
            direction: 'vertical',
            cta: {
                text: '今すぐ申し込む',
                url: 'https://example.com',
                bgColor: '#FF6B35',
                textColor: '#FFFFFF'
            },
            steps: [],
            createdAt: now,
            updatedAt: now
        };
        return _postJSON('save.php', lp).then(function (result) {
            return result.lp || lp;
        });
    }

    function saveLP(lp) {
        if (!_validateLP(lp)) {
            return Promise.reject(new Error('LPデータが不正です'));
        }
        lp.updatedAt = new Date().toISOString();
        return _postJSON('save.php', lp).then(function (result) {
            return result.lp || lp;
        });
    }

    function deleteLP(id) {
        return _postJSON('save.php', { id: id, _delete: true });
    }

    function addStep(lpId, imagePath, fileName) {
        return getLP(lpId).then(function (lp) {
            if (!lp) throw new Error('LPが見つかりません');
            if (lp.steps.length >= 20) throw new Error('ステップは最大20枚までです');

            var step = {
                id: window.LPCats.Utils.generateId('step'),
                order: lp.steps.length,
                image: imagePath,
                fileName: fileName || 'image.jpg',
                createdAt: new Date().toISOString()
            };
            lp.steps.push(step);
            return saveLP(lp);
        });
    }

    function removeStep(lpId, stepId) {
        return getLP(lpId).then(function (lp) {
            if (!lp) throw new Error('LPが見つかりません');

            lp.steps = lp.steps.filter(function (s) { return s.id !== stepId; });
            lp.steps.forEach(function (s, i) { s.order = i; });
            return saveLP(lp);
        });
    }

    function reorderSteps(lpId, stepIds) {
        return getLP(lpId).then(function (lp) {
            if (!lp) throw new Error('LPが見つかりません');

            var stepMap = {};
            lp.steps.forEach(function (s) { stepMap[s.id] = s; });

            lp.steps = stepIds.map(function (id, i) {
                var step = stepMap[id];
                if (!step) return null;
                step.order = i;
                return step;
            }).filter(Boolean);

            return saveLP(lp);
        });
    }

    function uploadImage(file) {
        var formData = new FormData();
        formData.append('image', file);

        return fetch(API_BASE + 'upload.php', {
            method: 'POST',
            body: formData
        }).then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.error || 'アップロードエラー');
                });
            }
            return res.json();
        });
    }

    function getAnalytics(lpId) {
        return _fetch(API_BASE + 'analytics.php?id=' + encodeURIComponent(lpId));
    }

    function _validateLP(lp) {
        if (!lp || !lp.id) return false;
        if (!['vertical', 'horizontal', 'fullscreen'].includes(lp.direction)) return false;
        if (!Array.isArray(lp.steps)) return false;
        if (!lp.cta) return false;
        return true;
    }

    return {
        createLP: createLP,
        getAllLPs: getAllLPs,
        getLP: getLP,
        saveLP: saveLP,
        deleteLP: deleteLP,
        addStep: addStep,
        removeStep: removeStep,
        reorderSteps: reorderSteps,
        uploadImage: uploadImage,
        getAnalytics: getAnalytics
    };
})();
