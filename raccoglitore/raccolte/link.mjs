const GOOGLE = /(^|\.)google\.[a-z.]+$/i;
const testo = (v) => typeof v === "string" ? v.trim().slice(0, 2000) : "";

export function classificaSito(link, profondita = 0) {
  const grezzo = testo(link);
  if (!grezzo) return { sito: "", tipo: "", grezzo: "" };
  let u;
  try { u = new URL(grezzo); } catch { return { sito: "", tipo: "altro", grezzo }; }
  if (!/^https?:$/.test(u.protocol)) return { sito: "", tipo: "altro", grezzo };
  const host = u.hostname.toLowerCase();
  if (GOOGLE.test(host) && /^\/url$/.test(u.pathname) && profondita < 2) {
    const dentro = u.searchParams.get("q") || u.searchParams.get("url") || "";
    const x = classificaSito(dentro, profondita + 1);
    return x.sito ? { sito: x.sito, tipo: x.tipo === "diretto" ? "rimando" : x.tipo, grezzo } : { sito: "", tipo: "rimando", grezzo };
  }
  if (host === "sites.google.com") return { sito: grezzo, tipo: "google-sites", grezzo };
  if (host.endsWith(".business.site")) return { sito: grezzo, tipo: "business-site", grezzo };
  if (host === "g.page" || host === "maps.app.goo.gl" || (host === "goo.gl" && u.pathname.startsWith("/maps")) || (GOOGLE.test(host) && /^\/maps\b/.test(u.pathname) && !/\/reserve\b/.test(u.pathname)))
    return { sito: "", tipo: "scheda-maps", grezzo };
  if (GOOGLE.test(host) && /\/reserve\b/.test(u.pathname)) return { sito: "", tipo: "prenota-google", grezzo };
  if (GOOGLE.test(host)) return { sito: "", tipo: "google-altro", grezzo };
  const h = host.replace(/^(www|m|it|l)\./, "");
  if (h === "wa.me" || h === "api.whatsapp.com" || h === "whatsapp.com" || h === "wa.link") return { sito: "", tipo: "whatsapp", grezzo };
  if (/^(facebook\.com|fb\.com|fb\.me|instagram\.com|linkedin\.com|tiktok\.com|youtube\.com|x\.com|twitter\.com)$/.test(h)) return { sito: "", tipo: "social", grezzo };
  if (/^(linktr\.ee|linkin\.bio|beacons\.ai|bio\.link|taplink\.cc)$/.test(h)) return { sito: "", tipo: "link-in-bio", grezzo };
  return { sito: grezzo.slice(0, 500), tipo: "diretto", grezzo };
}

export const datiSito = (c) => c.tipo ? { sito_tipo: c.tipo, ...(c.grezzo && c.grezzo !== c.sito ? { sito_grezzo: c.grezzo.slice(0, 1000) } : {}) } : {};
