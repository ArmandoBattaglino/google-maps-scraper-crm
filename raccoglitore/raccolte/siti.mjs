const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const MAX = 1_500_000;
const EMAIL = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const UNA_EMAIL = /^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/;
const FINTE = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(example|esempio|domain|dominio|sentry|wixpress|sentry-next)\.|^(nome|name|tuo|your|email|mail|info@example)/i;
const PIVA = /(?:p\.?\s*iva|partita\s+iva|vat(?:\s+number)?|c\.?\s*f\.?\s*(?:e|\/)\s*p\.?\s*iva)[^0-9]{0,25}(?:it\s?)?(\d{11})\b/i;

async function scarica(url, segnale) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  const via = () => ctl.abort();
  segnale?.addEventListener("abort", via, { once: true });
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "it-IT,it;q=0.9" } });
    if (!r.ok || !/text\/html|application\/xhtml/i.test(r.headers.get("content-type") || "")) return null;
    const lettore = r.body.getReader(); const pezzi = []; let n = 0;
    for (;;) { const { done, value } = await lettore.read(); if (done) break; n += value.length; if (n > MAX) { ctl.abort(); break; } pezzi.push(value); }
    return { html: Buffer.concat(pezzi).toString("utf8"), url: r.url };
  } catch { return null; }
  finally { clearTimeout(t); segnale?.removeEventListener("abort", via); }
}

const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const sciogli = (html) => html.replace(/&#0*64;|&#x0*40;/gi, "@").replace(/&#0*46;|&#x0*2e;/gi, ".").replace(/\s*[[(]\s*(at|chiocciola)\s*[\])]\s*/gi, "@").replace(/\s*[[(]\s*(dot|punto)\s*[\])]\s*/gi, ".");

export function analizza(html, url) {
  const testo = sciogli(String(html || ""));
  const mailto = [...testo.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]));
  const tutte = [...new Set([...mailto, ...(testo.match(EMAIL) || [])].map((e) => e.toLowerCase().replace(/^[^a-z0-9]+|[^a-z]+$/g, "")).filter((e) => UNA_EMAIL.test(e) && !FINTE.test(e)))];
  const qui = dominio(url);
  const piva = PIVA.exec(testo.replace(/<[^>]+>/g, " "))?.[1] || "";
  const contatti = [...testo.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)]
    .filter(([, href, dentro]) => /contatt|contact|chi-siamo|dove-siamo|about/i.test(href + " " + dentro))
    .map(([, href]) => { try { return new URL(href, url).href; } catch { return null; } })
    .filter((h) => h && /^https?:/.test(h) && dominio(h) === qui);
  return { email: tutte, piva, contatti: [...new Set(contatti)].slice(0, 2) };
}

export function scegli(tutte, url) {
  const qui = dominio(url);
  const pec = tutte.find((e) => /pec|legalmail|arubapec|postacert/.test(e)) || "";
  const normali = tutte.filter((e) => e !== pec);
  const punti = (e) => (dominio("http://" + e.split("@")[1]) === qui ? 0 : 10) + (/^(info|commerciale|amministrazione|contatti|ufficio|segreteria|vendite|sales)@/.test(e) ? 0 : 3);
  const email = [...normali].sort((a, b) => punti(a) - punti(b))[0] || "";
  return { email, pec };
}

export async function leggiSito(url, { segnale } = {}) {
  let u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) return { errore: "nessun sito" };
  const prima = await scarica(u, segnale);
  if (!prima) return { errore: "il sito non risponde" };
  let { email, piva, contatti } = analizza(prima.html, prima.url);
  let pagine = 1;
  for (const c of email.length ? [] : contatti) {
    if (segnale?.aborted) break;
    const p = await scarica(c, segnale);
    pagine++;
    if (!p) continue;
    const a = analizza(p.html, p.url);
    email = [...new Set([...email, ...a.email])];
    piva ||= a.piva;
    if (email.length) break;
  }
  const s = scegli(email, prima.url);
  return { ...s, email_tutte: email.slice(0, 8), piva, pagine };
}
