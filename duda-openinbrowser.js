/**
 * OpenInBrowser v2
 * Detecta navegadores in-app (Instagram, TikTok, Facebook etc.) e orienta a
 * pessoa a abrir a página no navegador padrão. UI minimalista e multilíngue.
 *
 * Uso básico:
 *   <script src="openinbrowser.js" defer></script>
 *
 * Configuração opcional (antes de carregar o script):
 *   <script>
 *     window.InAppGuideConfig = {
 *       position: 'top-right',        // 'top-right' | 'bottom-right'
 *       androidIntent: true,          // mostra botão "Abrir no Chrome" no Android
 *       autoRedirectAndroid: false,   // tenta abrir no Chrome sem pedir nada
 *       onShow: function (info) {}
 *     };
 *   </script>
 *
 * O aviso não tem botão de fechar nem fecha ao clicar fora: a pessoa precisa
 * abrir a página no navegador externo para continuar.
 *
 * API pública: window.InAppGuide.show() / .dismiss() / .isInApp
 */
(function () {
    'use strict';

    if (window.InAppGuide) return; // evita carregar duas vezes

    // ─── Configuração ────────────────────────────────────────────────────────────

    const DEFAULTS = {
        position: 'top-right',
        androidIntent: true,
        autoRedirectAndroid: false,
        onShow: null
    };
    const CFG = Object.assign({}, DEFAULTS, window.InAppGuideConfig || {});

    const STRINGS = {
        pt: {
            title:    'Melhore sua experiência',
            step1:    'Toque nos <strong>(···)</strong> no canto superior direito',
            step2ios: 'Selecione <strong>Abrir no navegador externo / Safari</strong>',
            step2and: 'Selecione <strong>Abrir no navegador externo / Chrome</strong>',
            hint:     'Siga as instruções acima',
            copy:     'Copiar link',
            copied:   'Link copiado!',
            chrome:   'Abrir no Chrome'
        },
        en: {
            title:    'Improve your experience',
            step1:    'Tap the <strong>(···)</strong> in the top right',
            step2ios: 'Select <strong>Open in external browser / Safari</strong>',
            step2and: 'Select <strong>Open in external browser / Chrome</strong>',
            hint:     'Follow the instructions above',
            copy:     'Copy link',
            copied:   'Link copied!',
            chrome:   'Open in Chrome'
        },
        es: {
            title:    'Mejora tu experiencia',
            step1:    'Toca los <strong>(···)</strong> en la esquina superior derecha',
            step2ios: 'Elige <strong>Abrir en navegador externo / Safari</strong>',
            step2and: 'Elige <strong>Abrir en navegador externo / Chrome</strong>',
            hint:     'Sigue las instrucciones de arriba',
            copy:     'Copiar enlace',
            copied:   '¡Enlace copiado!',
            chrome:   'Abrir en Chrome'
        }
    };

    // ─── Detecção ─────────────────────────────────────────────────────────────────

    const IN_APP_PATTERNS = [
        { id: 'instagram', re: /Instagram/i },
        { id: 'facebook',  re: /FBAN|FBAV|FB_IAB|FBIOS|FBSS|Messenger/i },
        { id: 'tiktok',    re: /TikTok|BytedanceWebview|musical_ly|trill/i },
        { id: 'snapchat',  re: /Snapchat/i },
        { id: 'twitter',   re: /Twitter/i },
        { id: 'linkedin',  re: /LinkedInApp/i },
        { id: 'pinterest', re: /Pinterest/i },
        { id: 'line',      re: /\bLine\//i },
        { id: 'wechat',    re: /MicroMessenger/i },
        { id: 'kakao',     re: /KAKAOTALK/i }
    ];

    const ua      = navigator.userAgent || '';
    const found   = IN_APP_PATTERNS.find(function (p) { return p.re.test(ua); });
    const appId   = found ? found.id : null;
    const isInApp = !!appId;

    // iPadOS moderno se identifica como Mac, então checamos também o touch
    const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
                  (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);

    function detectLang() {
        const list = (navigator.languages && navigator.languages.length)
            ? navigator.languages
            : [navigator.language || 'en'];
        const code = String(list[0]).toLowerCase().slice(0, 2);
        return STRINGS[code] ? code : 'en';
    }

    const lang    = detectLang();
    const t       = STRINGS[lang];
    const step2   = isIOS ? t.step2ios : t.step2and;

    // ─── Utilitários ──────────────────────────────────────────────────────────────

    function safeCall(fn, arg) {
        if (typeof fn !== 'function') return;
        try { fn(arg); } catch (e) { /* callback do usuário não derruba o script */ }
    }

    // Intent do Android: tenta abrir a URL atual direto no Chrome
    function chromeIntentUrl() {
        const u = new URL(location.href);
        return 'intent://' + u.host + u.pathname + u.search + u.hash +
               '#Intent;scheme=' + u.protocol.replace(':', '') +
               ';package=com.android.chrome' +
               ';S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                ok ? resolve() : reject(new Error('copy failed'));
            } catch (err) { reject(err); }
        });
    }

    // ─── Estilos ──────────────────────────────────────────────────────────────────

    const CSS = `
        #iag-overlay {
            --iag-overlay:   rgba(0, 0, 0, 0.22);
            --iag-popup:     #ffffff;
            --iag-title:     #0f0f0f;
            --iag-text:      #1a1a1a;
            --iag-hint:      #444444;
            --iag-step-bg:   #f4f4f6;
            --iag-hint-bg:   rgba(255, 255, 255, 0.88);
            --iag-hint-bd:   rgba(0, 0, 0, 0.07);
            --iag-btn-bg:    #0f0f0f;
            --iag-btn-fg:    #ffffff;
            --iag-ghost-bd:  rgba(0, 0, 0, 0.14);
            --iag-n1a: #c4a7d8; --iag-n1b: #9e72bf;
            --iag-n2a: #8dd4b4; --iag-n2b: #55b88d;

            position: fixed; inset: 0;
            background: var(--iag-overlay);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            opacity: 0;
            transition: opacity 0.32s ease;
            -webkit-tap-highlight-color: transparent;
        }
        @media (prefers-color-scheme: dark) {
            #iag-overlay {
                --iag-overlay:  rgba(0, 0, 0, 0.45);
                --iag-popup:    #1c1c1e;
                --iag-title:    #f5f5f7;
                --iag-text:     #e5e5ea;
                --iag-hint:     #d1d1d6;
                --iag-step-bg:  #2c2c2e;
                --iag-hint-bg:  rgba(44, 44, 46, 0.88);
                --iag-hint-bd:  rgba(255, 255, 255, 0.08);
                            --iag-btn-bg:   #f5f5f7;
                --iag-btn-fg:   #0f0f0f;
                --iag-ghost-bd: rgba(255, 255, 255, 0.18);
            }
        }
        #iag-overlay.iag-visible { opacity: 1; }
        #iag-overlay *, #iag-overlay *::before, #iag-overlay *::after { box-sizing: border-box; }

        #iag-popup {
            position: absolute;
            right: 12px;
            top: calc(12px + env(safe-area-inset-top, 0px));
            background: var(--iag-popup);
            border-radius: 20px;
            padding: 22px 20px 18px;
            width: min(296px, calc(100vw - 48px));
            box-shadow:
                0 2px 4px rgba(0,0,0,0.04),
                0 8px 24px rgba(0,0,0,0.10),
                0 20px 48px rgba(0,0,0,0.07);
            transform: translateY(-8px) scale(0.96);
            opacity: 0;
            transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        opacity   0.38s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #iag-overlay.iag-bottom #iag-popup {
            top: auto;
            bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            transform: translateY(8px) scale(0.96);
        }
        #iag-overlay.iag-visible #iag-popup { transform: translateY(0) scale(1); opacity: 1; }

        #iag-arrow {
            position: absolute;
            top: -8px; right: 20px;
            width: 0; height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 8px solid var(--iag-popup);
        }
        #iag-overlay.iag-bottom #iag-arrow {
            top: auto; bottom: -8px;
            border-bottom: 0;
            border-top: 8px solid var(--iag-popup);
        }

        #iag-overlay :focus-visible { outline: 2px solid #9e72bf; outline-offset: 2px; }

        #iag-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--iag-title);
            margin: 0 0 14px 0;
            line-height: 1.25;
            letter-spacing: -0.15px;
        }

        .iag-step {
            display: flex; align-items: center; gap: 11px;
            padding: 10px 12px;
            border-radius: 13px;
            background: var(--iag-step-bg);
            margin-bottom: 7px;
        }
        .iag-num {
            width: 25px; height: 25px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            font-size: 11.5px; font-weight: 600;
            color: #ffffff;
        }
        .iag-num-1 { background: linear-gradient(135deg, var(--iag-n1a), var(--iag-n1b)); }
        .iag-num-2 { background: linear-gradient(135deg, var(--iag-n2a), var(--iag-n2b)); }
        .iag-step-text { font-size: 13px; color: var(--iag-text); line-height: 1.4; }
        .iag-step-text strong { font-weight: 600; color: var(--iag-title); }

        .iag-actions { display: flex; gap: 8px; margin-top: 12px; }
        .iag-btn {
            flex: 1;
            font: inherit; font-size: 12.5px; font-weight: 600;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid var(--iag-ghost-bd);
            background: transparent;
            color: var(--iag-title);
            cursor: pointer;
            transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .iag-btn:active { transform: scale(0.97); }
        .iag-btn-primary {
            background: var(--iag-btn-bg);
            color: var(--iag-btn-fg);
            border-color: transparent;
        }

        #iag-hint {
            position: absolute;
            left: 50%;
            bottom: calc(18% + env(safe-area-inset-bottom, 0px));
            transform: translateX(-50%) translateY(6px);
            max-width: calc(100vw - 32px);
            background: var(--iag-hint-bg);
            border: 1px solid var(--iag-hint-bd);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 100px;
            padding: 11px 24px;
            font-size: 12.5px; font-weight: 500;
            color: var(--iag-hint);
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            opacity: 0;
            transition: opacity 0.4s ease 0.22s,
                        transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.22s;
            pointer-events: none;
            user-select: none;
        }
        #iag-overlay.iag-bottom #iag-hint { bottom: auto; top: calc(18% + env(safe-area-inset-top, 0px)); }
        #iag-overlay.iag-visible #iag-hint { opacity: 1; transform: translateX(-50%) translateY(0); }

        @media (prefers-reduced-motion: reduce) {
            #iag-overlay, #iag-popup, #iag-hint, .iag-btn { transition: none !important; }
        }
    `;

    // ─── Módulo principal ─────────────────────────────────────────────────────────

    const InAppGuide = {
        isInApp: isInApp,
        app: appId,

        _overlay: null,
        _style: null,
        _prevOverflow: '',
        _onKey: null,

        init: function () {
            if (!isInApp) return;
            if (CFG.autoRedirectAndroid && isAndroid) {
                // Tenta jogar direto pro Chrome; se o app bloquear, o guia aparece normalmente
                try { location.href = chromeIntentUrl(); } catch (e) { /* segue pro guia */ }
            }
            this.show();
        },

        show: function () {
            if (this._overlay) return;
            this._injectStyles();
            this._render();
            this._bindEvents();
            safeCall(CFG.onShow, { app: appId, platform: isIOS ? 'ios' : (isAndroid ? 'android' : 'other'), lang: lang });
        },

        // Uso programático apenas; a pessoa não tem como fechar pela interface
        dismiss: function () {
            const overlay = this._overlay;
            if (!overlay) return;
            this._overlay = null;

            document.removeEventListener('keydown', this._onKey);
            document.documentElement.style.overflow = this._prevOverflow || '';

            overlay.classList.remove('iag-visible');
            const style = this._style;
            this._style = null;

            setTimeout(function () {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (style && style.parentNode) style.parentNode.removeChild(style);
            }, 380);
        },

        _injectStyles: function () {
            const style = document.createElement('style');
            style.id = 'iag-styles';
            style.textContent = CSS;
            document.head.appendChild(style);
            this._style = style;
        },

        _render: function () {
            const overlay = document.createElement('div');
            overlay.id = 'iag-overlay';
            if (CFG.position === 'bottom-right') overlay.classList.add('iag-bottom');
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'iag-title');

            const showChrome = CFG.androidIntent && isAndroid;

            overlay.innerHTML =
                '<div id="iag-popup">' +
                    '<div id="iag-arrow"></div>' +
                    '<p id="iag-title">' + t.title + '</p>' +
                    '<div class="iag-step">' +
                        '<span class="iag-num iag-num-1" aria-hidden="true">1</span>' +
                        '<span class="iag-step-text">' + t.step1 + '</span>' +
                    '</div>' +
                    '<div class="iag-step">' +
                        '<span class="iag-num iag-num-2" aria-hidden="true">2</span>' +
                        '<span class="iag-step-text">' + step2 + '</span>' +
                    '</div>' +
                    '<div class="iag-actions">' +
                        (showChrome ? '<button id="iag-chrome" type="button" class="iag-btn iag-btn-primary">' + t.chrome + '</button>' : '') +
                        '<button id="iag-copy" type="button" class="iag-btn">' + t.copy + '</button>' +
                    '</div>' +
                '</div>' +
                '<div id="iag-hint" aria-hidden="true">' + t.hint + '</div>';

            document.body.appendChild(overlay);
            this._overlay = overlay;

            // Trava a rolagem da página por trás do aviso
            this._prevOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';

            // Entrada animada
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { overlay.classList.add('iag-visible'); });
            });

            const firstBtn = overlay.querySelector('button');
            if (firstBtn) firstBtn.focus({ preventScroll: true });
        },

        _bindEvents: function () {
            const overlay = this._overlay;

            overlay.addEventListener('click', function (e) {
                const target = e.target;

                if (target.closest('#iag-chrome')) {
                    location.href = chromeIntentUrl();
                    return;
                }

                const copyBtn = target.closest('#iag-copy');
                if (copyBtn) {
                    copyToClipboard(location.href).then(function () {
                        copyBtn.textContent = t.copied;
                        setTimeout(function () { copyBtn.textContent = t.copy; }, 1800);
                    }).catch(function () {
                        // Último recurso: deixa o usuário copiar manualmente
                        window.prompt(t.copy, location.href);
                    });
                    return;
                }
            });

            this._onKey = function (e) {
                if (e.key !== 'Tab') return;

                // Mantém o foco dentro do diálogo
                const focusables = overlay.querySelectorAll('button');
                if (!focusables.length) return;
                const first = focusables[0];
                const last  = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            };
            document.addEventListener('keydown', this._onKey);

        }
    };

    window.InAppGuide = InAppGuide;

    // ─── Inicialização segura ─────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { InAppGuide.init(); });
    } else {
        InAppGuide.init();
    }

})();