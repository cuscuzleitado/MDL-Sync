// ============================================================
// REGISTRO DE SITES — compartilhado por content scripts, background e popup.
//
// Cada site que o MDL-Sync entende aparece aqui, com o nome mostrado nas
// listas do popup (Discord presence por site, Excluded sites). Pra
// adicionar um site novo: some uma linha em MDL_SITES com o mesmo
// "siteName" do parser (o id). Se esquecer, nada quebra: o site aparece
// nas listas com o nome técnico assim que for visitado pela 1ª vez.
//
//   id              — o "siteName" do parser (episodeData.site)
//   name            — nome exibido
//   hosts           — (opcional) domínios que pertencem a esse site; usado
//                     quando o parser tem vários domínios (ex: Seekee)
//   aliases         — (opcional) outros valores de episodeData.site
//   presenceDefault — false = a presence nasce DESLIGADA nesse site (usado
//                     nos que o PreMiD já cobre, pra não duplicar a atividade)
// ============================================================
const MDL_SITES = [
  { id: "viki", name: "Viki", presenceDefault: false },
  { id: "wetv", name: "WeTV", presenceDefault: false },
  { id: "iqiyi", name: "iQIYI", presenceDefault: false },
  { id: "clubdodorama", name: "ClubDoDorama" },
  { id: "kisskh", name: "KissKH" },
  {
    // Todos os sites do template "detail/drama" contam como um só.
    id: "seekee",
    name: "Seekee",
    hosts: [
      "123flmsfree.com",
      "123pelicula.com",
      "flixlat.com",
      "cuevana19.com",
      "dramasfree.com",
      "solo-latino.com",
      "cuevana4br.com",
      "playspelis.com"
    ]
  },
  { id: "tokudrive", name: "TokuDrive" },
  { id: "lostdramas", name: "Lost Dramas" },
  { id: "vlc", name: "VLC (local files)", aliases: ["vlc-local"] }
];

// Descobre o site a partir de episodeData.site (o siteName do parser).
function mdlSiteInfo(siteName) {
  const name = String(siteName || "");
  for (const site of MDL_SITES) {
    if (site.id === name) return site;
    if (site.aliases && site.aliases.includes(name)) return site;
    if (site.hosts && site.hosts.some((h) => name === h || name.endsWith("." + h))) return site;
  }
  return { id: name, name, dynamic: true }; // site novo, ainda não registrado acima
}

// "overrides" = { [id]: true/false } com o que o usuário escolheu no popup.
function mdlPresenceAllowed(info, overrides) {
  const chosen = overrides ? overrides[info.id] : undefined;
  if (typeof chosen === "boolean") return chosen;
  return info.presenceDefault !== false;
}
