#!/usr/bin/env node
import http from "node:http";
import * as archivio from "./archivio.mjs";
import { creaRaccolte } from "./raccolte.mjs";

class Errore extends Error { constructor(stato, msg) { super(msg); this.stato = stato; } }
const PORTA = Number(process.env.RACCOLTE_PORTA || 5320), HOST = process.env.RACCOLTE_HOST || "0.0.0.0";
if (!process.env.DATABASE_URL) { console.error("raccoglitore: senza DATABASE_URL non parte (le raccolte vivono nel database)"); process.exit(1); }

const json = (res, x, stato = 200) => { res.writeHead(stato, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(x)); };
const corpo = (req) => new Promise((ok, ko) => {
  const b = []; let n = 0;
  req.on("data", (x) => { n += x.length; if (n > 256 * 1024) { ko(new Errore(413, "richiesta troppo grande")); req.destroy(); } else b.push(x); });
  req.on("end", () => { try { ok(b.length ? JSON.parse(Buffer.concat(b)) : {}); } catch { ko(new Errore(400, "JSON non valido")); } });
});

const raccolte = creaRaccolte({ Errore });

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://raccoglitore"), parti = u.pathname.split("/").filter(Boolean);
    if (req.method === "GET" && u.pathname === "/salute") return json(res, { ok: true, in_corso: raccolte.attivi.size });
    if (parti[0] !== "api" || parti[1] !== "raccolte") throw new Errore(404, "non c'è: qui ci sono solo le raccolte");
    const email = String(req.headers["x-utente-email"] || "").trim().toLowerCase();
    if (!email) throw new Errore(401, "le raccolte si chiedono dal CRM");
    await archivio.conChi(email, () => raccolte.gestisci(req, res, u, parti, { corpo, json }));
  } catch (e) {
    if (res.headersSent) { try { res.end(); } catch {} return; }
    json(res, { errore: e.stato ? e.message : `errore del raccoglitore (${e.code || e.name || "errore"})` }, e.stato || 500);
    if (!e.stato) console.error(`raccoglitore: errore non previsto (${e.code || e.name || "errore"})`);
  }
});

try { await raccolte.riprendiAllAvvio(); }
catch (e) { console.error(`raccoglitore: la ripresa all'avvio non è andata (${e.code || e.name || "errore"}): le raccolte in corso restano da rifare`); }
server.listen(PORTA, HOST, () => console.log(`raccoglitore: in ascolto su ${HOST}:${PORTA}`));
const GIRO_S = Math.max(5, Number(process.env.RACCOLTE_GIRO_S || 60));
setInterval(() => raccolte.continua().catch((e) => console.error(`raccoglitore: il giro della ripresa non è andato (${e.code || e.name || "errore"})`)), GIRO_S * 1000).unref();
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { server.close(); process.exit(0); });
