# MDL Sync (prototype) — v0.1.3

## What's new in v0.1.3

**How to install this update:** you do **not** need to remove and reload the
extension from scratch. Just extract this zip's files directly into your
existing extension folder (overwrite the matching files), then click the
reload icon (🔄) on the extension's card in `chrome://extensions`. Your
saved title mappings and synced-episode history are stored separately and
won't be lost.

Bug fixes:

- **Fixed Viki auto-sync firing almost instantly, before the episode even
  starts.** Viki plays a ~4 second "Rakuten Viki" branding clip before the
  actual episode, and that clip is also a `<video>` element — 80% of 4
  seconds is reached in about 3 seconds, so auto-sync was triggering on the
  branding clip instead of the real episode. Any video shorter than 3
  minutes is now ignored, since no real episode is that short.
- **Fixed Viki failing to detect episodes opened via "Continue Watching".**
  Those links use a short URL (e.g. `viki.com/videos/12345v`) that doesn't
  contain the show's slug or episode number, unlike the full URL format.
  The extension now reads this info from the page's `og:url` meta tag
  instead, which always contains the full slug/episode info regardless of
  which URL format is being viewed. As a side benefit, this also makes the
  stored title mapping independent of the on-screen display language (it
  no longer matters if Viki shows the drama name in Portuguese vs English).
- **Fixed a "stale page title" race condition on single-page-app sites**
  (Viki, kisskh, etc.). When navigating to a new episode without a full
  page reload, the extension could sometimes read the previous episode's
  page title for a brief moment before it updated, causing it to detect
  the wrong episode (or none) — requiring a manual refresh to fix. The
  extension now waits until the title actually changes before accepting
  a detection after a URL change.
- **Fixed WeTV title parsing** after WeTV changed their page title format
  (the episode number now appears before the drama name, e.g. "EP1: Drama
  Name - Watch HD..." instead of "Drama Name EP1 Watch Free..."). Both the
  old and new formats are now supported, and parsing no longer depends on
  the "Watch Free / Watch HD / Watch VIP" text, which varies depending on
  the viewer's account/plan.
- **Fixed episodes not updating the watch status on MDL.** Previously,
  syncing a non-final episode only updated the episode count, leaving the
  status untouched — so a title that was in "Plan to Watch" (or On-Hold,
  etc.) before syncing stayed there instead of moving to "Currently
  Watching." Any episode that isn't the final one now explicitly sets the
  status to "Currently Watching."
- Auto-sync now also re-attaches correctly if a site swaps out the entire
  `<video>` element when transitioning from an intro clip to the real
  episode player, instead of continuing to listen to the removed element.

## What's new in v0.1.2

- **Nota opcional no último episódio**: quando a extensão detecta que você
  chegou no último episódio de um drama (comparando com o total lido do
  próprio MDL), o badge ganha uma linha extra opcional com um seletor de
  nota (escala do MDL, 1.0 a 10.0) e um botão "Complete". O sync normal do
  episódio continua funcionando igual sempre (manual ou automático) — a
  nota é só um complemento, disponível a qualquer momento, antes ou depois
  do episódio já ter sido sincronizado. Ao usar, marca o status como
  "Completed" no MDL com a nota escolhida.
- **Interface toda em inglês**: botões, badge, notificações e popup agora
  estão em inglês (antes estavam em português).
- **Ícone novo** da extensão.

## Novidade da v0.1.1 — Auto-sync por % assistido

Se um título **já tem mapeamento salvo** (você já resolveu manualmente qual
é a entrada certa no MDL pelo menos uma vez), a extensão passa a escutar o
`<video>` da página e sincroniza sozinha automaticamente ao passar de 80%
do episódio — sem precisar clicar no botão "Marcar no MDL".

- Títulos **novos** (sem mapeamento ainda) continuam exigindo o clique
  manual na primeira vez — é assim que o mapeamento é criado.
- O badge mostra "🔄 auto 80%" quando o auto-sync está ativo pro episódio atual.
- **Indicador permanente de "já sincronizado"**: assim que um episódio é
  sincronizado (manual ou automaticamente), isso fica salvo. Da próxima vez
  que essa página carregar — mesmo depois de sair da tela cheia, recarregar,
  ou reabrir o navegador — o botão já aparece como "Já sincronizado ✓" em
  vez do padrão "Marcar no MDL". Isso é importante pra quem não sabe que o
  auto-sync existe (ex: amigos usando a extensão) não ficar em dúvida e
  clicar à toa achando que nada foi feito.
- **Notificação nativa do sistema**: como o badge fica escondido quando o
  vídeo está em tela cheia (o navegador só renderiza o elemento em
  fullscreen, não o resto da página), o auto-sync também dispara uma
  notificação do navegador/SO ao concluir — essa aparece independente de
  fullscreen ou da aba estar em segundo plano.
- Funciona melhor em sites que usam a tag `<video>` HTML5 nativa. Sites que
  escondem o vídeo dentro de um `<iframe>` de terceiros podem não funcionar
  (limitação de cross-origin do navegador) — nesses casos, o botão manual
  continua sempre disponível como alternativa.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative o "Modo do desenvolvedor" no canto superior direito.
3. Clique em "Carregar sem compactação" e selecione esta pasta.
4. Abra uma página de episódio no clubdodorama, ex:
   https://clubdodorama.com/episodios/awaken-1x10/
5. Deve aparecer um badge no canto inferior direito com o título/episódio detectado.

## Status atual

- ✅ Detecção de título + temporada + episódio no clubdodorama.com
- ✅ Badge de UI com botão "Marcar no MDL"
- ✅ Marcação do episódio via dialog "Add to List" (clica → preenche input → Submit)
- ✅ Matching manual na primeira vez (você escolhe o resultado certo na busca,
  já que títulos podem divergir entre sites — ex: "Awaken" vs "The Awake")
- ✅ Cache do mapeamento (`chrome.storage.local`, chave `mdlMap`) — da segunda
  vez em diante pula a busca e vai direto pra página certa
- ✅ Popup mostra os títulos mapeados e permite remover (corrigir escolha errada)

### Como funciona o matching agora

1. Primeiro episódio de um título novo → abre a busca do MDL numa aba visível,
   você clica no resultado certo, a extensão detecta a navegação e salva o
   mapeamento.
2. Próximos episódios do mesmo título → vai direto, sem busca, aba oculta.
3. Errou o título? Abra o popup da extensão, ache a entrada em "Títulos
   mapeados" e clique "remover" — a próxima sincronização pede pra escolher de novo.

## Sites suportados atualmente

- clubdodorama.com
- viki.com
- wetv.vip
- kisskh.co
- iq.com (iQIYI)
- 123flmsfree.com, ver.123pelicula.com, flixlat.com, play.cuevana19.com
  (todos usam o mesmo parser, `content/detail-drama-template.js`, por
  compartilharem a mesma estrutura de URL)

## Como adicionar um novo site de streaming

Cada site precisa de 2 coisas:

1. Um arquivo em `content/<nome-do-site>.js` com um objeto `SITE_PARSER`
   implementando `getSeasonEpisode()` (retornando `{ season, episode, slug }`)
   e `getTitle()` — use `content/viki.js` ou `content/clubdodorama.js` como
   modelo. No final do arquivo, chame `window.MDLSyncCommon.init(SITE_PARSER)`.
2. Uma entrada em `content_scripts` no `manifest.json` apontando pro domínio,
   **sempre carregando `content/common.js` antes** do arquivo do site:

```json
{
  "matches": ["https://outrosite.com/algum/padrao/*"],
  "js": ["content/common.js", "content/outrosite.js"],
  "run_at": "document_idle"
}
```

E adicione o domínio em `host_permissions` também.

Nada mais precisa mudar — o badge, o envio pro background, o cache de
mapeamento e a lógica de sync no MDL são todos compartilhados via `common.js`
e `background.js`.
