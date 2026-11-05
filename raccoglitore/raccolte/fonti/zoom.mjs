import { apriBrowser, Captcha } from "../maps.mjs";
import { postiDaRisposta } from "../maps-dati.mjs";
import { centro, raggio, distanza, dentroRett } from "../geo.mjs";
import { fineCella, urlCella } from "./ibrida.mjs";

export const nome = "zoom";
const PAGINA = 20;
export const ZOOM_MIN = 12, ZOOM_MAX = 17;
export const VISTA_PX = { larghezza: 1280, altezza: 900 };
const STAMPO = /\/search\?tbm=map&[^#]*!8i\d+/;
const attesa = (ms, segnale) => new Promise((ok) => {
  const t = setTimeout(ok, ms);
  segnale?.addEventListener("abort", () => { clearTimeout(t); ok(); }, { once: true });
});
const aCaso = (min, max) => min + Math.random() * (max - min);

export function zoomDaCella(r) {
  const c = centro(r);
  const largo = distanza(c.lat, r.ovest, c.lat, r.est), alto = distanza(r.sud, c.lng, r.nord, c.lng);
  const mpp0 = 156543.03392 * Math.cos(c.lat * Math.PI / 180);
  const z = Math.min(Math.log2((mpp0 * VISTA_PX.larghezza) / Math.max(largo, 1)), Math.log2((mpp0 * VISTA_PX.altezza) / Math.max(alto, 1)));
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(z)));
}

export function urlApri(cosa, lat, lng, z) {
  return `https://www.google.com/maps/search/${encodeURIComponent(cosa)}/@${lat.toFixed(5)},${lng.toFixed(5)},${z}z?hl=it`;
}

export const quotaDi = (stampo) => { const m = /!1d([\d.]+)!2d/.exec(stampo || ""); return m ? Number(m[1]) : null; };

export function urlZoom(stampo, { cosa, lat, lng, da }) {
  const quota = quotaDi(stampo);
  if (!quota) throw Object.assign(new Error("lo stampo di Maps non ha più !1d!2d!3d: la richiesta è cambiata"), { name: "PaginaCambiata" });
  return urlCella(stampo, { cosa, lat, lng, larghezza: quota, da });
}

const eCrollo = (e) => /crash|Target (page, context or browser )?(has been )?closed|browser has been closed|Execution context was destroyed/i.test(String(e?.message || e));

export async function apri({ segnale } = {}) {
  let b = null, page = null;
  const stampi = new Map();
  async function accendi() {
    if (b) await b.browser.close().catch(() => {});
    b = await apriBrowser();
    page = await b.ctx.newPage();
  }
  await accendi();

  async function impara(cosa, lat, lng, z) {
    let stampo = null;
    const ascolta = (r) => { if (!stampo && STAMPO.test(r.url())) stampo = r.url(); };
    page.on("request", ascolta);
    try {
      await page.goto(urlApri(cosa, lat, lng, z), { waitUntil: "domcontentloaded", timeout: 45_000 });
      if (/consent\.google/.test(page.url())) {
        await page.locator('button:has-text("Rifiuta tutto"), button:has-text("Accetta tutto"), button:has-text("Reject all"), button:has-text("Accept all")').first().click({ timeout: 15_000 });
        await page.waitForURL(/google\.[a-z.]+\/maps/, { timeout: 30_000 });
      }
      if (/\/sorry\//.test(page.url())) throw new Captcha("Google chiede il captcha: la raccolta si ferma (riprova fra qualche ora)");
      const feed = page.locator('div[role="feed"]');
      await feed.waitFor({ timeout: 25_000 }).catch(() => {});
      for (let i = 0; i < 12 && !stampo; i++) {
        await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight)).catch(() => {});
        await attesa(700, segnale);
      }
    } finally { page.off("request", ascolta); }
    if (!stampo) throw Object.assign(new Error(`Maps non ha chiesto altri posti a zoom ${z}: lo stampo non si impara`), { name: "PaginaCambiata" });
    stampi.set(z, stampo);
    return stampo;
  }

  async function unaCella({ cosa, rettangolo, tetto, fissa, rilevante }, posti) {
    const c = centro(rettangolo), r = raggio(rettangolo), z = zoomDaCella(rettangolo);
    const stampo = stampi.get(z) || await impara(cosa, c.lat, c.lng, z);
    const distanze = [];
    let richieste = 0, dentro = 0, oltre = 0, distanzaMax = 0, fine = null;
    for (let da = 0; !fine; da += PAGINA) {
      if (segnale?.aborted) return { posti, fine: "errore", errore: "fermata", richieste, pagine: distanze.length, dentro, oltre, distanza_max: Math.round(distanzaMax), zoom: z };
      const u = urlZoom(stampo, { cosa, lat: c.lat, lng: c.lng, da });
      const x = await page.evaluate(async (url) => {
        try { const y = await fetch(url, { credentials: "include" }); return { stato: y.status, url: y.url, corpo: await y.text() }; }
        catch (e) { return { stato: 0, url: "", corpo: "", errore: String(e) }; }
      }, u);
      richieste++;
      if (/\/sorry\//.test(x.url) || x.stato === 429) throw new Captcha("Google chiede il captcha: la raccolta si ferma (riprova fra qualche ora)");
      if (x.stato !== 200) throw new Error(`Maps risponde ${x.stato || "niente"}`);
      const { posti: qui, n } = postiDaRisposta(x.corpo);
      const dist = [];
      for (const p of qui) {
        const d = Number.isFinite(p.lat) && Number.isFinite(p.lng) ? distanza(c.lat, c.lng, p.lat, p.lng) : Infinity;
        dist.push(d); distanzaMax = Math.max(distanzaMax, Number.isFinite(d) ? d : 0);
        if (Number.isFinite(p.lat) && dentroRett(rettangolo, p.lat, p.lng)) dentro++;
        if (d > r) oltre++;
        posti.push(p);
      }
      distanze.push(dist);
      fine = fissa ? (n < PAGINA || distanze.length * PAGINA >= tetto ? "completa" : null) : fineCella({ pagine: distanze, r, tetto, ultima: n < PAGINA, fuoriNicchia: !!rilevante && qui.length > 0 && !qui.some(rilevante) });
      if (!fine) await attesa(aCaso(350, 800), segnale);
    }
    return { posti, fine, richieste, pagine: distanze.length, dentro, oltre, distanza_max: Math.round(distanzaMax), raggio: Math.round(r), zoom: z };
  }

  async function cercaCella({ cosa, rettangolo, tetto = 160, fissa = false, rilevante = null }) {
    for (let tentativo = 0; ; tentativo++) {
      const posti = [];
      try { return await unaCella({ cosa, rettangolo, tetto, fissa, rilevante }, posti); }
      catch (e) {
        if (e instanceof Captcha) { e.name = "Captcha"; throw e; }
        if (e?.name === "PaginaCambiata") throw e;
        if (eCrollo(e) && tentativo === 0) { await accendi(); stampi.clear(); continue; }
        return { posti, fine: "errore", errore: String(e.message || e).slice(0, 240), richieste: 0, pagine: 0, dentro: 0, oltre: 0, distanza_max: 0 };
      }
    }
  }

  return { cercaCella, chiudi: () => b?.browser.close().catch(() => {}) };
}
