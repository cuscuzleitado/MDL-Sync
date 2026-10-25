// ============================================================
// PARSER: iq.com (iQIYI)
// ============================================================

const SITE_PARSER = {
  siteName: "iqiyi",

  // Esses sites já lembram onde você parou por conta própria, então o
  // "retomar de onde parou" do MDL-Sync fica desligado aqui.
  supportsResume: false,

  // A página do episódio sempre tem um link visível pro álbum (a página
  // do drama), e esse link é a fonte mais confiável tanto pro nome quanto
  // pra uma chave estável — o <title> da aba vem cheio de texto de SEO.
  // Ex: link "OVERDO" -> href="https://www.iq.com/album/overdo-2026-ekj37hbjxt?..."
  _getAlbumLink() {
    return document.querySelector('a[href*="/album/"]');
  },

  // Ex: https://www.iq.com/play/overdo-episode-1-1yqejndn9k0?lang=en_us
  //     -> { season: 1, episode: 1, slug: "overdo-2026-ekj37hbjxt" }
  getSeasonEpisode() {
    const episodeMatch = window.location.pathname.match(/-episode-(\d+)-/i);
    const albumLink = this._getAlbumLink();
    if (!episodeMatch || !albumLink) return null;

    const slugMatch = albumLink.getAttribute("href").match(/\/album\/([^/?]+)/);
    if (!slugMatch) return null;

    return { season: 1, episode: parseInt(episodeMatch[1], 10), slug: slugMatch[1] };
  },

  getTitle() {
    const albumLink = this._getAlbumLink();
    return albumLink ? albumLink.textContent.trim() : null;
  }
};

window.MDLSyncCommon.init(SITE_PARSER);
