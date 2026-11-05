export class ErroreApi extends Error {
  constructor(stato, message, code = "crm") { super(message); this.stato = stato; this.code = code; }
}

const scrivibile = (schema, tabella, altro = {}) => Object.freeze({ schema, tabella, scrive: true, cancella: "si", ...altro });
const lettura = (schema, tabella, altro = {}) => Object.freeze({ schema, tabella, scrive: false, cancella: "no", ...altro });

export const RISORSE = Object.freeze({
  aziende: scrivibile("app", "aziende", { cancella: "no", q: ["nome"], tag: "azienda", nascoste: true }),
  persone: scrivibile("crm", "persone", { cancella: "ponte", ponte: [], q: ["nome", "email", "telefono"], tag: "persona" }),
  trattative: scrivibile("crm", "trattative", { cancella: "ponte", ponte: ["contatto_id"], q: ["prossimo_passo", "note"], tag: "trattativa" }),
  attivita: scrivibile("crm", "attivita", { cancella: "ponte", ponte: ["attivita_app_id"], q: ["testo"] }),
  tag: scrivibile("crm", "tag", { q: ["nome"] }),
  tag_su: scrivibile("crm", "tag_su"),
  schede_aziende: scrivibile("crm", "schede_aziende", { chiave: "azienda_id" }),
  viste: scrivibile("crm", "viste", { q: ["nome"] }),
  modelli_messaggi: scrivibile("crm", "modelli_messaggi", { q: ["nome"] }),
  campi_definizioni: scrivibile("crm", "campi_definizioni", { cancella: "no", q: ["etichetta", "chiave"] }),
  fasi: lettura("crm", "fasi", { q: ["nome"] }),
  soci: lettura("app", "soci", { chiave: "email", q: ["email", "nome"] }),
  fasi_lead: lettura("app", "fasi_lead", { q: ["nome"] }),
  percorsi: lettura("app", "percorsi", { q: ["nome"] }),
  contatti: lettura("app", "contatti", { q: ["nome", "email", "telefono"] }),
  impostazioni: lettura("crm", "impostazioni", { chiave: "chiave" }),
});

const PROTETTE = new Set(["id", "creato", "creato_da", "aggiornato", "origine", "ponte_il", "archiviata_il", "contatto_id",
  "attivita_app_id", "mossa_il", "telefono_norm"]);
const PARAMETRI = new Set(["_start", "_end", "_sort", "_order", "q", "range", "sort", "filter"]);
const OPERATORI = new Set(["eq", "in", "ilike", "gte", "lte", "is"]);
const SUFFISSI = { _gte: "gte", _lte: "lte", _like: "ilike" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TESTO = /^(text|character varying|character|citext)\b/;
const ORDINABILE = /^(smallint|integer|bigint|numeric|real|double precision|date|timestamp|time)\b/;
export const FINESTRA = 1000;
export const q = (nome) => `"${nome}"`;

export const NON_AZIENDA = "non-azienda";
export const TUTTE_LE_ETICHETTE = "tutte";
const SENZA_REGOLA = process.env.CRM_CONTROPROVA === "mostra-non-aziende";
export const pertinente = (alias = "") => (SENZA_REGOLA ? "true" : `${alias ? `${alias}.` : ""}"dati" ->> 'etichetta' is distinct from '${NON_AZIENDA}'`);
const corto = (s, n = 80) => String(s).slice(0, n);

function jsonParam(nome, v) {
  try { return JSON.parse(v); } catch { throw new ErroreApi(400, `${nome}: serve JSON`, "parametro"); }
}
function intero(nome, v) {
  const n = typeof v === "number" ? v : (/^\d{1,9}$/.test(String(v)) ? Number(v) : NaN);
  if (!Number.isInteger(n) || n < 0) throw new ErroreApi(400, `${nome}: serve un intero ≥ 0`, "parametro");
  return n;
}
const semplice = (x) => x !== null && x !== undefined && typeof x !== "object";

export function regole(catalogo) {
  const risorsa = (nome) => {
    if (typeof nome !== "string" || !Object.hasOwn(RISORSE, nome)) throw new ErroreApi(400, `risorsa fuori lista: ${corto(nome)}`, "risorsa");
    const cols = catalogo.get(nome);
    if (!cols) throw new ErroreApi(404, `${nome}: non ancora disponibile`, "risorsa");
    const r = RISORSE[nome];
    return { nome, ...r, chiave: r.chiave || "id", cols, tab: `${q(r.schema)}.${q(r.tabella)}` };
  };
  const nomeColonna = (R, nome) => (nome === "id" && !R.cols.has("id") ? R.chiave : nome);
  const colonna = (R, nome) => {
    const n = typeof nome === "string" ? nomeColonna(R, nome) : nome;
    if (typeof n !== "string" || !R.cols.has(n)) throw new ErroreApi(400, `colonna fuori lista: ${R.nome}.${corto(nome)}`, "colonna");
    return [n, R.cols.get(n)];
  };
  const idValido = (R, id) => {
    if (typeof id !== "string" || !id || id.length > 320) throw new ErroreApi(400, "id non valido", "valore");
    if (R.cols.get(R.chiave).tipo === "uuid" && !UUID.test(id)) throw new ErroreApi(400, "id non valido", "valore");
    return id;
  };

  function valore(info, v, nome) {
    if (v === null || v === undefined) return null;
    if (info.json) return JSON.stringify(v);
    if (info.array) {
      if (!Array.isArray(v) || v.some((x) => x !== null && typeof x === "object")) throw new ErroreApi(400, `${nome}: serve un elenco di valori`, "valore");
      return v;
    }
    if (typeof v === "object") throw new ErroreApi(400, `${nome}: valore non ammesso`, "valore");
    return v;
  }

  function chiaveFiltro(R, k) {
    if (typeof k !== "string" || k.length > 120) throw new ErroreApi(400, "filtro non valido", "parametro");
    const chiocciola = k.indexOf("@");
    if (chiocciola > 0) {
      const op = k.slice(chiocciola + 1);
      const [n] = colonna(R, k.slice(0, chiocciola));
      if (!OPERATORI.has(op)) throw new ErroreApi(400, `operatore fuori lista: ${R.nome}.${n}@${corto(op, 20)}`, "operatore");
      return [n, op];
    }
    if (R.cols.has(nomeColonna(R, k))) return [nomeColonna(R, k), "eq"];
    const m = /^(.+)(_gte|_lte|_like)$/.exec(k);
    if (m && R.cols.has(nomeColonna(R, m[1]))) return [nomeColonna(R, m[1]), SUFFISSI[m[2]]];
    return colonna(R, k);
  }

  function filtro(R, k, v, params, filtri) {
    if (k === "q") {
      if (typeof v !== "string" || v.length > 200) throw new ErroreApi(400, "q: testo fino a 200 caratteri", "parametro");
      if (!v.trim()) return;
      const dove = (R.q || []).filter((c) => R.cols.has(c));
      if (!dove.length) throw new ErroreApi(400, `q: ricerca testo non ammessa su ${R.nome}`, "parametro");
      params.push(`%${v.trim().replace(/[\\%_]/g, (c) => "\\" + c)}%`);
      filtri.push("(" + dove.map((c) => `${q(c)}::text ilike $${params.length}`).join(" or ") + ")");
      return;
    }
    if (k === "tag" && R.tag) {
      const valori = Array.isArray(v) ? v : [v];
      if (valori.length > 50 || !valori.every((x) => typeof x === "string" && UUID.test(x))) throw new ErroreApi(400, "tag: serve l'id di un tag", "valore");
      params.push(valori, R.tag);
      filtri.push(`${q(R.chiave)} in (select "oggetto_id" from "crm"."tag_su" where "tag_id" = any($${params.length - 1}::uuid[]) and "oggetto" = $${params.length})`);
      return;
    }
    if (k === "etichetta" && R.nascoste) {
      if (typeof v !== "string" || v.length > 40) throw new ErroreApi(400, "etichetta: serve un valore", "valore");
      if (v === TUTTE_LE_ETICHETTE) return;
      params.push(v);
      filtri.push(`"dati" ->> 'etichetta' = $${params.length}`);
      return;
    }
    const [n, op] = chiaveFiltro(R, k);
    const info = R.cols.get(n);
    const nomeFiltro = `${R.nome}.${n}@${op}`;
    if (op === "is") {
      if (v !== null && v !== "null" && v !== "notnull") throw new ErroreApi(400, `${nomeFiltro}: vuole null o notnull`, "valore");
      filtri.push(`${q(n)} is ${v === "notnull" ? "not null" : "null"}`);
      return;
    }
    if (info.json || info.array) throw new ErroreApi(400, `filtro non ammesso su ${R.nome}.${n}`, "parametro");
    if (op === "ilike") {
      if (!TESTO.test(info.tipo)) throw new ErroreApi(400, `ilike solo su colonne di testo: ${R.nome}.${n}`, "operatore");
      if (typeof v !== "string" || v.length > 200) throw new ErroreApi(400, `${nomeFiltro}: testo fino a 200 caratteri`, "valore");
      params.push(`%${v.replace(/[\\%_]/g, (c) => "\\" + c)}%`);
      filtri.push(`${q(n)} ilike $${params.length}`);
      return;
    }
    if (op === "gte" || op === "lte") {
      if (!ORDINABILE.test(info.tipo)) throw new ErroreApi(400, `${op} solo su date e numeri: ${R.nome}.${n}`, "operatore");
      if (!semplice(v) || String(v).length > 64) throw new ErroreApi(400, `${nomeFiltro}: valore non ammesso`, "valore");
      params.push(String(v));
      filtri.push(`${q(n)} ${op === "gte" ? ">=" : "<="} $${params.length}::${info.tipo}`);
      return;
    }
    const valori = Array.isArray(v) ? v : [v];
    if (op === "in" && !Array.isArray(v) && typeof v === "string") valori.splice(0, 1, ...v.split(","));
    if (!valori.length || valori.length > FINESTRA || !valori.every(semplice) || valori.some((x) => String(x).length > 320)) {
      throw new ErroreApi(400, `${nomeFiltro}: valori non ammessi`, "valore");
    }
    if (n === R.chiave) valori.forEach((x) => idValido(R, String(x)));
    params.push(valori.map(String));
    filtri.push(`${q(n)} = any($${params.length}::${info.tipo}[])`);
  }

  function leggiElenco(R, cerca, params) {
    const filtri = [];
    let start = 0, end = null, sort = R.chiave, ordine = "ASC", soloChiave = false, etichettaScelta = false;
    for (const k of new Set(cerca.keys())) {
      const tutti = cerca.getAll(k);
      if (!PARAMETRI.has(k)) {
        if (nomeColonna(R, k) === R.chiave) soloChiave = true;
        if (k === "etichetta") etichettaScelta = true;
        filtro(R, k, tutti.length > 1 ? tutti : tutti[0], params, filtri);
        continue;
      }
      if (tutti.length !== 1) throw new ErroreApi(400, `parametro ripetuto: ${k}`, "parametro");
      const v = tutti[0];
      switch (k) {
        case "_start": start = intero("_start", v); break;
        case "_end": end = intero("_end", v); break;
        case "_sort": sort = v; break;
        case "_order": ordine = v; break;
        case "q": filtro(R, "q", v, params, filtri); break;
        case "range": {
          const r = jsonParam("range", v);
          if (!Array.isArray(r) || r.length !== 2) throw new ErroreApi(400, "range: serve [primo, ultimo]", "parametro");
          start = intero("range", r[0]); end = intero("range", r[1]) + 1;
          break;
        }
        case "sort": {
          const s = jsonParam("sort", v);
          if (!Array.isArray(s) || s.length !== 2) throw new ErroreApi(400, "sort: serve [colonna, ASC|DESC]", "parametro");
          [sort, ordine] = s;
          break;
        }
        case "filter": {
          const f = jsonParam("filter", v);
          if (!f || typeof f !== "object" || Array.isArray(f)) throw new ErroreApi(400, "filter: serve un oggetto", "parametro");
          for (const [fk, x] of Object.entries(f)) {
            if (fk !== "q" && nomeColonna(R, fk) === R.chiave) soloChiave = true;
            if (fk === "etichetta") etichettaScelta = true;
            filtro(R, fk, x, params, filtri);
          }
          break;
        }
      }
    }
    if (R.nascoste && !soloChiave && !etichettaScelta) filtri.push(pertinente());
    const [col, info] = colonna(R, sort);
    if (info.json || info.array) throw new ErroreApi(400, `ordine non ammesso su ${R.nome}.${col}`, "parametro");
    const dir = String(ordine).toUpperCase();
    if (dir !== "ASC" && dir !== "DESC") throw new ErroreApi(400, `ordine fuori lista: ${corto(ordine, 20)}`, "parametro");
    if (end === null) end = start + (soloChiave ? FINESTRA : 25);
    if (end <= start || end - start > FINESTRA) throw new ErroreApi(400, `finestra fuori lista (1-${FINESTRA} righe)`, "parametro");
    return {
      where: filtri.length ? " where " + filtri.join(" and ") : "",
      order: ` order by ${q(col)} ${dir}${col === R.chiave ? "" : `, ${q(R.chiave)} asc`}`,
      start, end,
    };
  }

  function leggiCorpo(R, corpo, { aggiorna = false } = {}) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroreApi(400, "il corpo è un oggetto", "valore");
    const coppie = [];
    for (const [k, v] of Object.entries(corpo)) {
      if (k === "id" && !R.cols.has("id")) continue;
      const [n, info] = colonna(R, k);
      if (PROTETTE.has(n) || info.generata || (aggiorna && n === R.chiave)) continue;
      coppie.push([n, valore(info, v, n)]);
    }
    return coppie;
  }

  function ponte(R) {
    if (R.cancella !== "ponte") return null;
    const pezzi = [];
    if (R.cols.has("origine")) pezzi.push(`${q("origine")} = 'app'`);
    for (const c of R.ponte || []) if (R.cols.has(c)) pezzi.push(`${q(c)} is not null`);
    return pezzi.length ? `(${pezzi.join(" or ")})` : null;
  }

  const fuori = (R) => (riga) => (R.cols.has("id") || !riga ? riga : { id: riga[R.chiave], ...riga });

  return { risorsa, colonna, idValido, leggiElenco, leggiCorpo, ponte, fuori };
}
