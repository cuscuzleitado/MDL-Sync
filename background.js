// Registro de sites compartilhado (MDL_SITES, mdlSiteInfo, mdlPresenceAllowed).
importScripts("sites.js");

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
  entry.title = result.mdlTitle ?? entry.title ?? title; // nome mostrado em Mapped Titles
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

    // Nome do drama no MDL (título da aba sem o " - MyDramaList" e sem o ano),
    // usado pra identificar o mapeamento na lista de Mapped Titles.
    const mdlTitle =
      document.title
        .replace(/\s*-\s*MyDramaList.*$/i, "")
        .replace(/\s*\(\d{4}\)\s*$/, "")
        .trim() || null;

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

      return { marked: true, mdlTitle, total, cover, communityRating, ratingCount, statsUrl, reviewCount, reviewsUrl, debug };
    } catch (err) {
      console.warn("[MDL Sync] Erro ao marcar episódio:", err.message);
      return { marked: false, mdlTitle, total: null, cover, communityRating, ratingCount, statsUrl, reviewCount, reviewsUrl };
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

// ============================================================
// VIKI: SKIP AD (script registrado dinamicamente)
//
// O botão "Skip Ad" fica dentro de iframes do player de anúncios, em
// domínios de terceiros. Pra alcançar esses iframes o script precisa
// rodar em todos os frames, o que exige a permissão opcional
// "<all_urls>" — que só é pedida quando o usuário liga "Skip ad" nas
// Settings. Sem a opção ligada (ou sem a permissão), o script não é
// registrado e a extensão nunca vê nada fora dos sites suportados.
// ============================================================
const VIKI_SKIP_AD_SCRIPT_ID = "mdl-sync-viki-skip-ad";

async function syncVikiSkipAdRegistration() {
  try {
    const { vikiSkipAd } = await chrome.storage.local.get("vikiSkipAd");
    const hasPermission = await chrome.permissions.contains({ origins: ["<all_urls>"] });
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [VIKI_SKIP_AD_SCRIPT_ID] });
    const shouldRun = vikiSkipAd === true && hasPermission;

    if (shouldRun && registered.length === 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: VIKI_SKIP_AD_SCRIPT_ID,
          matches: ["<all_urls>"],
          js: ["content/viki-skip-ad.js"],
          allFrames: true,
          // cobre também os frames about:blank/srcdoc/blob:/data: criados por anúncios
          matchOriginAsFallback: true,
          runAt: "document_idle",
          persistAcrossSessions: true
        }
      ]);
    } else if (!shouldRun && registered.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [VIKI_SKIP_AD_SCRIPT_ID] });
    }
  } catch (err) {
    console.warn("[MDL Sync] Could not update the Skip ad script:", err);
  }
}

chrome.runtime.onInstalled.addListener(syncVikiSkipAdRegistration);
chrome.runtime.onStartup.addListener(syncVikiSkipAdRegistration);
chrome.permissions.onAdded.addListener(syncVikiSkipAdRegistration);
chrome.permissions.onRemoved.addListener(syncVikiSkipAdRegistration);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.vikiSkipAd) syncVikiSkipAdRegistration();
});

// ============================================================
// DISCORD PRESENCE
//
// Recebe do content script (common.js) o que está tocando, junta com a
// capa/total/link do MDL que já ficaram salvos no mdlMap depois do sync,
// e entrega pro app local "MDL-Sync Presence" (HTTP em 127.0.0.1), que é
// quem de fato fala com o Discord — o navegador não consegue.
//
// HTTP (e não WebSocket) de propósito: no Manifest V3 o service worker é
// desligado quando fica ocioso, e uma conexão aberta se perderia. Cada
// aviso é um POST curto; o content script reenvia a cada ~5s.
// ============================================================
const PRESENCE_ENDPOINT = "http://127.0.0.1:17831"; // mesma porta do config.json do app
const PRESENCE_OWNER_STALE_MS = 15000;

let presenceTabId = null; // aba "dona" da atividade agora
let presenceLastUpdate = 0;
let presenceLastPaused = true;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message) return;
  const tabId = sender.tab ? sender.tab.id : null;
  if (message.type === "PRESENCE_UPDATE") handlePresenceUpdate(message.data, tabId);
  else if (message.type === "PRESENCE_CLEAR") handlePresenceClear(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => handlePresenceClear(tabId));

async function handlePresenceUpdate(data, tabId) {
  if (!data || typeof tabId !== "number") return;

  // Liga/desliga geral e por site (Settings > Discord presence).
  const { presenceEnabled, presenceSites } = await chrome.storage.local.get(["presenceEnabled", "presenceSites"]);
  const allowed = presenceEnabled !== false && mdlPresenceAllowed(mdlSiteInfo(data.site), presenceSites);
  if (!allowed) {
    handlePresenceClear(tabId); // se essa aba era a dona da atividade, tira do ar
    return;
  }

  // Duas abas tocando ao mesmo tempo: a aba que já é dona continua sendo.
  // Outra só assume se estiver tocando e a dona estiver pausada (ou sumiu).
  const now = Date.now();
  const ownerFresh = presenceTabId !== null && now - presenceLastUpdate < PRESENCE_OWNER_STALE_MS;
  if (ownerFresh && presenceTabId !== tabId && (data.paused || !presenceLastPaused)) return;

  presenceTabId = tabId;
  presenceLastUpdate = now;
  presenceLastPaused = Boolean(data.paused);

  // Capa/total/link só existem depois do primeiro sync desse título no MDL.
  const { mdlMap } = await chrome.storage.local.get("mdlMap");
  let entry = (mdlMap || {})[data.key];
  if (typeof entry === "string") entry = { url: entry };
  entry = entry || {};

  deliverPresence("/presence", {
    title: data.title,
    season: data.season || null,
    episode: data.episode,
    total: entry.total || null,
    cover: entry.cover || null,
    url: entry.url || null,
    currentTime: data.currentTime,
    duration: data.duration,
    rate: data.rate,
    paused: Boolean(data.paused)
  });
}

function handlePresenceClear(tabId) {
  if (tabId === null || tabId !== presenceTabId) return;
  presenceTabId = null;
  deliverPresence("/clear", {});
}

async function postToPresenceApp(route, body) {
  try {
    await fetch(PRESENCE_ENDPOINT + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000)
    });
  } catch {
    // App não está rodando (ou Discord fechado) — sem problema, o próximo aviso tenta de novo.
  }
}

// ============================================================
// DISCORD — MODO "LOGIN DA CONTA" (sem precisar do app local)
//
// Logado, a atividade vai direto da extensão pro Discord pela sua conta
// (Gateway). Como o service worker do MV3 é desligado quando fica
// ocioso, a conexão em si mora no documento offscreen.html / offscreen.js
// e este arquivo só manda comandos pra lá.
//
// ATENÇÃO: esse modo usa a sessão da sua conta e não é suportado
// oficialmente pelo Discord (os termos não permitem automatizar contas de
// usuário). Por isso o app local continua existindo como plano B — sem
// login, tudo segue passando por ele, como antes.
// ============================================================
const DISCORD_API = "https://discord.com/api/v10";
// Aplicação do Discord usada pra registrar as capas (asset externo). Fica
// fixa pra ninguém precisar criar uma própria.
const DISCORD_APP_ID = "1575093209288155236";
const DISCORD_TOKEN_RE = /^(mfa\.[\w-]{20,}|[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,})$/;
const DISCORD_LOGIN_WINDOW_MS = 10 * 60 * 1000; // quanto tempo o botão de login "escuta" depois de clicado
const DISCORD_MIN_SEND_INTERVAL_MS = 4000; // o Discord limita atualizações de presença
const DISCORD_DRIFT_TOLERANCE_MS = 4000; // só reenvia por mudança de tempo se pular mais que isso (seek)

let discordLastSig = null;
let discordLastStart = null;
let discordLastEnd = null;
let discordLastSentAt = 0;
const discordCoverInflight = new Map();
const discordCoverFailures = new Map();

// Roteia a presença: logado = Gateway (via offscreen); senão = app local.
async function deliverPresence(route, body) {
  const { discordToken, discordTokenInvalid } = await chrome.storage.local.get(["discordToken", "discordTokenInvalid"]);
  if (!discordToken || discordTokenInvalid || !chrome.offscreen) {
    postToPresenceApp(route, body);
    return;
  }
  try {
    await deliverViaDiscordAccount(route, body, discordToken);
  } catch (err) {
    console.warn("[MDL Sync] Discord presence error:", err);
  }
}

let offscreenCreating = null;
async function ensureOffscreen() {
  if (offscreenCreating) return offscreenCreating;
  if (chrome.runtime.getContexts) {
    const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    if (existing.length) return;
  }
  offscreenCreating = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification: "Keeps the connection to Discord open so the presence keeps working while the service worker sleeps."
      });
    } catch (err) {
      // "Only a single offscreen document may be created" = já existe, tudo certo.
      if (!/single|already/i.test(String(err && err.message))) throw err;
    } finally {
      offscreenCreating = null;
    }
  })();
  return offscreenCreating;
}

function sendToOffscreen(message) {
  chrome.runtime.sendMessage({ target: "offscreen", ...message }, () => void chrome.runtime.lastError);
}

function discordClip(text, max) {
  const s = String(text || "").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function discordEpisodeLabel(b) {
  const season = b.season && b.season > 1 ? `Season ${b.season} · ` : "";
  return season + (b.total ? `Episode ${b.episode}/${b.total}` : `Episode ${b.episode}`);
}

async function deliverViaDiscordAccount(route, body, token) {
  await ensureOffscreen();

  if (route === "/clear") {
    discordLastSig = null;
    sendToOffscreen({ cmd: "clear" });
    return;
  }

  const { discordStatus } = await chrome.storage.local.get("discordStatus");
  const discordAppId = DISCORD_APP_ID;
  const status = ["online", "idle", "dnd"].includes(discordStatus) ? discordStatus : "online";
  const now = Date.now();

  const cover = await resolveDiscordCover(body.cover, discordAppId, token);
  const title = discordClip(body.title, 128);

  // Cabeçalho: "Watching <drama>" (name). Linha 1: o nome do drama de novo.
  // Linha 2: "Episode x/xx". (Sempre as duas linhas preenchidas e diferentes:
  // no celular, com só uma, o Discord repetia a mesma linha duas vezes.)
  const label = discordEpisodeLabel(body);
  const activity = {
    name: title,
    type: 3, // Watching
    details: title,
    state: discordClip(body.paused ? `⏸ Paused · ${label}` : label, 128),
    application_id: discordAppId
  };

  // Timestamps só quando está tocando (barra de progresso do vídeo).
  let start = null;
  let end = null;
  if (!body.paused && body.duration > 0) {
    const rate = body.rate > 0 ? body.rate : 1;
    end = Math.round(now + ((body.duration - body.currentTime) / rate) * 1000);
    start = Math.round(end - (body.duration / rate) * 1000);
    activity.timestamps = { start, end };
  }

  if (cover) activity.assets = { large_image: cover, large_text: title };
  if (body.url && /^https:\/\//.test(body.url)) {
    activity.buttons = ["View on MyDramaList"];
    activity.metadata = { button_urls: [body.url] };
  }

  const sig = JSON.stringify([title, body.season, body.episode, body.total, cover, body.url, body.paused, Math.round(body.duration || 0), status, discordAppId || null]);
  if (sig === discordLastSig) {
    const sameTime =
      (start === null && discordLastStart === null) ||
      (start !== null &&
        discordLastStart !== null &&
        Math.abs(start - discordLastStart) < DISCORD_DRIFT_TOLERANCE_MS &&
        Math.abs(end - discordLastEnd) < DISCORD_DRIFT_TOLERANCE_MS);
    if (sameTime) return; // nada mudou de verdade
  }
  // Muito perto do último envio: o próximo aviso da página (a cada ~5s) entrega o estado final.
  if (now - discordLastSentAt < DISCORD_MIN_SEND_INTERVAL_MS) return;

  discordLastSig = sig;
  discordLastStart = start;
  discordLastEnd = end;
  discordLastSentAt = now;
  sendToOffscreen({ cmd: "presence", token, status, activity });
}

// O Discord só mostra imagens "dele": a capa do MDL precisa ser registrada
// como asset externo da sua aplicação (vira "mp:external/...").
async function resolveDiscordCover(url, appId, token) {
  if (!url || !appId || !/^https:\/\//.test(url)) return null;

  const failedAt = discordCoverFailures.get(url);
  if (failedAt && Date.now() - failedAt < 5 * 60 * 1000) return null;

  const { discordCoverCache } = await chrome.storage.local.get("discordCoverCache");
  const cache = discordCoverCache || {};
  if (cache[url]) return cache[url];
  if (discordCoverInflight.has(url)) return discordCoverInflight.get(url);

  const job = (async () => {
    try {
      const res = await fetch(`${DISCORD_API}/applications/${appId}/external-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ urls: [url] }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const path = Array.isArray(data) && data[0] && data[0].external_asset_path;
      if (!path) throw new Error("resposta sem external_asset_path");

      cache[url] = `mp:${path}`;
      const keys = Object.keys(cache);
      if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete cache[k];
      await chrome.storage.local.set({ discordCoverCache: cache });
      return cache[url];
    } catch (err) {
      discordCoverFailures.set(url, Date.now());
      console.warn("[MDL Sync] Discord cover upload failed:", err.message);
      return null;
    } finally {
      discordCoverInflight.delete(url);
    }
  })();
  discordCoverInflight.set(url, job);
  return job;
}

// ---------- Login ----------
// "Log in with Discord" abre o login normal do Discord (com senha, 2FA e
// captcha do próprio site) e, depois de logado, a extensão lê o token no
// cabeçalho das requisições que o site do Discord faz. Nada de senha passa
// pela extensão.
chrome.webRequest.onSendHeaders.addListener(
  onDiscordRequestHeaders,
  { urls: ["https://discord.com/api/*"], types: ["xmlhttprequest"] },
  ["requestHeaders", "extraHeaders"]
);

async function onDiscordRequestHeaders(details) {
  const { discordLoginPending } = await chrome.storage.session.get("discordLoginPending");
  if (!discordLoginPending || Date.now() - discordLoginPending > DISCORD_LOGIN_WINDOW_MS) return;

  const header = (details.requestHeaders || []).find((h) => h.name.toLowerCase() === "authorization");
  const value = header && header.value ? header.value.trim() : "";
  if (!DISCORD_TOKEN_RE.test(value)) return;

  await chrome.storage.session.remove("discordLoginPending"); // só pega uma vez
  try {
    const name = await saveDiscordToken(value);
    notify("Discord connected", `Logged in as ${name}. Your watching activity will show up on Discord.`);
  } catch (err) {
    notify("Discord login failed", err.message);
  }
}

async function saveDiscordToken(token) {
  const res = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: token } });
  if (!res.ok) throw new Error(res.status === 401 ? "Discord rejected this login." : `Discord error (HTTP ${res.status}).`);
  const me = await res.json();
  const name = me.global_name || me.username || "your account";
  await chrome.storage.local.set({
    discordToken: token,
    discordUser: { id: me.id, name },
    discordTokenInvalid: false
  });
  await chrome.storage.local.remove("discordGatewayState");
  return name;
}

async function discordLogout() {
  discordLastSig = null;
  sendToOffscreen({ cmd: "logout" });
  await chrome.storage.local.remove(["discordToken", "discordUser", "discordTokenInvalid", "discordGatewayState"]);
  try {
    if (chrome.offscreen) await chrome.offscreen.closeDocument();
  } catch {
    // não havia documento aberto — ok
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  if (message.type === "DISCORD_LOGIN_START") {
    chrome.storage.session.set({ discordLoginPending: Date.now() }).then(() => {
      chrome.tabs.create({ url: "https://discord.com/login" });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "DISCORD_LOGOUT") {
    discordLogout().then(() => sendResponse({ ok: true }));
    return true;
  }

  // Estado da conexão, vindo do offscreen.js.
  if (message.type === "GATEWAY_STATE") {
    chrome.storage.local.set({ discordGatewayState: { state: message.state, detail: message.detail } });
    if (message.state === "error" && message.detail === "auth-failed") {
      chrome.storage.local.set({ discordTokenInvalid: true });
      notify("Discord login expired", "Open the MDL-Sync popup → Settings and log in with Discord again. Until then the local app is used.");
    }
  }
});

// ============================================================
// CHANGELOG APÓS ATUALIZAÇÃO
//
// Na primeira vez que a extensão roda depois de uma atualização (versão
// diferente da última que o usuário viu), abre a página changelog.html uma
// única vez. Depois disso, só pelo botão em Settings > More > Changelog.
// Recarregar a extensão sem mudar a versão não abre nada.
// ============================================================
chrome.runtime.onInstalled.addListener(async (details) => {
  const version = chrome.runtime.getManifest().version;
  const { changelogSeenVersion } = await chrome.storage.local.get("changelogSeenVersion");

  if (details.reason === "update") {
    // O Application ID das capas mudou (agora é fixo): limpa o cache antigo
    // e o campo que existia antes nas Settings.
    await chrome.storage.local.remove(["discordCoverCache", "discordAppId"]);
    if (changelogSeenVersion !== version) {
      chrome.tabs.create({ url: chrome.runtime.getURL("changelog.html") });
    }
  }

  if (changelogSeenVersion !== version) await chrome.storage.local.set({ changelogSeenVersion: version });
});
