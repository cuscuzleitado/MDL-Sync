// ============================================================
// PARSER: viki.com
// ============================================================

const SITE_PARSER = {
  siteName: "viki",

  // Viki às vezes usa uma URL curta sem o nome do drama nem o número do
  // episódio (ex: entrando por "Continue Watching"):
  //   https://www.viki.com/videos/1262821v
  // em vez da URL completa:
  //   https://www.viki.com/videos/1262821v-deep-affectionate-eyes-episode-1
  //
  // A tag <meta property="og:url"> sempre traz a URL completa (com slug e
  // episódio), mesmo quando a URL da página é a curta. Ela também não muda
  // com o idioma de exibição (o slug fica em inglês sempre), diferente do
  // <title> da aba. Por isso usamos ela como fonte, com fallback pra URL
  // da própria página caso a meta tag não exista por algum motivo.
  // Viki também não usa temporada separada, assumimos sempre 1.
  getSeasonEpisode() {
    const ogUrl = document.querySelector('meta[property="og:url"]')?.content;
    const source = ogUrl || window.location.href;

    let pathname;
    try {
      pathname = new URL(source, window.location.origin).pathname.replace(/\/$/, "");
    } catch {
      return null;
    }

    const match = pathname.match(/^\/videos\/(\d+v)-(.+)-episode-(\d+)$/);
    if (!match) return null;
    const [, , slugRaw, episode] = match;
    return { season: 1, episode: parseInt(episode, 10), slug: slugRaw };
  },

  // Nome exibido (pode variar de idioma) — usado só pra mostrar no badge,
  // não afeta o identificador salvo (que vem do slug da og:url acima).
  getTitle() {
    const raw = document.title;
    const namePart = raw.split(/\s+-\s+Episode/i)[0]?.trim();
    return namePart || null;
  }
};

window.MDLSyncCommon.init(SITE_PARSER);
