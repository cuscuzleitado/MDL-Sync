// ============================================================
// MDL-Sync Presence — app local (sem dependências, só precisa do Node.js)
//
// Recebe da extensão MDL-Sync o que você está assistindo (HTTP em
// 127.0.0.1) e mostra no Discord como atividade "Watching", falando
// direto com o Discord pelo IPC (named pipe no Windows).
// ============================================================
"use strict";

const net = require("net");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = __dirname;
const LOG_FILE = path.join(DIR, "presence.log");
const CONFIG_FILE = path.join(DIR, "config.json");

const DEFAULT_CONFIG = {
  // Application ID do Discord (Developer Portal). O nome dessa aplicação
  // aparece como fallback quando o Discord não aceita o nome do drama.
  clientId: "1575093209288155236",
  // Porta local — precisa ser a mesma PRESENCE_ENDPOINT do background.js da extensão.
  port: 17831,
  // Botão "Ver no MyDramaList" na atividade.
  showButtons: true,
  // Chave de uma imagem enviada em Rich Presence > Art Assets (usada quando
  // o drama ainda não tem capa, ou seja, antes do 1º sync no MDL). Opcional.
  fallbackImage: "",
  // Sem notícias da extensão por esse tempo (segundos) = limpa a atividade.
  staleSeconds: 100
};

// ------------------------------------------------------------
// Log simples em arquivo (+ console quando rodando visível)
// ------------------------------------------------------------
try {
  if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 512 * 1024) fs.writeFileSync(LOG_FILE, "");
} catch {
  // sem problema se não der pra aparar o log
}

function log(...parts) {
  const line = `[${new Date().toLocaleString()}] ${parts.join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // ignora
  }
}

function loadConfig() {
  let user = {};
  try {
    user = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") log("config.json inválido, usando padrões:", err.message);
  }
  return { ...DEFAULT_CONFIG, ...user };
}

const config = loadConfig();

// ------------------------------------------------------------
// Cliente IPC do Discord (protocolo: [opcode int32 LE][tamanho int32 LE][JSON])
// ------------------------------------------------------------
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function encodeFrame(op, payload) {
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const buf = Buffer.alloc(8 + data.length);
  buf.writeInt32LE(op, 0);
  buf.writeInt32LE(data.length, 4);
  data.copy(buf, 8);
  return buf;
}

function ipcPaths(i) {
  if (process.platform === "win32") return [`\\\\?\\pipe\\discord-ipc-${i}`];
  const bases = [process.env.XDG_RUNTIME_DIR, process.env.TMPDIR, process.env.TMP, process.env.TEMP, "/tmp"].filter(Boolean);
  const out = [];
  for (const base of bases) {
    out.push(path.join(base, `discord-ipc-${i}`));
    out.push(path.join(base, "snap.discord", `discord-ipc-${i}`));
    out.push(path.join(base, "app", "com.discordapp.Discord", `discord-ipc-${i}`));
  }
  return out;
}

function tryConnect(p) {
  return new Promise((resolve) => {
    const socket = net.createConnection(p);
    const fail = () => {
      socket.destroy();
      resolve(null);
    };
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.removeListener("error", fail);
      resolve(socket);
    });
  });
}

class DiscordIPC {
  constructor(clientId) {
    this.clientId = clientId;
    this.socket = null;
    this.ready = false;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map(); // nonce -> resolve
    this.onReady = () => {};
    this.connecting = false;
  }

  async connect() {
    if (this.connecting || this.socket) return;
    this.connecting = true;
    try {
      for (let i = 0; i < 10 && !this.socket; i++) {
        for (const p of ipcPaths(i)) {
          const socket = await tryConnect(p);
          if (socket) {
            this._attach(socket);
            return;
          }
        }
      }
    } finally {
      this.connecting = false;
    }
    // Discord fechado (ou ainda abrindo): tenta de novo daqui a pouco.
    setTimeout(() => this.connect(), 5000);
  }

  _attach(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("close", () => this._onClose());
    socket.on("error", () => {}); // o "close" cuida do resto
    socket.write(encodeFrame(OP.HANDSHAKE, { v: 1, client_id: this.clientId }));
  }

  _onClose() {
    const wasReady = this.ready;
    this.ready = false;
    this.socket = null;
    for (const resolve of this.pending.values()) resolve({ ok: false, error: "discord-offline" });
    this.pending.clear();
    if (wasReady) log("Discord desconectou — tentando reconectar...");
    setTimeout(() => this.connect(), 5000);
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 8) {
      const op = this.buffer.readInt32LE(0);
      const len = this.buffer.readInt32LE(4);
      if (this.buffer.length < 8 + len) return;
      const raw = this.buffer.subarray(8, 8 + len).toString("utf8");
      this.buffer = this.buffer.subarray(8 + len);

      let msg = null;
      try {
        msg = JSON.parse(raw);
      } catch {
        // frame ilegível, ignora
      }

      if (op === OP.PING) {
        if (this.socket) this.socket.write(encodeFrame(OP.PONG, msg || {}));
      } else if (op === OP.CLOSE) {
        log("Discord fechou a conexão:", raw);
        if (this.socket) this.socket.destroy();
      } else if (op === OP.FRAME && msg) {
        this._onFrame(msg);
      }
    }
  }

  _onFrame(msg) {
    if (msg.cmd === "DISPATCH" && msg.evt === "READY") {
      this.ready = true;
      const user = msg.data && msg.data.user ? msg.data.user.username : "?";
      log(`Conectado ao Discord (usuário: ${user}).`);
      this.onReady();
      return;
    }
    if (msg.nonce && this.pending.has(msg.nonce)) {
      const resolve = this.pending.get(msg.nonce);
      this.pending.delete(msg.nonce);
      if (msg.evt === "ERROR") {
        const detail = msg.data ? `${msg.data.code || ""} ${msg.data.message || ""}`.trim() : "erro desconhecido";
        resolve({ ok: false, error: detail });
      } else {
        resolve({ ok: true });
      }
    }
  }

  // activity = objeto da atividade, ou null pra limpar.
  setActivity(activity) {
    if (!this.ready || !this.socket) return Promise.resolve({ ok: false, error: "discord-offline" });
    const nonce = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(nonce);
        resolve({ ok: false, error: "timeout" });
      }, 6000);
      this.pending.set(nonce, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      this.socket.write(
        encodeFrame(OP.FRAME, {
          cmd: "SET_ACTIVITY",
          args: { pid: process.pid, activity: activity || null },
          nonce
        })
      );
    });
  }
}

// ------------------------------------------------------------
// Presença: monta a atividade "Watching" e decide quando atualizar
// ------------------------------------------------------------
const ipc = new DiscordIPC(config.clientId);

const MIN_APPLY_INTERVAL_MS = 4000; // o Discord limita a frequência de SET_ACTIVITY
const DRIFT_TOLERANCE_MS = 4000; // só reenvia por mudança de tempo se pular mais que isso (seek)

let current = null; // último estado recebido da extensão
let lastApplied = null; // { sig, start, end } do que está no Discord agora
let lastApplyAt = 0;
let applyTimer = null;
let degrade = 0; // 0 = completo; 1 = sem name/status_display_type; 2 = sem type

function clip(text, max) {
  const s = String(text || "").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function episodeLabel(c) {
  const season = c.season && c.season > 1 ? `Season ${c.season} · ` : "";
  const ep = c.total ? `Episode ${c.episode}/${c.total}` : `Episode ${c.episode}`;
  return season + ep;
}

function buildActivity(c, level) {
  const title = clip(c.title, 128);
  const label = episodeLabel(c);

  const activity = {
    type: 3, // Watching
    name: title,
    status_display_type: 2, // cabeçalho "Watching ___" usa o campo "details" (nome do drama)
    details: title,
    state: clip(c.paused ? `⏸ Paused · ${label}` : label, 128)
  };

  // Timestamps só quando está tocando — o Discord mostra o tempo/barra de progresso.
  let start = null;
  let end = null;
  if (!c.paused && c.duration > 0) {
    const rate = c.rate > 0 ? c.rate : 1;
    end = Math.round(c.receivedAt + ((c.duration - c.currentTime) / rate) * 1000);
    start = Math.round(end - (c.duration / rate) * 1000);
    activity.timestamps = { start, end };
  }

  const assets = { large_text: title };
  if (c.cover) assets.large_image = c.cover;
  else if (config.fallbackImage) assets.large_image = config.fallbackImage;
  if (assets.large_image) activity.assets = assets;

  if (config.showButtons && c.url) activity.buttons = [{ label: "View on MyDramaList", url: c.url }];

  if (level >= 1) {
    delete activity.name;
    delete activity.status_display_type;
  }
  if (level >= 2) delete activity.type;

  return { activity, start, end };
}

function signatureOf(c) {
  return JSON.stringify([c.title, c.season, c.episode, c.total, c.cover, c.url, c.paused, Math.round(c.duration || 0)]);
}

function scheduleApply() {
  if (applyTimer) return;
  const wait = Math.max(0, lastApplyAt + MIN_APPLY_INTERVAL_MS - Date.now());
  applyTimer = setTimeout(() => {
    applyTimer = null;
    applyNow();
  }, wait);
}

async function applyNow() {
  const c = current;

  if (!c) {
    if (lastApplied !== null) {
      lastApplyAt = Date.now();
      await ipc.setActivity(null);
      lastApplied = null;
      log("Atividade limpa.");
    }
    return;
  }

  const sig = signatureOf(c);
  const { activity, start, end } = buildActivity(c, degrade);

  if (lastApplied && lastApplied.sig === sig) {
    const sameTime =
      (start === null && lastApplied.start === null) ||
      (start !== null &&
        lastApplied.start !== null &&
        Math.abs(start - lastApplied.start) < DRIFT_TOLERANCE_MS &&
        Math.abs(end - lastApplied.end) < DRIFT_TOLERANCE_MS);
    if (sameTime) return; // nada mudou de verdade
  }

  lastApplyAt = Date.now();
  const result = await ipc.setActivity(activity);

  if (result.ok) {
    lastApplied = { sig, start, end };
    log(`Atividade: ${c.title} — ${episodeLabel(c)}${c.paused ? " (pausado)" : ""}${c.cover ? " [capa]" : ""} (nível ${degrade})`);
  } else if (result.error === "discord-offline") {
    lastApplied = null; // reaplica quando o Discord voltar
  } else if (degrade < 2) {
    degrade++;
    log(`Discord recusou a atividade (${result.error}). Tentando versão mais simples (nível ${degrade})...`);
    lastApplied = null;
    scheduleApply();
  } else {
    log("Discord recusou a atividade:", result.error);
  }
}

ipc.onReady = () => {
  lastApplied = null;
  scheduleApply();
};

// Sem notícias da extensão há muito tempo (navegador fechado, aba travada...).
setInterval(() => {
  if (current && Date.now() - current.receivedAt > config.staleSeconds * 1000) {
    log("Sem sinal da extensão — limpando atividade.");
    current = null;
    scheduleApply();
  }
}, 10000);

// ------------------------------------------------------------
// Servidor HTTP local (só aceita pedidos vindos da extensão)
// ------------------------------------------------------------
function isHttps(url) {
  return typeof url === "string" && url.length <= 256 && /^https:\/\//i.test(url);
}

function sanitize(body) {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const episode = Number(body.episode);
  if (!title || !Number.isFinite(episode) || episode < 0) return null;

  const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    title,
    season: body.season ? num(body.season, null) : null,
    episode,
    total: body.total ? num(body.total, null) : null,
    cover: isHttps(body.cover) ? body.cover : null,
    url: isHttps(body.url) ? body.url : null,
    currentTime: Math.max(0, num(body.currentTime)),
    duration: Math.max(0, num(body.duration)),
    rate: num(body.rate, 1),
    paused: Boolean(body.paused),
    receivedAt: Date.now()
  };
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "";
  const fromExtension = /^(chrome|moz)-extension:\/\//i.test(origin);

  // Páginas da web (qualquer site) não podem mexer na sua presença — só a extensão.
  if (origin && !fromExtension) {
    res.writeHead(403);
    res.end();
    return;
  }

  const headers = { "Content-Type": "application/json" };
  if (fromExtension) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ discordConnected: ipc.ready, degrade, current }));
    return;
  }

  if (req.method === "POST" && (req.url === "/presence" || req.url === "/clear")) {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 16 * 1024) req.destroy();
    });
    req.on("end", () => {
      if (req.url === "/clear") {
        current = null;
        scheduleApply();
        res.writeHead(200, headers);
        res.end('{"ok":true}');
        return;
      }

      let data = null;
      try {
        data = sanitize(JSON.parse(raw));
      } catch {
        // JSON inválido
      }
      if (!data) {
        res.writeHead(400, headers);
        res.end('{"ok":false}');
        return;
      }
      current = data;
      scheduleApply();
      res.writeHead(200, headers);
      res.end('{"ok":true}');
    });
    return;
  }

  res.writeHead(404, headers);
  res.end("{}");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    log(`A porta ${config.port} já está em uso — provavelmente o app já está rodando. Saindo.`);
    process.exit(0);
  }
  log("Erro no servidor local:", err.message);
});

server.listen(config.port, "127.0.0.1", () => {
  log(`MDL-Sync Presence rodando (porta ${config.port}). Procurando o Discord...`);
  ipc.connect();
});

// ------------------------------------------------------------
// Encerramento limpo + rede de segurança
// ------------------------------------------------------------
function shutdown() {
  current = null;
  Promise.race([ipc.setActivity(null), new Promise((r) => setTimeout(r, 1000))]).then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (err) => log("Erro inesperado:", err && err.stack ? err.stack : err));
process.on("unhandledRejection", (err) => log("Erro inesperado (promise):", err && err.stack ? err.stack : err));
