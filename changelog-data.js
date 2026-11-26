
// ============================================================
// Notas da versão mostradas na página de changelog (changelog.html).
// A cada versão nova: atualize "version" e os textos abaixo (en / pt / es)
// e também o changelog do README. A página abre sozinha UMA vez depois da
// atualização; depois, só pelo botão em Settings > More > Changelog.
// ============================================================
const MDL_CHANGELOG = {
  version: "0.1.6",
  notes: {
    en: [
      "Discord presence: shows what you’re watching as “Watching <drama>”, with the drama name, “Episode x/xx”, the cover, a progress bar, a “Paused” state and a “View on MyDramaList” button. All the text is in English.",
      "Works on every supported site (and VLC). In Settings → Discord presence you can turn it on or off per site. Viki, WeTV and iQIYI start off because PreMiD already covers them. The “detail/drama” sites (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) count as one site: Seekee. New sites show up in the lists automatically.",
      "Connect to Discord by logging in with your Discord account directly through the extension. No additional app or installation is required. You can also choose the status shown while watching (Online / Idle / Do not disturb).",
      "New Settings page 2 (“More ›” next to Back): Excluded sites (turn MDL-Sync off on specific sites), Quick skip (pick the seconds and a shortcut key to jump ahead) and this Changelog.",
      "Mapped Titles now show the drama’s name with the site underneath (e.g. “Small Talk · ClubDoDorama”), so the same drama mapped on two sites is easy to tell apart.",
      "Mapped Titles: new “skip op” button. Pick when the opening starts and where to jump (e.g. 0:32 → 1:40) and every episode of that title skips it automatically, once per time you open the episode.",
      "Rating on the last episode now uses stars like MyDramaList: move the mouse over the stars and click. The number next to them is the exact score that will be sent.",
      "VLC: the popup now shows the episode playing in VLC, and VLC has Discord presence too.",
      "“detail/drama” sites: tags in square brackets at the start or end of the page title (like “[Português Legendas]”) are removed, so only the drama’s name is used.",
      "This page opens once after each update. You can open it again anytime from Settings → More → Changelog."
    ],
    pt: [
      "Presence no Discord: mostra o que você está assistindo como “Watching <drama>”, com o nome do drama, “Episode x/xx”, a capa, a barra de progresso, o estado “Paused” e o botão “View on MyDramaList”. Todo o texto fica em inglês.",
      "Funciona em todos os sites suportados (e no VLC). Em Settings → Discord presence dá pra ligar ou desligar por site. Viki, WeTV e iQIYI começam desligados porque o PreMiD já cobre. Os sites “detail/drama” (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) contam como um só: Seekee. Sites novos aparecem nas listas automaticamente.",
      "Conecte-se ao Discord fazendo login com sua conta diretamente pela extensão. Não é necessário instalar nenhum aplicativo adicional. Também dá pra escolher o status mostrado enquanto você assiste (Online / Ausente / Não perturbe).",
      "Nova página 2 das Settings (“More ›” ao lado do Back): Excluded sites (desliga o MDL-Sync em sites específicos), Quick skip (escolha os segundos e uma tecla de atalho pra pular à frente) e este Changelog.",
      "Mapped Titles agora mostram o nome do drama com o site embaixo (ex: “Small Talk · ClubDoDorama”), então fica fácil diferenciar o mesmo drama mapeado em dois sites.",
      "Mapped Titles: novo botão “skip op”. Escolha quando a abertura começa e pra onde pular (ex: 0:32 → 1:40) e todo episódio daquele título pula sozinho, uma vez a cada abertura do episódio.",
      "A nota do último episódio agora usa estrelas, como no MyDramaList: passe o mouse pelas estrelas e clique. O número ao lado é a nota exata que será enviada.",
      "VLC: o popup agora mostra o episódio que está tocando no VLC, e o VLC também tem presence no Discord.",
      "Sites “detail/drama”: tags entre colchetes no começo ou no fim do título da página (como “[Português Legendas]”) são removidas, então só o nome do drama é usado.",
      "Esta página abre uma vez depois de cada atualização. Dá pra abrir de novo quando quiser em Settings → More → Changelog."
    ],
    es: [
      "Presence en Discord: muestra lo que estás viendo como “Watching <drama>”, con el nombre del drama, “Episode x/xx”, la portada, una barra de progreso, el estado “Paused” y un botón “View on MyDramaList”. Todo el texto está en inglés.",
      "Funciona en todos los sitios compatibles (y en VLC). En Settings → Discord presence puedes activarla o desactivarla por sitio. Viki, WeTV e iQIYI empiezan desactivados porque PreMiD ya los cubre. Los sitios “detail/drama” (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) cuentan como uno solo: Seekee. Los sitios nuevos aparecen solos en las listas.",
      "Conéctate a Discord iniciando sesión con tu cuenta directamente desde la extensión. No es necesario instalar ninguna aplicación adicional. También puedes elegir el estado que se muestra mientras ves algo (Online / Idle / Do not disturb).",
      "Nueva página 2 de Settings (“More ›” junto a Back): Excluded sites (apaga MDL-Sync en sitios concretos), Quick skip (elige los segundos y una tecla de atajo para saltar adelante) y este Changelog.",
      "Mapped Titles ahora muestra el nombre del drama con el sitio debajo (ej. “Small Talk · ClubDoDorama”), así es fácil distinguir el mismo drama mapeado en dos sitios.",
      "Mapped Titles: nuevo botón “skip op”. Elige cuándo empieza la apertura y a dónde saltar (ej. 0:32 → 1:40) y todos los episodios de ese título la saltan solos, una vez cada vez que abres el episodio.",
      "La nota del último episodio ahora usa estrellas, como en MyDramaList: pasa el ratón por las estrellas y haz clic. El número de al lado es la nota exacta que se enviará.",
      "VLC: el popup ahora muestra el episodio que se reproduce en VLC, y VLC también tiene presence en Discord.",
      "Sitios “detail/drama”: las etiquetas entre corchetes al principio o al final del título de la página (como “[Português Legendas]”) se eliminan, así solo se usa el nombre del drama.",
      "Esta página se abre una vez después de cada actualización. Puedes abrirla de nuevo cuando quieras en Settings → More → Changelog."
    ]
  },
  titles: { en: "What’s new", pt: "Novidades", es: "Novedades" },
  older: {
    en: "Older versions: see the Changelog section of the README.",
    pt: "Versões anteriores: veja a seção Changelog do README.",
    es: "Versiones anteriores: consulta la sección Changelog del README."
  }
};
