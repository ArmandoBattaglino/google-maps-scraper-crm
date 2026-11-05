import pg from "pg";
import { ErroreApi } from "./regole.mjs";
import { SOCIO_SQL } from "./db.mjs";

const BATTITO = Number(process.env.EVENTI_BATTITO_MS || 25_000);
const RICONTROLLO = Number(process.env.EVENTI_RICONTROLLO_MS || 60_000);
const MAX_PER_EMAIL = 20, MAX_TUTTI = 300;
const EVENTI = new Set(["INSERT", "UPDATE", "DELETE"]);
const DALL_APP = new Set(["aziende", "contatti", "attivita", "fasi_lead", "aziende_provenienze"]);
const DEL_CRM = new Set(["persone", "trattative", "attivita", "tag", "tag_su", "schede_aziende", "impostazioni", "viste",
  "campi_definizioni", "ponte_registro"]);
const SPENTO = process.env.CRM_CONTROPROVA === "senza-eventi";

const idSemplice = (v) => (typeof v === "string" && v.length > 0 && v.length <= 320) || (typeof v === "number" && Number.isFinite(v));

export function ripulisci(canale, testo) {
  let m; try { m = JSON.parse(testo); } catch { return null; }
  if (!m || typeof m !== "object" || !EVENTI.has(m.evento)) return null;
  if (canale === "crm") {
    if (m.schema !== "crm" || !DEL_CRM.has(m.tabella) || !idSemplice(m.id)) return null;
    return { schema: "crm", tabella: m.tabella, evento: m.evento, id: m.id };
  }
  if (canale === "app") {
    if (!DALL_APP.has(m.tabella)) return null;
    const id = m.chiave && typeof m.chiave === "object" ? m.chiave.id : m.id;
    if (!idSemplice(id)) return null;
    return { schema: "app", tabella: m.tabella, evento: m.evento, id };
  }
  return null;
}

export function creaEventi({ db, connectionString }) {
  const clienti = new Set();
  let ascolto = null, numero = 0, aperture = 0, giu = false, prova = null;

  async function apri() {
    const c = new pg.Client({ connectionString, application_name: "crm-eventi" });
    let morta = false;
    c.on("notification", (n) => {
      const m = ripulisci(n.channel, n.payload);
      if (!m) return;
      const riga = `id: ${++numero}\ndata: ${JSON.stringify(m)}\n\n`;
      for (const cl of clienti) scrivi(cl, riga);
    });
    const cade = (e) => {
      if (morta) return;
      morta = true;
      console.error(`eventi: connessione LISTEN caduta: ${e?.code || e?.message?.slice(0, 120) || "fine"}`);
      c.removeAllListeners("notification");
      c.end().catch(() => {});
      ascolto = null;
      giu = true;
      if (clienti.size) riprova(1000);
    };
    c.on("error", cade);
    c.on("end", () => cade());
    await c.connect();
    await c.query("listen crm");
    await c.query("listen app");
    if (aperture++) console.log("eventi: LISTEN riaperta");
    if (giu) {
      giu = false;
      for (const cl of clienti) scrivi(cl, `event: ripreso\ndata: {"ok":true}\n\n`);
    }
    return c;
  }
  async function ascolta() {
    if (ascolto) return ascolto;
    ascolto = apri();
    try { return await ascolto; } catch (e) { ascolto = null; throw e; }
  }
  function riprova(attesa) {
    if (prova) return;
    prova = setTimeout(async () => {
      prova = null;
      if (!clienti.size || ascolto) return;
      try { await ascolta(); }
      catch (e) { console.error(`eventi: LISTEN non riesce ancora: ${e?.code || "errore"}`); riprova(Math.min(attesa * 2, 5000)); }
    }, attesa);
    prova.unref?.();
  }

  function scrivi(cl, testo) {
    if (cl.res.writableEnded) return;
    if (cl.res.writableLength > 1024 * 1024) { chiudi(cl); return; }
    cl.res.write(testo);
  }
  function chiudi(cl) {
    if (!clienti.delete(cl)) return;
    clearInterval(cl.battito); clearInterval(cl.ricontrollo); clearTimeout(cl.scadenza);
    if (!cl.res.writableEnded) cl.res.end();
  }

  const socio = (email) => db.conLaSessione(email, async (c) => (await c.query(SOCIO_SQL)).rows[0].ok);

  async function eventi(req, res, { email, claims }) {
    if (SPENTO) throw new ErroreApi(501, "tempo reale spento (controprova)");
    if (req.method !== "GET") throw new ErroreApi(405, "metodo non ammesso");
    if (!(await socio(email))) throw new ErroreApi(403, "solo gli utenti ricevono il tempo reale", "socio");
    if (clienti.size >= MAX_TUTTI || [...clienti].filter((c) => c.email === email).length >= MAX_PER_EMAIL) {
      throw new ErroreApi(429, "troppi flussi aperti");
    }
    try { await ascolta(); } catch (e) { console.error(`eventi: LISTEN non riesce: ${e?.code || "errore"}`); throw new ErroreApi(503, "tempo reale non disponibile ora"); }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
      "x-servizio": "crm",
      Connection: "keep-alive",
    });
    res.socket?.setNoDelay?.(true);
    req.socket?.setTimeout?.(0);
    const cl = { res, email };
    clienti.add(cl);
    res.write(`retry: 1000\n: ${" ".repeat(2048)}\n\nevent: pronto\ndata: {"ok":true}\n\n`);
    cl.battito = setInterval(() => scrivi(cl, ": battito\n\n"), BATTITO);
    cl.ricontrollo = setInterval(async () => {
      try { if (!(await socio(email))) { console.log("eventi: un ascoltatore non è più utente, flusso chiuso"); chiudi(cl); } }
      catch (e) { console.error(`eventi: ricontrollo: ${e?.code || "errore"}`); }
    }, RICONTROLLO);
    const resta = typeof claims?.exp === "number" ? claims.exp * 1000 - Date.now() : 0;
    if (resta > 0) cl.scadenza = setTimeout(() => chiudi(cl), Math.min(resta, 2 ** 31 - 1));
    req.on("close", () => chiudi(cl));
  }
  eventi.ferma = () => { for (const cl of [...clienti]) chiudi(cl); clearTimeout(prova); return ascolto?.then((c) => c.end()).catch(() => {}); };
  return eventi;
}
