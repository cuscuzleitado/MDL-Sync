# MDL-Sync — v0.1.6

[English](README.md) | [Português (Brasil)](README-pt_BR.md) | **Español**

Una extensión de navegador que sincroniza automáticamente tu progreso de episodios en **MyDramaList** mientras ves doramas en sitios de streaming compatibles (o de forma local, mediante VLC Web).

⚠️ Este es un proyecto personal en una etapa temprana. No tiene ninguna relación oficial con MyDramaList ni con ningún sitio de streaming. Espera errores, y siéntete libre de abrir un issue si encuentras alguno.

### Qué hace

- Detecta automáticamente el drama, la temporada y el episodio que estás viendo.
- Muestra un botoncito flotante para sincronizar el episodio actual con tu lista de MDL con un clic.
- Después de que confirmas manualmente el título correcto una vez, lo recuerda — desde entonces puede sincronizar solo cuando hayas visto ~80% del episodio, sin tener que hacer clic en nada.
- Una vez sincronizado, el botón queda marcado como "Already synced ✓" — incluso después de recargar la página o salir de pantalla completa — así que siempre puedes saber de un vistazo si ya se hizo.
- En el **último episodio** de un drama, el título se marca automáticamente como **Completed** en MDL al sincronizar. También aparece un selector de nota opcional (en la escala propia de MDL, de 1.0 a 10.0), disponible en cualquier momento, independiente de la sincronización en sí.
- Cualquier episodio que no sea el último fuerza el estado a **Currently Watching** en MDL, así que un título que esté en "Plan to Watch" o "On-Hold" se mueve correctamente en lugar de quedarse ahí.
- Notificaciones nativas del navegador cuando termina el auto-sync — aparecen incluso con el video en pantalla completa (donde el badge de la página queda oculto).
- **Retomar donde te quedaste** (activado por defecto, se puede desactivar en Settings): recuerda dónde te quedaste y, cuando vuelves a abrir el episodio, te ofrece continuar desde ahí. Funciona en todos los sitios compatibles, excepto WeTV e iQIYI, y los puntos guardados quedan solo en tu navegador.
- **Extras de Viki** (desactivados por defecto, en Settings): hace clic solo en los botones “Skip Ad” y “Skip Intro”. “Skip ad” pide un permiso extra del navegador la primera vez que lo activas, porque el botón del anuncio está dentro de los frames del reproductor de anuncios.
- También rastrea episodios vistos de forma local en **VLC** (por ejemplo, archivos descargados de Telegram), a través de la interfaz Web nativa de VLC — mira la sección de VLC más abajo.
- **Presence en Discord** (opcional): muestra en Discord lo que estás viendo como “Watching `<drama>`”, con el episodio, la portada y una barra de progreso — mira la sección de presence más abajo.
- **Saltar la apertura** por título, **tecla de atajo para saltar** hacia adelante, **nota en estrellas** (como en MyDramaList) en el último episodio y opción de **excluir sitios** — mira “Más opciones y extras” más abajo.

### Requisitos

- Debes haber **iniciado sesión en MyDramaList** — la extensión abre una pestaña oculta en segundo plano para actualizar tu lista, usando tu sesión ya iniciada.
- MyDramaList debe estar configurado en **inglés** — la extensión busca textos específicos de botones y etiquetas, y no los encontrará en otros idiomas.
- Los sitios de streaming también deben estar en inglés para que la detección funcione de forma confiable.

### Cómo instalar (modo desarrollador)

Como no está publicada en la Chrome Web Store, tendrás que cargarla manualmente:

1. Descarga y extrae este repositorio.
2. Abre `chrome://extensions` (o `edge://extensions`).
3. Activa el **Modo de desarrollador** (esquina superior derecha).
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta extraída.
5. Abre la página de un episodio en un sitio compatible — debería aparecer un badge en la esquina inferior derecha con el título/episodio detectado.

**Actualizar una instalación existente:** no necesitas quitar y cargar la extensión desde cero. Solo extrae los archivos de la nueva versión directamente en la carpeta que ya tienes (reemplazando los archivos) y haz clic en el ícono de recargar (🔄) en la tarjeta de la extensión en `chrome://extensions`. Tus mapeos guardados y el historial de episodios sincronizados se guardan por separado y no se pierden. (Algunas versiones traen archivos nuevos — la v0.1.6 trae `sites.js`, `offscreen.html`, `offscreen.js`, `changelog.html`, `changelog.js` y `changelog-data.js` — así que copia todos los archivos de la versión nueva, y no solo los que recuerdes que cambiaron.)

### Si el nombre del drama es diferente entre el sitio de streaming y MDL

Esto pasa a veces (romanizaciones distintas, títulos localizados, etc.). La primera vez que sincronices un título nuevo, se abre automáticamente una pestaña de búsqueda — solo entra tú mismo a la página correcta del título en MDL. La extensión lo detecta y memoriza el mapeo correcto desde ahí en adelante, así que solo tienes que hacerlo una vez por título.

Si eliges el título equivocado por error, abre el popup de la extensión, busca la entrada en "Mapped titles" y haz clic en **remove** — la próxima sincronización te pedirá elegir de nuevo.

### Sitios compatibles

- Viki
- WeTV
- iQIYI
- clubdodorama.com
- kisskh (espejos kisskh.co, kisskh.mx y kisskh.xyz)
- tokusatsus.com (TokuDrive)
- 123flmsfree.com, ver.123pelicula.com, flixlat.com, play.cuevana19.com, dramasfree.com, solo-latino.com (misma plantilla/parser, ya que comparten la misma estructura de URL)
- **VLC** (archivos locales), mediante la interfaz Web de VLC — mira más abajo

### Rastrear archivos locales con VLC

Para doramas que descargas (por ejemplo, de Telegram) y ves en VLC en lugar de un sitio de streaming:

1. En VLC, ve a **Herramientas → Preferencias**, cambia a mostrar **Todo** (abajo a la izquierda), luego **Interfaz → Interfaces principales**, y marca **Web**.
2. Ve a la sección **Lua** que aparece debajo de Interfaces principales y define una contraseña.
3. Reinicia VLC y abre `http://localhost:8080` en el navegador mientras un video se está reproduciendo — debería aparecer el reproductor web de VLC.
4. La extensión detectará el nombre del archivo que se está reproduciendo y seguirá el progreso igual que en los sitios de streaming.

El reconocimiento de nombres de archivo hoy admite patrones como `Drama Name - EP01.mp4`, `Drama.Name.S01E05.1080p.mkv` y `[Grupo] Drama Name - 05.mkv`. Si tus archivos usan un patrón diferente, abre un issue con un ejemplo de nombre de archivo.

### Presence en Discord (opcional)

Muestra en Discord lo que estás viendo como **“Watching `<drama>`”**. La tarjeta tiene el nombre del drama, **“Episode 5/16”**, la portada y una barra de progreso; en pausa muestra “Paused”, y hay un botón “View on MyDramaList”. Si cierras la pestaña, desaparece. Todo el texto está en inglés. Funciona en **todos los sitios compatibles y en VLC**. La portada y el “/16” aparecen después de que el episodio se sincronizó en MDL, porque de ahí la extensión saca esa información.

![Screenshot_8](https://github.com/user-attachments/assets/71278e3b-ca5b-42e5-9287-7e899f01aa63)

Todo está en **Settings → Discord presence**:

- Un interruptor general, el inicio de sesión de Discord y el **estado mostrado mientras ves algo** (Online / Idle / Do not disturb — reemplaza tu estado de siempre mientras la presence esté activa).
- Una **lista por sitio** para activar o desactivar la presence. **Viki, WeTV e iQIYI empiezan desactivados** porque PreMiD ya los cubre (activarlos puede mostrar dos actividades al mismo tiempo). Los sitios “detail/drama” (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) cuentan como un solo sitio, llamado **Seekee**. Un sitio nuevo agregado a la extensión aparece solo en la lista.

Cómo conectarse a Discord:

**Inicia sesión con tu cuenta de Discord (sin app).** Haz clic en **Log in with Discord**, inicia sesión normalmente en la página que se abre, y listo — la extensión mantiene la conexión sola, incluso con Discord cerrado. No hace falta crear nada: las portadas usan una aplicación que ya viene con la extensión. ⚠️ Esto usa la sesión de tu cuenta, algo que Discord no soporta oficialmente (sus términos no permiten automatizar cuentas de usuario), así que úsalo bajo tu propio riesgo. El token del inicio de sesión se guarda solo en el almacenamiento de la extensión, en tu navegador; **Log out** lo borra.

### Más opciones y extras

Abre **Settings** y haz clic en **More ›** (junto a Back):

- **Excluded sites** — apaga MDL-Sync en los sitios que desmarques (sin badge, sync, retomar, saltar ni Discord ahí). Recarga la página después de cambiar.
- **Quick skip** — elige una cantidad de segundos y una tecla de atajo; al presionar la tecla mientras ves algo, el video avanza esos segundos. Solo funciona en los sitios compatibles y tiene prioridad sobre el atajo del propio sitio para la misma tecla. No hace nada en la página de VLC (VLC tiene sus propias teclas).
- **Changelog** — abre la página “Novedades” (English, Português, Español). También se abre sola, una vez, la primera vez que la extensión se ejecuta después de una actualización.

**Saltar la apertura:** en **Mapped Titles**, haz clic en **skip op** junto al título, escribe cuándo empieza la apertura y a dónde saltar (por ejemplo, `0:32` y `1:40`) y guarda. Desde ahí, todos los episodios de ese título saltan de 0:32 a 1:40 solos — una vez cada vez que abres el episodio (si vuelves atrás para ver la apertura de nuevo, no salta otra vez). No hace nada si el video ya está después del tiempo final (por ejemplo, si retomaste más adelante). Quitar el mapeo también quita la regla.

**Nota:** en el último episodio, la nota opcional ahora son 5 estrellas, como en MyDramaList. Pasa el mouse por las estrellas y haz clic; cada estrella vale 2 puntos y el mouse avanza de 0,5 en 0,5 (1.0 a 10.0). El número junto a las estrellas es exactamente lo que se enviará.
