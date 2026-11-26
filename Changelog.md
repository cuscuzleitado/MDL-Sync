### Changelog - English

**v0.1.6**
- Added **Discord presence**, shown as **“Watching <drama>”**: the drama's name, **“Episode x/xx”**, the cover, a progress bar, a “Paused” state and a “View on MyDramaList” button. All the text is in English. (On mobile the episode used to show twice; the card now has the drama name, the name repeated and “Episode x/xx”.) Works on every supported site and on VLC.
- **Two ways to connect:** log in with your Discord account (**Settings → Discord presence → Log in with Discord**) — no app and no open Discord needed, and covers use an application that ships with the extension, so there's nothing to create — or keep using the separate **MDL-Sync Presence** app (Windows, starts with the PC), which is used whenever you're not logged in (never both at once). The login connects only while you're watching, disconnects ~1 minute after you stop, reconnects by itself after drops and, if Discord rejects it (expired token), shows a notification and falls back to the app. ⚠️ The login mode uses your account session and isn't officially supported by Discord; the app is the safer alternative.
- **New Discord presence screen** in Settings: master switch, login/logout, **Status while watching** (Online / Idle / Do not disturb) and a **per-site on/off list**. Viki, WeTV and iQIYI start off because PreMiD already covers them; the “detail/drama” sites are grouped as one site, **Seekee**; new sites show up in the list automatically (see `sites.js`).
- **Settings page 2** (“More ›” next to Back): **Excluded sites** (turn MDL-Sync off on chosen sites, including the Viki skip buttons), **Quick skip** (choose the seconds and a shortcut key to jump ahead) and **Changelog**.
- **Mapped Titles now show the drama's name** (taken from MyDramaList when you sync) with the site underneath — e.g. “Small Talk · ClubDoDorama” — instead of the technical key, so the same drama mapped on two sites is easy to tell apart. Mappings saved before this update show a name taken from the MyDramaList link until their next sync.
- **Skip opening:** new **skip op** button next to “remove” in Mapped Titles. Pick when the opening starts and where to jump (e.g. 0:32 → 1:40); every episode of that title skips it on its own, once each time you open the episode.
- **Star rating** like MyDramaList on the last episode's optional rating: hover and click (each star = 2 points, steps of 0.5, from 1.0 to 10.0), with the exact score shown next to the stars.
- **Changelog page** (English / Português / Español) that opens once, automatically, the first time the extension runs after an update; afterwards it's in Settings → More → Changelog.
- **VLC:** the popup now shows the episode playing in VLC (before, it kept showing the last episode from another site, because VLC wasn't saving it as the last detected one). VLC also gets the Discord presence.
- **“detail/drama” sites** (123flmsfree, ver.123pelicula, flixlat, cuevana19, dramasfree, solo-latino…): tags in square brackets at the start or end of the page title — like “[Português Legendas]” or “[Português Dublado]” — are now removed, so only the drama's name is used for the MDL search, the popup and Discord. Brackets in the middle of a name are kept.
- New files: `sites.js` (site registry), `offscreen.html` / `offscreen.js` (the Discord connection, which survives the browser putting the extension's background script to sleep), `changelog.html` / `changelog.js` / `changelog-data.js`. New permissions: `webRequest` and `offscreen`, and access to `discord.com` (to read the login after you sign in on Discord's page, keep the connection and register covers) and to `127.0.0.1:17831` (the local app).

**v0.1.5**
- Added **Resume playback**: saves your position (15 seconds before where you stopped) while you watch, and offers to continue when you reopen the episode, right above the "Mark on MDL" button. The saved position isn't overwritten until you watch 1 minute past it, so opening an episode from 0:00 doesn't erase it. Can be turned off in Settings. Not used on WeTV and iQIYI.
- Added optional **Viki extras** in Settings: automatic "Skip Ad" and "Skip Intro" clicks (both off by default). "Skip ad" requests an extra browser permission only when you turn it on.
- Added support for **dramasfree.com** and **solo-latino.com** (same template as the other "detail/drama" sites).
- kisskh is now supported on its **kisskh.co, kisskh.mx and kisskh.xyz** mirrors, sharing the same saved mappings.
- Removed the "AUTO ACTIVATED" label from the badge.

**v0.1.4**
- Renamed the extension to **MDL-Sync**.
- Added a `LICENSE` file (MIT).
- Added support for **tokusatsus.com (TokuDrive)**. This site uses random per-episode IDs in the URL (no stable identifier), so detection is based entirely on page content: the episode number from `<h1 class="video-title">` (handles both "Episódio 1" and bare "01" formats) and the drama name from the `.playlist-header` heading.
- Added support for tracking local files played in **VLC**, via VLC's built-in Web Interface (`localhost:8080`). Since VLC has no `<video>` element or per-episode URL, this uses a dedicated polling approach: reads the filename from the `#mediaTitle` element, and progress from VLC's `/requests/status.json` API (with a DOM-based fallback using `#currentTime`/`#totalTime` if that request fails).

**v0.1.3**

Fixes:
- Fixed Viki auto-sync firing almost instantly, before the episode even starts. Viki plays a ~4 second "Rakuten Viki" branding clip before the actual episode, and that clip is also a `<video>` element — 80% of 4 seconds is reached in about 3 seconds, so auto-sync was triggering on the branding clip instead of the real episode. Any video shorter than 3 minutes is now ignored, since no real episode is that short.
- Fixed Viki failing to detect episodes opened via "Continue Watching." Those links use a short URL (e.g. `viki.com/videos/12345v`) that doesn't contain the show's slug or episode number, unlike the full URL format. The extension now reads this info from the page's `og:url` meta tag instead, which always contains the full slug/episode info regardless of which URL format is being viewed. As a side benefit, this also makes the stored title mapping independent of the on-screen display language.
- Fixed a "stale page title/episode" race condition on single-page-app sites (Viki, kisskh, etc.). When navigating to a new episode without a full page reload (including autoplay-triggered transitions), the extension could sometimes detect the previous episode for a brief moment before the new one loaded, requiring a manual refresh to fix. It now compares the actually-detected episode (not just the page title) before accepting a new detection after a URL change.
- Fixed WeTV title parsing after WeTV changed their page title format (the episode number now appears before the drama name). Both the old and new formats are now supported, and parsing no longer depends on "Watch Free / Watch HD / Watch VIP" text, which varies depending on the viewer's account/plan.
- Fixed episodes not updating the watch status on MDL. Syncing a non-final episode now explicitly sets the status to "Currently Watching," so a title previously in "Plan to Watch" (or On-Hold, etc.) moves correctly instead of staying put.
- Auto-sync now re-attaches correctly if a site swaps out the entire `<video>` element when transitioning from an intro clip to the real episode player.

**v0.1.2**
- Added optional rating system for the final episode of a drama (score 1.0–10.0, MDL's own scale).
- Final episode now automatically marks the title as "Completed" on MDL when synced, independent of whether a rating was given.
- Rating picker now appears immediately after syncing the final episode, no page reload needed.
- Entire UI translated to English (buttons, badge, notifications, popup).
- New extension icon.
- Backward-compatible with mappings saved by earlier versions.

**v0.1.1**
- Added auto-sync: once a title has been manually matched to MDL at least once, the extension automatically syncs progress after you've watched 80% of an episode (no click needed).
- Persistent "Already synced ✓" indicator on the floating button — stays marked across page reloads and after exiting fullscreen, so it's clear at a glance whether an episode was already tracked.
- Native browser notifications on auto-sync completion (visible even in fullscreen, where the on-page badge is hidden).
- Retry logic for messages to the background script, to recover from the browser's service worker going idle (common after the computer sleeps/hibernates).
- Detection retry loop for single-page-app sites (Angular/React/Vue) that render the page title asynchronously.
- URL-change watcher so sites that swap episodes without a full page reload are still detected correctly.

**v0.1.0**
- Initial release.
- Automatic detection of drama title, season, and episode on supported streaming sites.
- One-click sync button to mark episodes as watched on MyDramaList.
- Manual title-matching flow for cases where the drama's name differs between the streaming site and MDL.
- Supported sites: Viki, WeTV, iQIYI, and others.

### Changelog - Português

**v0.1.6**
- Adicionada a **presence no Discord**, exibida como **“Watching <drama>”**: o nome do drama, **“Episode x/xx”**, a capa, uma barra de progresso, o estado “Paused” e um botão “View on MyDramaList”. Todo o texto fica em inglês. (No celular o episódio aparecia duas vezes; agora o card tem o nome do drama, o nome repetido e “Episode x/xx”.) Funciona em todos os sites suportados e no VLC.
- **Duas formas de conectar:** login com sua conta do Discord (**Settings → Discord presence → Log in with Discord**) — sem app e sem precisar do Discord aberto, e as capas usam uma aplicação que já vem com a extensão, então não precisa criar nada — ou continuar usando o app separado **MDL-Sync Presence** (Windows, inicia com o PC), que é usado sempre que você não estiver logado (nunca os dois ao mesmo tempo). O login só conecta enquanto você assiste, desconecta ~1 minuto depois que você para, reconecta sozinho depois de quedas e, se o Discord recusar (token expirado), mostra uma notificação e volta pro app. ⚠️ O modo com login usa a sessão da sua conta e não é suportado oficialmente pelo Discord; o app é a alternativa mais segura.
- **Nova tela Discord presence** nas Settings: interruptor geral, login/logout, **Status while watching** (Online / Ausente / Não perturbe) e uma **lista pra ligar/desligar por site**. Viki, WeTV e iQIYI começam desligados porque o PreMiD já cobre; os sites “detail/drama” são agrupados num só, **Seekee**; sites novos aparecem na lista automaticamente (veja `sites.js`).
- **Página 2 das Settings** (“More ›” do lado do Back): **Excluded sites** (desliga o MDL-Sync em sites escolhidos, inclusive os botões de pular do Viki), **Quick skip** (escolha os segundos e uma tecla de atalho pra pular à frente) e **Changelog**.
- **Mapped Titles agora mostram o nome do drama** (vem do MyDramaList quando você sincroniza) com o site embaixo — ex: “Small Talk · ClubDoDorama” — em vez da chave técnica, então fica fácil diferenciar o mesmo drama mapeado em dois sites. Mapeamentos salvos antes desta atualização mostram um nome tirado do link do MyDramaList até o próximo sync.
- **Pular abertura:** novo botão **skip op** ao lado do “remove” em Mapped Titles. Escolha quando a abertura começa e pra onde pular (ex: 0:32 → 1:40); todo episódio daquele título pula sozinho, uma vez a cada vez que você abre o episódio.
- **Nota em estrelas**, como no MyDramaList, na nota opcional do último episódio: passe o mouse e clique (cada estrela = 2 pontos, de 0,5 em 0,5, de 1.0 a 10.0), com a nota exata mostrada ao lado das estrelas.
- **Página de changelog** (English / Português / Español) que abre sozinha, uma vez, na primeira vez que a extensão roda depois de uma atualização; depois fica em Settings → More → Changelog.
- **VLC:** o popup agora mostra o episódio que está tocando no VLC (antes ele continuava mostrando o último episódio de outro site, porque o VLC não salvava o “último detectado”). O VLC também ganhou a presence no Discord.
- **Sites “detail/drama”** (123flmsfree, ver.123pelicula, flixlat, cuevana19, dramasfree, solo-latino…): tags entre colchetes no começo ou no fim do título da página — como “[Português Legendas]” ou “[Português Dublado]” — agora são removidas, então só o nome do drama é usado na busca do MDL, no popup e no Discord. Colchetes no meio do nome são mantidos.
- Arquivos novos: `sites.js` (registro de sites), `offscreen.html` / `offscreen.js` (a conexão com o Discord, que sobrevive ao navegador pôr o script de fundo da extensão pra dormir), `changelog.html` / `changelog.js` / `changelog-data.js`. Novas permissões: `webRequest` e `offscreen`, e acesso ao `discord.com` (pra ler o login depois que você entra na página do Discord, manter a conexão e registrar as capas) e ao `127.0.0.1:17831` (o app local).

**v0.1.5**
- Adicionado o **Retomar de onde parou**: guarda sua posição (15 segundos antes de onde você parou) enquanto você assiste, e oferece continuar quando você reabre o episódio, logo acima do botão "Mark on MDL". A posição salva não é sobrescrita até você assistir 1 minuto além dela, então abrir um episódio do 0:00 não a apaga. Dá pra desligar nas Settings. Não é usado no WeTV nem no iQIYI.
- Adicionados **extras do Viki** opcionais nas Settings: cliques automáticos em "Skip Ad" e "Skip Intro" (os dois desligados por padrão). O "Skip ad" só pede a permissão extra do navegador quando você liga.
- Adicionado suporte pro **dramasfree.com** e pro **solo-latino.com** (mesmo template dos outros sites "detail/drama").
- O kisskh agora é suportado nos espelhos **kisskh.co, kisskh.mx e kisskh.xyz**, compartilhando os mesmos mapeamentos salvos.
- Removido o texto "AUTO ACTIVATED" do badge.

**v0.1.4**
- Extensão renomeada pra **MDL-Sync**.
- Adicionado arquivo `LICENSE` (MIT).
- Adicionado suporte pro **tokusatsus.com (TokuDrive)**. Esse site usa IDs aleatórios por episódio na URL (sem identificador estável), então a detecção é baseada inteiramente no conteúdo da página: o número do episódio vem do `<h1 class="video-title">` (cobre tanto "Episódio 1" quanto só "01") e o nome do drama vem do cabeçalho `.playlist-header`.
- Adicionado suporte pra rastrear arquivos locais tocados no **VLC**, via interface Web nativa do VLC (`localhost:8080`). Como o VLC não tem tag `<video>` nem URL por episódio, isso usa uma abordagem própria de polling: lê o nome do arquivo do elemento `#mediaTitle`, e o progresso da API `/requests/status.json` do VLC (com um plano B via DOM usando `#currentTime`/`#totalTime` caso essa requisição falhe).

**v0.1.3**

Correções:
- Corrigido o auto-sync do Viki disparando quase instantaneamente, antes do episódio nem começar. O Viki toca um clipe de ~4 segundos da marca "Rakuten Viki" antes do episódio de verdade, e esse clipe também é um elemento `<video>` — 80% de 4 segundos é atingido em uns 3 segundos, então o auto-sync disparava em cima da vinheta em vez do episódio real. Qualquer vídeo com menos de 3 minutos agora é ignorado, já que nenhum episódio de verdade é tão curto.
- Corrigido o Viki não detectando episódios abertos pelo "Continue Watching". Esses links usam uma URL curta (ex: `viki.com/videos/12345v`) que não contém o slug nem o número do episódio, diferente da URL completa. A extensão agora lê essa informação da meta tag `og:url` da página, que sempre traz o slug/episódio completo independente de qual formato de URL está sendo usado. De bônus, isso também torna o mapeamento salvo independente do idioma exibido na tela.
- Corrigida uma condição de corrida de "título/episódio desatualizado" em sites de página única (Viki, kisskh, etc.). Ao navegar pra um episódio novo sem recarregar a página inteira (incluindo trocas automáticas por autoplay), a extensão às vezes detectava o episódio anterior por um instante antes do novo carregar, exigindo um refresh manual pra corrigir. Agora ela compara o episódio realmente detectado (não só o título da página) antes de aceitar uma nova detecção depois de uma troca de URL.
- Corrigido o parsing de título do WeTV depois que o WeTV mudou o formato do título da página (o número do episódio agora aparece antes do nome do drama). Os dois formatos, antigo e novo, agora são suportados, e o parsing não depende mais do texto "Watch Free / Watch HD / Watch VIP", que varia conforme a conta/plano de quem está assistindo.
- Corrigidos episódios sincronizando sem atualizar o status de andamento no MDL. Sincronizar um episódio que não é o último agora força o status pra "Currently Watching", então um título que estava em "Plan to Watch" (ou On-Hold, etc.) é movido corretamente em vez de ficar preso lá.
- O auto-sync agora reconecta corretamente se um site trocar a tag `<video>` inteira na transição da vinheta pro player do episódio real.

**v0.1.2**
- Adicionado sistema de nota opcional pro último episódio de um drama (nota de 1.0 a 10.0, escala do próprio MDL).
- O último episódio agora marca o título como "Completed" no MDL automaticamente ao sincronizar, independente de ter recebido uma nota ou não.
- O seletor de nota agora aparece imediatamente depois de sincronizar o último episódio, sem precisar recarregar a página.
- Interface toda traduzida pra inglês (botões, badge, notificações, popup).
- Ícone novo da extensão.
- Compatível com mapeamentos salvos por versões anteriores.

**v0.1.1**
- Adicionado auto-sync: assim que um título já foi casado manualmente com o MDL pelo menos uma vez, a extensão sincroniza o progresso automaticamente depois que você assistir 80% de um episódio (sem precisar clicar).
- Indicador permanente de "Already synced ✓" no botão flutuante — continua marcado entre recarregamentos de página e depois de sair da tela cheia, então sempre fica claro de relance se um episódio já foi rastreado.
- Notificações nativas do navegador quando o auto-sync termina (visíveis mesmo em tela cheia, onde o badge da página fica escondido).
- Lógica de repetição pras mensagens pro background script, pra se recuperar de quando o service worker do navegador fica inativo (comum depois do computador hibernar/dormir).
- Loop de repetição na detecção pra sites de página única (Angular/React/Vue) que renderizam o título da página de forma assíncrona.
- Monitor de mudança de URL, pra sites que trocam de episódio sem recarregar a página inteira continuarem sendo detectados corretamente.

**v0.1.0**
- Lançamento inicial.
- Detecção automática de título do drama, temporada e episódio em sites de streaming suportados.
- Botão de sync com um clique pra marcar episódios como assistidos no MyDramaList.
- Fluxo de matching manual de título pros casos em que o nome do drama diverge entre o site de streaming e o MDL.
- Sites suportados: Viki, WeTV, iQIYI, e outros.
