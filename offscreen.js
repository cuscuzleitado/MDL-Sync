// ============================================================
// OFFSCREEN — conexão com o Discord (modo "login da conta")
//
// O service worker do Manifest V3 é desligado quando fica ocioso, e isso
// derrubaria a conexão com o Discord. Este documento "offscreen" não é
// desligado, então a conexão (WebSocket do Gateway) mora aqui.
//
// O background manda comandos pra cá ({ target: "offscreen", cmd }):
//   presence — mostra/atualiza a atividade
//   clear    — tira a atividade (e desconecta depois de um tempo ocioso)
//   logout   — desconecta na hora
// E este arquivo devolve o estado da conexão ({ type: "GATEWAY_STATE" }).
// ============================================================

const GATEWAY_URL = globalThis.__MDL_GATEWAY_URL || "wss://gateway.discord.gg";
const IDLE_DISCONNECT_MS = 60 * 1000; // sem atividade por 1 min = desconecta (não fica "online" à toa)
const FATAL_CLOSE_CODES = [4004, 4010, 4011, 4012, 4013, 4014]; // login inválido, versão/intents inválidos...
const SESSION_LOST_CODES = [4007, 4009]; // sessão não pode mais ser retomada: começa uma nova

function reportState(state, detail) {
  try {
    chrome.runtime.sendMessage({ type: "GATEWAY_STATE", state, detail: detail || null }, () => void chrome.runtime.lastError);
  } catch {
    // ignora
  }
}

class DiscordGateway {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.ready = false;
    this.seq = null;
    this.sessionId = null;
    this.resumeUrl = null;
    this.heartbeatTimer = null;
    this.heartbeatKickoff = null;
    this.ackReceived = true;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.intentionalClose = false;
    this.desired = null; // { activity, status } que deve estar no ar
    this.identifiedWith = null; // o que já foi enviado junto com o IDENTIFY
  }

  open() {
    if (this.ws) return;
    this.intentionalClose = false;
    clearTimeout(this.reconnectTimer);
    reportState("connecting");

    const base = this.sessionId && this.resumeUrl ? this.resumeUrl : GATEWAY_URL;
    const ws = new WebSocket(`${base}/?v=10&encoding=json`);
    this.ws = ws;
    ws.onmessage = (event) => {
      try {
        this._onPayload(JSON.parse(event.data));
      } catch (err) {
        console.warn("[MDL Sync] Gateway payload error:", err);
      }
    };
    ws.onclose = (event) => this._onClose(event.code);
    ws.onerror = () => {}; // o "close" cuida do resto
  }

  close() {
    this.intentionalClose = true;
    clearTimeout(this.reconnectTimer);
    this._stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    this.ready = false;
    this.sessionId = null; // fechou de propósito: a sessão acaba (e a atividade some do perfil)
    this.resumeUrl = null;
    if (ws) {
      try {
        ws.close(1000);
      } catch {
        // ignora
      }
    }
    reportState("idle");
  }

  // activity = objeto da atividade, ou null pra limpar.
  setPresence(activity, status) {
    this.desired = activity ? { activity, status: status || "online" } : null;
    if (!this.ws) {
      if (activity) this.open(); // o IDENTIFY já leva a atividade junto
      return;
    }
    if (this.ready) this._sendPresence();
  }

  _send(payload) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(payload));
  }

  _sendPresence() {
    const d = this.desired;
    this._send({
      op: 3,
      d: { since: 0, activities: d ? [d.activity] : [], status: d ? d.status : "online", afk: false }
    });
  }

  _onPayload(p) {
    if (typeof p.s === "number") this.seq = p.s;

    switch (p.op) {
      case 10: // HELLO
        this._startHeartbeat(p.d.heartbeat_interval);
        if (this.sessionId) {
          this._send({ op: 6, d: { token: this.token, session_id: this.sessionId, seq: this.seq } });
        } else {
          this._identify();
        }
        break;
      case 11: // HEARTBEAT_ACK
        this.ackReceived = true;
        break;
      case 1: // o Discord pede um heartbeat agora
        this._beat();
        break;
      case 7: // RECONNECT: o Discord quer que a gente reconecte (e retome)
        this._dropSocket();
        this._scheduleReconnect(0);
        break;
      case 9: // INVALID_SESSION (d = true: dá pra retomar)
        if (!p.d) {
          this.sessionId = null;
          this.resumeUrl = null;
        }
        setTimeout(() => {
          if (!this.ws) return;
          if (p.d && this.sessionId) this._send({ op: 6, d: { token: this.token, session_id: this.sessionId, seq: this.seq } });
          else this._identify();
        }, 1000 + Math.random() * 4000);
        break;
      case 0: // DISPATCH
        if (p.t === "READY") {
          this.ready = true;
          this.reconnectAttempts = 0;
          this.sessionId = p.d.session_id;
          this.resumeUrl = p.d.resume_gateway_url || null;
          const user = p.d.user || {};
          reportState("ready", user.global_name || user.username || null);
          // O IDENTIFY já levou a atividade; só reenvia se ela mudou nesse meio tempo.
          if (this.desired !== this.identifiedWith) this._sendPresence();
        } else if (p.t === "RESUMED") {
          this.ready = true;
          this.reconnectAttempts = 0;
          reportState("ready");
          if (this.desired) this._sendPresence();
        }
        break;
      default:
        break;
    }
  }

  _identify() {
    const d = this.desired;
    this.identifiedWith = d;
    this._send({
      op: 2,
      d: {
        token: this.token,
        capabilities: 65,
        compress: false,
        large_threshold: 100,
        properties: { os: "Windows", browser: "Chrome", device: "" },
        presence: {
          status: d ? d.status : "online",
          since: 0,
          activities: d ? [d.activity] : [],
          afk: false
        }
      }
    });
  }

  _startHeartbeat(interval) {
    this._stopHeartbeat();
    this.ackReceived = true;
    // O primeiro heartbeat sai num ponto aleatório do intervalo (regra do Gateway).
    this.heartbeatKickoff = setTimeout(() => {
      this._beat();
      this.heartbeatTimer = setInterval(() => this._beat(), interval);
    }, interval * Math.random());
  }

  _stopHeartbeat() {
    clearTimeout(this.heartbeatKickoff);
    clearInterval(this.heartbeatTimer);
    this.heartbeatKickoff = null;
    this.heartbeatTimer = null;
  }

  _beat() {
    if (!this.ackReceived) {
      // O Discord não respondeu o heartbeat anterior: conexão "zumbi", reconecta.
      this._dropSocket();
      this._scheduleReconnect(0);
      return;
    }
    this.ackReceived = false;
    this._send({ op: 1, d: this.seq });
  }

  _dropSocket() {
    this._stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    this.ready = false;
    if (ws) {
      ws.onclose = null;
      try {
        ws.close(4000); // código ≠ 1000/1001 mantém a sessão retomável
      } catch {
        // ignora
      }
    }
  }

  _onClose(code) {
    this._stopHeartbeat();
    this.ws = null;
    this.ready = false;
    if (this.intentionalClose) return;

    if (FATAL_CLOSE_CODES.includes(code)) {
      this.sessionId = null;
      reportState("error", code === 4004 ? "auth-failed" : `closed-${code}`);
      return; // sem tentar de novo: login inválido não se resolve sozinho
    }
    if (SESSION_LOST_CODES.includes(code) || code === 1000 || code === 1001) {
      this.sessionId = null;
      this.resumeUrl = null;
    }
    this._scheduleReconnect();
  }

  _scheduleReconnect(delayMs) {
    clearTimeout(this.reconnectTimer);
    reportState("connecting");
    const delay = typeof delayMs === "number" ? delayMs : Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }
}

// ------------------------------------------------------------
// Comandos vindos do background
// ------------------------------------------------------------
let gateway = null;
let idleTimer = null;

function ensureGateway(token) {
  if (gateway && gateway.token !== token) {
    gateway.close();
    gateway = null;
  }
  if (!gateway) gateway = new DiscordGateway(token);
  return gateway;
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.target !== "offscreen") return;

  if (message.cmd === "presence" && message.token && message.activity) {
    clearTimeout(idleTimer);
    ensureGateway(message.token).setPresence(message.activity, message.status);
  } else if (message.cmd === "clear") {
    if (!gateway) return;
    gateway.setPresence(null);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (gateway) gateway.close();
    }, IDLE_DISCONNECT_MS);
  } else if (message.cmd === "logout") {
    clearTimeout(idleTimer);
    if (gateway) gateway.close();
    gateway = null;
  }
});
