# MDL-Sync — v0.1.6

**English** | [Português (Brasil)](README-pt_BR.md) | [Español](README-es.md)

A browser extension that automatically tracks your episode progress on **MyDramaList** while you watch dramas on supported streaming sites (or locally, via VLC Web).

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
- **Discord presence** (optional): shows what you're watching on Discord as “Watching `<drama>`”, with the episode, the cover and a progress bar — see the Discord presence section below.
- **Skip opening** per title, a **quick-skip shortcut key**, a **star rating** (like MyDramaList) on the last episode, and the option to **exclude sites** — see “More options and extras” below.

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

Shows what you're watching on Discord as **“Watching `<drama>`”**. The card has the drama's name, **“Episode 5/16”**, the cover and a progress bar; paused shows “Paused”, and there's a “View on MyDramaList” button. Close the tab and it disappears. All the text is in English. It works on **every supported site and on VLC**. The cover and the “/16” appear once the episode has been synced on MDL, because that's where the extension gets them.

![Screenshot_8](https://github.com/user-attachments/assets/71278e3b-ca5b-42e5-9287-7e899f01aa63)

Everything is in **Settings → Discord presence**:

- A master switch, the Discord login, and the **status shown while watching** (Online / Idle / Do not disturb — it replaces your usual status while the presence is up).
- A **per-site list** to turn the presence on or off. **Viki, WeTV and iQIYI start off** because PreMiD already covers them (turning them on can show two activities at once). The “detail/drama” sites (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) count as a single site called **Seekee**. A new site added to the extension shows up in the list by itself.

How to connect to Discord:

**Log in with your Discord account (no app needed).** Click **Log in with Discord**, log in normally on the page that opens, and that's it — the extension keeps the connection by itself, even with the Discord app closed. There's nothing to create: the covers use an application that already comes with the extension. ⚠️ This uses your account session, which Discord doesn't officially support (their terms don't allow automating user accounts), so use it at your own risk. The login token stays only in the extension's storage in your browser; **Log out** deletes it.

### More options and extras

Open **Settings** and click **More ›** (next to Back):

- **Excluded sites** — turns MDL-Sync off on the sites you uncheck (no badge, sync, resume, skip or Discord there). Reload the page after changing.
- **Quick skip** — pick a number of seconds and a shortcut key; pressing it while watching jumps ahead by that many seconds. It only works on supported sites and takes priority over the site's own shortcut for the same key. It does nothing on the VLC page (VLC has its own keys).
- **Changelog** — opens the “What's new” page (English, Português, Español). It also opens by itself, once, the first time the extension runs after an update.

**Skip opening:** in **Mapped Titles**, click **skip op** next to a title, type when the opening starts and where to jump (e.g. `0:32` and `1:40`) and save. From then on, every episode of that title jumps from 0:32 to 1:40 on its own — once each time you open the episode (if you go back to rewatch the opening, it doesn't skip again). It does nothing if the video is already past the end time (e.g. you resumed later). Removing the mapping also removes its rule.

**Rating:** on the last episode, the optional rating is now 5 stars like MyDramaList. Move the mouse over the stars and click; each star is 2 points and it moves in 0.5-point steps (1.0 to 10.0). The number next to the stars is exactly what will be sent.
