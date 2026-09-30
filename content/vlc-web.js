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

  const currentKey = `${episodeData.key}:${episodeData.episode}`;
  if (currentKey !== vlcLastKey) {
    vlcLastKey = currentKey;
    vlcSyncedForCurrentFile = false;

    const alreadySynced = await window.MDLSyncCommon._wasAlreadySynced(episodeData);
    const totalEpisodes = await window.MDLSyncCommon._getTotalEpisodes(episodeData.key);
    const isFinalEpisode = totalEpisodes !== null && episodeData.episode === totalEpisodes;
    const existingRating = isFinalEpisode ? await window.MDLSyncCommon._getRating(episodeData.key) : null;

    console.log("[MDL Sync] (VLC) Episódio detectado:", episodeData);
    window.MDLSyncCommon._createSyncBadge(episodeData, { alreadySynced, isFinalEpisode, existingRating });
    vlcSyncedForCurrentFile = alreadySynced;
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

setInterval(vlcPoll, VLC_POLL_INTERVAL_MS);
vlcPoll();

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
