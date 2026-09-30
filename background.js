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

// 1h depois de completar um drama, remove o mapeamento (mdlMap), o
// histórico de episódios sincronizados e a nota salva daquele título —
// deixa tudo limpo pra caso você comece a assistir de novo do zero (ou
// um remake com o mesmo nome) no futuro.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("mdlSyncCleanup:")) return;
  const key = alarm.name.slice("mdlSyncCleanup:".length);
  cleanupTitleMapping(key);
});

async function cleanupTitleMapping(key) {
  const { mdlMap, syncedEpisodes, ratedTitles } = await chrome.storage.local.get([
    "mdlMap",
    "syncedEpisodes",
    "ratedTitles"
  ]);

  if (mdlMap && mdlMap[key]) {
    delete mdlMap[key];
    await chrome.storage.local.set({ mdlMap });
  }

  if (syncedEpisodes) {
    let changed = false;
    for (const storedKey of Object.keys(syncedEpisodes)) {
      if (storedKey.startsWith(`${key}:`)) {
        delete syncedEpisodes[storedKey];
        changed = true;
      }
    }
    if (changed) await chrome.storage.local.set({ syncedEpisodes });
  }

  if (ratedTitles && ratedTitles[key]) {
    delete ratedTitles[key];
    await chrome.storage.local.set({ ratedTitles });
  }

  console.log(`[MDL Sync] Mapeamento de "${key}" removido automaticamente (1h após completar).`);
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
    const resolved = await resolveTitleManually(title);
    if (!resolved) throw new Error("You closed the tab before choosing the correct title.");
    entry = { url: resolved.url, total: null };

    // Essa aba já cumpriu o papel dela (só servia pra você escolher o
    // título certo) — a marcação em si acontece numa aba oculta separada
    // mais abaixo, então não precisa deixar essa aberta.
    try {
      await chrome.tabs.remove(resolved.tabId);
    } catch {
      // já pode ter sido fechada manualmente, sem problema.
    }
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

  // Guarda/atualiza total, capa e nota pra próxima vez sabermos sem
  // precisar abrir a aba do MDL de novo (mantém o valor antigo se por
  // algum motivo não achou um novo nessa passada, ex: layout do MDL mudou).
  entry.total = result.total ?? entry.total;
  entry.cover = result.cover ?? entry.cover ?? null;
  entry.rating = result.communityRating ?? entry.rating ?? null;
  entry.ratingCount = result.ratingCount ?? entry.ratingCount ?? null;
  entry.statsUrl = result.statsUrl ?? entry.statsUrl ?? null;
  entry.reviewCount = result.reviewCount ?? entry.reviewCount ?? null;
  entry.reviewsUrl = result.reviewsUrl ?? entry.reviewsUrl ?? null;
  mdlMap[key] = entry;
  await chrome.storage.local.set({ mdlMap });

  // Se esse era o último episódio, agenda a remoção do mapeamento pra
  // daqui a 1 hora. Usamos chrome.alarms (não setTimeout) porque o
  // service worker do Manifest V3 é desligado quando fica ocioso — um
  // setTimeout normal seria perdido bem antes de 1h se passar, enquanto
  // o chrome.alarms sobrevive e "acorda" a extensão na hora certa.
  const isFinalEpisode = entry.total !== null && episode === entry.total;
  if (isFinalEpisode) {
    chrome.alarms.create(`mdlSyncCleanup:${key}`, { delayInMinutes: 60 });
    console.log(`[MDL Sync] Limpeza automática de "${title}" agendada pra daqui a 1h.`);
  }

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
        resolve({ url: updatedTab.url, tabId: tab.id });
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
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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
    // Capa: pega direto da página do título no MDL (sempre no mesmo lugar,
    // independente do site de streaming ter ou não uma imagem de preview).
    // Extraída fora do try principal pra não se perder se o resto falhar.
    // Não usamos [itemprop="image"] porque algumas extensões do usuário
    // reescrevem esse atributo antes do nosso script rodar (ex: vira
    // "itempropx"); o alt="... poster" é mais estável.
    const coverImg =
      document.querySelector('img.img-responsive[alt$="poster"]') ||
      document.querySelector('img[alt$="poster"]') ||
      document.querySelector('img.img-responsive[itemprop="image"]');
    const cover = coverImg ? coverImg.src : null;

    // Nota/reviews: mesmo motivo do cover, não dá pra confiar em
    // [itemprop="ratingValue"] etc. (viram "itempropx" nessa página) —
    // acha pelas classes ".box" (o quadrado laranja com a nota) e ".hfs"
    // (as linhas "Ratings: ..." e "Reviews: ...") e lê o texto puro.
    // IMPORTANTE: chamada de "communityRating", NUNCA "rating" — esse nome já
    // é o parâmetro da função (a nota que O USUÁRIO escolhe dar, opcional).
    // Foi exatamente reusar o nome "rating" aqui que causou o bug de marcar
    // Completed sempre e submeter a nota da comunidade como se fosse do
    // usuário.
    let communityRating = null, ratingCount = null, statsUrl = null;
    let reviewCount = null, reviewsUrl = null;

    const ratingBox = document.querySelector(".box.deep-orange") || document.querySelector('.box[class*="orange"]');
    if (ratingBox) communityRating = ratingBox.textContent.trim();

    const hfsLines = Array.from(document.querySelectorAll(".hfs"));

    const ratingsLine = hfsLines.find((el) => el.textContent.trim().startsWith("Ratings:"));
    if (ratingsLine) {
      const b = ratingsLine.querySelector("b");
      if (!communityRating && b) communityRating = b.textContent.trim();
      const countMatch = ratingsLine.textContent.match(/from\s+([\d,]+)\s+users/i);
      if (countMatch) ratingCount = countMatch[1];
      const link = ratingsLine.querySelector("a[href]");
      if (link) statsUrl = new URL(link.getAttribute("href"), location.origin).href;
    }

    const reviewsLine = hfsLines.find((el) => el.textContent.trim().startsWith("Reviews:"));
    if (reviewsLine) {
      const link = reviewsLine.querySelector("a[href]");
      if (link) {
        reviewsUrl = new URL(link.getAttribute("href"), location.origin).href;
        const countMatch = link.textContent.match(/[\d,]+/);
        reviewCount = countMatch ? countMatch[0] : link.textContent.trim();
      }
    }

    try {
      const addBtn = document.querySelector(".btn-manage-list");
      if (!addBtn) throw new Error("Botão 'Add to List' não encontrado nesta página.");
      addBtn.click();

      // espera o dialog do Element UI renderizar e o input aparecer
      const input = await waitFor('.el-input__inner[type="number"]');

      // O input aparece antes do Vue terminar de preencher o "max" real
      // (carregamento assíncrono do total de episódios do título) — ler
      // direto na hora já causou um "total" errado (ex: pegou "1" antes
      // de virar "32"), o que fez marcar Completed num episódio que não
      // era o último. Por segurança, espera um instante e relê; se o
      // valor mudou nesse meio tempo, confia no mais recente.
      let total = input.max ? parseInt(input.max, 10) : null;
      await sleep(500);
      const totalRecheck = input.max ? parseInt(input.max, 10) : null;
      if (totalRecheck !== null) total = totalRecheck;

      setNativeValue(input, episodeNumber);

      // Nota (opcional): se tiver, ela por si só já implica Completed.
      const ratingSelect = document.querySelector("select.select-rating");
      if (rating && ratingSelect) setNativeValue(ratingSelect, String(rating));

      // Último episódio: marca como Completed automaticamente, independente
      // de ter nota ou não. Em qualquer outro episódio, garante que o
      // status vira "Currently watching" — sem isso, um título que estava
      // em "Plan to watch" (ou On-hold, etc.) continuava lá mesmo com o
      // episódio marcado.
      //
      // DE PROPÓSITO essa é a ÚLTIMA coisa setada antes do Submit — já
      // teve caso de episódio 1 (num título recém adicionado) ser marcado
      // como Completed sem motivo aparente; se algo no próprio dialog do
      // MDL reage ao valor do episódio e tenta mudar o status sozinho,
      // setar isso por último garante que a nossa escolha é a que vale.
      const isFinalEpisode = total !== null && episodeNumber === total;
      const statusSelect = document.querySelector("select.select-watch-status");
      const statusBefore = statusSelect ? statusSelect.value : null;
      const statusFound = Boolean(statusSelect);
      let statusAfter = null;

      // Todos os selects de status que existem na página nesse momento —
      // se tiver mais de um (ex: um escondido/duplicado de outro dialog
      // que não fechou), ".select-watch-status" pode estar pegando o
      // errado. Isso vai pro debug pra confirmar.
      const allStatusSelects = Array.from(document.querySelectorAll("select.select-watch-status")).length;

      if (statusSelect) {
        setNativeValue(statusSelect, rating || isFinalEpisode ? "2" : "1"); // 2 = Completed, 1 = Currently watching
        statusAfter = statusSelect.value;
      }

      const debug = {
        episodeNumber, total, isFinalEpisode, statusFound, statusBefore, statusAfter, allStatusSelects
      };

      // acha o botão de submit pelo texto do <span> filho
      const submitSpan = Array.from(document.querySelectorAll("span")).find(
        (s) => s.textContent.trim() === "Submit"
      );
      if (!submitSpan) throw new Error("Botão 'Submit' não encontrado.");
      const submitBtn = submitSpan.closest("button") || submitSpan;
      submitBtn.click();

      return { marked: true, total, cover, communityRating, ratingCount, statsUrl, reviewCount, reviewsUrl, debug };
    } catch (err) {
      console.warn("[MDL Sync] Erro ao marcar episódio:", err.message);
      return { marked: false, total: null, cover, communityRating, ratingCount, statsUrl, reviewCount, reviewsUrl };
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
