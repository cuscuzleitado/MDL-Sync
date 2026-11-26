// ============================================================
// PARSER: VLC Web Interface (http://localhost:8080)
// ============================================================
// Diferente dos outros sites, o VLC não tem uma tag <video> HTML nem uma
// URL que muda por episódio — a página é sempre localhost:8080/mobile.html,
// não importa o que está tocando. Por isso este arquivo NÃO usa o fluxo
// padrão (MDLSyncCommon.init) e implementa sua própria detecção por
// polling, tanto pro nome do arquivo quanto pro progresso (via
// /requests/status.json, a API nativa do VLC).
//
// PRÉ-REQUISITO: habilitar a interface Web do VLC
//   Ferramentas > Preferências > Mostrar todas (canto inferior esquerdo) >
//   Interface > Interfaces principais > marcar "Web" > aba "Lua" que
//   aparece > definir uma senha.
//
// Precisa que este arquivo seja carregado DEPOIS de content/common.js no
// manifest.json (ele usa window.MDLSyncCommon por baixo). Veja o final
// deste arquivo pra instrução de manifest.
// ============================================================

const VLC_POLL_INTERVAL_MS = 2000;
const VLC_MIN_EPISODE_DURATION_SECONDS = 180; // ignora prévias/clipes curtos
// Mesma configuração compartilhada com os outros sites (chave "syncThreshold"
// no storage, definida na página de opções). Ver common.js para o comentário
// completo sobre por que isso é "let" + listener.
let VLC_AUTO_SYNC_THRESHOLD = 0.8;

chrome.storage.local.get("syncThreshold", ({ syncThreshold }) => {
  if (typeof syncThreshold === "number") VLC_AUTO_SYNC_THRESHOLD = syncThreshold;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.syncThreshold && typeof changes.syncThreshold.newValue === "number") {
    VLC_AUTO_SYNC_THRESHOLD = changes.syncThreshold.newValue;
  }
});

// Padrões de nome de arquivo reconhecidos. Se um arquivo seu não bater
// com nenhum, me manda o nome exato — é só adicionar mais uma entrada
// aqui, igual fazemos com os parsers de site.
const VLC_FILENAME_PATTERNS = [
  // "THOUSAND YEARS FOR YOU - EP01.mp4" / "Drama Name - Ep 5.mkv"
  {
    regex: /^(.+?)\s*-\s*ep\.?\s*(\d+)/i,
    name: (m) => m[1],
    season: () => 1,
    episode: (m) => parseInt(m[2], 10)
  },
  // "Drama.Name.S01E05.1080p.mkv"
  {
    regex: /^(.+?)[.\s]+S(\d+)E(\d+)/i,
    name: (m) => m[1].replace(/\./g, " "),
    season: (m) => parseInt(m[2], 10),
    episode: (m) => parseInt(m[3], 10)
  },
  // "[Grupo] Drama Name - 05.mkv"
  {
    regex: /^\[[^\]]+\]\s*(.+?)\s*-\s*(\d+)/i,
    name: (m) => m[1],
    season: () => 1,
    episode: (m) => parseInt(m[2], 10)
  }
];

function vlcParseFilename(filename) {
  const withoutExt = filename.replace(/\.\w{2,4}$/, "");

  for (const pattern of VLC_FILENAME_PATTERNS) {
    const match = withoutExt.match(pattern.regex);
    if (match) {
      const title = pattern.name(match).trim();
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return { title, season: pattern.season(match), episode: pattern.episode(match), slug };
    }
  }

  return null;
}

// Lê o nome do arquivo direto do elemento #mediaTitle da interface do VLC.
function vlcFindFilenameOnPage() {
  const el = document.getElementById("mediaTitle");
  return el?.textContent?.trim() || null;
}

async function vlcFetchStatus() {
  try {
    const res = await fetch("/requests/status.json", { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Plano B: lê o progresso direto dos elementos #currentTime/#totalTime da
// própria página (formato "HH:MM:SS" ou "MM:SS"), caso o /status.json
// falhe por algum motivo (ex: autenticação).
function vlcParseTimeToSeconds(text) {
  if (!text) return null;
  const parts = text.trim().split(":").map(Number);
  if (parts.some((n) => isNaN(n))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function vlcGetProgressFromDOM() {
  const current = vlcParseTimeToSeconds(document.getElementById("currentTime")?.textContent);
  const total = vlcParseTimeToSeconds(document.getElementById("totalTime")?.textContent);
  if (current === null || total === null) return null;
  return { time: current, length: total };
}

let vlcLastKey = null;
let vlcSyncedForCurrentFile = false;

// ------------------------------------------------------------
// Discord presence do VLC (mesmo app local dos outros sites).
// O VLC não passa pelo fluxo padrão do common.js, então manda o
// estado daqui mesmo, a cada poll. O background junta com a
// capa/total do MDL (se o drama já estiver mapeado) e entrega ao app.
// ------------------------------------------------------------
const VLC_PRESENCE_MIN_INTERVAL_MS = 5000;
let vlcPresenceActive = false;
let vlcPresenceLastSent = 0;
let vlcPresenceLastPaused = null;
let vlcPresenceLastTime = null;
let vlcPresenceLastKey = null;

function vlcPresenceEnabled() {
  // PRESENCE_ENABLED é definido no common.js (mesmo escopo de content scripts).
  const on = typeof PRESENCE_ENABLED === "undefined" || PRESENCE_ENABLED;
  return on && !window.MDLSyncCommon._excluded;
}

function vlcClearPresence() {
  if (!vlcPresenceActive) return;
  vlcPresenceActive = false;
  vlcPresenceLastPaused = null;
  vlcPresenceLastTime = null;
  window.MDLSyncCommon._sendPresence({ type: "PRESENCE_CLEAR" });
}

function vlcSendPresence(episodeData, status) {
  const hasEpisode = status.length && status.length >= VLC_MIN_EPISODE_DURATION_SECONDS;
  if (!vlcPresenceEnabled() || !hasEpisode || status.state === "stopped") {
    vlcClearPresence();
    return;
  }

  // /status.json diz se está tocando ou pausado; o plano B (DOM) não diz,
  // então nesse caso considera pausado se o tempo não andou desde o último poll.
  const paused =
    typeof status.state === "string"
      ? status.state !== "playing"
      : vlcPresenceLastTime !== null && status.time === vlcPresenceLastTime;

  // Reenvia a cada 5s, ou na hora se mudou play/pause, episódio ou teve seek.
  const now = Date.now();
  const expectedTime =
    vlcPresenceLastTime === null || vlcPresenceLastPaused ? null : vlcPresenceLastTime + (now - vlcPresenceLastSent) / 1000;
  const jumped = expectedTime !== null && Math.abs(status.time - expectedTime) > 3;
  const changed =
    paused !== vlcPresenceLastPaused || vlcPresenceLastKey !== vlcLastKey || jumped;

  vlcPresenceLastTime = status.time;
  if (!changed && now - vlcPresenceLastSent < VLC_PRESENCE_MIN_INTERVAL_MS) return;

  vlcPresenceLastSent = now;
  vlcPresenceLastPaused = paused;
  vlcPresenceLastKey = vlcLastKey;
  vlcPresenceActive = true;

  window.MDLSyncCommon._sendPresence({
    type: "PRESENCE_UPDATE",
    data: {
      key: episodeData.key,
      site: episodeData.site,
      title: episodeData.title,
      season: episodeData.season,
      episode: episodeData.episode,
      currentTime: status.time,
      duration: status.length,
      rate: status.rate || 1,
      paused
    }
  });
}

window.addEventListener("pagehide", () => vlcClearPresence());

// ------------------------------------------------------------
// Pulador (tecla de atalho) e Skip op no VLC
//
// A página do VLC Web não tem <video> (é só um painel de controle), então
// aqui o pulo é feito mandando o comando "seek" pro próprio VLC, pela API
// dele (/requests/status.json?command=seek&val=...). A tecla só funciona
// com a aba do VLC Web em foco (é nela que a extensão roda).
// ------------------------------------------------------------
let vlcQuickSkip = null; // { seconds, key: { code, ctrl, alt, shift } | null }
let vlcSkipOpMap = {}; // { [key]: { from, to } }
let vlcLastStatus = null;
let vlcSkipOpKey = null;
let vlcSkipOpArmed = false;

chrome.storage.local.get(["quickSkip", "skipOpMap"], ({ quickSkip, skipOpMap }) => {
  vlcQuickSkip = quickSkip || null;
  vlcSkipOpMap = skipOpMap || {};
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.quickSkip) vlcQuickSkip = changes.quickSkip.newValue || null;
  if (changes.skipOpMap) vlcSkipOpMap = changes.skipOpMap.newValue || {};
});

// value: "+85S" (avança 85s) ou "100S" (vai pro segundo 100).
async function vlcSeek(value) {
  try {
    const res = await fetch(`/requests/status.json?command=seek&val=${encodeURIComponent(value)}`, {
      credentials: "include",
      cache: "no-store"
    });
    return res.ok;
  } catch (err) {
    console.warn("[MDL Sync] (VLC) Seek falhou:", err);
    return false;
  }
}

document.addEventListener(
  "keydown",
  async (e) => {
    const q = vlcQuickSkip;
    if (!q || !q.key || !q.seconds) return;
    if (window.MDLSyncCommon._excluded) return;
    if (e.code !== q.key.code || e.ctrlKey !== Boolean(q.key.ctrl) || e.altKey !== Boolean(q.key.alt) || e.shiftKey !== Boolean(q.key.shift) || e.metaKey) return;

    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // digitando

    const st = vlcLastStatus;
    if (!st || st.state === "stopped" || !st.length || st.length < VLC_MIN_EPISODE_DURATION_SECONDS) {
      console.log("[MDL Sync] (VLC) Quick skip: tecla reconhecida, mas não há episódio tocando no VLC.");
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (await vlcSeek(`+${q.seconds}S`)) {
      window.MDLSyncCommon._toast(`+${q.seconds}s`);
      console.log(`[MDL Sync] (VLC) Quick skip: +${q.seconds}s`);
    }
  },
  true
);

// Mesma regra do skip op dos sites: pula quando chega em "from", uma vez
// por abertura do episódio (reativa quando o vídeo volta pro começo).
function vlcApplySkipOp(episodeData, status) {
  if (vlcSkipOpKey !== vlcLastKey) {
    vlcSkipOpKey = vlcLastKey;
    vlcSkipOpArmed = true;
  }
  if (status.time < 1) vlcSkipOpArmed = true; // episódio aberto/reaberto em 0:00

  if (!vlcSkipOpArmed || window.MDLSyncCommon._excluded) return;
  const rule = vlcSkipOpMap[episodeData.key];
  if (!rule || !(rule.to > rule.from)) return;
  if (!status.length || status.length < VLC_MIN_EPISODE_DURATION_SECONDS || status.state === "stopped") return;

  if (status.time >= rule.to) {
    vlcSkipOpArmed = false; // já passou da abertura
  } else if (status.time >= rule.from) {
    vlcSkipOpArmed = false;
    vlcSeek(`${Math.floor(rule.to)}S`).then((ok) => {
      if (ok) window.MDLSyncCommon._toast("Opening skipped");
    });
  }
}

async function vlcPoll() {
  const filename = vlcFindFilenameOnPage();
  if (!filename) return;

  const parsed = vlcParseFilename(filename);
  if (!parsed) {
    console.log("[MDL Sync] (VLC) Nome de arquivo não reconhecido:", filename);
    return;
  }

  const episodeData = {
    title: parsed.title,
    season: parsed.season,
    episode: parsed.episode,
    site: "vlc-local",
    key: `vlc-local:${parsed.slug}`
  };

  const status = (await vlcFetchStatus()) || vlcGetProgressFromDOM();
  if (!status) return;
  vlcLastStatus = status;

  const currentKey = `${episodeData.key}:${episodeData.episode}`;
  if (currentKey !== vlcLastKey) {
    vlcLastKey = currentKey;
    vlcSyncedForCurrentFile = false;

    const alreadySynced = await window.MDLSyncCommon._wasAlreadySynced(episodeData);
    const totalEpisodes = await window.MDLSyncCommon._getTotalEpisodes(episodeData.key);
    const isFinalEpisode = totalEpisodes !== null && episodeData.episode === totalEpisodes;
    const existingRating = isFinalEpisode ? await window.MDLSyncCommon._getRating(episodeData.key) : null;

    // O VLC não passa pelo fluxo padrão do common.js, então salva aqui o
    // "último detectado" que o popup mostra (capa, nota, episódio).
    try {
      chrome.storage.local.set({ lastDetected: episodeData });
    } catch {
      // contexto da extensão invalidado — ignora
    }

    console.log("[MDL Sync] (VLC) Episódio detectado:", episodeData);
    window.MDLSyncCommon._createSyncBadge(episodeData, { alreadySynced, isFinalEpisode, existingRating });
    vlcSyncedForCurrentFile = alreadySynced;
  }

  try {
    vlcSendPresence(episodeData, status);
  } catch (err) {
    console.warn("[MDL Sync] (VLC) Presence error:", err);
  }
  try {
    vlcApplySkipOp(episodeData, status);
  } catch (err) {
    console.warn("[MDL Sync] (VLC) Skip op error:", err);
  }

  if (vlcSyncedForCurrentFile) return;
  if (!status.length || status.length < VLC_MIN_EPISODE_DURATION_SECONDS) return;

  const pct = status.time / status.length;
  if (pct >= VLC_AUTO_SYNC_THRESHOLD) {
    vlcSyncedForCurrentFile = true;
    console.log("[MDL Sync] (VLC) 80% atingido — sincronizando automaticamente...");

    window.MDLSyncCommon._sendSyncMessage({ type: "SYNC_EPISODE", source: "auto", data: episodeData }, (response) => {
      if (response?.ok) {
        window.MDLSyncCommon._markAsSynced(episodeData);
        window.MDLSyncCommon._setBadgeSyncedState("Synced automatically ✓");
        window.MDLSyncCommon._checkAndShowFinalRatingRow(episodeData, response.result);
        console.log("[MDL Sync] (VLC) Auto-sync concluído.");
      } else {
        console.warn("[MDL Sync] (VLC) Auto-sync falhou:", response?.error);
        vlcSyncedForCurrentFile = false; // permite tentar de novo no próximo poll
      }
    });
  }
}

// Site excluído nas Settings (More > Excluded sites): não faz nada aqui.
chrome.storage.local.get("excludedSites", ({ excludedSites }) => {
  const info = mdlSiteInfo("vlc-local");
  window.MDLSyncCommon._siteInfo = info;
  window.MDLSyncCommon._excluded = Boolean((excludedSites || {})[info.id]);
  if (window.MDLSyncCommon._excluded) {
    console.log("[MDL Sync] (VLC) Site excluído nas Settings — extensão desligada aqui.");
    return;
  }
  setInterval(vlcPoll, VLC_POLL_INTERVAL_MS);
  vlcPoll();
});

// ============================================================
// Pra ativar, adicione estas duas partes no manifest.json:
//
// Em "host_permissions", adicione:
//   "http://localhost:8080/*"
//
// Em "content_scripts", adicione este bloco:
//   {
//     "matches": ["http://localhost:8080/*"],
//     "js": ["content/common.js", "content/vlc-web.js"],
//     "run_at": "document_idle"
//   }
// ============================================================
