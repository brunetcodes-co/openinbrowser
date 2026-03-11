/**
 * InApp Browser Redirect Guide
 * Detecta navegadores in-app (Instagram, TikTok, etc.) e orienta o usuário
 * a abrir a página no navegador padrão — com UI minimalista e bilíngue.
 */
(function () {
    'use strict';

    // ─── Configuração ────────────────────────────────────────────────────────────

    const CONFIG = {
        colors: {
            overlay:    'rgba(0, 0, 0, 0.22)',
            popup:      '#ffffff',
            textTitle:  '#0f0f0f',
            textStep:   '#1a1a1a',
            textHint:   '#444444',
            stepBg:     '#f4f4f6',
            num1a:      '#c4a7d8',
            num1b:      '#9e72bf',
            num2a:      '#8dd4b4',
            num2b:      '#55b88d',
            hintBg:     'rgba(255, 255, 255, 0.88)',
            hintBorder: 'rgba(0, 0, 0, 0.07)',
            closeBg:    '#ebebeb',
            closeHover: '#dcdcdc'
        },
        strings: {
            pt: {
                title:    'Melhore sua experiência',
                step1:    'Toque nos <strong>···</strong> no canto superior direito',
                step2ios: 'Selecione <strong>Abrir no Safari</strong>',
                step2and: 'Selecione <strong>Abrir no Navegador</strong>',
                hint:     'Siga a instrução acima',
                close:    'Fechar'
            },
            en: {
                title:    'Open in Browser',
                step1:    'Tap the <strong>···</strong> in the top right',
                step2ios: 'Select <strong>Open in Browser / Safari</strong>',
                step2and: 'Select <strong>Open in Browser / Chrome</strong>',
                hint:     'Follow the instruction above',
                close:    'Close'
            }
        }
    };

    // ─── Detecção ─────────────────────────────────────────────────────────────────

    const ua         = navigator.userAgent || '';
    const isInApp    = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|FBSS|TikTok|BytedanceWebview|Snapchat|Twitter|LinkedInApp|Musical\.ly/i.test(ua);
    const isIOS      = /iPhone|iPad|iPod/i.test(ua);
    const lang       = (navigator.language || navigator.userLanguage || 'en').toLowerCase().startsWith('pt') ? 'pt' : 'en';
    const strings    = CONFIG.strings[lang];
    const step2Text  = isIOS ? strings.step2ios : strings.step2and;

    // ─── Módulo principal ─────────────────────────────────────────────────────────

    const InAppGuide = {

        init() {
            if (!isInApp) return;
            this._injectStyles();
            this._render();
            this._bindEvents();
        },

        _injectStyles() {
            const css = `
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

                #iag-overlay {
                    position: fixed; inset: 0;
                    background: ${CONFIG.colors.overlay};
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    z-index: 2147483647;
                    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                    opacity: 0;
                    transition: opacity 0.32s ease;
                    -webkit-tap-highlight-color: transparent;
                }
                #iag-overlay.iag-visible { opacity: 1; }
                #iag-overlay * { box-sizing: border-box; }

                #iag-popup {
                    position: absolute;
                    top: 12px; right: 12px;
                    background: ${CONFIG.colors.popup};
                    border-radius: 20px;
                    padding: 22px 20px 18px 20px;
                    width: min(286px, calc(100vw - 72px));
                    box-shadow:
                        0 2px 4px rgba(0,0,0,0.04),
                        0 8px 24px rgba(0,0,0,0.10),
                        0 20px 48px rgba(0,0,0,0.07);
                    transform: translateY(-8px) scale(0.96);
                    transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                                opacity  0.38s cubic-bezier(0.16, 1, 0.3, 1);
                    opacity: 0;
                }
                #iag-overlay.iag-visible #iag-popup {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }

                #iag-arrow {
                    position: absolute;
                    top: -8px; right: 20px;
                    width: 0; height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-bottom: 8px solid ${CONFIG.colors.popup};
                    filter: drop-shadow(0 -2px 1px rgba(0,0,0,0.04));
                }

                #iag-close {
                    position: absolute;
                    top: 11px; right: 11px;
                    width: 24px; height: 24px;
                    border-radius: 50%;
                    background: ${CONFIG.colors.closeBg};
                    border: none; cursor: pointer; padding: 0;
                    display: flex; align-items: center; justify-content: center;
                    transition: background 0.18s;
                    outline: none;
                }
                #iag-close:hover  { background: ${CONFIG.colors.closeHover}; }
                #iag-close:active { background: #d4d4d4; }
                #iag-close svg    { width: 9px; height: 9px; display: block; }

                #iag-title {
                    font-size: 14.5px;
                    font-weight: 600;
                    color: ${CONFIG.colors.textTitle};
                    margin: 0 28px 14px 0;
                    line-height: 1.25;
                    letter-spacing: -0.15px;
                }

                .iag-step {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    padding: 10px 12px;
                    border-radius: 13px;
                    background: ${CONFIG.colors.stepBg};
                    margin-bottom: 7px;
                }
                .iag-step:last-of-type { margin-bottom: 0; }

                .iag-num {
                    width: 25px; height: 25px;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                    font-size: 11.5px; font-weight: 600;
                    color: #ffffff;
                }
                .iag-num-1 { background: linear-gradient(135deg, ${CONFIG.colors.num1a}, ${CONFIG.colors.num1b}); }
                .iag-num-2 { background: linear-gradient(135deg, ${CONFIG.colors.num2a}, ${CONFIG.colors.num2b}); }

                .iag-step-text {
                    font-size: 13px;
                    color: ${CONFIG.colors.textStep};
                    line-height: 1.4;
                    font-weight: 400;
                }
                .iag-step-text strong {
                    font-weight: 600;
                    color: ${CONFIG.colors.textTitle};
                }

                #iag-hint {
                    position: absolute;
                    bottom: 38%;
                    left: 50%;
                    transform: translateX(-50%) translateY(6px);
                    background: ${CONFIG.colors.hintBg};
                    border: 1px solid ${CONFIG.colors.hintBorder};
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-radius: 100px;
                    padding: 11px 24px;
                    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12.5px;
                    font-weight: 500;
                    color: ${CONFIG.colors.textHint};
                    white-space: nowrap;
                    letter-spacing: -0.1px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                    opacity: 0;
                    transition: opacity 0.4s ease 0.22s,
                                transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.22s;
                    pointer-events: none;
                    user-select: none;
                }
                #iag-overlay.iag-visible #iag-hint {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            `;

            const style = document.createElement('style');
            style.id    = 'iag-styles';
            style.textContent = css;
            document.head.appendChild(style);
        },

        _render() {
            const overlay = document.createElement('div');
            overlay.id    = 'iag-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', strings.title);

            overlay.innerHTML = `
                <div id="iag-popup">
                    <div id="iag-arrow"></div>
                    <button id="iag-close" aria-label="${strings.close}">
                        <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L9 9M9 1L1 9" stroke="#666666" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <p id="iag-title">${strings.title}</p>
                    <div class="iag-step">
                        <span class="iag-num iag-num-1">1</span>
                        <span class="iag-step-text">${strings.step1}</span>
                    </div>
                    <div class="iag-step">
                        <span class="iag-num iag-num-2">2</span>
                        <span class="iag-step-text">${step2Text}</span>
                    </div>
                </div>
                <div id="iag-hint">${strings.hint}</div>
            `;

            document.body.appendChild(overlay);

            // Anima entrada
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    overlay.classList.add('iag-visible');
                });
            });
        },

        dismiss() {
            const overlay = document.getElementById('iag-overlay');
            const styles  = document.getElementById('iag-styles');
            if (!overlay) return;

            overlay.classList.remove('iag-visible');

            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (styles  && styles.parentNode)  styles.parentNode.removeChild(styles);
            }, 380);
        },

        _bindEvents() {
            // Fechar pelo botão X
            document.addEventListener('click', (e) => {
                const btn = document.getElementById('iag-close');
                if (btn && (e.target === btn || btn.contains(e.target))) {
                    this.dismiss();
                }
            }, { passive: true });

            // Quando a página fica oculta (usuário abriu no navegador externo)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.dismiss();
                }
            });

            // Fallback: quando o foco retorna — se não for mais in-app, dispensar
            window.addEventListener('focus', () => {
                if (!isInApp) this.dismiss();
            }, { passive: true });
        }
    };

    // ─── Inicialização segura ─────────────────────────────────────────────────────

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        InAppGuide.init();
    } else {
        window.addEventListener('DOMContentLoaded', () => InAppGuide.init());
    }

})();