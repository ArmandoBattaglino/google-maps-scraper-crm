import { PaginaCambiata } from "./maps.mjs";
import { classificaSito, datiSito } from "./link.mjs";

export function casella(x, ...via) {
  for (const k of via) {
    if (!Array.isArray(x) || k >= x.length) return null;
    x = x[k];
  }
  return x ?? null;
}
const testo = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
const numero = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;

export const POSIZIONI = Object.freeze({
  posti: [64], posto: [1],
  nome: [11], place_id: [78], cid: [10],
  telefono: [178, 0, 0],
  sito: [7, 0],
  voto: [4, 7], recensioni: [37, 1],
  categorie: [13],
  lat: [9, 2], lng: [9, 3],
  via: [183, 1, 1], comune: [183, 1, 3], cap: [183, 1, 4], provincia: [183, 1, 5],
  indirizzo_intero: [39],
  orari_oggi: [203, 1, 4, 0],
});

export function daPosto(p, citta) {
  const P = POSIZIONI, g = (via) => casella(p, ...via);
  const placeId = testo(g(P.place_id), 200) || null, cid = testo(g(P.cid), 80) || null;
  const categorie = (Array.isArray(g(P.categorie)) ? g(P.categorie) : []).filter((c) => typeof c === "string").slice(0, 8);
  const s = classificaSito(testo(g(P.sito), 2000));
  const voto = numero(g(P.voto)), rec = numero(g(P.recensioni));
  const lat = numero(g(P.lat)), lng = numero(g(P.lng));
  return {
    nome: testo(g(P.nome), 300),
    telefono: testo(g(P.telefono), 40).replace(/\s+/g, " "),
    citta: testo(citta, 120),
    sito: s.sito,
    indirizzo: testo(g(P.via), 300) || testo(g(P.indirizzo_intero), 300),
    categoria: (categorie[0] || "").slice(0, 120),
    valutazione: voto !== null && voto >= 0 && voto <= 5 ? Math.round(voto * 10) / 10 : null,
    recensioni: rec !== null && rec >= 0 ? Math.round(rec) : null,
    fonte: "google-maps",
    fonte_id: placeId || cid,
    dati: {
      ...datiSito(s),
      ...(placeId ? { place_id: placeId, maps: `https://www.google.com/maps/place/?q=place_id:${placeId}` } : {}),
      ...(cid ? { cid } : {}), ...(lat !== null && lng !== null ? { lat, lng } : {}),
      ...(testo(g(P.comune), 120) ? { comune: testo(g(P.comune), 120) } : {}),
      ...(testo(g(P.cap), 10) ? { cap: testo(g(P.cap), 10) } : {}),
      ...(testo(g(P.provincia), 60) ? { provincia: testo(g(P.provincia), 60) } : {}),
      ...(categorie.length > 1 ? { categorie } : {}),
      ...(testo(g(P.indirizzo_intero), 300) ? { indirizzo_intero: testo(g(P.indirizzo_intero), 300) } : {}),
      ...(testo(g(P.orari_oggi), 120) ? { orari: testo(g(P.orari_oggi), 120) } : {}),
      strada: "ibrida",
    },
  };
}

export function postoGrezzo(p) {
  const r = daPosto(p, "");
  return { place_id: r.dati.place_id || r.fonte_id, nome: r.nome, lat: r.dati.lat ?? null, lng: r.dati.lng ?? null, telefono: r.telefono, sito: r.sito,
    indirizzo: r.indirizzo, cap: r.dati.cap || "", provincia: r.dati.provincia || "", comune: r.dati.comune || "", categoria: r.categoria,
    categorie: r.dati.categorie || (r.categoria ? [r.categoria] : []), voto: r.valutazione, recensioni: r.recensioni, link: r.dati.maps || "",
    ...(r.dati.sito_tipo ? { sito_tipo: r.dati.sito_tipo } : {}), ...(r.dati.sito_grezzo ? { sito_grezzo: r.dati.sito_grezzo } : {}),
    ...(r.dati.orari ? { orari: r.dati.orari } : {}), ...(r.dati.cid ? { cid: r.dati.cid } : {}) };
}
export function postiDaRisposta(corpo) {
  const { aziende, posti } = daRisposta(corpo, "");
  void aziende;
  const t = String(corpo);
  const lista = casella(JSON.parse(t.slice(t.indexOf("\n") + 1)), ...POSIZIONI.posti) || [];
  return { posti: lista.map((x) => casella(x, ...POSIZIONI.posto)).filter(Array.isArray).map(postoGrezzo).filter((x) => x.nome && x.place_id), n: posti };
}

export function daRisposta(corpo, citta) {
  const t = String(corpo || "");
  if (!t.startsWith(")]}'")) throw new PaginaCambiata("la risposta di Maps non è più il JSON atteso (manca «)]}'»)");
  let j;
  try { j = JSON.parse(t.slice(t.indexOf("\n") + 1)); } catch { throw new PaginaCambiata("la risposta di Maps non si legge come JSON"); }
  if (!Array.isArray(j)) throw new PaginaCambiata("la risposta di Maps non è una lista");
  const lista = casella(j, ...POSIZIONI.posti);
  if (lista === null) return { aziende: [], posti: 0 };
  if (!Array.isArray(lista)) throw new PaginaCambiata("nel JSON di Maps i posti non sono più alla casella 64");
  const posti = lista.map((x) => casella(x, ...POSIZIONI.posto)).filter(Array.isArray);
  const aziende = posti.map((p) => daPosto(p, citta)).filter((a) => a.nome && a.fonte_id);
  if (posti.length && !aziende.length) throw new PaginaCambiata(`nel JSON di Maps ${posti.length} posti ma nessuno con nome e id: le posizioni sono cambiate`);
  if (aziende.length >= 5 && !aziende.some((a) => a.telefono || a.categoria || a.valutazione !== null)) {
    throw new PaginaCambiata(`nel JSON di Maps ${aziende.length} aziende senza telefono, categoria né voto: le posizioni sono cambiate`);
  }
  return { aziende, posti: posti.length };
}
