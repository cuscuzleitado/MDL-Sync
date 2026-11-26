# MDL-Sync Presence

App local que mostra no Discord o que você está assistindo (atividade **Watching**, com nome do drama, episódio, capa e barra de progresso). Funciona junto com a extensão MDL-Sync **v0.1.6**. Todo o texto da atividade no Discord fica em inglês (“Episode 5/16”).

## Instalar (uma vez)

1. Instale o [Node.js](https://nodejs.org) (versão LTS), se ainda não tiver.
2. Deixe esta pasta num lugar fixo (ex.: `C:\MDL-Sync-Presence`) — se mover depois, rode o `install.bat` de novo.
3. Dê dois cliques em **`install.bat`**. Ele já inicia o app e cria o início automático com o Windows. Não abre janela nenhuma.
4. Atualize a extensão MDL-Sync pra v0.1.6 (recarregue em `edge://extensions`).
5. No Discord: Configurações → Privacidade de atividade → ligue **Compartilhar atividade detectada**.

## Como saber se está funcionando

- Abra um episódio num site liberado e dê play. A atividade aparece no Discord em alguns segundos.
- A capa e o "Episódio X de Y" aparecem depois que o episódio é sincronizado no MyDramaList (é de lá que vêm esses dados).
- Se algo não aparecer, veja o `presence.log` (nesta pasta) ou abra `http://127.0.0.1:17831/status` no navegador.

## Sites com presença

kisskh (.co/.mx/.xyz), 123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree e solo-latino. Viki, iQIYI, WeTV e clubdodorama ficam de fora (o PreMiD já cobre ou vai cobrir). Dá pra desligar tudo no popup da extensão → Settings → Discord presence.

## Remover

Dois cliques em **`uninstall.bat`** (para o app e tira do início do Windows).

## config.json

- `clientId`: Application ID do Discord (já vem o padrão do MDL-Sync; só mude se quiser usar uma aplicação sua).
- `port`: precisa ser a mesma `PRESENCE_ENDPOINT` do `background.js` da extensão.
- `showButtons`: botão "Ver no MyDramaList" na atividade.
- `fallbackImage`: chave de uma imagem enviada em Rich Presence → Art Assets, usada enquanto o drama ainda não tem capa.
- `staleSeconds`: some a atividade se a extensão ficar tanto tempo sem dar sinal (navegador fechado, etc.).
