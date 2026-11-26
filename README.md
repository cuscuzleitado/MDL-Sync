# MDL-Sync — v0.1.6

**[English](#english) | [Português](#português-brasil)**

---

## English

A browser extension that automatically tracks your episode progress on **MyDramaList** while you watch dramas on supported streaming sites (or locally, via VLC).

⚠️ This is an early-stage personal project. It's not affiliated with MyDramaList or any streaming site. Expect bugs, and feel free to open an issue if you run into one.

### What it does

- Detects the drama title, season, and episode you're watching automatically.
- Shows a small floating button to sync the current episode to your MDL list with one click.
- After you manually confirm the correct title once, it remembers — from then on, it can sync automatically once you've watched ~80% of the episode, no clicking needed.
- Once an episode is synced, the button stays marked "Already synced ✓" — even after reloading the page or exiting fullscreen — so you always know at a glance whether it's done.
- On the **final episode** of a drama, the title is automatically marked as **Completed** on MDL when synced. An optional rating picker (MDL's own 1.0–10.0 scale) also appears, available at any time, independent of the sync itself.
- Any non-final episode explicitly sets the status to **Currently Watching** on MDL, so a title sitting in "Plan to Watch" or "On-Hold" gets moved correctly instead of staying put.
- Native browser notifications on auto-sync completion — these show up even when the video is in fullscreen (where the on-page badge is hidden).
- **Resume playback** (on by default, can be turned off in Settings): remembers where you stopped and, when you reopen the episode, offers to continue from there. It works on every supported site except WeTV and iQIYI, and the saved positions stay only in your browser.
- **Viki extras** (off by default, in Settings): automatically clicks the “Skip Ad” and “Skip Intro” buttons. “Skip ad” asks for an extra browser permission the first time you turn it on, because the ad button lives inside the ad player's frames.
- Can also track episodes played locally in **VLC** (e.g. files downloaded from Telegram), via VLC's built-in Web Interface — see the VLC section below.
- **Discord presence** (optional): shows what you're watching on Discord as “Watching <drama>”, with the episode, the cover and a progress bar — see the Discord presence section below.
- **Skip opening** per title, a **quick-skip shortcut key**, a **star rating** (like MyDramaList) on the last episode, and the option to **exclude sites** — see “More settings and extras” below.

### Requirements

- You need to be **logged into MyDramaList** — the extension opens a hidden background tab to update your list, using your existing session.
- MyDramaList needs to be set to **English** — the extension looks for specific button/label text, and won't find them in other languages.
- Streaming sites also need to be in English for detection to work reliably.

### Installing (developer mode)

Since this isn't published on the Chrome Web Store, you'll need to load it manually:

1. Download and unzip this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top-right corner).
4. Click **Load unpacked** and select the extracted folder.
5. Open an episode page on a supported site — a small badge should appear in the bottom-right corner with the detected title/episode.

**Updating an existing install:** you do NOT need to remove and reload the extension from scratch. Just extract the new version's files directly into your existing extension folder (overwriting the matching files), then click the reload icon (🔄) on the extension's card in `chrome://extensions`. Your saved title mappings and synced-episode history are stored separately and won't be lost. (Some versions add new files — v0.1.6 adds `sites.js`, `offscreen.html`, `offscreen.js`, `changelog.html`, `changelog.js` and `changelog-data.js` — so copy every file from the new version, not only the ones you remember changing.)

### If the drama's title differs between the streaming site and MDL

This happens sometimes (different romanizations, localized titles, etc.). The first time you sync a new title, a search tab opens automatically — just click into the correct title's MDL page yourself. The extension detects that and remembers the correct match from then on, so you'll only need to do this once per title.

If you ever pick the wrong title by mistake, open the extension's popup, find the entry under "Mapped titles," and click **remove** — the next sync will ask you to choose again.

### Supported sites

- Viki
- WeTV
- iQIYI
- clubdodorama.com
- kisskh (kisskh.co, kisskh.mx and kisskh.xyz mirrors)
- tokusatsus.com (TokuDrive)
- 123flmsfree.com, ver.123pelicula.com, flixlat.com, play.cuevana19.com, dramasfree.com, solo-latino.com (same template/parser, since they share the same URL structure)
- **VLC** (local files), via VLC's Web Interface — see below

### Tracking local files with VLC

For dramas you download (e.g. from Telegram) and watch in VLC instead of a streaming site:

1. In VLC, go to **Tools → Preferences**, switch to **All** settings (bottom-left), then **Interface → Main interfaces**, and check **Web**.
2. Go to the **Lua** section that appears under Main interfaces, and set a password.
3. Restart VLC and open `http://localhost:8080` in your browser while a video is playing — you should see VLC's web player.
4. The extension will detect the playing file's name and track progress the same way it does on streaming sites.

Filename recognition currently supports patterns like `Drama Name - EP01.mp4`, `Drama.Name.S01E05.1080p.mkv`, and `[Group] Drama Name - 05.mkv`. If your files use a different naming pattern, open an issue with an example filename.

### Discord presence (optional)

Shows what you're watching on Discord as **“Watching <drama>”**. The card has the drama's name, **“Episode 5/16”**, the cover and a progress bar; paused shows “Paused”, and there's a “View on MyDramaList” button. Close the tab and it disappears. All the text is in English. It works on **every supported site and on VLC**. The cover and the “/16” appear once the episode has been synced on MDL, because that's where the extension gets them.

Everything is in **Settings → Discord presence**:

- A master switch, the Discord login, and the **status shown while watching** (Online / Idle / Do not disturb — it replaces your usual status while the presence is up).
- A **per-site list** to turn the presence on or off. **Viki, WeTV and iQIYI start off** because PreMiD already covers them (turning them on can show two activities at once). The “detail/drama” sites (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) count as a single site called **Seekee**. A new site added to the extension shows up in the list by itself.

There are two ways to connect to Discord:

1. **Log in with your Discord account (no app needed).** Click **Log in with Discord**, log in normally on the page that opens, and that's it — the extension keeps the connection by itself, even with the Discord app closed. Nothing to create: covers use an application that already comes with the extension. ⚠️ This uses your account session, which Discord doesn't officially support (their terms don't allow automating user accounts), so use it at your own risk. The login token stays only in the extension's storage in your browser; **Log out** deletes it.
2. **The MDL-Sync Presence app (used when you're not logged in).** A small separate program for Windows (needs [Node.js](https://nodejs.org)) that starts with the PC and talks to the Discord desktop app, which has to be open. It doesn't use your account login. It comes as its own folder, `MDL-Sync-Presence`, with an `install.bat`.

If you're logged in, the app is not used (so you never get two activities at once); log out and the app takes over again.

### More settings and extras

Open **Settings** and click **More ›** (next to Back):

- **Excluded sites** — turns MDL-Sync off on the sites you uncheck (no badge, sync, resume, skip or Discord there). Reload the page after changing.
- **Quick skip** — pick a number of seconds and a shortcut key; pressing it while watching jumps ahead by that many seconds. It only works on supported sites and takes priority over the site's own shortcut for the same key. It does nothing on the VLC page (VLC has its own keys).
- **Changelog** — opens the “What's new” page (English, Português, Español). It also opens by itself, once, the first time the extension runs after an update.

**Skip opening:** in **Mapped Titles**, click **skip op** next to a title, type when the opening starts and where to jump (e.g. `0:32` and `1:40`) and save. From then on, every episode of that title jumps from 0:32 to 1:40 on its own — once each time you open the episode (if you go back to rewatch the opening, it doesn't skip again). It does nothing if the video is already past the end time (e.g. you resumed later). Removing the mapping also removes its rule.

**Rating:** on the last episode, the optional rating is now 5 stars like MyDramaList. Move the mouse over the stars and click; each star is 2 points and it moves in 0.5-point steps (1.0 to 10.0). The number next to the stars is exactly what will be sent.

### Adding support for a new streaming site

Each site needs two things:

1. A file at `content/<site-name>.js` with a `SITE_PARSER` object implementing `getSeasonEpisode()` (returning `{ season, episode, slug }`) and `getTitle()`. Use `content/viki.js` or `content/clubdodorama.js` as a template. At the end of the file, call `window.MDLSyncCommon.init(SITE_PARSER)`.
2. An entry in `content_scripts` in `manifest.json` pointing to the domain, **always loading `sites.js` and then `content/common.js` before** the site file:

```json
{
  "matches": ["https://newsite.com/some/pattern/*"],
  "js": ["sites.js", "content/common.js", "content/newsite.js"],
  "run_at": "document_idle"
}
```

Also add the domain to `host_permissions`. Optionally add a line for the site in `MDL_SITES` in `sites.js` (same `id` as the parser's `siteName`) so it gets a proper name in the “Discord presence” and “Excluded sites” lists — if you don't, it still appears there by itself, with its technical name, the first time you visit it.

Nothing else needs to change — the badge, messaging to the background script, title-mapping cache, MDL sync logic, and **resume playback** are all shared via `common.js` and `background.js`. Resume is on automatically for every new site; if a site already remembers your position by itself, add `supportsResume: false,` to its `SITE_PARSER` (like `content/wetv.js` and `content/iqiyi.js` do).

**A new mirror domain of a site that's already supported** (e.g. another kisskh address) doesn't need a new file: just add the domain to `host_permissions` and to the existing site's `matches` in `manifest.json`.

### License

MIT — see [LICENSE](./LICENSE).

### Changelog

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

### Contributing

Bug reports, additional site requests, and general feedback are all welcome. Please include the site name and, if possible, a screenshot of any console errors (`F12` → Console).

---

## Português (Brasil)

Uma extensão de navegador que sincroniza automaticamente seu progresso de episódios no **MyDramaList** enquanto você assiste doramas em sites de streaming suportados (ou localmente, via VLC).

⚠️ Isso é um projeto pessoal em estágio inicial. Não tem nenhuma ligação oficial com o MyDramaList nem com nenhum site de streaming. Esperem bugs, e sintam-se à vontade pra abrir uma issue se encontrar algum.

### O que ela faz

- Detecta automaticamente o drama, a temporada e o episódio que você está assistindo.
- Mostra um botãozinho flutuante pra sincronizar o episódio atual com sua lista do MDL com um clique.
- Depois que você confirma manualmente o título certo uma vez, ela lembra — daí em diante consegue sincronizar sozinha depois que você assistir ~80% do episódio, sem precisar clicar em nada.
- Uma vez sincronizado, o botão fica marcado como "Already synced ✓" — mesmo depois de recarregar a página ou sair da tela cheia — então sempre dá pra saber de relance se já foi feito.
- No **último episódio** de um drama, o título é marcado automaticamente como **Completed** no MDL assim que sincroniza. Um seletor de nota opcional (na própria escala do MDL, de 1.0 a 10.0) também aparece, disponível a qualquer momento, independente da sincronização em si.
- Qualquer episódio que não seja o último força o status pra **Currently Watching** no MDL, então um título parado em "Plan to Watch" ou "On-Hold" é movido corretamente em vez de ficar preso lá.
- Notificações nativas do navegador quando o auto-sync termina — aparecem mesmo com o vídeo em tela cheia (onde o badge da página fica escondido).
- **Retomar de onde parou** (ligado por padrão, dá pra desligar nas Settings): lembra onde você parou e, quando você reabre o episódio, oferece continuar dali. Funciona em todos os sites suportados, menos WeTV e iQIYI, e os pontos salvos ficam só no seu navegador.
- **Extras do Viki** (desligados por padrão, nas Settings): clica sozinho nos botões “Skip Ad” e “Skip Intro”. O “Skip ad” pede uma permissão extra do navegador na primeira vez que você liga, porque o botão do anúncio fica dentro dos frames do player de anúncios.
- Também rastreia episódios assistidos localmente no **VLC** (ex: arquivos baixados do Telegram), através da interface Web nativa do VLC — veja a seção do VLC abaixo.
- **Presence no Discord** (opcional): mostra no Discord o que você está assistindo como “Watching <drama>”, com o episódio, a capa e uma barra de progresso — veja a seção de presence abaixo.
- **Pular abertura** por título, **tecla de atalho pra pular** à frente, **nota em estrelas** (como no MyDramaList) no último episódio e opção de **excluir sites** — veja “Mais opções e extras” abaixo.

### Requisitos

- Você precisa estar **logado no MyDramaList** — a extensão abre uma aba oculta em segundo plano pra atualizar sua lista, usando sua sessão já logada.
- O MyDramaList precisa estar configurado em **inglês** — a extensão procura por textos específicos de botões/rótulos, e não vai achar em outros idiomas.
- Os sites de streaming também precisam estar em inglês pra detecção funcionar de forma confiável.

### Como instalar (modo desenvolvedor)

Como não está publicada na Chrome Web Store, você vai precisar carregar manualmente:

1. Baixe e extraia este repositório.
2. Abra `chrome://extensions` (ou `edge://extensions`).
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta extraída.
5. Abra uma página de episódio num site suportado — deve aparecer um badge no canto inferior direito com o título/episódio detectado.

**Atualizando uma instalação existente:** não precisa remover e carregar a extensão do zero. É só extrair os arquivos da nova versão direto na pasta que você já tem (substituindo os arquivos), e clicar no ícone de recarregar (🔄) no card da extensão em `chrome://extensions`. Seus mapeamentos salvos e histórico de episódios sincronizados ficam guardados separado e não se perdem. (Algumas versões trazem arquivos novos — a v0.1.6 traz `sites.js`, `offscreen.html`, `offscreen.js`, `changelog.html`, `changelog.js` e `changelog-data.js` — então copie todos os arquivos da versão nova, e não só os que você lembra que mudaram.)

### Se o nome do drama estiver diferente entre o site de streaming e o MDL

Isso acontece às vezes (romanizações diferentes, títulos localizados, etc.). Na primeira vez que você sincronizar um título novo, uma aba de busca abre automaticamente — é só você mesmo entrar na página certa do título no MDL. A extensão detecta isso e memoriza o mapeamento correto dali em diante, então só precisa fazer isso uma vez por título.

Se escolher o título errado por engano, abre o popup da extensão, acha a entrada em "Mapped titles" e clica em **remove** — a próxima sincronização pede pra escolher de novo.

### Sites suportados

- Viki
- WeTV
- iQIYI
- clubdodorama.com
- kisskh (espelhos kisskh.co, kisskh.mx e kisskh.xyz)
- tokusatsus.com (TokuDrive)
- 123flmsfree.com, ver.123pelicula.com, flixlat.com, play.cuevana19.com, dramasfree.com, solo-latino.com (mesmo template/parser, já que compartilham a mesma estrutura de URL)
- **VLC** (arquivos locais), via interface Web do VLC — veja abaixo

### Rastreando arquivos locais com o VLC

Pra doramas que você baixa (ex: do Telegram) e assiste no VLC em vez de um site de streaming:

1. No VLC, vá em **Ferramentas → Preferências**, mude pra mostrar **Todas** as configurações (canto inferior esquerdo), depois **Interface → Interfaces principais**, e marque **Web**.
2. Vá na seção **Lua** que aparece embaixo de Interfaces principais, e defina uma senha.
3. Reinicie o VLC e abra `http://localhost:8080` no navegador enquanto um vídeo estiver tocando — deve aparecer o player web do VLC.
4. A extensão vai detectar o nome do arquivo tocando e acompanhar o progresso igual faz nos sites de streaming.

O reconhecimento de nome de arquivo hoje suporta padrões como `Drama Name - EP01.mp4`, `Drama.Name.S01E05.1080p.mkv` e `[Grupo] Drama Name - 05.mkv`. Se seus arquivos usarem um padrão diferente, abra uma issue com um exemplo de nome de arquivo.

### Presence no Discord (opcional)

Mostra no Discord o que você está assistindo como **“Watching <drama>”**. O card tem o nome do drama, **“Episode 5/16”**, a capa e uma barra de progresso; pausado mostra “Paused”, e tem um botão “View on MyDramaList”. Fechou a aba, some. Todo o texto fica em inglês. Funciona em **todos os sites suportados e no VLC**. A capa e o “/16” aparecem depois que o episódio foi sincronizado no MDL, porque é de lá que a extensão tira essas informações.

Tudo fica em **Settings → Discord presence**:

- Um interruptor geral, o login do Discord e o **status mostrado enquanto você assiste** (Online / Ausente / Não perturbe — ele substitui seu status de sempre enquanto a presence estiver no ar).
- Uma **lista por site** pra ligar ou desligar a presence. **Viki, WeTV e iQIYI começam desligados** porque o PreMiD já cobre (ligar pode mostrar duas atividades ao mesmo tempo). Os sites “detail/drama” (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) contam como um site só, chamado **Seekee**. Um site novo adicionado à extensão aparece na lista sozinho.

Existem duas formas de conectar ao Discord:

1. **Login com sua conta do Discord (sem app).** Clique em **Log in with Discord**, faça o login normalmente na página que abrir, e pronto — a extensão mantém a conexão sozinha, mesmo com o Discord fechado. Não precisa criar nada: as capas usam uma aplicação que já vem com a extensão. ⚠️ Isso usa a sessão da sua conta, o que o Discord não suporta oficialmente (os termos não permitem automatizar contas de usuário), então use por sua conta e risco. O token do login fica guardado só no armazenamento da extensão, no seu navegador; **Log out** apaga.
2. **O app MDL-Sync Presence (usado quando você não está logado).** Um programinha separado pra Windows (precisa do [Node.js](https://nodejs.org)) que inicia junto com o PC e conversa com o app do Discord, que precisa estar aberto. Ele não usa o login da sua conta. Vem numa pasta própria, `MDL-Sync-Presence`, com um `install.bat`.

Se você estiver logado, o app não é usado (assim nunca aparecem duas atividades ao mesmo tempo); saiu do login, o app volta a assumir.

### Mais opções e extras

Abra as **Settings** e clique em **More ›** (do lado do Back):

- **Excluded sites** — desliga o MDL-Sync nos sites que você desmarcar (sem badge, sync, retomar, pular nem Discord ali). Recarregue a página depois de mudar.
- **Quick skip** — escolha uma quantidade de segundos e uma tecla de atalho; apertando a tecla enquanto assiste, o vídeo avança esses segundos. Só funciona nos sites suportados e tem prioridade sobre o atalho do próprio site pra mesma tecla. Não faz nada na página do VLC (o VLC tem as teclas dele).
- **Changelog** — abre a página “Novidades” (English, Português, Español). Ela também abre sozinha, uma vez, na primeira vez que a extensão roda depois de uma atualização.

**Pular abertura:** em **Mapped Titles**, clique em **skip op** ao lado do título, digite quando a abertura começa e pra onde pular (ex: `0:32` e `1:40`) e salve. A partir daí, todo episódio daquele título pula de 0:32 pra 1:40 sozinho — uma vez a cada vez que você abre o episódio (se voltar pra rever a abertura, não pula de novo). Não faz nada se o vídeo já estiver depois do tempo final (ex: você retomou mais pra frente). Remover o mapeamento também remove a regra.

**Nota:** no último episódio, a nota opcional agora são 5 estrelas, como no MyDramaList. Passe o mouse pelas estrelas e clique; cada estrela vale 2 pontos e o mouse anda de 0,5 em 0,5 (1.0 a 10.0). O número ao lado das estrelas é exatamente o que será enviado.

### Como adicionar suporte a um novo site de streaming

Cada site precisa de 2 coisas:

1. Um arquivo em `content/<nome-do-site>.js` com um objeto `SITE_PARSER` implementando `getSeasonEpisode()` (retornando `{ season, episode, slug }`) e `getTitle()`. Use `content/viki.js` ou `content/clubdodorama.js` como modelo. No final do arquivo, chame `window.MDLSyncCommon.init(SITE_PARSER)`.
2. Uma entrada em `content_scripts` no `manifest.json` apontando pro domínio, **sempre carregando `content/common.js` antes** do arquivo do site:

```json
{
  "matches": ["https://novosite.com/algum/padrao/*"],
  "js": ["sites.js", "content/common.js", "content/novosite.js"],
  "run_at": "document_idle"
}
```

E adicione o domínio em `host_permissions` também.

Nada mais precisa mudar — o badge, o envio de mensagens pro background, o cache de mapeamento de títulos, a lógica de sync no MDL e o **retomar de onde parou** são todos compartilhados via `common.js` e `background.js`. O retomar já vem ligado em qualquer site novo; se o site já lembra sozinho onde você parou, coloque `supportsResume: false,` no `SITE_PARSER` dele (como fazem `content/wetv.js` e `content/iqiyi.js`).

**Um domínio espelho de um site que já é suportado** (ex: outro endereço do kisskh) não precisa de arquivo novo: é só adicionar o domínio em `host_permissions` e no `matches` do site que já existe no `manifest.json`.

### Licença

MIT — veja [LICENSE](./LICENSE).

### Changelog

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

### Contribuindo

Relatos de bugs, pedidos de sites novos e feedback geral são bem-vindos. Por favor inclua o nome do site e, se possível, um print de qualquer erro no console (`F12` → Console).
