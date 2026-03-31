/**
 * LPcats - 管理画面メインアプリケーション
 * PHP API経由・Promise対応
 * 機能: LP管理、埋め込みタグ、分析ダッシュボード、全画面モード、CTA画像、ABテスト
 */
window.LPCats = window.LPCats || {};

window.LPCats.AdminApp = (function () {
    var _currentLP = null;
    var _toastContainer = null;

    function init() {
        console.log('[AdminApp] init');
        _createToastContainer();

        var params = new URLSearchParams(window.location.search);
        var lpId = params.get('id');
        var tab = params.get('tab');
        console.log('[AdminApp] params', { lpId: lpId, tab: tab });

        if (lpId) {
            window.LPCats.Store.getLP(lpId)
                .then(function (lp) {
                    _currentLP = lp;
                    if (tab === 'analytics') {
                        _showAnalytics(lp);
                    } else if (tab === 'embed') {
                        _showEmbed(lp);
                    } else {
                        _showEditor();
                    }
                })
                .catch(function () {
                    toast('LPが見つかりません', 'error');
                    _showList();
                });
        } else {
            _showList();
        }
    }

    // === LP一覧 ===
    function _showList() {
        var app = document.getElementById('app');
        app.innerHTML = '<div class="loading">読み込み中...</div>';

        window.LPCats.Store.getAllLPs().then(function (lps) {
            var html = '<div class="admin-header">' +
                '<h1 class="admin-title">LPcats</h1>' +
                '<p class="admin-subtitle">スワイプ型LP作成ツール</p>' +
                '</div>' +
                '<div class="admin-toolbar">' +
                    '<button class="btn btn-primary btn-lg" id="btn-create-lp">+ 新規LP作成</button>' +
                '</div>';

            if (lps.length === 0) {
                html += '<div class="empty-state card">' +
                    '<div class="empty-state__icon">&#128196;</div>' +
                    '<h3>LPがまだありません</h3>' +
                    '<p>「新規LP作成」ボタンでスワイプ型LPを作成しましょう</p>' +
                    '</div>';
            } else {
                html += '<div class="lp-grid">';
                lps.forEach(function (lp) {
                    var dirLabels = { vertical: '縦スワイプ', horizontal: '横スワイプ', fullscreen: '全画面' };
                    var dirLabel = dirLabels[lp.direction] || '縦スワイプ';
                    var date = new Date(lp.updatedAt).toLocaleDateString('ja-JP');

                    html += '<div class="lp-card card" data-lp-id="' + lp.id + '">' +
                        '<div class="lp-card__thumb" data-lp-id="' + lp.id + '"></div>' +
                        '<div class="lp-card__body">' +
                            '<h3 class="lp-card__title">' + window.LPCats.Utils.sanitizeText(lp.title) + '</h3>' +
                            '<div class="lp-card__meta">' +
                                '<span>' + dirLabel + '</span>' +
                                '<span>' + lp.steps.length + 'ステップ</span>' +
                                '<span>' + date + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="lp-card__actions">' +
                            '<button class="btn btn-sm btn-primary lp-edit">編集</button>' +
                            '<button class="btn btn-sm btn-secondary lp-analytics">分析</button>' +
                            '<button class="btn btn-sm btn-secondary lp-preview">プレビュー</button>' +
                            '<button class="btn btn-sm btn-danger lp-delete">削除</button>' +
                        '</div>' +
                    '</div>';
                });
                html += '</div>';
            }

            app.innerHTML = html;

            // サムネイル画像をDOM APIで安全に挿入
            lps.forEach(function (lp) {
                var thumbEl = app.querySelector('.lp-card__thumb[data-lp-id="' + lp.id + '"]');
                if (!thumbEl) return;
                if (lp.steps.length > 0 && lp.steps[0].image) {
                    var img = document.createElement('img');
                    img.src = lp.steps[0].image;
                    img.alt = '';
                    thumbEl.appendChild(img);
                } else {
                    thumbEl.innerHTML = '<div class="lp-card__thumb-empty">No Image</div>';
                }
            });

            // イベントバインド
            var createBtn = document.getElementById('btn-create-lp');
            if (createBtn) createBtn.addEventListener('click', _createLP);

            app.querySelectorAll('.lp-edit').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    window.location.search = '?id=' + e.target.closest('.lp-card').dataset.lpId;
                });
            });

            app.querySelectorAll('.lp-analytics').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    window.location.search = '?id=' + e.target.closest('.lp-card').dataset.lpId + '&tab=analytics';
                });
            });

            app.querySelectorAll('.lp-preview').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    window.LPCats.AdminPreview.openInNewTab(e.target.closest('.lp-card').dataset.lpId);
                });
            });

            app.querySelectorAll('.lp-delete').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    var card = e.target.closest('.lp-card');
                    var lpId = card.dataset.lpId;
                    var title = card.querySelector('.lp-card__title').textContent;
                    if (confirm('「' + title + '」を削除しますか？')) {
                        window.LPCats.Store.deleteLP(lpId).then(function () {
                            toast('LPを削除しました', 'success');
                            _showList();
                        }).catch(function (err) { toast('削除に失敗: ' + err.message, 'error'); });
                    }
                });
            });
        }).catch(function (err) {
            app.innerHTML = '<div class="error-state"><h2>読み込みエラー</h2>' +
                '<p>' + window.LPCats.Utils.sanitizeText(err.message) + '</p></div>';
        });
    }

    function _createLP() {
        var title = prompt('LP名を入力してください:', '新規LP');
        if (title === null) return;
        title = title.trim() || '新規LP';
        window.LPCats.Store.createLP(title).then(function (lp) {
            toast('LPを作成しました', 'success');
            window.location.search = '?id=' + lp.id;
        }).catch(function (err) { toast('作成に失敗: ' + err.message, 'error'); });
    }

    // === タブナビゲーション ===
    function _renderTabs(lp, activeTab) {
        return '<div class="admin-header">' +
            '<a href="index.html" class="back-link">&larr; LP一覧に戻る</a>' +
            '<div class="admin-header__title-row">' +
                '<h2 class="lp-title-display">' + window.LPCats.Utils.sanitizeText(lp.title) + '</h2>' +
            '</div>' +
            '<div class="tab-nav">' +
                '<a href="?id=' + lp.id + '" class="tab-nav__item' + (activeTab === 'edit' ? ' active' : '') + '">編集</a>' +
                '<a href="?id=' + lp.id + '&tab=analytics" class="tab-nav__item' + (activeTab === 'analytics' ? ' active' : '') + '">分析</a>' +
                '<a href="?id=' + lp.id + '&tab=embed" class="tab-nav__item' + (activeTab === 'embed' ? ' active' : '') + '">埋め込み</a>' +
            '</div>' +
        '</div>';
    }

    // === LP編集 ===
    function _showEditor() {
        var app = document.getElementById('app');
        var lp = _currentLP;

        var html = _renderTabs(lp, 'edit') +
            '<div class="editor-layout">' +
                '<div class="editor-main">' +
                    '<div class="card">' +
                        '<h3 class="card-title">ステップ管理</h3>' +
                        '<div id="drop-zone" class="drop-zone">' +
                            '<div class="drop-zone__content">' +
                                '<div class="drop-zone__icon">&#128247;</div>' +
                                '<p>画像をドラッグ&ドロップ、またはクリックして選択</p>' +
                                '<p class="drop-zone__hint">JPEG / PNG / WebP（1枚5MB以下、最大20枚）</p>' +
                            '</div>' +
                            '<input type="file" id="file-input" accept="image/jpeg,image/png,image/webp" multiple hidden>' +
                        '</div>' +
                        '<div id="upload-progress" class="upload-progress" style="display:none;"></div>' +
                        '<div id="step-list" class="step-list"></div>' +
                    '</div>' +
                '</div>' +

                '<div class="editor-sidebar">' +
                    // LP名
                    '<div class="card">' +
                        '<h3 class="card-title">LP設定</h3>' +
                        '<div class="form-group">' +
                            '<label class="form-label">LP名</label>' +
                            '<input type="text" id="lp-title" class="form-input" value="' +
                                window.LPCats.Utils.sanitizeText(lp.title) + '">' +
                        '</div>' +
                    '</div>' +

                    // スワイプ方向（全画面追加）
                    '<div class="card">' +
                        '<h3 class="card-title">表示形式</h3>' +
                        '<div class="direction-selector direction-selector--3col">' +
                            '<label class="direction-option">' +
                                '<input type="radio" name="direction" value="vertical"' +
                                    (lp.direction === 'vertical' ? ' checked' : '') + '>' +
                                '<span class="direction-label">' +
                                    '<span class="direction-icon">&#8597;</span>縦<br><small>TikTok風</small>' +
                                '</span>' +
                            '</label>' +
                            '<label class="direction-option">' +
                                '<input type="radio" name="direction" value="horizontal"' +
                                    (lp.direction === 'horizontal' ? ' checked' : '') + '>' +
                                '<span class="direction-label">' +
                                    '<span class="direction-icon">&#8596;</span>横<br><small>Instagram風</small>' +
                                '</span>' +
                            '</label>' +
                            '<label class="direction-option">' +
                                '<input type="radio" name="direction" value="fullscreen"' +
                                    (lp.direction === 'fullscreen' ? ' checked' : '') + '>' +
                                '<span class="direction-label">' +
                                    '<span class="direction-icon">&#9634;</span>全画面<br><small>ECアプリ風</small>' +
                                '</span>' +
                            '</label>' +
                        '</div>' +
                    '</div>' +

                    // CTA設定（画像CTA対応）
                    '<div class="card">' +
                        '<h3 class="card-title">CTA設定</h3>' +
                        '<div class="form-group">' +
                            '<label class="form-label">CTAタイプ</label>' +
                            '<select id="cta-type" class="form-input">' +
                                '<option value="text"' + (!lp.cta.image ? ' selected' : '') + '>テキストボタン</option>' +
                                '<option value="image"' + (lp.cta.image ? ' selected' : '') + '>画像ボタン</option>' +
                            '</select>' +
                        '</div>' +
                        '<div id="cta-text-settings"' + (lp.cta.image ? ' style="display:none"' : '') + '>' +
                            '<div class="form-group">' +
                                '<label class="form-label">ボタンテキスト</label>' +
                                '<input type="text" id="cta-text" class="form-input" value="' +
                                    window.LPCats.Utils.sanitizeText(lp.cta.text) + '" placeholder="今すぐ申し込む">' +
                            '</div>' +
                            '<div class="form-row">' +
                                '<div class="form-group form-group--half">' +
                                    '<label class="form-label">ボタン色</label>' +
                                    '<input type="color" id="cta-bg-color" class="form-color" value="' + (lp.cta.bgColor || '#FF6B35') + '">' +
                                '</div>' +
                                '<div class="form-group form-group--half">' +
                                    '<label class="form-label">文字色</label>' +
                                    '<input type="color" id="cta-text-color" class="form-color" value="' + (lp.cta.textColor || '#FFFFFF') + '">' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div id="cta-image-settings"' + (!lp.cta.image ? ' style="display:none"' : '') + '>' +
                            '<div class="form-group">' +
                                '<label class="form-label">CTA画像（推奨: 750x260px）</label>' +
                                '<div id="cta-image-upload" class="cta-image-upload">' +
                                    (lp.cta.image
                                        ? '<img id="cta-image-preview" src="' + lp.cta.image + '" alt="CTA画像">'
                                        : '<span id="cta-image-placeholder">クリックして画像を選択</span>') +
                                '</div>' +
                                '<input type="file" id="cta-image-input" accept="image/jpeg,image/png,image/webp" hidden>' +
                            '</div>' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label class="form-label">リンク先URL</label>' +
                            '<input type="url" id="cta-url" class="form-input" value="' +
                                window.LPCats.Utils.sanitizeText(lp.cta.url) + '" placeholder="https://example.com">' +
                        '</div>' +
                        '<div class="cta-preview-box">' +
                            '<div id="cta-preview-btn" class="cta-preview-button" ' +
                                'style="background:' + (lp.cta.bgColor || '#FF6B35') + ';color:' + (lp.cta.textColor || '#FFFFFF') + ';">' +
                                window.LPCats.Utils.sanitizeText(lp.cta.text) +
                            '</div>' +
                        '</div>' +
                    '</div>' +

                    // アクション
                    '<div class="card">' +
                        '<button class="btn btn-primary btn-lg" id="btn-preview" style="width:100%;margin-bottom:8px;">&#9654; プレビュー</button>' +
                        '<button class="btn btn-secondary btn-lg" id="btn-preview-tab" style="width:100%;">新しいタブで開く</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        app.innerHTML = html;
        window.LPCats.AdminEditor.init(lp.id);
        _bindEditorEvents(lp);
    }

    function _bindEditorEvents(lp) {
        // タイトル
        document.getElementById('lp-title').addEventListener('change', function () {
            lp.title = this.value.trim() || '無題のLP';
            _saveCurrentLP(lp);
        });

        // 表示形式
        document.querySelectorAll('input[name="direction"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                lp.direction = this.value;
                _saveCurrentLP(lp);
            });
        });

        // CTAタイプ切替
        document.getElementById('cta-type').addEventListener('change', function () {
            var isImage = this.value === 'image';
            document.getElementById('cta-text-settings').style.display = isImage ? 'none' : '';
            document.getElementById('cta-image-settings').style.display = isImage ? '' : 'none';
            if (!isImage) {
                lp.cta.image = '';
                _saveCurrentLP(lp);
            }
        });

        // CTA画像アップロード
        var ctaImageUpload = document.getElementById('cta-image-upload');
        var ctaImageInput = document.getElementById('cta-image-input');
        if (ctaImageUpload) {
            ctaImageUpload.addEventListener('click', function () { ctaImageInput.click(); });
        }
        if (ctaImageInput) {
            ctaImageInput.addEventListener('change', function (e) {
                if (!e.target.files[0]) return;
                window.LPCats.Store.uploadImage(e.target.files[0]).then(function (result) {
                    lp.cta.image = result.path;
                    var preview = document.getElementById('cta-image-preview');
                    var placeholder = document.getElementById('cta-image-placeholder');
                    if (preview) {
                        preview.src = result.path;
                    } else {
                        ctaImageUpload.textContent = '';
                        var newImg = document.createElement('img');
                        newImg.id = 'cta-image-preview';
                        newImg.src = result.path;
                        newImg.alt = 'CTA画像';
                        ctaImageUpload.appendChild(newImg);
                    }
                    _saveCurrentLP(lp);
                    toast('CTA画像をアップロードしました', 'success');
                }).catch(function (err) { toast(err.message, 'error'); });
                e.target.value = '';
            });
        }

        // CTA テキスト設定（デバウンス付き）
        var debouncedSave = window.LPCats.Utils.debounce(function () { _saveCurrentLP(lp); }, 400);
        ['cta-text', 'cta-url', 'cta-bg-color', 'cta-text-color'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', function () {
                lp.cta.text = document.getElementById('cta-text').value;
                var urlInput = document.getElementById('cta-url');
                if (urlInput.value && !window.LPCats.Utils.isSafeURL(urlInput.value)) {
                    urlInput.style.borderColor = 'var(--color-danger)';
                } else {
                    urlInput.style.borderColor = '';
                }
                lp.cta.url = urlInput.value;
                lp.cta.bgColor = document.getElementById('cta-bg-color').value;
                lp.cta.textColor = document.getElementById('cta-text-color').value;
                _updateCTAPreview(lp.cta);
                debouncedSave();
            });
        });

        // プレビュー
        document.getElementById('btn-preview').addEventListener('click', function () {
            window.LPCats.AdminPreview.openPreview(lp.id);
        });
        document.getElementById('btn-preview-tab').addEventListener('click', function () {
            window.LPCats.AdminPreview.openInNewTab(lp.id);
        });
    }

    function _updateCTAPreview(cta) {
        var btn = document.getElementById('cta-preview-btn');
        if (!btn) return;
        btn.textContent = cta.text || 'CTAボタン';
        btn.style.backgroundColor = cta.bgColor;
        btn.style.color = cta.textColor;
    }

    function _saveCurrentLP(lp) {
        window.LPCats.Store.getLP(lp.id).then(function (fresh) {
            if (fresh) lp.steps = fresh.steps;
            return window.LPCats.Store.saveLP(lp);
        }).catch(function (err) { toast(err.message, 'error'); });
    }

    // === 分析タブ ===
    function _showAnalytics(lp) {
        var app = document.getElementById('app');
        app.innerHTML = _renderTabs(lp, 'analytics') +
            '<div class="card"><div class="loading">分析データを読み込み中...</div></div>';

        window.LPCats.Store.getAnalytics(lp.id).then(function (data) {
            var content = '<div class="analytics-summary card">' +
                '<h3 class="card-title">サマリー</h3>' +
                '<div class="analytics-kpis">' +
                    '<div class="kpi-card"><div class="kpi-value">' + (data.summary.totalSessions || 0) + '</div><div class="kpi-label">セッション数</div></div>' +
                    '<div class="kpi-card"><div class="kpi-value">' + (data.summary.totalCtaClicks || 0) + '</div><div class="kpi-label">CTAクリック</div></div>' +
                    '<div class="kpi-card"><div class="kpi-value">' + (data.summary.ctaClickRate || 0) + '%</div><div class="kpi-label">CTAクリック率</div></div>' +
                '</div>' +
            '</div>';

            if (data.computed && data.computed.length > 0) {
                // ファネルビジュアライゼーション
                content += '<div class="card">' +
                    '<h3 class="card-title">ファネル</h3>' +
                    '<div class="analytics-funnel">';

                data.computed.forEach(function (step) {
                    var barWidth = Math.max(step.reachRate, 8);
                    content += '<div class="funnel-step">' +
                        '<div class="funnel-label">Step ' + (step.index + 1) + '</div>' +
                        '<div class="funnel-bar" style="width:' + barWidth + '%">' + step.reachRate + '%</div>' +
                    '</div>';
                });

                content += '</div></div>';

                // ステップ分析テーブル（バーグラフ付き）
                content += '<div class="card">' +
                    '<h3 class="card-title">ステップ分析</h3>' +
                    '<div class="analytics-table-wrap">' +
                    '<table class="analytics-table">' +
                        '<thead><tr>' +
                            '<th>ステップ</th><th>閲覧数</th><th>到達率</th><th>離脱率</th><th>平均滞在</th><th>CTAクリック</th><th>CTAクリック率</th>' +
                        '</tr></thead><tbody>';

                data.computed.forEach(function (step) {
                    var reachClass = step.reachRate < 20 ? ' danger' : (step.reachRate < 50 ? ' warning' : '');
                    var dropClass = step.dropRate > 30 ? ' danger' : (step.dropRate > 15 ? ' warning' : '');

                    content += '<tr>' +
                        '<td><strong>Step ' + (step.index + 1) + '</strong></td>' +
                        '<td>' + step.views + '</td>' +
                        '<td class="analytics-bar-cell' + reachClass + '"><div class="analytics-bar analytics-bar--reach" style="width:' + step.reachRate + '%"></div><span>' + step.reachRate + '%</span></td>' +
                        '<td class="analytics-bar-cell' + dropClass + '"><div class="analytics-bar analytics-bar--drop" style="width:' + Math.min(step.dropRate, 100) + '%"></div><span>' + step.dropRate + '%</span></td>' +
                        '<td>' + step.avgDurationFormatted + '</td>' +
                        '<td>' + step.ctaClicks + '</td>' +
                        '<td>' + step.ctaClickRate + '%</td>' +
                    '</tr>';
                });

                content += '</tbody></table></div></div>';

                // KPI基準ガイド
                content += '<div class="card analytics-guide">' +
                    '<h3 class="card-title">KPI基準</h3>' +
                    '<ul>' +
                        '<li><strong>2ステップ目到達率</strong>: 60%が理想（50%以下ならFV改善が最優先）</li>' +
                        '<li><strong>最終ステップ到達率</strong>: 20%が目標ライン</li>' +
                        '<li><strong>各ステップ離脱率</strong>: 10%以上で改善対象</li>' +
                    '</ul>' +
                '</div>';
            } else {
                content += '<div class="card"><div class="empty-state"><div class="empty-state__icon">&#128202;</div><h3>まだ分析データがありません</h3><p>LPを埋め込んでアクセスが発生すると、ここにデータが表示されます。</p></div></div>';
            }

            var tabsHtml = _renderTabs(lp, 'analytics');
            app.innerHTML = tabsHtml + content;

        }).catch(function (err) {
            app.innerHTML = _renderTabs(lp, 'analytics') +
                '<div class="card error-state"><p>分析データの取得に失敗: ' + window.LPCats.Utils.sanitizeText(err.message) + '</p></div>';
        });
    }

    // === 埋め込みタブ ===
    function _showEmbed(lp) {
        var app = document.getElementById('app');
        var baseUrl = window.location.origin + window.location.pathname.replace(/admin\.html.*$/, '');
        var embedTag = '<script src="' + baseUrl + 'api/embed.php?id=' + lp.id + '"><\/script>';
        var embedTagMobile = '<script src="' + baseUrl + 'api/embed.php?id=' + lp.id + '&mobile=1"><\/script>';

        var html = _renderTabs(lp, 'embed') +
            '<div class="card">' +
                '<h3 class="card-title">埋め込みタグ</h3>' +
                '<p class="embed-desc">以下のタグを表示させたいページのHTMLに貼り付けてください。</p>' +

                '<div class="form-group">' +
                    '<label class="form-label">全デバイス表示</label>' +
                    '<div class="embed-code-wrap">' +
                        '<code class="embed-code" id="embed-tag-all">' + window.LPCats.Utils.sanitizeText(embedTag) + '</code>' +
                        '<button class="btn btn-sm btn-primary embed-copy" data-target="embed-tag-all">コピー</button>' +
                    '</div>' +
                '</div>' +

                '<div class="form-group">' +
                    '<label class="form-label">スマホのみ表示（画面幅767px以下）</label>' +
                    '<div class="embed-code-wrap">' +
                        '<code class="embed-code" id="embed-tag-mobile">' + window.LPCats.Utils.sanitizeText(embedTagMobile) + '</code>' +
                        '<button class="btn btn-sm btn-primary embed-copy" data-target="embed-tag-mobile">コピー</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="card">' +
                '<h3 class="card-title">直接リンク</h3>' +
                '<div class="form-group">' +
                    '<label class="form-label">ビューアーURL</label>' +
                    '<div class="embed-code-wrap">' +
                        '<code class="embed-code" id="embed-viewer-url">' + baseUrl + 'viewer.html?id=' + lp.id + '</code>' +
                        '<button class="btn btn-sm btn-primary embed-copy" data-target="embed-viewer-url">コピー</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="card">' +
                '<h3 class="card-title">設置方法</h3>' +
                '<ol class="embed-instructions">' +
                    '<li>上のタグをコピー</li>' +
                    '<li>LPを表示させたいページのHTMLを開く</li>' +
                    '<li>表示させたい位置にタグを貼り付け</li>' +
                    '<li>保存してページを表示 → スワイプ型LPが出現</li>' +
                '</ol>' +
            '</div>';

        app.innerHTML = html;

        // コピーボタン
        app.querySelectorAll('.embed-copy').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = document.getElementById(this.dataset.target);
                if (target) {
                    navigator.clipboard.writeText(target.textContent).then(function () {
                        toast('コピーしました', 'success');
                    }).catch(function () {
                        // フォールバック
                        var range = document.createRange();
                        range.selectNodeContents(target);
                        var sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                        document.execCommand('copy');
                        toast('コピーしました', 'success');
                    });
                }
            });
        });
    }

    // === トースト ===
    function _createToastContainer() {
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'toast-container';
        document.body.appendChild(_toastContainer);
    }

    function toast(message, type) {
        type = type || 'success';
        var t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.textContent = message;
        _toastContainer.appendChild(t);
        setTimeout(function () {
            t.classList.add('toast-out');
            setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 200);
        }, 3000);
    }

    return { init: init, toast: toast };
})();

document.addEventListener('DOMContentLoaded', function () {
    window.LPCats.AdminApp.init();
});
