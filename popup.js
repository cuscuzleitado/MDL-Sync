// ============================================================
// Popup — tela principal (episódio detectado + mapeamentos) e tela de
// settings (threshold + ajuda), ambas dentro do mesmo popup.html. Trocar
// de tela é só esconder/mostrar uma div, sem navegar pra outra página.
// ============================================================

const DEFAULT_THRESHOLD = 0.8;

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
  const container = document.getElementById("mappings");
  const entries = Object.entries(mdlMap || {});

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

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.textContent = total ? `${key} (${total} eps)` : key;
    link.title = url;
    row.appendChild(link);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "remove";
    removeBtn.onclick = async () => {
      const { mdlMap } = await chrome.storage.local.get("mdlMap");
      delete mdlMap[key];
      await chrome.storage.local.set({ mdlMap });
      row.remove();
      if (Object.keys(mdlMap).length === 0) renderMappings({});
    };
    row.appendChild(removeBtn);

    container.appendChild(row);
  }
}

chrome.storage.local.get(["lastDetected", "mdlMap"], ({ lastDetected, mdlMap }) => {
  renderLastDetected(lastDetected, mdlMap);
  renderMappings(mdlMap);
});

// --- Troca de tela (principal <-> settings <-> mapped titles) ---
const mainView = document.getElementById("mainView");
const settingsView = document.getElementById("settingsView");
const mappedView = document.getElementById("mappedView");

document.getElementById("settingsBtn").onclick = () => {
  mainView.classList.add("hidden");
  settingsView.classList.remove("hidden");
};

document.getElementById("backBtn").onclick = () => {
  settingsView.classList.add("hidden");
  mainView.classList.remove("hidden");
};

document.getElementById("mappedBtn").onclick = () => {
  mainView.classList.add("hidden");
  mappedView.classList.remove("hidden");
};

document.getElementById("mappedBackBtn").onclick = () => {
  mappedView.classList.add("hidden");
  mainView.classList.remove("hidden");
};

// --- Threshold (mesma lógica que estava em options.js) ---
const thresholdContainer = document.getElementById("thresholdOptions");
const savedNote = document.getElementById("savedNote");

function markActiveLabel(value) {
  thresholdContainer.querySelectorAll("label").forEach((label) => {
    label.classList.toggle("active", label.dataset.value === String(value));
  });
}

function flashSaved() {
  savedNote.classList.add("show");
  setTimeout(() => savedNote.classList.remove("show"), 1200);
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
