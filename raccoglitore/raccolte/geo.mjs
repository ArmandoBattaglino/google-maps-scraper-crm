import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const R = 6371008.8;
const rad = (g) => g * Math.PI / 180;

export function distanza(lat1, lng1, lat2, lng2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
export const centro = (r) => ({ lat: (r.sud + r.nord) / 2, lng: (r.ovest + r.est) / 2 });
export function raggio(r) {
  const c = centro(r);
  return Math.max(distanza(c.lat, c.lng, r.sud, r.ovest), distanza(c.lat, c.lng, r.nord, r.est), distanza(c.lat, c.lng, r.sud, r.est), distanza(c.lat, c.lng, r.nord, r.ovest));
}
export function lato(r) {
  const c = centro(r);
  return Math.min(distanza(r.sud, c.lng, r.nord, c.lng), distanza(c.lat, r.ovest, c.lat, r.est));
}
export const dentroRett = (r, lat, lng) => lat >= r.sud && lat <= r.nord && lng >= r.ovest && lng <= r.est;
export function figli(r) {
  const { lat, lng } = centro(r);
  return [{ sud: r.sud, ovest: r.ovest, nord: lat, est: lng }, { sud: r.sud, ovest: lng, nord: lat, est: r.est },
    { sud: lat, ovest: r.ovest, nord: r.nord, est: lng }, { sud: lat, ovest: lng, nord: r.nord, est: r.est }];
}
export function areaKm2(r) {
  return (R * R * Math.abs(rad(r.est - r.ovest)) * Math.abs(Math.sin(rad(r.nord)) - Math.sin(rad(r.sud)))) / 1e6;
}

function inAnello(a, lat, lng) {
  let dentro = false;
  for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
    const xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
export const inPoligono = (pol, lat, lng) => inAnello(pol[0], lat, lng) && !pol.slice(1).some((b) => inAnello(b, lat, lng));
export function comuneDi(zona, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const c of zona.comuni) {
    const [s, o, n, e] = c.box;
    if (lat < s || lat > n || lng < o || lng > e) continue;
    if (c.poligoni.some((p) => inPoligono(p, lat, lng))) return c;
  }
  return null;
}

function incrocio(ax, ay, bx, by, cx, cy, dx, dy) {
  const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) && o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by);
}
export function toccaZona(zona, r) {
  const angoli = [[r.sud, r.ovest], [r.sud, r.est], [r.nord, r.ovest], [r.nord, r.est], [centro(r).lat, centro(r).lng]];
  const lati = [[r.ovest, r.sud, r.est, r.sud], [r.est, r.sud, r.est, r.nord], [r.est, r.nord, r.ovest, r.nord], [r.ovest, r.nord, r.ovest, r.sud]];
  for (const c of zona.comuni) {
    const [s, o, n, e] = c.box;
    if (r.nord < s || r.sud > n || r.est < o || r.ovest > e) continue;
    for (const pol of c.poligoni) {
      if (angoli.some(([la, ln]) => inPoligono(pol, la, ln))) return true;
      const a = pol[0];
      for (let i = 0; i < a.length; i += 2) if (dentroRett(r, a[i + 1], a[i])) return true;
      for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
        if (lati.some(([x1, y1, x2, y2]) => incrocio(a[j], a[j + 1], a[i], a[i + 1], x1, y1, x2, y2))) return true;
      }
    }
  }
  return false;
}
export function boxZona(zona) {
  let sud = 90, ovest = 180, nord = -90, est = -180;
  for (const c of zona.comuni) { sud = Math.min(sud, c.box[0]); ovest = Math.min(ovest, c.box[1]); nord = Math.max(nord, c.box[2]); est = Math.max(est, c.box[3]); }
  return { sud, ovest, nord, est };
}
export function cellePartenza(zona, km = 5) {
  const b = boxZona(zona), c = centro(b);
  const dLat = km / 111.32, dLng = km / (111.32 * Math.cos(rad(c.lat)));
  const celle = [];
  for (let s = b.sud; s < b.nord; s += dLat) for (let o = b.ovest; o < b.est; o += dLng) {
    const r = { sud: s, ovest: o, nord: Math.min(s + dLat, b.nord + 1e-9), est: Math.min(o + dLng, b.est + 1e-9) };
    if (toccaZona(zona, r)) celle.push(r);
  }
  return celle;
}
export function copertura(zona, rettangoli, punti = 4000) {
  const b = boxZona(zona), passo = Math.sqrt(areaKm2(b) / punti) / 111.32;
  let dentro = 0, coperti = 0;
  for (let la = b.sud + passo / 2; la < b.nord; la += passo) for (let ln = b.ovest + passo / 2; ln < b.est; ln += passo) {
    if (!comuneDi(zona, la, ln)) continue;
    dentro++;
    if (rettangoli.some((r) => dentroRett(r, la, ln))) coperti++;
  }
  return dentro ? coperti / dentro : 0;
}

const CONFINI = path.join(path.dirname(fileURLToPath(import.meta.url)), "confini");
let indice = null;
const leggiIndice = () => (indice ??= JSON.parse(fs.readFileSync(path.join(CONFINI, "indice.json"), "utf8")));
const provincia = (sigla) => JSON.parse(fs.readFileSync(path.join(CONFINI, `${sigla}.json`), "utf8"));
const norma = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function zonaDa(testo) {
  const t = String(testo || "").trim();
  if (!t) throw new Error("zona: un comune («Brescia»), una provincia («provincia di Brescia» o «BS»)");
  const I = leggiIndice();
  const conSigla = /^(.*?)\s*\(([A-Za-z]{2})\)$/.exec(t);
  const perProvincia = /^(provincia|citta metropolitana|citt[aà] metropolitana|cm)\s+(di|del|della|dell')?\s*/i;
  const sigla = /^[A-Za-z]{2}$/.test(t) && I.province[t.toUpperCase()] ? t.toUpperCase() : null;
  const tutta = (s) => { const p = provincia(s); return { nome: `${p.tipo === "Città metropolitana" ? "Città metropolitana di" : "Provincia di"} ${p.nome}`, tipo: "provincia", sigla: s, comuni: p.comuni.map((c) => ({ ...c, sigla: s })) }; };
  if (sigla) return tutta(sigla);
  if (perProvincia.test(norma(t)) || perProvincia.test(t)) {
    const nome = norma(t.replace(perProvincia, ""));
    const s = Object.entries(I.province).find(([, p]) => norma(p.nome) === nome || norma(p.nome).split(" ").includes(nome) && nome.length > 3)?.[0];
    if (!s) throw new Error(`zona: non trovo la provincia «${t}»`);
    return tutta(s);
  }
  const nome = norma(conSigla ? conSigla[1] : t.replace(/^comune\s+(di\s+)?/i, ""));
  const trovati = I.comuni.filter(([n, s]) => norma(n) === nome && (!conSigla || s === conSigla[2].toUpperCase()));
  if (!trovati.length) throw new Error(`zona: non trovo il comune «${t}» (per una provincia: «provincia di …» o la sigla)`);
  if (trovati.length > 1) throw new Error(`zona: «${t}» è il nome di ${trovati.length} comuni: ${trovati.map(([n, s]) => `«${n} (${s})»`).join(", ")}`);
  const [, s, istat] = trovati[0];
  const c = provincia(s).comuni.find((x) => x.istat === istat);
  return { nome: c.nome, tipo: "comune", sigla: s, comuni: [{ ...c, sigla: s }] };
}
