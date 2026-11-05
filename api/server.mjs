#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { creaDb, SOCIO_SQL } from "./db.mjs";
import { creaDati, ErroreApi, traduciErrorePg } from "./dati.mjs";
import { creaAziende, corpoAttivita } from "./aziende.mjs";
import { creaElenchi } from "./elenchi.mjs";
import { creaCompiti } from "./compiti.mjs";
import { creaMotore } from "./query.mjs";
import { creaCoda } from "./coda.mjs";
import { creaOggi } from "./oggi.mjs";
import { creaViste } from "./viste.mjs";
import { creaEventi } from "./eventi.mjs";
import { creaMcp } from "./mcp.mjs";
import { creaIngressi } from "./ingressi.mjs";
import { senzaContatti } from "./riservato.mjs";
import { segnala } from "./errori.mjs";
import { creaCampi } from "./campi.mjs";
import { creaOrigini } from "./origini.mjs";

const env = process.env;
const manca = ["DATABASE_URL"].filter((k) => !env[k]);
if (manca.length) { console.error(`crm: mancano le variabili ${manca.join(", ")}`); process.exit(2); }

const BASE = "/crm";
const PORTA = Number(env.PORTA || 5330);
const WEB = env.WEB_DIR ? path.resolve(env.WEB_DIR) : "";
const VERSIONE = env.COMMIT_IMMAGINE || "sviluppo";
const MARCA = env.APP_NOME || "CRM";
const LIMITE_JSON = 1024 * 1024;
const TIPI = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".json": "application/json", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".map": "application/json", ".webmanifest": "application/manifest+json" };
const CON_IMPRONTA = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;
const SICUREZZA = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "SAMEORIGIN", "x-servizio": "crm" };

const db = creaDb(env.DATABASE_URL);
// Non c'è un login: tutto avviene a nome dell'unico utente (db/semi.sql). Per questo il CRM risponde solo agli indirizzi
// di questa macchina, più quelli scelti in CONSENTI_HOST: così una pagina web non può raggiungerlo (DNS rebinding).
const UTENTE = "io@crm.local";
const HOST_AMMESSI = new Set(["localhost", "127.0.0.1", "[::1]", ...String(env.CONSENTI_HOST || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)]);
const hostAmmesso = (req) => HOST_AMMESSI.has(String(req.headers.host || "").toLowerCase().replace(/:\d+$/, ""));
const eventi = creaEventi({ db, connectionString: env.DATABASE_URL });
const ora = () => Date.now();
const daAzienda = creaIngressi({ conLaSessione: db.conLaSessione });
const compiti = creaCompiti({ conLaSessione: db.conLaSessione });
let dati = null, aziende = null, elenchi = null, motore = null, coda = null, oggi = null, viste = null, catalogoLetto = null;

function manda(res, stato, corpo, intestazioni = {}) {
  if (res.headersSent) { res.end(); return; }
  const s = JSON.stringify(corpo);
  res.writeHead(stato, { ...SICUREZZA, ...intestazioni, "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s), "Cache-Control": "no-store" });
  res.end(s);
}
const errore = (res, stato, message, code = "crm") => manda(res, stato, { error: { message, code } });
const origini = creaOrigini({ conLaSessione: db.conLaSessione });
const mcp = creaMcp({ email: UTENTE, raccolteUrl: env.RACCOLTE_URL || "http://raccoglitore:5320", conLaSessione: db.conLaSessione, versione: VERSIONE, intestazioni: SICUREZZA, segnala,
  servizi: () => (viste ? { catalogo: catalogoLetto, dati, aziende, motore, viste } : null) });

async function leggiJson(req) {
  const pezzi = []; let n = 0;
  for await (const p of req) { n += p.length; if (n > LIMITE_JSON) throw new ErroreApi(413, "corpo oltre 1 MB"); pezzi.push(p); }
  if (!n) return undefined;
  if (!/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) throw new ErroreApi(415, "il corpo va in JSON (application/json)");
  try { return JSON.parse(Buffer.concat(pezzi).toString("utf8")); } catch { throw new ErroreApi(400, "JSON non valido", "valore"); }
}

async function webapp(req, res, rel) {
  if (!WEB) throw new ErroreApi(404, "non trovato");
  if (req.method !== "GET" && req.method !== "HEAD") throw new ErroreApi(405, "metodo non ammesso");
  let nome;
  try { nome = decodeURIComponent(rel); } catch { throw new ErroreApi(400, "percorso non valido"); }
  if (nome.includes("\0")) throw new ErroreApi(404, "non trovato");
  if (nome === "/" || nome === "" || !path.extname(nome)) nome = "/index.html";
  const pieno = path.resolve(WEB, "." + nome);
  const tipo = TIPI[path.extname(pieno).toLowerCase()];
  if (!pieno.startsWith(WEB + path.sep) || !tipo || path.basename(pieno).startsWith(".")) throw new ErroreApi(404, "non trovato");
  let st; try { st = await fsp.stat(pieno); } catch { st = null; }
  if (!st?.isFile()) throw new ErroreApi(404, "non trovato");
  const cache = tipo.startsWith("text/html") ? "no-cache" : (CON_IMPRONTA.test(nome) ? "public, max-age=31536000, immutable" : "public, max-age=300");
  res.writeHead(200, { ...SICUREZZA, "Content-Type": tipo, "Content-Length": st.size, "Cache-Control": cache });
  if (req.method === "HEAD") { res.end(); return; }
  await pipeline(fs.createReadStream(pieno), res);
}

async function gestisci(req, res) {
  const url = new URL(req.url, "http://crm");
  const percorso = url.pathname;
  if (percorso === "/salute" || percorso === BASE + "/salute") {
    return manda(res, dati ? 200 : 503, { ok: !!dati, servizio: "crm", versione: VERSIONE });
  }
  if (!hostAmmesso(req)) return errore(res, 403, "questo indirizzo non è fra quelli ammessi: vedi CONSENTI_HOST nel README", "host");
  if (percorso === "/") { res.writeHead(302, { ...SICUREZZA, Location: BASE + "/" }); return res.end(); }
  if (percorso !== BASE && !percorso.startsWith(BASE + "/")) throw new ErroreApi(404, "non trovato");
  const rel = percorso.slice(BASE.length);
  if (rel === "/mcp") return mcp(req, res);
  if (rel.startsWith("/mcp/")) throw new ErroreApi(404, "non trovato");

  const pezzi = rel.split("/").filter(Boolean);
  if (pezzi[0] !== "api" && pezzi[0] !== "eventi") return webapp(req, res, rel);

  // niente scritture da un'altra pagina
  const daDove = req.headers["sec-fetch-site"];
  if (req.method !== "GET" && req.method !== "HEAD" && daDove && daDove !== "same-origin" && daDove !== "none") {
    return errore(res, 403, "richiesta da un altro sito", "origine");
  }

  if (pezzi[0] === "api" && pezzi.length === 2 && pezzi[1] === "marca") {
    if (req.method !== "GET") throw new ErroreApi(405, "metodo non ammesso");
    return manda(res, 200, { nome: MARCA });
  }

  const email = UTENTE, claims = {};
  if (pezzi[0] === "eventi" && pezzi.length === 1) return eventi(req, res, { email, claims });
  if (pezzi[0] === "api") {
    if (!dati) return errore(res, 503, "il servizio si sta avviando");
    if (pezzi.length < 2 || pezzi.length > 4) throw new ErroreApi(404, "non trovato");
    if (pezzi.length === 2 && pezzi[1] === "io") {
      if (req.method !== "GET") throw new ErroreApi(405, "metodo non ammesso");
      const socio = await db.conLaSessione(email, async (c) => (await c.query(SOCIO_SQL)).rows[0].ok);
      return manda(res, 200, { email, socio });
    }
    if (pezzi[1] === "coda") {
      if (pezzi.length !== 3) throw new ErroreApi(404, "non trovato");
      const corpo = req.method === "POST" ? await leggiJson(req) : undefined;
      const r = await coda({ metodo: req.method, azione: pezzi[2], cerca: url.searchParams, corpo, email });
      return manda(res, r.stato, r.corpo);
    }
    if (pezzi.length === 3 && pezzi[1] === "trattative" && pezzi[2] === "da-azienda") {
      const corpo = req.method === "POST" ? await leggiJson(req) : undefined;
      const r = await daAzienda({ metodo: req.method, cerca: url.searchParams, corpo, email });
      return manda(res, r.stato, r.corpo);
    }
    let risorsa, id, azione;
    try { [risorsa, id, azione] = pezzi.slice(1).map(decodeURIComponent); } catch { throw new ErroreApi(400, "percorso non valido"); }
    let corpo = ["POST", "PUT", "PATCH"].includes(req.method) ? await leggiJson(req) : undefined;
    if (risorsa === "attivita") corpo = corpoAttivita(req.method, id, corpo);
    const richiesta = { metodo: req.method, risorsa, id, azione, cerca: url.searchParams, corpo, email };
    const r = (await compiti(richiesta)) ?? (await origini(richiesta)) ?? (await oggi.rotta(richiesta)) ?? (await motore.rotta(richiesta)) ?? (await viste.rotta(richiesta)) ?? (await elenchi(richiesta)) ?? (await aziende(richiesta)) ?? (await dati(richiesta));
    return manda(res, r.stato, r.corpo, r.intestazioni);
  }
  throw new ErroreApi(404, "non trovato");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function perIlLog(url) {
  const pezzi = String(url).split("?")[0].slice(0, 200).split("/");
  if (pezzi[2] === "api" && pezzi[4] && !UUID.test(pezzi[4])) pezzi[4] = "<id>";
  return senzaContatti(pezzi.join("/").replace(/%40/g, "@"));
}

const server = http.createServer((req, res) => {
  const t0 = Date.now();
  res.on("finish", () => console.log(`${new Date().toISOString()} ${req.method} ${perIlLog(req.url)} ${res.statusCode} ${Date.now() - t0}ms`));
  gestisci(req, res).catch((e) => {
    if (e instanceof ErroreApi) return errore(res, e.stato, e.message, e.code);
    const pg = traduciErrorePg(e);
    if (pg) return errore(res, pg.stato, pg.message, pg.code);
    console.error(`errore: ${e?.code || ""} ${senzaContatti(String(e?.message || e).split("\n")[0]).slice(0, 200)}`);
    segnala(e, { servizio: "crm", percorso: perIlLog(req.url), metodo: req.method });
    errore(res, 500, "errore del servizio");
  });
});
server.requestTimeout = 60_000;
server.headersTimeout = 30_000;

async function avvia() {
  for (let i = 1; ; i++) {
    try {
      const catalogo = await db.catalogo();
      catalogoLetto = catalogo;
      aziende = creaAziende({ conLaSessione: db.conLaSessione, catalogo });
      elenchi = creaElenchi({ conLaSessione: db.conLaSessione, catalogo });
      motore = creaMotore({ conLaSessione: db.conLaSessione, catalogo });
      coda = creaCoda({ conLaSessione: db.conLaSessione, motore, ora });
      oggi = creaOggi({ conLaSessione: db.conLaSessione, motore });
      dati = creaDati({ conLaSessione: db.conLaSessione, catalogo });
      dati = creaCampi({ conLaSessione: db.conLaSessione, catalogo, dati });
      viste = creaViste({ conLaSessione: db.conLaSessione, catalogo, dati, motore });
      console.log(`crm pronto (${VERSIONE}): ${catalogo.size} risorse, ${[...catalogo.values()].reduce((n, c) => n + c.size, 0)} colonne · app: ${WEB ? "sì" : "no"}`);
      return;
    } catch (e) {
      if (i >= 60) { console.error(`crm: database non pronto dopo 2 minuti: ${senzaContatti(e.message)}`); process.exit(1); }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

for (const come of ["uncaughtException", "unhandledRejection"]) {
  process.on(come, async (err) => {
    console.error(`⛔ ${come}: ${senzaContatti(err?.stack || err)}`);
    await segnala(err, { servizio: "crm", come });
    process.exit(1);
  });
}
server.listen(PORTA, () => console.log(`crm in ascolto su :${PORTA}`));
avvia();

for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => {
  server.close();
  Promise.allSettled([eventi.ferma()]).finally(() => db.pool.end()).finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
