// Mostra as notas da versão (changelog-data.js) no idioma escolhido.
// Começa no idioma do navegador (en / pt / es); o botão troca na hora.
const LANGS = ["en", "pt", "es"];

function pickInitialLang() {
  const code = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANGS.includes(code) ? code : "en";
}

function renderChangelog(lang) {
  document.getElementById("title").textContent = MDL_CHANGELOG.titles[lang];
  document.getElementById("version").textContent = `MDL-Sync v${MDL_CHANGELOG.version}`;
  document.getElementById("older").textContent = MDL_CHANGELOG.older[lang];
  document.documentElement.lang = lang;

  const list = document.getElementById("notes");
  list.innerHTML = "";
  for (const note of MDL_CHANGELOG.notes[lang]) {
    const li = document.createElement("li");
    li.textContent = note;
    list.appendChild(li);
  }

  document.querySelectorAll(".langs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.lang === lang));
}

document.querySelectorAll(".langs button").forEach((btn) => {
  btn.onclick = () => renderChangelog(btn.dataset.lang);
});

renderChangelog(pickInitialLang());
