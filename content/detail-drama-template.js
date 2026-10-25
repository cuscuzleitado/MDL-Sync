// ============================================================
// PARSER: template "detail/drama" — reutilizado por vários sites
// que usam a mesma estrutura de URL (parecem ser feitos com o
// mesmo "template" de site de streaming pirata).
//
// Sites que usam este parser (ver manifest.json):
//   - 123flmsfree.com
//   - ver.123pelicula.com
//   - flixlat.com
//   - play.cuevana19.com
//   - dramasfree.com (www3.dramasfree.com)
//   - solo-latino.com (latino.solo-latino.com)
// ============================================================

const SITE_PARSER = {
  // Usa o domínio real como nome do site, já que cada um é tecnicamente
  // um site diferente (mesmo template, conteúdo/domínio distintos) —
  // isso mantém o cache de mapeamento separado por site.
  siteName: window.location.hostname,

  // Ex: https://flixlat.com/pt/detail/drama/VzkL6JwLJuBXagf30gy64-Fangs-of-Fortune/2
  //     -> { season: 1, episode: 2, slug: "VzkL6JwLJuBXagf30gy64-Fangs-of-Fortune" }
  //
  // Importante: o ID antes do nome (que muda por título) fica DENTRO do
  // slug de propósito — ele é parte do identificador único do drama,
  // não deve ser removido/ignorado.
  //
  // Páginas sem número de episódio no final (ex: só a página do drama,
  // sem episódio selecionado) retornam null de propósito — não tem o
  // que sincronizar ali.
  getSeasonEpisode() {
    const match = window.location.pathname.match(/\/detail\/drama\/([^/]+)\/(\d+)$/);
    if (!match) return null;
    return { season: 1, episode: parseInt(match[2], 10), slug: match[1] };
  },

  // O <title> da aba nesse template geralmente já vem limpo, só com o
  // nome do drama.
  getTitle() {
    const raw = document.title.trim();
    return raw || null;
  }
};

window.MDLSyncCommon.init(SITE_PARSER);
