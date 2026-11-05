#!/usr/bin/env node
// La prova del sistema acceso: app, API, MCP e raccoglitore. Non interroga Google, ma lascia nel CRM qualche riga
// «Azienda di prova»: usala su un'installazione nuova.
//   node test/prova.mjs        (BASE=http://127.0.0.1:5330 se è su un'altra porta)
import http from "node:http";

const BASE = process.env.BASE || "http://127.0.0.1:5330";

let falliti = 0;
const ok = (cond, nome, altro = "") => {
  console.log(`${cond ? "✅" : "⛔"} ${nome}${cond ? "" : ` ${altro}`}`);
  if (!cond) falliti++;
};
const api = (p, o = {}) => fetch(BASE + p, { redirect: "manual", ...o });
const json = (corpo) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
/** Una richiesta con intestazioni che fetch non lascia scegliere. */
const grezza = (metodo, p, headers, corpo = "") => new Promise((fatto, male) => {
  const u = new URL(BASE + p);
  const q = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: metodo, headers }, (r) => { r.resume(); r.on("end", () => fatto(r.statusCode)); });
  q.on("error", male);
  q.end(corpo);
});

let r = await api("/salute");
ok(r.status === 200, "/salute 200", r.status);
r = await api("/");
ok(r.status === 302, "/ porta all'app", r.status);
r = await api("/crm/");
ok(r.status === 200 && /<html/i.test(await r.text()), "l'app si apre", r.status);
r = await api("/crm/api/marca");
ok(r.status === 200 && typeof (await r.json()).nome === "string", "il nome del CRM", r.status);

r = await api("/crm/api/io");
const io = await r.json();
ok(r.status === 200 && io.socio === true, "si entra senza login, come utente del CRM", JSON.stringify(io));

let s = await grezza("GET", "/crm/api/aziende", { host: "sito-qualunque.example" });
ok(s === 403, "un altro indirizzo non passa", s);
s = await grezza("POST", "/crm/mcp", { host: "sito-qualunque.example", "content-type": "application/json" }, "{}");
ok(s === 403, "un altro indirizzo non arriva all'MCP", s);
s = await grezza("POST", "/crm/api/aziende", { "sec-fetch-site": "cross-site", "content-type": "application/json" }, "{}");
ok(s === 403, "niente scritture da un altro sito", s);
s = await grezza("POST", "/crm/api/aziende", { "sec-fetch-site": "same-site", "content-type": "application/json" }, "{}");
ok(s === 403, "niente scritture da un'altra app sulla stessa macchina", s);
s = await grezza("POST", "/crm/mcp", { origin: "http://sito-qualunque.example", "content-type": "application/json" }, "{}");
ok(s === 403, "l'MCP rifiuta un'altra origine", s);

for (const risorsa of ["aziende", "persone", "trattative", "attivita", "viste", "tag", "fasi", "soci", "percorsi", "campi_definizioni", "modelli_messaggi", "impostazioni"]) {
  r = await api(`/crm/api/${risorsa}`);
  ok(r.status === 200, `GET ${risorsa}`, r.status);
}
for (const p of ["/crm/api/oggi", "/crm/api/aziende/elenco", "/crm/api/persone/elenco", "/crm/api/trattative/elenco", "/crm/api/compiti/elenco", "/crm/api/origini/elenco", "/crm/api/origini/conteggi"]) {
  r = await api(p);
  ok(r.status === 200, `GET ${p}`, `${r.status} ${(await r.text()).slice(0, 160)}`);
}

const nome = `Azienda di prova ${Date.now()}`;
const idDi = (x) => x.id ?? x.riga?.id;
r = await api("/crm/api/aziende", json({ nome, telefono: "010 000000", comune: "Genova" }));
const azienda = await r.json();
ok(r.status === 201 || r.status === 200, "crea un'azienda", JSON.stringify(azienda).slice(0, 200));
const fasi = await (await api("/crm/api/fasi")).json();
ok(Array.isArray(fasi) && fasi.length === 6, "le sei fasi di partenza", JSON.stringify(fasi).slice(0, 120));
r = await api("/crm/api/attivita", json({ tipo: "chiamata", azienda_id: idDi(azienda), esito: "risposto", esito_azienda: "interessato", testo: "prova" }));
ok(r.status === 201 || r.status === 200, "una chiamata con esito «interessato»", `${r.status} ${(await r.clone().text()).slice(0, 200)}`);
r = await api("/crm/api/trattative/da-azienda", json({ azienda_id: idDi(azienda), percorso: "freddo" }));
const tr = await r.json();
ok(r.status < 300, "«interessato → trattativa»", JSON.stringify(tr).slice(0, 240));
const dopo = await (await api(`/crm/api/aziende/${idDi(azienda)}`)).json();
ok(!!dopo.contatto_id, "l'azienda esce dalla coda a freddo", JSON.stringify(dopo).slice(0, 160));

const mcp = (metodo, params) => api("/crm/mcp", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: metodo, params }) });
r = await mcp("tools/list", {});
const nomi = (await r.json()).result?.tools?.map((t) => t.name) || [];
ok(nomi.length === 10, "MCP: dieci strumenti", nomi.join(","));
ok(!nomi.some((n) => /confronto|studio/.test(n)), "MCP: niente strumenti di altri sistemi", nomi.join(","));
const chiama = async (name, args) => {
  const j = await (await mcp("tools/call", { name, arguments: args })).json();
  const t = j.result?.content?.[0]?.text ?? "";
  return { errore: !!j.result?.isError, testo: t, dati: (() => { try { return JSON.parse(t); } catch { return null; } })() };
};
let c = await chiama("crm_cerca", { testo: "Azienda di prova" });
ok(!c.errore && c.dati?.quante >= 1, "crm_cerca trova l'azienda", c.testo.slice(0, 200));
r = await api("/crm/api/aziende", json({ nome: `${nome} due`, telefono: "010 000001", comune: "Genova" }));
const seconda = await r.json();
c = await chiama("crm_attivita", { tipo: "chiamata", testo: "prova", azienda_id: idDi(seconda), esito: "richiamare", quando: "2030-01-01" });
ok(!c.errore, "crm_attivita scrive una chiamata", c.testo.slice(0, 200));
const az2 = await (await api(`/crm/api/aziende/${idDi(seconda)}`)).json();
ok(az2.esito === "richiamare" && az2.tentativi >= 1, "l'esito arriva sull'azienda", JSON.stringify({ e: az2.esito, t: az2.tentativi }));
c = await chiama("crm_vista", { vista: "Da richiamare oggi" });
ok(!c.errore, "crm_vista legge una vista", c.testo.slice(0, 200));
c = await chiama("raccolta_liste", {});
ok(!c.errore && Array.isArray(c.dati?.liste), "raccolta_liste parla col raccoglitore", c.testo.slice(0, 200));

console.log(falliti ? `\n⛔ ${falliti} prove fallite` : "\n✅ tutte le prove passate");
process.exit(falliti ? 1 : 0);
