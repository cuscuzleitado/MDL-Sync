// ============================================================
// LÓGICA COMUM — compartilhada por todos os sites.
// Cada arquivo de site só precisa definir SITE_PARSER e chamar
// MDLSyncCommon.init(SITE_PARSER) no final.
//
// Textos visíveis pro usuário (botões, badge, popup) estão em inglês
// de propósito. Comentários ficam em português, são só pra devs.
// ============================================================

// Valor padrão — sobrescrito pelo que estiver salvo em chrome.storage.local
// (configurável na página de opções da extensão). "let" porque muda em
// runtime; o listener no final mantém sincronizado se o usuário alterar a
// opção com a página já aberta.
let AUTO_SYNC_THRESHOLD = 0.8; // 80%

chrome.storage.local.get("syncThreshold", ({ syncThreshold }) => {
  if (typeof syncThreshold === "number") AUTO_SYNC_THRESHOLD = syncThreshold;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.syncThreshold && typeof changes.syncThreshold.newValue === "number") {
    AUTO_SYNC_THRESHOLD = changes.syncThreshold.newValue;
    // Se já existe um badge na tela (usuário mudou a opção com o vídeo já
    // aberto), atualiza o texto na hora em vez de só valer a partir do
    // próximo episódio.
    if (window.MDLSyncCommon) window.MDLSyncCommon._updateBadgeAutoLabel();
  }
});

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
  // "staleEpisodeData" (opcional): quando chamado por causa de uma troca de
  // URL (ex: autoplay indo pro próximo episódio no Viki), guarda o episódio
  // detectado ANTES da troca. Enquanto a nova detecção continuar batendo
  // com o episódio antigo, é tratada como "ainda não pronta" e continua
  // tentando — sem isso, a extensão às vezes ficava presa mostrando o
  // episódio anterior, exigindo um F5 manual pra corrigir. Comparamos pelo
  // episódio detectado (não pelo <title> da aba), já que alguns sites (ex:
  // Viki) identificam o episódio pela URL/meta tags, e o <title> pode nem
  // atualizar durante uma troca automática de episódio.
  _attemptDetection(SITE_PARSER, staleEpisodeData = null) {
    const maxAttempts = 16; // ~8 segundos no total
    const intervalMs = 500;
    let attempts = 0;

    const tryDetect = async () => {
      attempts++;

      let episodeData = this._detectEpisode(SITE_PARSER);

      const stillStale =
        staleEpisodeData &&
        episodeData &&
        episodeData.key === staleEpisodeData.key &&
        episodeData.episode === staleEpisodeData.episode;

      if (stillStale) episodeData = null; // ainda não atualizou de verdade, continua tentando

      if (episodeData) {
        console.log("[MDL Sync] Episódio detectado:", episodeData);
        this._lastKnownEpisodeData = episodeData;

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
  // em "próximo", ou autoplay indo pro episódio seguinte sozinho). Isso
  // detecta a mudança de URL e roda a detecção de novo, sem criar um novo
  // monitor a cada vez (só um setInterval por página).
  _watchUrlChanges(SITE_PARSER) {
    if (this._watchingUrl) return;
    this._watchingUrl = true;

    // Compara só o pathname, não a URL inteira: todos os parsers de site
    // identificam o episódio pelo caminho (ver getSeasonEpisode de cada
    // um), nunca por query string/hash. Comparar a URL inteira fazia o
    // badge ser recriado do zero (fechando qualquer coisa aberta, ex: o
    // seletor de nota) sempre que o player mudava algo irrelevante na
    // query string/hash (telemetria, posição de playback, etc.) sem o
    // episódio ter mudado de verdade.
    let lastPath = window.location.pathname;
    setInterval(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        console.log("[MDL Sync] URL mudou, tentando detectar de novo...");
        this._attemptDetection(SITE_PARSER, this._lastKnownEpisodeData || null);
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

  // Maior episódio já sincronizado com sucesso pra esse título (0 se
  // nenhum ainda). Usado como sanity-check antes do auto-sync: ver
  // _setupAutoTrack.
  _getMaxSyncedEpisode(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get("syncedEpisodes", ({ syncedEpisodes }) => {
        const prefix = `${key}:`;
        let max = 0;
        for (const storedKey of Object.keys(syncedEpisodes || {})) {
          if (!storedKey.startsWith(prefix)) continue;
          const ep = parseInt(storedKey.slice(prefix.length), 10);
          if (!isNaN(ep) && ep > max) max = ep;
        }
        resolve(max);
      });
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
          // Só sincroniza se a aba estiver realmente em foco/visível. Sem
          // isso, um vídeo com autoplay do próximo episódio pode continuar
          // avançando sozinho numa aba em segundo plano (ex: alternando
          // entre duas abas de dramas diferentes) e sincronizar episódios
          // que você nunca chegou a ver de verdade — foi exatamente isso
          // que causou um "Completed" incorreto num teste. Não retorna
          // (não trava o listener): se você voltar pra essa aba antes do
          // vídeo mudar de episódio de novo, sincroniza normalmente.
          if (document.visibilityState !== "visible") {
            console.log("[MDL Sync] Threshold atingido mas a aba está em segundo plano — auto-sync pausado até você voltar pra ela.");
            return;
          }

          synced = true; // trava o listener já — o guard abaixo só decide se ENVIA, não se trava.

          this._getMaxSyncedEpisode(episodeData.key).then((maxSynced) => {
            const jump = episodeData.episode - maxSynced;

            // Se esse título já vinha sincronizando normalmente (maxSynced > 0)
            // e o episódio detectado agora saltou muito além do esperado
            // (ex: veio do 3 pro 32 do nada), a detecção do site provavelmente
            // pegou o episódio errado — bloqueia o auto-sync em vez de arriscar
            // marcar "Completed" sem ter sido esse o episódio de verdade. O
            // "Mark on MDL" manual continua disponível se for intencional.
            if (maxSynced > 0 && jump > 3) {
              console.warn(
                `[MDL Sync] Salto suspeito de episódio em "${episodeData.title}" ` +
                `(último sincronizado: E${maxSynced}, detectado agora: E${episodeData.episode}). ` +
                `Auto-sync BLOQUEADO por segurança.`
              );
              this._setBadgeSyncedState(`⚠ Skipped — jump to E${episodeData.episode}`);
              return;
            }

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
          });
        }
      });
    };

    attach();
  },

  // Pequeno indicativo visual no badge de que o auto-sync está ativo
  // nesse episódio. Atualiza o texto se já existir (ex: quando a % é
  // trocada nas Settings com o badge já na tela) em vez de ignorar.
  _updateBadgeAutoLabel() {
    const badge = document.getElementById("mdl-sync-badge");
    if (!badge) return;

    const topRow = badge.querySelector(".mdl-sync-top-row") || badge;
    let autoLabel = badge.querySelector(".mdl-sync-auto-label");
    if (!autoLabel) {
      autoLabel = document.createElement("span");
      autoLabel.className = "mdl-sync-auto-label";
      autoLabel.style.cssText = "font-size: 11px; color: #4da3ff; margin-left: 4px;";
      topRow.appendChild(autoLabel);
    }
    // Sem emoji, sem % — só o essencial: o auto-tracking está ativo
    // nesse episódio.
    autoLabel.textContent = "AUTO ACTIVATED";
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

    // "S1" some quando o site não informa uma temporada real (a maioria
    // não informa — ver comentário em _detectEpisode/getSeasonEpisode de
    // cada parser); só aparece quando for de fato diferente de 1.
    const seasonPrefix = data.season && data.season > 1 ? `S${data.season}` : "";
    const episodePart = `${seasonPrefix}E${data.episode}`;
    const label = document.createElement("span");
    label.textContent = isFinalEpisode
      ? `${data.title} — ${episodePart} (Final)`
      : `${data.title} — ${episodePart}`;
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
