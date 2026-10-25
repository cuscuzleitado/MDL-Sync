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
  }
});

// ------------------------------------------------------------
// RETOMAR — configuração (a lógica fica no fim deste arquivo)
// ------------------------------------------------------------
let RESUME_ENABLED = true; // interruptor nas Settings ("resumeEnabled")
const RESUME_STORAGE_KEY = "resumePoints";
const RESUME_MIN_EPISODE_SECONDS = 180; // mesma regra do auto-sync: ignora vinhetas/anúncios curtos
const RESUME_REWIND_SECONDS = 15; // o ponto salvo fica 15s antes de onde você parou
const RESUME_MIN_SAVE_SECONDS = 45; // não grava nos primeiros 45s
const RESUME_END_MARGIN_SECONDS = 60; // nos últimos 60s o episódio conta como terminado
const RESUME_PROTECT_SECONDS = 60; // ponto antigo fica protegido até assistir 1 min além dele
const RESUME_SAVE_INTERVAL_MS = 5000;
const RESUME_MAX_ENTRIES = 300;

chrome.storage.local.get("resumeEnabled", ({ resumeEnabled }) => {
  if (typeof resumeEnabled === "boolean") RESUME_ENABLED = resumeEnabled;
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.resumeEnabled) return;
  RESUME_ENABLED = changes.resumeEnabled.newValue !== false;
  const common = window.MDLSyncCommon;
  if (!common) return;
  if (!RESUME_ENABLED) common._teardownResume();
  else if (common._resumeAllowed && common._lastKnownEpisodeData) common._setupResume(common._lastKnownEpisodeData);
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

        // Retomar de onde parou (ver seção "RETOMAR" no fim deste arquivo).
        // Qualquer site que use o MDLSyncCommon ganha isso de graça; pra
        // desligar num site específico, coloque supportsResume: false no
        // SITE_PARSER dele. O try/catch garante que um bug aqui nunca atrapalhe
        // o auto-sync.
        this._resumeAllowed = SITE_PARSER.supportsResume !== false;
        if (this._resumeAllowed) {
          try {
            this._setupResume(episodeData);
          } catch (err) {
            console.warn("[MDL Sync] Resume setup failed:", err);
          }
        }

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
  },

  // ==========================================================
  // RETOMAR DE ONDE PAROU
  //
  // - Enquanto você assiste, grava o ponto (15s antes de onde está) a cada
  //   ~5s e ao pausar/fechar a aba. Só vale pro vídeo do episódio (>= 3 min),
  //   então vinhetas e anúncios nunca entram.
  // - Ao reabrir o episódio, mostra um aviso em cima do badge: "Continue
  //   from 14:46?" com Resume / From start.
  // - O ponto antigo fica PROTEGIDO (não é sobrescrito) até o vídeo passar
  //   1 min além dele (ex: salvo em 14:46 -> protegido até 15:46). Isso
  //   impede que abrir o episódio em 0:00 apague o ponto salvo. Quando chega
  //   lá, o aviso some e a gravação volta ao normal.
  // - Fica escondido: nada disso aparece no popup da extensão.
  // ==========================================================

  _resumeKey(episodeData) {
    return this._syncedStorageKey(episodeData);
  },

  _readResumePoint(episodeData) {
    return new Promise((resolve) => {
      chrome.storage.local.get(RESUME_STORAGE_KEY, (res) => {
        const map = res[RESUME_STORAGE_KEY] || {};
        resolve(map[this._resumeKey(episodeData)] || null);
      });
    });
  },

  // point = null apaga o ponto desse episódio.
  _writeResumePoint(episodeData, point) {
    chrome.storage.local.get(RESUME_STORAGE_KEY, (res) => {
      const map = res[RESUME_STORAGE_KEY] || {};
      const key = this._resumeKey(episodeData);
      if (point) map[key] = point;
      else delete map[key];

      // Mantém só os mais recentes, pra não crescer pra sempre.
      const keys = Object.keys(map);
      if (keys.length > RESUME_MAX_ENTRIES) {
        keys.sort((a, b) => (map[a].ts || 0) - (map[b].ts || 0));
        for (const oldKey of keys.slice(0, keys.length - RESUME_MAX_ENTRIES)) delete map[oldKey];
      }
      chrome.storage.local.set({ [RESUME_STORAGE_KEY]: map });
    });
  },

  // O <video> do episódio de verdade (ignora clipes curtos). Procura entre
  // todos, não só o primeiro: em alguns players o anúncio vem antes na página.
  _findEpisodeVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    return (
      videos.find((v) => isFinite(v.duration) && v.duration >= RESUME_MIN_EPISODE_SECONDS) || null
    );
  },

  _formatTime(totalSeconds) {
    const t = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    return `${h > 0 ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
  },

  _removeResumePrompt() {
    document.querySelectorAll(".mdl-sync-resume-row").forEach((el) => el.remove());
  },

  _teardownResume() {
    const state = this._resumeState;
    if (state && state.cleanup) state.cleanup.forEach((fn) => fn());
    this._resumeState = null;
    this._removeResumePrompt();
  },

  _setupResume(episodeData) {
    this._teardownResume(); // cancela o episódio anterior (troca de episódio sem recarregar)
    if (!RESUME_ENABLED) return;

    const state = { protectUntil: null, lastSave: 0, cleared: false, cleanup: [] };
    this._resumeState = state;

    // Espera o <video> do episódio aparecer (até ~2 min, por causa de anúncios).
    let attempts = 0;
    const find = async () => {
      if (this._resumeState !== state) return;
      const video = this._findEpisodeVideo();
      if (!video) {
        if (++attempts < 120) setTimeout(find, 1000);
        return;
      }
      const point = await this._readResumePoint(episodeData);
      if (this._resumeState !== state) return;
      this._startResume(episodeData, state, video, point);
    };
    find();
  },

  _startResume(episodeData, state, video, point) {
    const saved =
      point && typeof point.t === "number" && point.t > 0 && point.t < video.duration - RESUME_END_MARGIN_SECONDS
        ? point
        : null;

    if (saved) {
      state.protectUntil = saved.t + RESUME_PROTECT_SECONDS;
      // Se o próprio site já retomou perto do ponto (ex: Viki sem adblock),
      // não pergunta de novo — só mantém o ponto protegido.
      if (video.currentTime < saved.t - 10) this._showResumePrompt(episodeData, state, saved);
    }

    const guard = (fn) => (...args) => {
      try {
        fn(...args);
      } catch (err) {
        console.warn("[MDL Sync] Resume error:", err);
      }
    };
    const onTime = guard((e) => this._onResumeTick(episodeData, state, e.target, false));
    const onPause = guard((e) => this._onResumeTick(episodeData, state, e.target, true));
    const onFlush = guard(() => this._onResumeTick(episodeData, state, this._findEpisodeVideo(), true));
    const onHide = guard(() => {
      if (document.visibilityState === "hidden") onFlush();
    });

    // Eventos de mídia não "borbulham", mas dá pra ouvir na fase de captura
    // no document — assim continua funcionando se o site trocar a tag <video>.
    document.addEventListener("timeupdate", onTime, true);
    document.addEventListener("pause", onPause, true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onFlush);
    state.cleanup.push(
      () => document.removeEventListener("timeupdate", onTime, true),
      () => document.removeEventListener("pause", onPause, true),
      () => document.removeEventListener("visibilitychange", onHide),
      () => window.removeEventListener("pagehide", onFlush)
    );
  },

  _onResumeTick(episodeData, state, v, force) {
    if (this._resumeState !== state || !RESUME_ENABLED) return;
    if (!(v instanceof HTMLVideoElement)) return;
    if (!isFinite(v.duration) || v.duration < RESUME_MIN_EPISODE_SECONDS) return;

    const ct = v.currentTime;

    // Ponto antigo ainda protegido: não grava nada até passar 1 min além dele.
    if (state.protectUntil !== null) {
      if (ct < state.protectUntil) return;
      state.protectUntil = null;
      this._removeResumePrompt();
    }

    const now = Date.now();
    if (!force && now - state.lastSave < RESUME_SAVE_INTERVAL_MS) return;
    state.lastSave = now;

    // Reta final: o episódio conta como terminado, então não precisa retomar.
    if (v.duration - ct <= RESUME_END_MARGIN_SECONDS) {
      if (!state.cleared) {
        state.cleared = true;
        this._writeResumePoint(episodeData, null);
      }
      return;
    }
    state.cleared = false;

    if (ct < RESUME_MIN_SAVE_SECONDS) return;
    this._writeResumePoint(episodeData, {
      t: Math.floor(ct - RESUME_REWIND_SECONDS),
      d: Math.floor(v.duration),
      ts: now
    });
  },

  // Pula pro ponto salvo e confere nos próximos segundos se o player não
  // "desfez" o salto (alguns players voltam pro início ao terminar de carregar).
  _seekTo(state, seconds) {
    let tries = 0;
    const attempt = () => {
      if (this._resumeState !== state) return;
      const v = this._findEpisodeVideo();
      if (v && v.currentTime < seconds - 5) v.currentTime = seconds;
      if (++tries < 4) setTimeout(attempt, 1200);
    };
    attempt();
  },

  _showResumePrompt(episodeData, state, saved) {
    const badge = document.getElementById("mdl-sync-badge");
    if (!badge || badge.querySelector(".mdl-sync-resume-row")) return;

    const row = document.createElement("div");
    row.className = "mdl-sync-resume-row";
    row.style.cssText =
      "display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #333; padding-bottom: 8px;";

    const label = document.createElement("span");
    label.textContent = `Continue from ${this._formatTime(saved.t)}?`;
    label.style.cssText = "font-size: 12px; flex: 1;";

    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "Resume";
    resumeBtn.style.cssText = `
      background: #4da3ff; color: #fff; border: none; padding: 6px 10px;
      border-radius: 6px; cursor: pointer; font-size: 12px;
    `;
    resumeBtn.onclick = () => {
      this._seekTo(state, saved.t);
      row.remove();
    };

    const startBtn = document.createElement("button");
    startBtn.textContent = "From start";
    startBtn.style.cssText = `
      background: #2c2c2e; color: #ccc; border: 1px solid #444; padding: 5px 9px;
      border-radius: 6px; cursor: pointer; font-size: 12px;
    `;
    startBtn.onclick = () => {
      // Descarta o ponto antigo e volta a gravar já.
      state.protectUntil = null;
      this._writeResumePoint(episodeData, null);
      row.remove();
    };

    row.appendChild(label);
    row.appendChild(resumeBtn);
    row.appendChild(startBtn);
    badge.insertBefore(row, badge.firstChild);
  }
};
