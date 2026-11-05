import { apriBrowser, Captcha } from "../maps.mjs";
import { postiDaRisposta } from "../maps-dati.mjs";
import { centro, raggio, distanza, dentroRett } from "../geo.mjs";

export const nome = "ibrida";
const PAGINA = 20;
export const TETTO_GOOGLE = 100;
const attesa = (ms, segnale) => new Promise((ok) => {
  const t = setTimeout(ok, ms);
  segnale?.addEventListener("abort", () => { clearTimeout(t); ok(); }, { once: true });
});
const aCaso = (min, max) => min + Math.random() * (max - min);
const STAMPO = /\/search\?tbm=map&[^#]*!8i\d+/;

export function urlCella(stampo, { cosa, lat, lng, larghezza, da }) {
  if (!/!1d[\d.]+!2d-?[\d.]+!3d-?[\d.]+/.test(stampo) || !/!8i\d+/.test(stampo) || !/[?&]q=/.test(stampo)) {
    throw Object.assign(new Error("lo stampo di Maps non ha più !1d!2d!3d, !8i o q: la richiesta è cambiata"), { name: "PaginaCambiata" });
  }
  return stampo
    .replace(/!1d[\d.]+!2d-?[\d.]+!3d-?[\d.]+/, `!1d${Math.round(larghezza)}!2d${lng.toFixed(7)}!3d${lat.toFixed(7)}`)
    .replace(/!8i\d+/, `!8i${da}`)
    .replace(/([?&]q=)[^&]*/, `$1${encodeURIComponent(cosa).replace(/%20/g, "+")}`);
}

export function fineCella({ pagine, r, tetto, ultima, fuoriNicchia = false }) {
  const ultimaPagina = pagine.at(-1) || [], totale = pagine.reduce((s, p) => s + p.length, 0);
  if (fuoriNicchia && ultimaPagina.length >= PAGINA) return "completa";
  if (ultimaPagina.length >= PAGINA && ultimaPagina.every((d) => d > r)) return "completa";
  if (ultima) return totale >= TETTO_GOOGLE ? "piena" : "completa";
  if (pagine.length * PAGINA >= tetto) return "piena";
  return null;
}

export async function apri({ segnale } = {}) {
  const { browser, ctx } = await apriBrowser();
  const page = await ctx.newPage();
  let stampo = null;
  page.on("request", (r) => { if (!stampo && STAMPO.test(r.url())) stampo = r.url(); });

  async function impara(lat, lng) {
    await page.goto(`https://www.google.com/maps/search/ristorante/@${lat.toFixed(5)},${lng.toFixed(5)},14z?hl=it`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (/consent\.google/.test(page.url())) {
      await page.locator('button:has-text("Rifiuta tutto"), button:has-text("Accetta tutto"), button:has-text("Reject all"), button:has-text("Accept all")').first().click({ timeout: 15_000 });
      await page.waitForURL(/google\.[a-z.]+\/maps/, { timeout: 30_000 });
    }
    if (/\/sorry\//.test(page.url())) throw new Captcha("Google chiede il captcha: la raccolta si ferma (riprova fra qualche ora)");
    const feed = page.locator('div[role="feed"]');
    await feed.waitFor({ timeout: 25_000 });
    for (let i = 0; i < 4 && !stampo; i++) {
      await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight));
      for (let k = 0; k < 20 && !stampo; k++) await attesa(150, segnale);
    }
    if (!stampo) throw Object.assign(new Error("Maps non ha chiesto altri posti: lo stampo non si impara"), { name: "PaginaCambiata" });
  }

  async function cercaCella({ cosa, rettangolo, tetto = 160, luogo = "", rilevante = null }) {
    const c = centro(rettangolo), r = raggio(rettangolo), q = luogo ? `${cosa} ${luogo}` : cosa;
    if (!stampo) await impara(c.lat, c.lng);
    const posti = [], distanze = [];
    let richieste = 0, dentro = 0, oltre = 0, distanzaMax = 0, fine = null;
    try {
      for (let da = 0; !fine; da += PAGINA) {
        if (segnale?.aborted) return { posti, fine: "errore", errore: "fermata", richieste, pagine: distanze.length, dentro, oltre, distanza_max: Math.round(distanzaMax) };
        const u = urlCella(stampo, { cosa: q, lat: c.lat, lng: c.lng, larghezza: Math.max(800, r * 2.4), da });
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
        fine = fineCella({ pagine: distanze, r, tetto, ultima: n < PAGINA, fuoriNicchia: !!rilevante && qui.length > 0 && !qui.some(rilevante) });
        if (!fine) await attesa(aCaso(350, 800), segnale);
      }
    } catch (e) {
      if (e instanceof Captcha) { e.name = "Captcha"; throw e; }
      return { posti, fine: "errore", errore: String(e.message || e).slice(0, 240), richieste, pagine: distanze.length, dentro, oltre, distanza_max: Math.round(distanzaMax) };
    }
    return { posti, fine, richieste, pagine: distanze.length, dentro, oltre, distanza_max: Math.round(distanzaMax), raggio: Math.round(r) };
  }

  return { cercaCella, chiudi: () => browser.close().catch(() => {}) };
}
