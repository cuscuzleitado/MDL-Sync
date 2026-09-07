// ============================================================
// BACKGROUND SCRIPT
// Recebe o episódio detectado no site de streaming e tenta
// sincronizar com o MyDramaList numa aba oculta.
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SYNC_EPISODE") {
    const isAuto = message.source === "auto";

    syncEpisodeToMDL(message.data)
      .then((result) => {
        if (isAuto) {
          const label = result.rating ? `Completed with rating ${result.rating}!` : "Synced automatically on MDL.";
          notify(`✓ ${result.title} — Ep ${result.episode}`, label);
        }
        sendResponse({ ok: true, result });
      })
      .catch((err) => {
        if (isAuto) notify(`✗ Sync failed`, err.message);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // resposta assíncrona
  }
});

// Notificação nativa do sistema — ao contrário do badge na página, essa
// aparece mesmo com o vídeo em tela cheia ou a aba em segundo plano.
function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message
  });
}

// `rating` é opcional (1.0 a 10.0, de 0.5 em 0.5). Quando presente, marca
// como "Completed" e aplica a nota — usado no último episódio de um drama.
async function syncEpisodeToMDL({ title, season, episode, key, rating }) {
  // 1) Já sabemos pra onde esse título aponta no MDL?
  const stored = await chrome.storage.local.get("mdlMap");
  const mdlMap = stored.mdlMap || {};
  let entry = mdlMap[key];

  // Compatibilidade: mapeamentos salvos antes da v0.1.2 eram só a URL como
  // string. Converte pro formato novo { url, total } sem perder o que já
  // estava salvo.
  if (entry && typeof entry === "string") {
    entry = { url: entry, total: null };
  }

  if (!entry) {
    // 2) Primeira vez: abre a busca numa aba VISÍVEL e deixa o usuário
    // clicar no resultado certo (evita sync errado por título diferente
    // entre sites, ex: "Awaken" no site vs "The Awake" no MDL).
    const mdlUrl = await resolveTitleManually(title);
    if (!mdlUrl) throw new Error("You closed the tab before choosing the correct title.");
    entry = { url: mdlUrl, total: null };
  }

  // 3) Já sabemos a página certa — marca o episódio (aba oculta agora, já
  // que não precisa mais de intervenção manual).
  const tab = await chrome.tabs.create({ url: entry.url, active: false });
  await waitForTabLoad(tab.id);

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: markEpisodeWatchedOnMDL,
    args: [episode, rating || null]
  });

  await chrome.tabs.remove(tab.id);

  if (!result || !result.marked) {
    throw new Error("Reached the title page, but couldn't mark the episode.");
  }

  // Guarda/atualiza o total de episódios pra próxima vez sabermos se é o
  // último sem precisar abrir a aba do MDL de novo.
  entry.total = result.total ?? entry.total;
  mdlMap[key] = entry;
  await chrome.storage.local.set({ mdlMap });

  return { title, season, episode, url: entry.url, total: entry.total, rating: rating || null };
}

// Abre a busca numa aba ativa e espera o usuário navegar até a página
// correta do título (URL no formato mydramalist.com/{id}-{slug}).
function resolveTitleManually(title) {
  return new Promise(async (resolve) => {
    const searchUrl = `https://mydramalist.com/search?q=${encodeURIComponent(title)}`;
    const tab = await chrome.tabs.create({ url: searchUrl, active: true });

    function isTitlePage(url) {
      try {
        const u = new URL(url);
        return u.hostname === "mydramalist.com" && /^\/\d+-/.test(u.pathname);
      } catch {
        return false;
      }
    }

    function updateListener(tabId, info, updatedTab) {
      if (tabId !== tab.id || info.status !== "complete") return;
      if (isTitlePage(updatedTab.url)) {
        cleanup();
        resolve(updatedTab.url);
      }
    }

    function removeListener(tabId) {
      if (tabId !== tab.id) return;
      cleanup();
      resolve(null); // usuário fechou a aba sem escolher
    }

    function cleanup() {
      chrome.tabs.onUpdated.removeListener(updateListener);
      chrome.tabs.onRemoved.removeListener(removeListener);
    }

    chrome.tabs.onUpdated.addListener(updateListener);
    chrome.tabs.onRemoved.addListener(removeListener);
  });
}

// ------------------------------------------------------------
// Roda DENTRO da página do MDL (contexto da aba), via chrome.scripting.
// Fluxo: clica em "Add to List" -> espera o dialog abrir -> escreve o
// número de episódios assistidos -> (se tiver rating) marca como
// Completed e aplica a nota -> clica em "Submit".
//
// Retorna { marked: boolean, total: number|null } — "total" vem do
// atributo max do próprio input de episódios.
// ------------------------------------------------------------
function markEpisodeWatchedOnMDL(episodeNumber, rating) {
  function waitFor(selector, timeout = 6000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(timer);
          resolve(el);
        } else if (Date.now() - start > timeout) {
          clearInterval(timer);
          reject(new Error("timeout esperando: " + selector));
        }
      }, 200);
    });
  }

  // Setter nativo — necessário pra frameworks reativos (Vue/React)
  // perceberem a mudança de valor, já que setar .value direto é ignorado.
  function setNativeValue(el, value) {
    const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
    nativeSetter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (async () => {
    try {
      const addBtn = document.querySelector(".btn-manage-list");
      if (!addBtn) throw new Error("Botão 'Add to List' não encontrado nesta página.");
      addBtn.click();

      // espera o dialog do Element UI renderizar e o input aparecer
      const input = await waitFor('.el-input__inner[type="number"]');
      const total = input.max ? parseInt(input.max, 10) : null;

      setNativeValue(input, episodeNumber);

      // Último episódio: marca como Completed automaticamente, independente
      // de ter nota ou não (a nota é só um extra opcional por cima disso).
      // Em qualquer outro episódio, garante que o status vira "Currently
      // watching" — sem isso, um título que estava em "Plan to watch" (ou
      // On-hold, etc.) continuava lá mesmo com o episódio marcado.
      const isFinalEpisode = total !== null && episodeNumber === total;
      const statusSelect = document.querySelector("select.select-watch-status");
      if (isFinalEpisode) {
        if (statusSelect) setNativeValue(statusSelect, "2"); // 2 = Completed
      } else {
        if (statusSelect) setNativeValue(statusSelect, "1"); // 1 = Currently watching
      }

      // Nota (opcional, pode chegar numa chamada separada, depois do
      // episódio já ter sido marcado como Completed antes).
      if (rating) {
        const statusSelect = document.querySelector("select.select-watch-status");
        if (statusSelect) setNativeValue(statusSelect, "2"); // 2 = Completed

        const ratingSelect = document.querySelector("select.select-rating");
        if (ratingSelect) setNativeValue(ratingSelect, String(rating));
      }

      // acha o botão de submit pelo texto do <span> filho
      const submitSpan = Array.from(document.querySelectorAll("span")).find(
        (s) => s.textContent.trim() === "Submit"
      );
      if (!submitSpan) throw new Error("Botão 'Submit' não encontrado.");
      const submitBtn = submitSpan.closest("button") || submitSpan;
      submitBtn.click();

      return { marked: true, total };
    } catch (err) {
      console.warn("[MDL Sync] Erro ao marcar episódio:", err.message);
      return { marked: false, total: null };
    }
  })();
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}
