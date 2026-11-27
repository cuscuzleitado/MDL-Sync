// ============================================================
// Popup — tela principal (episódio detectado + mapeamentos), settings
// (páginas 1 e 2), Discord presence e Excluded sites, todas dentro do mesmo
// popup.html. Trocar de tela é só esconder/mostrar uma div, sem navegar
// pra outra página.
// ============================================================

const DEFAULT_THRESHOLD = 0.8;

let currentMdlMap = {};
let currentSkipOpMap = {};

// Nome mostrado nos mapeamentos: o título salvo no sync; nos antigos (sem
// título salvo) sai do final do link do MDL ("760719-fei-dao" -> "Fei Dao");
// por último, a própria chave.
function mappingName(key, entry) {
  if (entry && typeof entry !== "string" && entry.title) return entry.title;
  const url = typeof entry === "string" ? entry : entry && entry.url;
  const m = /mydramalist\.com\/(?:\d+-)?([^/?#]+)/.exec(url || "");
  if (m) return m[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return key;
}

// "ClubDoDorama", ou "Seekee · ver.123pelicula.com" (sites agrupados mostram
// o domínio, pra dar pra diferenciar o mesmo drama mapeado em dois lugares).
function mappingSite(key) {
  const siteName = key.split(":")[0];
  const info = mdlSiteInfo(siteName);
  return info.hosts || info.aliases ? `${info.name} · ${siteName}` : info.name;
}

// "1:40" -> 100, "32" -> 32, "1:02:03" -> 3723. null se não der pra entender.
function parseTime(text) {
  const parts = String(text || "").trim().split(":");
  if (parts.length < 1 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p.trim()))) return null;
  return parts.reduce((total, p) => total * 60 + parseInt(p, 10), 0);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = Math.floor(seconds % 60);
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function renderLastDetected(lastDetected, mdlMap) {
  const el = document.getElementById("lastDetected");
  const link = document.getElementById("mdlLink");
  const coverWrap = document.getElementById("coverWrap");
  const coverImg = document.getElementById("coverImg");
  const ratingRow = document.getElementById("ratingRow");

  if (!lastDetected) return;

  el.className = "item";
  el.innerHTML = "";

  // Só mostra o botão/capa/nota se esse título já tiver um mapeamento
  // salvo (senão não existe ainda uma página do MDL pra apontar).
  const entry = (mdlMap || {})[lastDetected.key];
  const url = entry ? (typeof entry === "string" ? entry : entry.url) : null;
  const cover = entry && typeof entry !== "string" ? entry.cover : null;
  const total = entry && typeof entry !== "string" ? entry.total : null;

  const nameEl = document.createElement("div");
  nameEl.className = "drama-name";
  nameEl.textContent = lastDetected.title;

  const epEl = document.createElement("div");
  epEl.className = "episode-line";
  // "Season" só aparece quando o site realmente informa uma temporada
  // diferente de 1 (a maioria não informa — ver comentário no common.js);
  // "/total" só aparece quando já sabemos o total (depois do 1º sync).
  const episodeText = total ? `Episode ${lastDetected.episode}/${total}` : `Episode ${lastDetected.episode}`;
  epEl.textContent =
    lastDetected.season && lastDetected.season > 1 ? `Season ${lastDetected.season} · ${episodeText}` : episodeText;

  el.appendChild(nameEl);
  el.appendChild(epEl);

  if (url) {
    link.href = url;
    link.classList.remove("hidden");
  } else {
    link.classList.add("hidden");
  }

  if (cover) {
    coverImg.src = cover;
    coverWrap.classList.remove("hidden");
  } else {
    coverWrap.classList.add("hidden");
  }

  renderRating(entry, ratingRow);
}

function renderRating(entry, ratingRow) {
  const rating = entry && typeof entry !== "string" ? entry.rating : null;

  if (!rating) {
    ratingRow.classList.add("hidden");
    return;
  }

  document.getElementById("ratingBox").textContent = rating;

  const ratingText = document.getElementById("ratingText");
  ratingText.textContent = entry.ratingCount ? `${rating}/10 from ${entry.ratingCount} users` : `${rating}/10`;

  const statsLink = document.getElementById("statsLink");
  if (entry.statsUrl) {
    statsLink.href = entry.statsUrl;
    statsLink.classList.remove("hidden");
  } else {
    statsLink.classList.add("hidden");
  }

  const reviewsLink = document.getElementById("reviewsLink");
  const reviewText = document.getElementById("reviewText");
  if (entry.reviewsUrl) {
    reviewsLink.href = entry.reviewsUrl;
    reviewText.textContent = entry.reviewCount ? `${entry.reviewCount} users` : "See reviews";
    reviewsLink.classList.remove("hidden");
  } else {
    reviewsLink.classList.add("hidden");
  }

  ratingRow.classList.remove("hidden");
}

function renderMappings(mdlMap) {
  currentMdlMap = mdlMap || {};
  const container = document.getElementById("mappings");
  const entries = Object.entries(currentMdlMap);

  document.getElementById("mappedCount").textContent = entries.length;

  if (entries.length === 0) {
    container.className = "empty";
    container.textContent = "No titles mapped yet.";
    return;
  }

  container.className = "";
  container.innerHTML = "";

  for (const [key, entry] of entries) {
    // Compatibilidade: mapeamentos salvos antes da v0.1.2 eram só a URL
    // como string; agora é um objeto { url, total }.
    const url = typeof entry === "string" ? entry : entry.url;
    const total = typeof entry === "string" ? null : entry.total;

    const row = document.createElement("div");
    row.className = "map-row";

    const info = document.createElement("div");
    info.className = "map-info";

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.textContent = mappingName(key, entry);
    link.title = `${url}\n${key}`;
    info.appendChild(link);

    const sub = document.createElement("div");
    sub.className = "map-sub";
    sub.textContent = total ? `${mappingSite(key)} · ${total} eps` : mappingSite(key);
    info.appendChild(sub);
    row.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "map-actions";

    const rule = currentSkipOpMap[key];
    const skipBtn = document.createElement("button");
    skipBtn.className = "skip-btn" + (rule ? " on" : "");
    skipBtn.textContent = "Skip OP";
    skipBtn.title = rule ? `Skips ${formatTime(rule.from)} → ${formatTime(rule.to)}` : "Skip the opening automatically";
    skipBtn.onclick = () => openSkipOp(key);
    actions.appendChild(skipBtn);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async () => {
      const { mdlMap, skipOpMap } = await chrome.storage.local.get(["mdlMap", "skipOpMap"]);
      delete mdlMap[key];
      const updates = { mdlMap };
      if (skipOpMap && skipOpMap[key]) {
        delete skipOpMap[key];
        updates.skipOpMap = skipOpMap;
        currentSkipOpMap = skipOpMap;
      }
      await chrome.storage.local.set(updates);
      row.remove();
      if (Object.keys(mdlMap).length === 0) renderMappings({});
    };
    actions.appendChild(removeBtn);
    row.appendChild(actions);

    container.appendChild(row);
  }
}

chrome.storage.local.get(["lastDetected", "mdlMap", "skipOpMap"], ({ lastDetected, mdlMap, skipOpMap }) => {
  currentSkipOpMap = skipOpMap || {};
  renderLastDetected(lastDetected, mdlMap);
  renderMappings(mdlMap);
});

// --- Troca de tela ---
const VIEW_IDS = ["mainView", "mappedView", "skipOpView", "settingsView", "settings2View", "discordView", "excludeView"];

function showView(id) {
  for (const viewId of VIEW_IDS) document.getElementById(viewId).classList.toggle("hidden", viewId !== id);
}

const go = (buttonId, viewId, before) => {
  document.getElementById(buttonId).onclick = () => {
    if (before) before();
    showView(viewId);
  };
};

go("settingsBtn", "settingsView", () => renderDiscordChip());
go("backBtn", "mainView");
go("page2Btn", "settings2View", () => renderExcludeChip());
go("page2BackBtn", "settingsView");
go("discordBtn", "discordView", () => {
  renderDiscord();
  renderPresenceSites();
});
go("discordBackBtn", "settingsView", () => renderDiscordChip());
go("excludeBtn", "excludeView", () => renderExcludeSites());
go("excludeBackBtn", "settings2View", () => renderExcludeChip());
go("mappedBtn", "mappedView");
go("mappedBackBtn", "mainView");

// --- Threshold (mesma lógica que estava em options.js) ---
const thresholdContainer = document.getElementById("thresholdOptions");

function markActiveLabel(value) {
  thresholdContainer.querySelectorAll("label").forEach((label) => {
    label.classList.toggle("active", label.dataset.value === String(value));
  });
}

function flashSaved() {
  const notes = document.querySelectorAll(".saved-note");
  notes.forEach((n) => n.classList.add("show"));
  setTimeout(() => notes.forEach((n) => n.classList.remove("show")), 1200);
}

chrome.storage.local.get("syncThreshold", ({ syncThreshold }) => {
  const current = typeof syncThreshold === "number" ? syncThreshold : DEFAULT_THRESHOLD;
  const radio = thresholdContainer.querySelector(`input[value="${current}"]`);
  if (radio) radio.checked = true;
  markActiveLabel(current);
});

thresholdContainer.addEventListener("change", (event) => {
  const value = parseFloat(event.target.value);
  chrome.storage.local.set({ syncThreshold: value }, () => {
    markActiveLabel(value);
    flashSaved();
  });
});

// --- Extras: Skip ad / Skip intro (Viki) e Resume playback ---
// Padrões: os dois do Viki começam desligados (são opcionais); o resume
// começa ligado, com o interruptor pra quem não quiser.
const EXTRA_DEFAULTS = { vikiSkipAd: false, vikiSkipIntro: false, resumeEnabled: true, presenceEnabled: true };
const SKIP_AD_ORIGINS = ["<all_urls>"]; // permissão opcional, pedida só ao ligar o Skip ad
const extraInputs = document.querySelectorAll("input[data-extra]");

function setExtraToggle(input, on) {
  input.checked = on;
  input.closest("label").classList.toggle("active", on);
}

chrome.storage.local.get(Object.keys(EXTRA_DEFAULTS), async (stored) => {
  for (const input of extraInputs) {
    const key = input.dataset.extra;
    setExtraToggle(input, typeof stored[key] === "boolean" ? stored[key] : EXTRA_DEFAULTS[key]);
  }

  // Skip ad ligado mas sem a permissão (ex: o pedido foi negado com o popup
  // já fechado): desliga de volta pra não ficar marcado sem funcionar.
  if (stored.vikiSkipAd === true) {
    const hasPermission = await chrome.permissions.contains({ origins: SKIP_AD_ORIGINS });
    if (!hasPermission) {
      const input = document.querySelector('input[data-extra="vikiSkipAd"]');
      setExtraToggle(input, false);
      chrome.storage.local.set({ vikiSkipAd: false });
    }
  }
});

for (const input of extraInputs) {
  input.addEventListener("change", () => {
    const key = input.dataset.extra;
    const on = input.checked;
    setExtraToggle(input, on);

    if (key === "vikiSkipAd" && on) {
      // Salva já (o background registra o script assim que a permissão
      // existir) e pede a permissão direto no clique, que é quando o
      // Chrome aceita o pedido.
      chrome.storage.local.set({ vikiSkipAd: true });
      chrome.permissions.request({ origins: SKIP_AD_ORIGINS }, (granted) => {
        if (granted) {
          flashSaved();
        } else {
          setExtraToggle(input, false);
          chrome.storage.local.set({ vikiSkipAd: false });
        }
      });
      return;
    }

    chrome.storage.local.set({ [key]: on }, () => {
      if (key === "vikiSkipAd" && !on) chrome.permissions.remove({ origins: SKIP_AD_ORIGINS });
      flashSaved();
    });
  });
}


// --- Skip op (tela própria, aberta pelo botão "skip op" em Mapped Titles) ---
const skipOpFrom = document.getElementById("skipOpFrom");
const skipOpTo = document.getElementById("skipOpTo");
const skipOpMsg = document.getElementById("skipOpMsg");
const skipOpClear = document.getElementById("skipOpClear");
const SKIP_OP_HELP = "When an episode of this title reaches the first time, it jumps to the second one.";
let skipOpKey = null;

function openSkipOp(key) {
  skipOpKey = key;
  const rule = currentSkipOpMap[key];
  document.getElementById("skipOpTitle").textContent = `${mappingName(key, currentMdlMap[key])} — ${mappingSite(key)}`;
  skipOpFrom.value = rule ? formatTime(rule.from) : "";
  skipOpTo.value = rule ? formatTime(rule.to) : "";
  skipOpMsg.textContent = SKIP_OP_HELP;
  skipOpClear.classList.toggle("hidden", !rule);
  showView("skipOpView");
  skipOpFrom.focus();
}

function closeSkipOp() {
  showView("mappedView");
  skipOpKey = null;
}

function saveSkipOpMap(map) {
  currentSkipOpMap = map;
  chrome.storage.local.set({ skipOpMap: map }, () => {
    renderMappings(currentMdlMap);
    closeSkipOp();
  });
}

document.getElementById("skipOpCancel").onclick = closeSkipOp;

document.getElementById("skipOpSave").onclick = () => {
  const from = parseTime(skipOpFrom.value);
  const to = parseTime(skipOpTo.value);
  if (from === null || to === null) {
    skipOpMsg.textContent = "Use the m:ss format, like 0:32 and 1:40.";
    return;
  }
  if (to <= from) {
    skipOpMsg.textContent = "The “skip to” time must be after the start time.";
    return;
  }
  saveSkipOpMap({ ...currentSkipOpMap, [skipOpKey]: { from, to } });
};

skipOpClear.onclick = () => {
  const map = { ...currentSkipOpMap };
  delete map[skipOpKey];
  saveSkipOpMap(map);
};

// --- Lista de sites (registro em sites.js + sites novos vistos pelas páginas) ---
async function getAllSites() {
  const { seenSites } = await chrome.storage.local.get("seenSites");
  const known = new Set(MDL_SITES.map((site) => site.id));
  const extra = Object.entries(seenSites || {})
    .filter(([id]) => !known.has(id))
    .map(([id, name]) => ({ id, name, dynamic: true }));
  return MDL_SITES.concat(extra);
}

function buildSiteRow(site, checked, tagText, onChange) {
  const row = document.createElement("label");
  row.className = "site-row";
  const name = document.createElement("span");
  name.textContent = site.name;
  if (tagText) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = tagText;
    name.appendChild(tag);
  }
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = checked;
  box.addEventListener("change", () => onChange(box.checked));
  row.appendChild(name);
  row.appendChild(box);
  return row;
}

// --- Discord presence: login, status e liga/desliga por site ---
const discordStatusLine = document.getElementById("discordStatusLine");
const discordLoginBtn = document.getElementById("discordLoginBtn");
const discordLogoutBtn = document.getElementById("discordLogoutBtn");
const discordStatusSel = document.getElementById("discordStatusSel");
const discordMsg = document.getElementById("discordMsg");

function renderDiscord() {
  chrome.storage.local.get(["discordToken", "discordUser", "discordTokenInvalid", "discordGatewayState", "discordStatus"], (s) => {
    const loggedIn = Boolean(s.discordToken);
    let text = "Not logged in — using the MDL-Sync Presence app.";

    if (loggedIn && s.discordTokenInvalid) {
      text = "Login expired — log in again. Using the local app meanwhile.";
    } else if (loggedIn) {
      const name = (s.discordUser && s.discordUser.name) || "Discord";
      const state = s.discordGatewayState && s.discordGatewayState.state;
      const detail =
        state === "ready" ? "connected" : state === "connecting" ? "connecting…" : state === "error" ? "connection error" : "connects when you start watching";
      text = `Logged in as ${name} — ${detail}.`;
    }

    discordStatusLine.textContent = text;
    const needsLogin = !loggedIn || Boolean(s.discordTokenInvalid);
    discordLoginBtn.classList.toggle("hidden", !needsLogin);
    discordLoginBtn.textContent = loggedIn ? "Log in again" : "Log in with Discord";
    discordLogoutBtn.classList.toggle("hidden", !loggedIn);
    discordStatusSel.value = ["online", "idle", "dnd"].includes(s.discordStatus) ? s.discordStatus : "online";
  });
}

function renderDiscordChip() {
  chrome.storage.local.get("presenceEnabled", ({ presenceEnabled }) => {
    document.getElementById("discordChip").textContent = presenceEnabled === false ? "Off ›" : "On ›";
  });
}

async function renderPresenceSites() {
  const [sites, { presenceSites }] = await Promise.all([getAllSites(), chrome.storage.local.get("presenceSites")]);
  const overrides = { ...(presenceSites || {}) };
  const list = document.getElementById("presenceSiteList");
  list.innerHTML = "";

  for (const site of sites) {
    const tag = site.presenceDefault === false ? "PreMiD covers it" : "";
    list.appendChild(
      buildSiteRow(site, mdlPresenceAllowed(site, overrides), tag, (checked) => {
        overrides[site.id] = checked;
        chrome.storage.local.set({ presenceSites: overrides }, () => flashSaved());
      })
    );
  }
}

renderDiscord();
renderDiscordChip();
chrome.storage.onChanged.addListener((changes) => {
  if (Object.keys(changes).some((k) => k.startsWith("discord"))) renderDiscord();
  if (changes.presenceEnabled) renderDiscordChip();
});

discordLoginBtn.onclick = () => {
  discordMsg.textContent = "Finish logging in on the Discord tab that just opened.";
  chrome.runtime.sendMessage({ type: "DISCORD_LOGIN_START" });
};

discordLogoutBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: "DISCORD_LOGOUT" }, () => {
    discordMsg.textContent = "";
    renderDiscord();
  });
};

discordStatusSel.addEventListener("change", () => {
  chrome.storage.local.set({ discordStatus: discordStatusSel.value }, () => flashSaved());
});

// --- Excluded sites (Settings > More) ---
async function renderExcludeSites() {
  const [sites, { excludedSites }] = await Promise.all([getAllSites(), chrome.storage.local.get("excludedSites")]);
  const excluded = { ...(excludedSites || {}) };
  const list = document.getElementById("excludeSiteList");
  list.innerHTML = "";

  for (const site of sites) {
    list.appendChild(
      buildSiteRow(site, !excluded[site.id], "", (enabled) => {
        if (enabled) delete excluded[site.id];
        else excluded[site.id] = true;
        chrome.storage.local.set({ excludedSites: excluded }, () => flashSaved());
      })
    );
  }
}

function renderExcludeChip() {
  chrome.storage.local.get("excludedSites", ({ excludedSites }) => {
    const count = Object.keys(excludedSites || {}).length;
    document.getElementById("excludeChip").textContent = count ? `${count} off ›` : "›";
  });
}

// --- Quick skip: segundos + tecla de atalho (Settings > More) ---
const quickSkipSeconds = document.getElementById("quickSkipSeconds");
const quickSkipKey = document.getElementById("quickSkipKey");
let quickSkip = { seconds: 85, key: null };

function keyLabel(k) {
  if (!k) return "";
  const name = k.key === " " ? "Space" : k.key && k.key.length === 1 ? k.key.toUpperCase() : k.key || k.code;
  return [k.ctrl ? "Ctrl" : "", k.alt ? "Alt" : "", k.shift ? "Shift" : "", name].filter(Boolean).join(" + ");
}

function renderQuickSkip() {
  quickSkipSeconds.value = quickSkip.seconds;
  quickSkipKey.value = keyLabel(quickSkip.key);
}

function saveQuickSkip() {
  chrome.storage.local.set({ quickSkip }, () => flashSaved());
}

chrome.storage.local.get("quickSkip", ({ quickSkip: stored }) => {
  if (stored) quickSkip = { seconds: stored.seconds || 85, key: stored.key || null };
  renderQuickSkip();
});

quickSkipSeconds.addEventListener("change", () => {
  const value = Math.round(Number(quickSkipSeconds.value));
  quickSkip.seconds = Number.isFinite(value) ? Math.min(600, Math.max(1, value)) : 85;
  renderQuickSkip();
  saveQuickSkip();
});

quickSkipKey.addEventListener("keydown", (e) => {
  if (e.key === "Tab") return; // deixa navegar
  e.preventDefault();
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return; // espera a tecla "de verdade"
  if (e.key === "Escape") {
    quickSkipKey.blur();
    return;
  }
  quickSkip.key = { code: e.code, key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
  renderQuickSkip();
  saveQuickSkip();
  quickSkipKey.blur();
});

document.getElementById("quickSkipClear").onclick = () => {
  quickSkip.key = null;
  renderQuickSkip();
  saveQuickSkip();
};

// --- Changelog ---
document.getElementById("changelogBtn").onclick = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("changelog.html") });
};
