// ============================================================
// VIKI — Skip Ad automático (opcional)
//
// Este arquivo NÃO está no manifest.json de propósito: o botão "Skip
// Ad" fica dentro de iframes do player de anúncios (IMA do Google),
// em domínios que não são do Viki. Por isso ele é registrado
// dinamicamente pelo background.js (ver syncVikiSkipAdRegistration),
// só quando o usuário liga Settings > Viki only > Skip ad e aceita a
// permissão extra que o Chrome pede nesse momento.
//
// Chave "vikiSkipAd" no chrome.storage.local (desligado por padrão).
// ============================================================

(() => {
  "use strict";

  const isTop = window.top === window;

  // Como este script entra em qualquer iframe, só continua se o frame
  // for do Viki ou estiver DENTRO de uma página do Viki.
  try {
    if (isTop) {
      if (!/(^|\.)viki\.com$/.test(location.hostname)) return;
    } else {
      const ancestors = Array.from(location.ancestorOrigins || []);
      if (ancestors.length && !ancestors.some((o) => /(^|\.)viki\.com$/.test(new URL(o).hostname))) return;
    }
  } catch (_) {
    // se não der pra checar, segue — o resto só age se achar o botão
  }

  let enabled = false;
  chrome.storage.local.get("vikiSkipAd", ({ vikiSkipAd }) => {
    enabled = vikiSkipAd === true;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.vikiSkipAd) enabled = changes.vikiSkipAd.newValue === true;
  });

  // Textos aceitos no botão (o Viki muda conforme o idioma da conta).
  const AD_TEXT = /^\s*(skip ads?|pular an[uú]ncios?|omitir anuncios?|saltar anuncios?)\s*$/i;
  const lastPress = new WeakMap();

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  }

  function press(el) {
    const now = Date.now();
    if (now - (lastPress.get(el) || 0) < 2500) return false;
    lastPress.set(el, now);

    const r = el.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0
    };
    ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach((type) => {
      const Ev = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ev(type, opts));
    });
    el.click();
    return true;
  }

  function check() {
    if (!enabled) return;

    // O container do botão (div.skip-button) é o elemento que recebe o
    // clique; o texto "Skip Ad" fica num <span> dentro dele.
    const direct = document.querySelector(
      '[data-ck-tag="skip"], div.skip-button, [aria-label="Skip Ad"], [aria-label="Skip Ads"]'
    );
    if (direct && visible(direct)) {
      if (press(direct)) console.log("[MDL Sync] Skip Ad clicked.");
      return;
    }

    // Plano B: procura por texto, caso as classes/atributos mudem.
    const candidates = document.querySelectorAll('span[x-code], button, [role="button"], div[class*="skip"]');
    for (const el of candidates) {
      if (!AD_TEXT.test(el.textContent || "")) continue;
      if (!visible(el)) continue;
      const target = el.closest('button, [role="button"], a') || el;
      if (press(target)) console.log("[MDL Sync] Skip Ad clicked.");
      break;
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      check();
    }, 250);
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-disabled"]
  });
  setInterval(check, 1000);
})();
