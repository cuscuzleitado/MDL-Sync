// ============================================================
// LÓGICA COMUM — compartilhada por todos os sites.
// Cada arquivo de site só precisa definir SITE_PARSER e chamar
// MDLSyncCommon.init(SITE_PARSER) no final.
//
// Textos visíveis pro usuário (botões, badge, popup) estão em inglês
// de propósito. Comentários ficam em português, são só pra devs.
// ============================================================

const AUTO_SYNC_THRESHOLD = 0.8; // 80%

// Notas do MDL: 1.0 a 10.0, de 0.5 em 0.5. [valor, rótulo exibido]
const RATING_OPTIONS = [
  ["10", "10"], ["9.5", "9.5"], ["9", "9.0"], ["8.5", "8.5"], ["8", "8.0"],
  ["7.5", "7.5"], ["7", "7.0"], ["6.5", "6.5"], ["6", "6.0"], ["5.5", "5.5"],
  ["5", "5.0"], ["4.5", "4.5"], ["4", "4.0"], ["3.5", "3.5"], ["3", "3.0"],
  ["2.5", "2.5"], ["2", "2.0"], ["1.5", "1.5"], ["1", "1.0"]
];

window.MDLSyncCommon = {
  init(SITE_PARSER) {
    this._attemptDetection(SITE_PARSER);
    this._watchUrlChanges(SITE_PARSER);
  },

  // Tenta detectar por alguns segundos, caso o site seja uma SPA
  // (Angular/React/Vue) que ainda não terminou de renderizar o título/
  // conteúdo quando o content script roda (ex: kisskh).
  //
  // "staleTitleSnapshot" (opcional): quando chamado por causa de uma troca
  // de URL (ex: clicar em "próximo episódio"), guarda o <title> de ANTES
  // da troca. Enquanto o título da aba ainda não mudou de verdade, a
  // detecção é tratada como "ainda não pronta" e continua tentando — sem
  // isso, a extensão às vezes lia o título antigo (ainda não atualizado
  // pelo site) e achava que tinha detectado certo, exigindo um F5 manual
  // pra corrigir.
  _attemptDetection(SITE_PARSER, staleTitleSnapshot = null) {
    const maxAttempts = 16; // ~8 segundos no total
    const intervalMs = 500;
    let attempts = 0;

    const tryDetect = async () => {
      attempts++;

      const titleStillStale = staleTitleSnapshot !== null && document.title === staleTitleSnapshot;
      const episodeData = titleStillStale ? null : this._detectEpisode(SITE_PARSER);

      if (episodeData) {
        console.log("[MDL Sync] Episódio detectado:", episodeData);

        const alreadySynced = await this._wasAlreadySynced(episodeData);
        const totalEpisodes = await this._getTotalEpisodes(episodeData.key);
        const isFinalEpisode = totalEpisodes !== null && episodeData.episode === totalEpisodes;
        const existingRating = isFinalEpisode ? await this._getRating(episodeData.key) : null;

        this._createSyncBadge(episodeData, { alreadySynced, isFinalEpisode, existingRating });
        chrome.storage.local.set({ lastDetected: episodeData });

        // Auto-sync funciona normal pra QUALQUER episódio (inclusive o
        // último) — a nota é só um extra opcional, não trava o sync normal.
        if (!alreadySynced) {
          chrome.storage.local.get("mdlMap", ({ mdlMap }) => {
            if (mdlMap && mdlMap[episodeData.key]) {
              this._setupAutoTrack(episodeData);
            }
          });
        }

        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tryDetect, intervalMs);
      } else {
        console.log("[MDL Sync] Não foi possível detectar título/episódio nesta página (mesmo após aguardar).");
      }
    };

    tryDetect();
  },

  // Sites SPA podem trocar de episódio sem recarregar a página (ex: clicar
  // em "próximo"). Isso detecta a mudança de URL e roda a detecção de novo,
  // sem criar um novo monitor a cada vez (só um setInterval por página).
  _watchUrlChanges(SITE_PARSER) {
    if (this._watchingUrl) return;
    this._watchingUrl = true;

    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        const titleBeforeChange = document.title;
        console.log("[MDL Sync] URL mudou, tentando detectar de novo...");
        this._attemptDetection(SITE_PARSER, titleBeforeChange);
      }
    }, 1000);
  },

  // Lê o total de episódios já salvo no mapeamento desse título (vem do
  // atributo "max" do input de episódios do MDL, capturado da última vez
  // que sincronizamos). Retorna null se ainda não sabemos.
  _getTotalEpisodes(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get("mdlMap", ({ mdlMap }) => {
        const entry = (mdlMap || {})[key];
        if (!entry || typeof entry === "string") return resolve(null); // formato antigo, sem total
        resolve(entry.total ?? null);
      });
    });
  },

  // Chave usada pra guardar "esse episódio específico já foi sincronizado",
  // persistente entre reloads/sessões (diferente do "synced" em memória
  // usado só pra travar o listener do <video> na mesma carga de página).
  _syncedStorageKey(episodeData) {
    return `${episodeData.key}:${episodeData.episode}`;
  },

  _wasAlreadySynced(episodeData) {
    return new Promise((resolve) => {
      chrome.storage.local.get("syncedEpisodes", ({ syncedEpisodes }) => {
        const storageKey = this._syncedStorageKey(episodeData);
        resolve(Boolean(syncedEpisodes && syncedEpisodes[storageKey]));
      });
    });
  },

  _markAsSynced(episodeData) {
    chrome.storage.local.get("syncedEpisodes", ({ syncedEpisodes }) => {
      const map = syncedEpisodes || {};
      map[this._syncedStorageKey(episodeData)] = Date.now();
      chrome.storage.local.set({ syncedEpisodes: map });
    });
  },

  // Nota é por TÍTULO (não por episódio) — persiste separado do progresso
  // de episódios, pra funcionar mesmo se o usuário quiser avaliar depois
  // de já ter sincronizado o último episódio.
  _getRating(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get("ratedTitles", ({ ratedTitles }) => {
        resolve((ratedTitles && ratedTitles[key]) ?? null);
      });
    });
  },

  _markAsRated(key, rating) {
    chrome.storage.local.get("ratedTitles", ({ ratedTitles }) => {
      const map = ratedTitles || {};
      map[key] = rating;
      chrome.storage.local.set({ ratedTitles: map });
    });
  },

  // Liga o auto-sync: acha o <video> da página e, ao passar de 80% do
  // episódio, dispara o sync automaticamente (sem precisar clicar no
  // botão). Só é chamado quando o mapeamento pro MDL já existe.
  _setupAutoTrack(episodeData) {
    let synced = false;
    let attempts = 0;
    const maxAttempts = 30; // ~30s esperando o player carregar o <video>

    // Invalida o listener anterior se um novo episódio foi detectado antes
    // dele terminar (evita continuar escutando o <video> do episódio errado
    // em players SPA que reaproveitam a mesma tag <video>).
    this._autoTrackGeneration = (this._autoTrackGeneration || 0) + 1;
    const myGeneration = this._autoTrackGeneration;

    const attach = () => {
      if (myGeneration !== this._autoTrackGeneration) return; // superado por episódio mais novo

      const video = document.querySelector("video");

      if (!video) {
        attempts++;
        if (attempts < maxAttempts) setTimeout(attach, 1000);
        return;
      }

      console.log(`[MDL Sync] Auto-sync ativo (dispara ao passar de ${AUTO_SYNC_THRESHOLD * 100}%).`);
      this._updateBadgeAutoLabel();

      video.addEventListener("timeupdate", () => {
        if (myGeneration !== this._autoTrackGeneration) return;
        if (synced) return;

        // Se o site trocou a tag <video> inteira (não só o src), esse
        // elemento antigo pode ter sido removido da página. Reanexa no
        // vídeo novo em vez de continuar escutando um elemento morto.
        if (!document.contains(video)) {
          attach();
          return;
        }

        if (!video.duration || isNaN(video.duration)) return;

        // Ignora clipes curtos (vinhetas, "Rakuten Viki" antes do episódio,
        // anúncios, etc.) — nenhum episódio de verdade tem menos que isso.
        const MIN_EPISODE_DURATION_SECONDS = 180; // 3 minutos
        if (video.duration < MIN_EPISODE_DURATION_SECONDS) return;

        const pct = video.currentTime / video.duration;
        if (pct >= AUTO_SYNC_THRESHOLD) {
          synced = true;
          console.log(`[MDL Sync] ${AUTO_SYNC_THRESHOLD * 100}% atingido — sincronizando automaticamente...`);
          this._sendSyncMessage({ type: "SYNC_EPISODE", source: "auto", data: episodeData }, (response) => {
            if (response?.ok) {
              console.log("[MDL Sync] Auto-sync concluído.");
              this._markAsSynced(episodeData);
              this._checkAndShowFinalRatingRow(episodeData, response.result);
              this._setBadgeSyncedState("Synced automatically ✓");
            } else {
              console.warn("[MDL Sync] Auto-sync falhou:", response?.error);
            }
          });
        }
      });
    };

    attach();
  },

  // Pequeno indicativo visual no badge de que o auto-sync está ativo
  // nesse episódio.
  _updateBadgeAutoLabel() {
    const badge = document.getElementById("mdl-sync-badge");
    if (!badge) return;
    if (badge.querySelector(".mdl-sync-auto-label")) return;

    const topRow = badge.querySelector(".mdl-sync-top-row") || badge;
    const autoLabel = document.createElement("span");
    autoLabel.className = "mdl-sync-auto-label";
    autoLabel.textContent = `🔄 auto ${AUTO_SYNC_THRESHOLD * 100}%`;
    autoLabel.style.cssText = "font-size: 11px; color: #4da3ff; margin-left: 4px;";
    topRow.appendChild(autoLabel);
  },

  // Deixa o botão principal do badge permanentemente no estado
  // "sincronizado" — fica assim mesmo depois de sair da tela cheia ou
  // recarregar a página. Não mexe na linha de nota (se houver), que é
  // independente.
  _setBadgeSyncedState(text) {
    const badge = document.getElementById("mdl-sync-badge");
    if (!badge) return;
    const actionArea = badge.querySelector(".mdl-sync-action");
    if (!actionArea) return;
    actionArea.innerHTML = "";

    const button = document.createElement("button");
    button.textContent = text;
    button.disabled = true;
    button.style.cssText = `
      background: #2ecc71; color: #fff; border: none; padding: 6px 10px;
      border-radius: 6px; font-size: 12px;
    `;
    actionArea.appendChild(button);
  },

  // Envia a mensagem de sync pro background com retry — o background.js
  // roda como "service worker" (Manifest V3) e o Chrome pode desligá-lo
  // sozinho depois de um tempo ocioso (principalmente depois do notebook
  // hibernar/ficar ocioso). Na primeira tentativa depois disso, o Chrome
  // às vezes falha em "acordá-lo" a tempo — então tentamos de novo antes
  // de desistir de verdade.
  _sendSyncMessage(payload, callback, attempt = 1) {
    const maxAttempts = 3;

    chrome.runtime.sendMessage(payload, (response) => {
      const connectionError = chrome.runtime.lastError;

      if (connectionError && attempt < maxAttempts) {
        console.warn(
          `[MDL Sync] Sem resposta do background (tentativa ${attempt}/${maxAttempts}), tentando de novo em 1s...`,
          connectionError.message
        );
        setTimeout(() => this._sendSyncMessage(payload, callback, attempt + 1), 1000);
        return;
      }

      if (connectionError) {
        console.error(
          "[MDL Sync] Não consegui falar com a extensão depois de várias tentativas. " +
          "Isso costuma acontecer se o navegador ficou muito tempo ocioso/hibernando. " +
          "Recarregue a extensão em chrome://extensions (ícone de reload) e a página, se persistir.",
          connectionError.message
        );
        callback({ ok: false, error: "No response from the extension (service worker inactive)." });
        return;
      }

      callback(response);
    });
  },

  // Depois de QUALQUER sync bem-sucedido (manual ou automático), confere
  // se o total retornado revela que esse episódio é o último — se for,
  // adiciona a linha de nota opcional na hora, sem precisar recarregar a
  // página. Cobre o caso de primeira sincronização de um título depois de
  // atualizar a extensão, quando o total ainda não era conhecido de
  // antemão (por isso não apareceu no primeiro carregamento da página).
  _checkAndShowFinalRatingRow(data, result) {
    if (!result || !result.total) return;
    if (data.episode !== result.total) return;

    const badge = document.getElementById("mdl-sync-badge");
    if (!badge) return;
    if (badge.querySelector(".mdl-sync-rating-row")) return; // já está lá

    this._getRating(data.key).then((existingRating) => {
      badge.appendChild(this._buildRatingRow(data, existingRating));
    });
  },

  _detectEpisode(SITE_PARSER) {
    const se = SITE_PARSER.getSeasonEpisode();
    const title = SITE_PARSER.getTitle();
    if (!se || !title) return null;

    return {
      title,
      season: se.season,
      episode: se.episode,
      site: SITE_PARSER.siteName,
      key: `${SITE_PARSER.siteName}:${se.slug}`
    };
  },

  _createSyncBadge(data, { alreadySynced, isFinalEpisode, existingRating }) {
    const old = document.getElementById("mdl-sync-badge");
    if (old) old.remove();

    const badge = document.createElement("div");
    badge.id = "mdl-sync-badge";
    badge.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;
      background: #1c1c1e; color: #fff; padding: 10px 14px;
      border-radius: 10px; font-family: sans-serif; font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,.4); display: flex; flex-direction: column; gap: 8px;
      max-width: 320px;
    `;

    // Linha principal: título + ação de sync normal (igual sempre foi).
    const topRow = document.createElement("div");
    topRow.className = "mdl-sync-top-row";
    topRow.style.cssText = "display: flex; align-items: center; gap: 10px;";

    const label = document.createElement("span");
    label.textContent = isFinalEpisode
      ? `${data.title} — S${data.season}E${data.episode} (Final)`
      : `${data.title} — S${data.season}E${data.episode}`;
    topRow.appendChild(label);

    const actionArea = document.createElement("div");
    actionArea.className = "mdl-sync-action";
    actionArea.style.cssText = "display: flex; align-items: center; gap: 6px;";
    topRow.appendChild(actionArea);

    if (alreadySynced) {
      const button = document.createElement("button");
      button.textContent = "Already synced ✓";
      button.disabled = true;
      button.style.cssText = `
        background: #2ecc71; color: #fff; border: none; padding: 6px 10px;
        border-radius: 6px; font-size: 12px;
      `;
      actionArea.appendChild(button);
    } else {
      const button = document.createElement("button");
      button.textContent = "Mark on MDL";
      button.style.cssText = `
        background: #e91e63; color: #fff; border: none; padding: 6px 10px;
        border-radius: 6px; cursor: pointer; font-size: 12px;
      `;
      button.onclick = () => {
        button.disabled = true;
        button.textContent = "Sending...";
        this._sendSyncMessage({ type: "SYNC_EPISODE", data }, (response) => {
          if (response?.ok) {
            button.textContent = "Synced ✓";
            button.style.background = "#2ecc71";
            this._markAsSynced(data);
            this._checkAndShowFinalRatingRow(data, response.result);
          } else {
            button.textContent = "Failed ✗ (see console)";
            button.style.background = "#e74c3c";
            button.disabled = false;
            console.warn("[MDL Sync] Falha ao sincronizar:", response?.error);
          }
        });
      };
      actionArea.appendChild(button);
    }

    badge.appendChild(topRow);

    // Linha extra, só no último episódio: nota opcional. Aparece
    // independente do episódio já ter sido sincronizado ou não.
    if (isFinalEpisode) {
      badge.appendChild(this._buildRatingRow(data, existingRating));
    }

    document.body.appendChild(badge);
  },

  // Linha opcional de "avaliar e marcar como Completed" — disponível a
  // qualquer momento no último episódio, sem depender do estado de sync.
  _buildRatingRow(data, existingRating) {
    const row = document.createElement("div");
    row.className = "mdl-sync-rating-row";
    row.style.cssText = "display: flex; align-items: center; gap: 6px; border-top: 1px solid #333; padding-top: 8px;";

    if (existingRating) {
      const doneLabel = document.createElement("span");
      doneLabel.textContent = `Rated ${existingRating} ✓ (Completed)`;
      doneLabel.style.cssText = "font-size: 12px; color: #2ecc71;";
      row.appendChild(doneLabel);
      return row;
    }

    const hint = document.createElement("span");
    hint.textContent = "Optional:";
    hint.style.cssText = "font-size: 11px; color: #999;";
    row.appendChild(hint);

    const select = document.createElement("select");
    select.style.cssText = `
      background: #2c2c2e; color: #fff; border: 1px solid #444;
      border-radius: 6px; font-size: 12px; padding: 4px;
    `;

    const placeholder = document.createElement("option");
    placeholder.value = "0";
    placeholder.textContent = "Rate...";
    select.appendChild(placeholder);

    for (const [value, labelText] of RATING_OPTIONS) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labelText;
      select.appendChild(option);
    }

    const button = document.createElement("button");
    button.textContent = "Complete";
    button.style.cssText = `
      background: #4da3ff; color: #fff; border: none; padding: 6px 10px;
      border-radius: 6px; cursor: pointer; font-size: 12px;
    `;

    button.onclick = () => {
      const rating = select.value;
      if (!rating || rating === "0") {
        button.textContent = "Pick a rating first";
        setTimeout(() => (button.textContent = "Complete"), 1800);
        return;
      }

      button.disabled = true;
      select.disabled = true;
      button.textContent = "Sending...";

      this._sendSyncMessage({ type: "SYNC_EPISODE", data: { ...data, rating } }, (response) => {
        if (response?.ok) {
          this._markAsRated(data.key, rating);
          row.innerHTML = "";
          const doneLabel = document.createElement("span");
          doneLabel.textContent = `Rated ${rating} ✓ (Completed)`;
          doneLabel.style.cssText = "font-size: 12px; color: #2ecc71;";
          row.appendChild(doneLabel);
        } else {
          button.textContent = "Failed ✗ (see console)";
          button.style.background = "#e74c3c";
          button.disabled = false;
          select.disabled = false;
          console.warn("[MDL Sync] Falha ao completar:", response?.error);
        }
      });
    };

    row.appendChild(select);
    row.appendChild(button);
    return row;
  }
};
