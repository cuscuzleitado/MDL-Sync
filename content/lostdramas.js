// ============================================================
// PARSER: lostdramas.blogspot.com (Lost Dramas)
// ============================================================
// O site é uma SPA com rotas por HASH (o caminho da URL nunca muda):
//   Home:      https://lostdramas.blogspot.com/#/
//   Catálogo:  https://lostdramas.blogspot.com/#/cat/K-Drama
//   Drama:     https://lostdramas.blogspot.com/#/drama/the-remarried-empress
//   Episódio:  https://lostdramas.blogspot.com/#/drama/the-remarried-empress/3
//
// O <title> da aba segue o padrão (o "Dublado" aparece só nas versões dubladas):
//   "The Remarried Empress - Episódio 1 | Lost Dramas"
//   "The Remarried Empress - Dublado - Episódio 1 | Lost Dramas"
//
// Dublado e legendado são o mesmo drama no MDL, então o "- Dublado" é
// removido do título e do slug: os dois compartilham o mesmo mapeamento.
// ============================================================

// Lê o hash como lista de partes: "#/drama/the-remarried-empress/3"
// -> ["drama", "the-remarried-empress", "3"]
function lostDramasRoute() {
  return window.location.hash
    .replace(/^#\/?/, "")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

const SITE_PARSER = {
  siteName: "lostdramas",

  // Retorna null fora de uma página de episódio (home, catálogo e página do
  // drama sem episódio não têm o que sincronizar).
  getSeasonEpisode() {
    const route = lostDramasRoute();
    if (route[0] !== "drama" || !route[1] || !/^\d+$/.test(route[2] || "")) return null;

    const slug = route[1].toLowerCase().replace(/-dublado$/, "");
    return { season: 1, episode: parseInt(route[2], 10), slug };
  },

  // Extrai só o nome do drama do <title>, sem "- Episódio N", sem
  // "- Dublado" e sem "| Lost Dramas".
  //
  // Como o site troca de episódio sem recarregar, o <title> pode demorar
  // um instante pra atualizar. Se o número do episódio no título não bater
  // com o do hash, devolve null: o MDL-Sync tenta de novo a cada 500ms e
  // não corre o risco de sincronizar com o título do episódio anterior.
  getTitle() {
    const route = lostDramasRoute();
    const raw = document.title.replace(/\s*\|\s*Lost Dramas\s*$/i, "").trim();

    const match = raw.match(/^(.+?)\s*-\s*Epis[oó]dio\s*(\d+)\s*$/i);
    if (!match) return null;
    if (route[2] && parseInt(match[2], 10) !== parseInt(route[2], 10)) return null;

    const title = match[1].replace(/\s*-\s*Dublado\s*$/i, "").trim();
    return title || null;
  }
};

window.MDLSyncCommon.init(SITE_PARSER);

// O common.js só percebe troca de episódio quando o CAMINHO da URL muda, e
// neste site muda só o hash. Então aqui avisamos o common.js a cada troca de
// hash (mesmo mecanismo que ele usa quando o caminho muda).
window.addEventListener("hashchange", () => {
  if (SITE_PARSER.getSeasonEpisode()) {
    window.MDLSyncCommon._attemptDetection(
      SITE_PARSER,
      window.MDLSyncCommon._lastKnownEpisodeData || null
    );
  } else {
    // Saiu da página de episódio: some com o badge do episódio anterior.
    document.getElementById("mdl-sync-badge")?.remove();
  }
});
