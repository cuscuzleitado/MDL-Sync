// ============================================================
// PARSER: wetv.vip
// ============================================================

const SITE_PARSER = {
  siteName: "wetv",

  // WeTV não expõe temporada na URL, então assumimos sempre 1.
  // O "slug" usa o ID da série (estável entre episódios), não o título,
  // já que o título só aparece formatado dentro da própria página.
  // Ex: https://wetv.vip/en/play/bau2n7vfm0tvhsc/y4102uv0vrn-EP01%3A_Love_Has_Fireworks
  //     -> { season: 1, episode: 1, slug: "bau2n7vfm0tvhsc" }
  getSeasonEpisode() {
    const path = window.location.pathname;
    const match = path.match(/^\/en\/play\/([^/]+)\/[^/]*-EP(\d+)/i);
    if (!match) return null;
    return { season: 1, episode: parseInt(match[2], 10), slug: match[1] };
  },

  // Extrai o nome do drama a partir do <title> da aba. O WeTV já usou dois
  // formatos diferentes (varia inclusive com Watch Free/HD/VIP dependendo
  // da conta) — reconhece os dois:
  //   Novo:  "EP1: Love Song in Winter - Watch HD Video Online - WeTV"
  //   Antigo: "Love Has Fireworks EP1 Watch Free with Eng Sub | WeTV"
  getTitle() {
    const raw = document.title;

    // Formato novo: nome vem DEPOIS do "EPxx: ", antes do " - Watch".
    let match = raw.match(/^EP\d+:\s*(.+?)\s*-\s*Watch/i);
    if (match) return match[1].trim();

    // Formato antigo: nome vem ANTES do "EPxx".
    match = raw.match(/^(.+?)\s+EP\d+/i);
    if (match) return match[1].trim();

    return null;
  }
};

window.MDLSyncCommon.init(SITE_PARSER);
