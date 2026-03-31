/**
 * LPcats - ユーティリティ
 */
window.LPCats = window.LPCats || {};

window.LPCats.Utils = (function () {
    function generateId(prefix) {
        return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function sanitizeText(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function isSafeURL(url) {
        if (!url) return false;
        try {
            var parsed = new URL(url);
            return ['http:', 'https:', 'tel:', 'mailto:'].indexOf(parsed.protocol) !== -1;
        } catch (e) {
            return false;
        }
    }

    function debounce(fn, delay) {
        var timer = null;
        return function () {
            var args = arguments;
            var ctx = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
        };
    }

    return {
        generateId: generateId,
        sanitizeText: sanitizeText,
        isSafeURL: isSafeURL,
        debounce: debounce
    };
})();
