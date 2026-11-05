import { chromium } from "patchright";
import { classificaSito, datiSito } from "./link.mjs";

const ATTESA = (ms, segnale) => new Promise((ok) => {
  const t = setTimeout(ok, ms);
  segnale?.addEventListener("abort", () => { clearTimeout(t); ok(); }, { once: true });
});
const aCaso = (min, max) => min + Math.random() * (max - min);

export async function apriBrowser() {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--lang=it-IT", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ locale: "it-IT", timezoneId: "Europe/Rome", viewport: { width: 1280, height: 900 } });
  return { browser, ctx };
}

const numero = (s) => { const n = Number(String(s || "").replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) && String(s || "").trim() ? n : null; };

export function dalLink(href) {
  const s = String(href || "");
  const placeId = /!19s(ChIJ[^!?&]+)/.exec(s)?.[1] || null;
  const cid = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(s)?.[1] || null;
  const lat = Number(/!3d(-?\d+\.\d+)/.exec(s)?.[1]), lng = Number(/!4d(-?\d+\.\d+)/.exec(s)?.[1]);
  return { id: placeId || cid || null, place_id: placeId, cid, ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}) };
}

const ORARI = /\b(aperto|chiuso|chiude|apre|24 ore|temporaneamente|definitivamente)\b/i;
const TELEFONO = /(\+39[\s\d]{6,16}|\b0\d{1,4}[\s\d]{5,12}\d|\b3\d{2}[\s\d]{6,10}\d)/;

export function daCarta(c, citta) {
  const link = dalLink(c.link);
  const righe = (c.righe || []).map((r) => String(r).trim()).filter(Boolean);
  const info = righe.find((r) => r.includes("·") && !ORARI.test(r) && !TELEFONO.test(r)) || "";
  const [categoria = "", ...resto] = info.split("·").map((x) => x.trim()).filter((x) => x && !/^[€$]+$/.test(x));
  const telefono = String(c.telefono || "").trim() || (righe.map((r) => TELEFONO.exec(r)?.[1]).find(Boolean) || "").trim();
  const voto = numero(c.voto);
  const rec = /([\d.]+)\s*recension/i.exec(c.aria_voto || "")?.[1] || String(c.recensioni || "").replace(/[()]/g, "");
  const s = classificaSito(c.sito);
  return {
    nome: String(c.nome || "").trim().slice(0, 300),
    telefono: telefono.replace(/\s+/g, " ").slice(0, 40),
    citta: String(citta || "").trim().slice(0, 120),
    sito: s.sito,
    indirizzo: resto.join(", ").slice(0, 300),
    categoria: categoria.slice(0, 120),
    valutazione: voto !== null && voto >= 0 && voto <= 5 ? Math.round(voto * 10) / 10 : null,
    recensioni: rec && Number.isFinite(numero(rec)) ? Math.round(numero(rec)) : null,
    fonte: "google-maps",
    fonte_id: link.id,
    dati: { maps: String(c.link || "").split("?")[0].slice(0, 600), ...(link.lat !== undefined ? { lat: link.lat, lng: link.lng } : {}), ...(link.place_id ? { place_id: link.place_id } : {}), ...(link.cid ? { cid: link.cid } : {}), ...datiSito(s) },
  };
}

async function consenso(page) {
  if (!/consent\.google/.test(page.url())) return;
  const b = page.locator('button:has-text("Rifiuta tutto"), button:has-text("Accetta tutto"), button:has-text("Reject all"), button:has-text("Accept all")').first();
  await b.click({ timeout: 15_000 });
  await page.waitForURL(/google\.[a-z.]+\/maps/, { timeout: 30_000 });
}

export class Captcha extends Error {}
export class PaginaCambiata extends Error {}

export function controllaPagina({ posti, carte, aziende }) {
  if (posti > 0 && carte === 0) throw new PaginaCambiata(`la pagina di Google Maps è cambiata: ${posti} posti nella lista ma nessuna carta letta (va aggiornato motore/raccolte/maps.mjs)`);
  if (carte > 0 && aziende.length === 0) throw new PaginaCambiata(`la pagina di Google Maps è cambiata: ${carte} carte lette ma nessuna con nome e id del posto (va aggiornato motore/raccolte/maps.mjs)`);
  if (aziende.length >= 5 && !aziende.some((a) => a.telefono || a.categoria || a.valutazione !== null)) {
    throw new PaginaCambiata(`la pagina di Google Maps è cambiata: ${aziende.length} aziende senza telefono, categoria né voto (va aggiornato motore/raccolte/maps.mjs)`);
  }
}

export async function cercaMaps(ctx, { cosa, dove, massimo = 120, segnale }) {
  const page = await ctx.newPage();
  try {
    const q = [cosa, dove].filter(Boolean).join(" ");
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=it`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await consenso(page);
    if (/\/sorry\//.test(page.url())) throw new Captcha("Google chiede il captcha: la raccolta si ferma (riprova fra qualche ora)");
    const feed = page.locator('div[role="feed"]');
    try { await feed.waitFor({ timeout: 25_000 }); }
    catch {
      if (/\/maps\/place\//.test(page.url())) {
        const una = await page.evaluate(() => ({ nome: document.querySelector("h1")?.textContent || "", link: location.href,
          telefono: document.querySelector('button[data-item-id^="phone"]')?.getAttribute("aria-label")?.replace(/^[^:]*:\s*/, "") || "",
          sito: document.querySelector('a[data-item-id="authority"]')?.href || "",
          righe: [document.querySelector('button[jsaction*="category"]')?.textContent || "", document.querySelector('button[data-item-id="address"]')?.getAttribute("aria-label")?.replace(/^[^:]*:\s*/, "") || ""].filter(Boolean).join(" · ").split("\n") }));
        return { aziende: una.nome ? [daCarta(una, dove)] : [], fine: "elenco" };
      }
      return { aziende: [], fine: "elenco" };
    }
    let fine = "elenco", ultimi = 0, fermi = 0;
    for (let giro = 0; giro < 80; giro++) {
      if (segnale?.aborted) { fine = "ferma"; break; }
      const n = await page.locator('div[role="feed"] a.hfpxzc').count();
      if (n >= massimo) { fine = "massimo"; break; }
      if (await page.locator("text=/fine dell.elenco|end of the list/i").count()) break;
      if (n === ultimi) { if (++fermi > 6) break; } else fermi = 0;
      ultimi = n;
      await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight));
      await ATTESA(aCaso(900, 1800), segnale);
    }
    const carte = await page.evaluate(() => [...document.querySelectorAll('div[role="feed"] a.hfpxzc')].map((a) => {
      const carta = a.parentElement;
      const voto = carta.querySelector('span[role="img"][aria-label]');
      return {
        nome: a.getAttribute("aria-label") || "", link: a.href,
        voto: carta.querySelector("span.MW4etd")?.textContent || "", recensioni: carta.querySelector("span.UY7F9")?.textContent || "",
        aria_voto: voto?.getAttribute("aria-label") || "",
        telefono: carta.querySelector("span.UsdlK")?.textContent || "",
        sito: [...carta.querySelectorAll("a[href]")].filter((x) => x !== a).map((x) => x.href).find((h) => !/\/maps\/(place|dir|search)\//.test(h)) || "",
        righe: carta.innerText.split("\n"),
      };
    }));
    const viste = new Set(), aziende = [];
    for (const c of carte.slice(0, massimo)) {
      const r = daCarta(c, dove);
      if (!r.nome || !r.fonte_id || viste.has(r.fonte_id)) continue;
      viste.add(r.fonte_id); aziende.push(r);
    }
    const posti = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
    controllaPagina({ posti, carte: carte.length, aziende });
    return { aziende, fine };
  } finally { await page.close().catch(() => {}); }
}
