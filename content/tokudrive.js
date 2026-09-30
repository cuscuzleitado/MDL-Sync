// ============================================================
// PARSER: tokusatsus.com (TokuDrive)
// ============================================================
// A URL usa IDs aleatórios por episódio (não dá pra usar como chave
// estável), então tiramos tudo do conteúdo da própria página:
//   - Episódio: <h1 class="video-title"> — o texto varia bastante:
//     "Episódio 1", só "01", ou possivelmente outro formato sem
//     nenhuma palavra "episódio" junto.
//   - Nome do drama: <h3> dentro de .playlist-header — ex: "Armor Hero (2009)"
// ============================================================

const SITE_PARSER = {
  siteName: "tokudrive",

  getSeasonEpisode() {
    const h1 = document.querySelector("h1.video-title");
    if (!h1) return null;
    const raw = h1.textContent.trim();

    let episode = null;

    // Formato "Episódio 1" (com ou sem acento)
    let match = raw.match(/epis[oó]dio\s*(\d+)/i);
    if (match) {
      episode = parseInt(match[1], 10);
    } else if (/^\d+$/.test(raw)) {
      // Formato só o número, ex: "01"
      episode = parseInt(raw, 10);
    } else {
      // Último recurso: pega o primeiro número que aparecer no texto,
      // pra cobrir formatos diferentes que ainda não vimos.
      match = raw.match(/(\d+)/);
      if (match) episode = parseInt(match[1], 10);
    }

    if (episode === null || isNaN(episode)) return null;

    const dramaEl = document.querySelector(".playlist-header h3");
    if (!dramaEl) return null;
    const title = dramaEl.textContent.trim();
    if (!title) return null;

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    return { season: 1, episode, slug };
  },

  getTitle() {
    const dramaEl = document.querySelector(".playlist-header h3");
    return dramaEl ? dramaEl.textContent.trim() : null;
  }
};

window.MDLSyncCommon.init(SITE_PARSER);
