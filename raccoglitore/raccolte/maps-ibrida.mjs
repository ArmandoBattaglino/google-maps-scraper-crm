import { Captcha, PaginaCambiata } from "./maps.mjs";
import { daRisposta } from "./maps-dati.mjs";

export class IbridaNonVa extends Error {}

const PAGINA = 20, MAX_PAGINE = 10;
const attesa = (ms, segnale) => new Promise((ok) => {
  const t = setTimeout(ok, ms);
  segnale?.addEventListener("abort", () => { clearTimeout(t); ok(); }, { once: true });
});
const aCaso = (min, max) => min + Math.random() * (max - min);
const STAMPO = /\/search\?tbm=map&[^#]*!8i\d+/;

export function conDa(stampo, da) {
  if (!/!8i\d+/.test(stampo)) throw new IbridaNonVa("lo stampo di Maps non ha più «!8i»: la paginazione è cambiata");
  return stampo.replace(/!8i\d+/, `!8i${da}`);
}

export async function cercaMapsIbrida(ctx, { cosa, dove, massimo = 120, segnale }) {
  const page = await ctx.newPage();
  let stampo = null;
  page.on("request", (r) => { if (!stampo && STAMPO.test(r.url())) stampo = r.url(); });
  try {
    const q = [cosa, dove].filter(Boolean).join(" ");
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=it`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (/consent\.google/.test(page.url())) {
      await page.locator('button:has-text("Rifiuta tutto"), button:has-text("Accetta tutto"), button:has-text("Reject all"), button:has-text("Accept all")').first().click({ timeout: 15_000 });
      await page.waitForURL(/google\.[a-z.]+\/maps/, { timeout: 30_000 });
    }
    if (/\/sorry\//.test(page.url())) throw new Captcha("Google chiede il captcha: la raccolta si ferma (riprova fra qualche ora)");
    const feed = page.locator('div[role="feed"]');
    try { await feed.waitFor({ timeout: 25_000 }); }
    catch { throw new IbridaNonVa("nessuna lista (un risultato solo, o nessuno): ci pensa il browser"); }
    for (let i = 0; i < 3 && !stampo; i++) {
      await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight));
      for (let k = 0; k < 20 && !stampo; k++) await attesa(150, segnale);
    }
    if (!stampo) throw new IbridaNonVa("la lista non ha chiesto altri posti (meno di 20 risultati?): ci pensa il browser");

    const viste = new Set(), aziende = [];
    let fine = "elenco", pagine = 0;
    for (let da = 0; pagine < MAX_PAGINE; da += PAGINA) {
      if (segnale?.aborted) { fine = "ferma"; break; }
      const r = await page.evaluate(async (u) => {
        try { const x = await fetch(u, { credentials: "include" }); return { stato: x.status, url: x.url, corpo: await x.text() }; }
        catch (e) { return { stato: 0, url: "", corpo: "", errore: String(e) }; }
      }, conDa(stampo, da));
      pagine++;
      if (/\/sorry\//.test(r.url) || r.stato === 429) throw new Captcha("Google chiede il captcha: la raccolta si ferma (riprova fra qualche ora)");
      if (r.stato !== 200) throw new IbridaNonVa(`Maps risponde ${r.stato || "niente"} alla richiesta dei posti`);
      const { aziende: qui, posti } = daRisposta(r.corpo, dove);
      if (da === 0 && !posti) {
        const carte = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
        if (carte) throw new PaginaCambiata(`il JSON di Maps non dà posti ma la lista ne mostra ${carte}: le posizioni sono cambiate`);
      }
      for (const a of qui) if (!viste.has(a.fonte_id)) { viste.add(a.fonte_id); aziende.push(a); }
      if (aziende.length >= massimo) { fine = "massimo"; break; }
      if (posti < PAGINA) break;
      await attesa(aCaso(400, 900), segnale);
    }
    return { aziende: aziende.slice(0, massimo), fine, pagine };
  } finally { await page.close().catch(() => {}); }
}
