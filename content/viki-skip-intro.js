// ============================================================
// VIKI — Skip Intro automático (opcional)
//
// Liga/desliga em Settings > Viki only > Skip intro (chave
// "vikiSkipIntro" no chrome.storage.local, desligado por padrão).
// Não depende do common.js: é só um clique automático no botão
// que o próprio player do Viki mostra durante a abertura.
// ============================================================

(() => {
  "use strict";

  let enabled = false;
  chrome.storage.local.get("vikiSkipIntro", ({ vikiSkipIntro }) => {
    enabled = vikiSkipIntro === true;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.vikiSkipIntro) enabled = changes.vikiSkipIntro.newValue === true;
  });

  const lastPress = new WeakMap();

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  }

  // Clique "completo" (pointer + mouse + click), com intervalo mínimo
  // por elemento pra não clicar várias vezes seguidas.
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
    const button = document.querySelector('[data-what="skip_intro_button"]');
    if (
      button &&
      !button.classList.contains("vjs-hidden") &&
      button.getAttribute("aria-disabled") !== "true" &&
      visible(button)
    ) {
      if (press(button)) console.log("[MDL Sync] Skip Intro clicked.");
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
