Uma extensão de navegador que sincroniza automaticamente seu progresso de episódios no **MyDramaList** enquanto você assiste doramas em sites de streaming suportados (ou localmente, via VLC Web).

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

<img width="410" height="151" alt="Screenshot_8" src="https://github.com/user-attachments/assets/71278e3b-ca5b-42e5-9287-7e899f01aa63" />

Tudo fica em **Settings → Discord presence**:

- Um interruptor geral, o login do Discord e o **status mostrado enquanto você assiste** (Online / Ausente / Não perturbe — ele substitui seu status de sempre enquanto a presence estiver no ar).
- Uma **lista por site** pra ligar ou desligar a presence. **Viki, WeTV e iQIYI começam desligados** porque o PreMiD já cobre (ligar pode mostrar duas atividades ao mesmo tempo). Os sites “detail/drama” (123flmsfree, 123pelicula, flixlat, cuevana19, dramasfree, solo-latino…) contam como um site só, chamado **Seekee**. Um site novo adicionado à extensão aparece na lista sozinho.

Como se conectar ao Discord:

**Login com sua conta do Discord (sem app).** Clique em **Log in with Discord**, faça o login normalmente na página que abrir, e pronto — a extensão mantém a conexão sozinha, mesmo com o Discord fechado. Não precisa criar nada: as capas usam uma aplicação que já vem com a extensão. ⚠️ Isso usa a sessão da sua conta, o que o Discord não suporta oficialmente (os termos não permitem automatizar contas de usuário), então use por sua conta e risco. O token do login fica guardado só no armazenamento da extensão, no seu navegador; **Log out** apaga.

### Mais opções e extras

Abra as **Settings** e clique em **More ›** (do lado do Back):

- **Excluded sites** — desliga o MDL-Sync nos sites que você desmarcar (sem badge, sync, retomar, pular nem Discord ali). Recarregue a página depois de mudar.
- **Quick skip** — escolha uma quantidade de segundos e uma tecla de atalho; apertando a tecla enquanto assiste, o vídeo avança esses segundos. Só funciona nos sites suportados e tem prioridade sobre o atalho do próprio site pra mesma tecla. Não faz nada na página do VLC (o VLC tem as teclas dele).
- **Changelog** — abre a página “Novidades” (English, Português, Español). Ela também abre sozinha, uma vez, na primeira vez que a extensão roda depois de uma atualização.

**Pular abertura:** em **Mapped Titles**, clique em **skip op** ao lado do título, digite quando a abertura começa e pra onde pular (ex: `0:32` e `1:40`) e salve. A partir daí, todo episódio daquele título pula de 0:32 pra 1:40 sozinho — uma vez a cada vez que você abre o episódio (se voltar pra rever a abertura, não pula de novo). Não faz nada se o vídeo já estiver depois do tempo final (ex: você retomou mais pra frente). Remover o mapeamento também remove a regra.

**Nota:** no último episódio, a nota opcional agora são 5 estrelas, como no MyDramaList. Passe o mouse pelas estrelas e clique; cada estrela vale 2 pontos e o mouse anda de 0,5 em 0,5 (1.0 a 10.0). O número ao lado das estrelas é exatamente o que será enviado.
