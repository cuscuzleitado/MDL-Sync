// ============================================================
// PARSER: kisskh (kisskh.co, kisskh.mx, kisskh.xyz)
// ============================================================
// Os domínios são espelhos do mesmo site (mesma estrutura de URL e mesmo
// "id" de série), por isso o siteName é fixo "kisskh" — o mapeamento e o
// ponto de retomar são compartilhados entre eles.
//
// Pra adicionar outro espelho, NÃO mexa neste arquivo: no manifest.json,
// adicione o domínio em "host_permissions" e em "matches" do kisskh.
// ============================================================

const SITE_PARSER = {
  siteName: "kisskh",

  // kisskh não usa temporada separada, assumimos sempre 1.
  // O parâmetro "id" na query string é o ID estável da série.
  // Ex: /Drama/Four-Hands--Two-Sonatas--2026-/Episode-1?id=13311&ep=223288
  //     -> { season: 1, episode: 1, slug: "13311" }
  getSeasonEpisode() {
    const url = new URL(window.location.href);
    const idParam = url.searchParams.get("id");
    const episodeMatch = window.location.pathname.match(/Episode-(\d+)/i);
    if (!idParam || !episodeMatch) return null;
    return { season: 1, episode: parseInt(episodeMatch[1], 10), slug: idParam };
  },

  // Extrai o nome do drama a partir do <title> da aba, removendo o ano
  // entre parênteses no final (ajuda a busca no MDL a não estranhar).
  // Ex: "Four Hands, Two Sonatas (2026) Episode 1 | kisskh" -> "Four Hands, Two Sonatas"
  getTitle() {
    const raw = document.title;
    const match = raw.match(/^(.+?)\s+Episode\s+\d+/i);
    if (!match) return null;
    return match[1].trim().replace(/\s*\(\d{4}\)\s*$/, "").trim();
  }
};

window.MDLSyncCommon.init(SITE_PARSER);
