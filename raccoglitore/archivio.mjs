import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

const TABELLE = new Set(["soci", "raccolte", "raccolte_celle", "liste_freddo", "aziende", "aziende_chiavi", "liste_aziende", "aziende_provenienze"]);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL || 4),
  idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, application_name: "raccoglitore" });
pool.on("error", (e) => console.error(`db: ${e.message}`));

async function sessione(email, fn) {
  const c = await pool.connect();
  let rotta = false;
  try {
    await c.query("begin");
    await c.query("set local statement_timeout = '20s'");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ email: String(email || "").toLowerCase(), role: "authenticated" })]);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    try { await c.query("rollback"); } catch { rotta = true; }
    throw e;
  } finally { c.release(rotta); }
}

let catalogo = null;
async function tabella(nome) {
  catalogo ??= pool.query(`
      select c.relname as tabella, a.attname as colonna, t.typcategory = 'A' as array,
             a.atttypid in ('json'::regtype, 'jsonb'::regtype) as json,
             exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary and a.attnum = any(i.indkey)) as pk
        from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
        join pg_type t on t.oid = a.atttypid
       where n.nspname = 'app' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped and c.relname = any($1)
       order by c.relname, a.attnum`, [[...TABELLE]]).then(({ rows }) => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.tabella)) m.set(r.tabella, { nome: r.tabella, colonne: new Map(), pk: [] });
      m.get(r.tabella).colonne.set(r.colonna, r);
      if (r.pk) m.get(r.tabella).pk.push(r.colonna);
    }
    return m;
  }).catch((e) => { catalogo = null; throw e; });
  const t = TABELLE.has(nome) && (await catalogo).get(nome);
  if (!t) throw new Error(`tabella «${nome}» fuori lista`);
  return t;
}
const ID = /^[a-z_][a-z0-9_]*$/;
function colonna(t, c) {
  if (!ID.test(c) || !t.colonne.has(c)) throw new Error(`colonna «${c}» non c'è in ${t.nome}`);
  return `"${c}"`;
}

function elenco(s) {
  const fuori = []; let cur = "", q = false, p = 0;
  for (const ch of s) {
    if (ch === '"') q = !q;
    else if (!q && ch === "(") p++;
    else if (!q && ch === ")") p--;
    if (ch === "," && !q && !p) { fuori.push(cur); cur = ""; } else cur += ch;
  }
  if (cur || fuori.length) fuori.push(cur);
  return fuori.map((x) => x.trim());
}
const senzaVirgolette = (x) => x.startsWith('"') && x.endsWith('"') ? x.slice(1, -1) : x;

function condizione(t, col, espr, par) {
  const m = /^(not\.)?(eq|neq|ilike|cs|in|is)\.([\s\S]*)$/.exec(espr);
  if (!m) throw new Error(`filtro non previsto: ${col}=${espr.slice(0, 40)}`);
  const [, no, op, v] = m, c = colonna(t, col), info = t.colonne.get(col);
  const p = (x) => { par.push(x); return `$${par.length}`; };
  let s;
  if (op === "eq") s = `${c} = ${p(v)}`;
  else if (op === "neq") s = `${c} <> ${p(v)}`;
  else if (op === "ilike") s = `${c}::text ilike ${p(v.replace(/\*/g, "%"))}`;
  else if (op === "in") s = `${c} = any(${p(elenco(v.replace(/^\(|\)$/g, "")).map(senzaVirgolette))})`;
  else if (op === "cs") s = info.json ? `${c} @> ${p(v)}::jsonb` : `${c} @> ${p(v)}`;
  else {
    const k = { null: "null", true: "true", false: "false" }[v.toLowerCase()];
    if (!k) throw new Error(`is.${v} non previsto`);
    s = `${c} is ${k}`;
  }
  return no ? `not (${s})` : s;
}

function analizza(t, query, par) {
  let colonne = "*", ordine = "", limite = "";
  const dove = [];
  for (const [k, v] of new URLSearchParams(query)) {
    if (k === "select") colonne = v.trim() === "*" ? "*" : v.split(",").map((x) => colonna(t, x.trim())).join(", ");
    else if (k === "order") ordine = " order by " + v.split(",").map((o) => {
      const [c, verso = "asc", nulli] = o.trim().split(".");
      if (!["asc", "desc"].includes(verso) || (nulli && !["nullsfirst", "nullslast"].includes(nulli))) throw new Error(`order non previsto: ${o}`);
      return `${colonna(t, c)} ${verso}${nulli ? ` nulls ${nulli.slice(5)}` : ""}`;
    }).join(", ");
    else if (k === "limit") { if (!/^\d{1,5}$/.test(v)) throw new Error("limit non valido"); limite = ` limit ${Number(v)}`; }
    else if (k === "or") dove.push(`(${elenco(v.replace(/^\(|\)$/g, "")).map((x) => {
      const i = x.indexOf("."); return condizione(t, x.slice(0, i), x.slice(i + 1), par);
    }).join(" or ")})`);
    else dove.push(condizione(t, k, v, par));
  }
  return { colonne, dove, ordine, limite };
}

const valore = (info, v) => v == null ? null : info.json ? JSON.stringify(v) : v;
const comeJson = (rows) => JSON.parse(JSON.stringify(rows));

export async function rest(metodo, percorso, corpo, extra = {}, email) {
  const [nome, query = ""] = String(percorso).split("?");
  const t = await tabella(nome), par = [], prefer = String(extra.Prefer || extra.prefer || "");
  const { colonne, dove, ordine, limite } = analizza(t, query, par);
  const where = dove.length ? ` where ${dove.join(" and ")}` : "";
  const ritorno = /return=minimal/.test(prefer) ? "" : " returning *";
  let sql;
  if (metodo === "GET") sql = `select ${colonne} from app."${t.nome}"${where}${ordine}${limite}`;
  else if (metodo === "POST") {
    const righe = Array.isArray(corpo) ? corpo : [corpo];
    if (!righe.length || righe.some((r) => !r || typeof r !== "object")) throw new Error("POST senza righe");
    const nomi = [...new Set(righe.flatMap(Object.keys))];
    const cols = nomi.map((c) => colonna(t, c));
    const valori = righe.map((r) => `(${nomi.map((c) => {
      if (!(c in r)) return "default";
      par.push(valore(t.colonne.get(c), r[c])); return `$${par.length}`;
    }).join(", ")})`).join(", ");
    let conflitto = "";
    if (/resolution=merge-duplicates/.test(prefer)) {
      const resto = nomi.filter((c) => !t.pk.includes(c));
      conflitto = ` on conflict (${t.pk.map((c) => `"${c}"`).join(", ")}) do ${resto.length ? `update set ${resto.map((c) => `"${c}" = excluded."${c}"`).join(", ")}` : "nothing"}`;
    } else if (/resolution=ignore-duplicates/.test(prefer)) conflitto = ` on conflict do nothing`;
    sql = `insert into app."${t.nome}" (${cols.join(", ")}) values ${valori}${conflitto}${ritorno}`;
  } else if (metodo === "PATCH" || metodo === "DELETE") {
    if (!dove.length) throw new Error(`${metodo} senza filtri: no`);
    if (metodo === "DELETE") sql = `delete from app."${t.nome}"${where}${ritorno}`;
    else {
      const set = Object.entries(corpo || {}).map(([c, v]) => { const k = colonna(t, c); par.push(valore(t.colonne.get(c), v)); return `${k} = $${par.length}`; });
      if (!set.length) throw new Error("PATCH senza campi");
      sql = `update app."${t.nome}" set ${set.join(", ")}${where}${ritorno}`;
    }
  } else throw new Error(`metodo non previsto: ${metodo}`);
  const r = await sessione(email, (c) => c.query(sql, par));
  return ritorno || metodo === "GET" ? comeJson(r.rows) : null;
}

export async function sql(query, email) {
  const r = await sessione(email, (c) => c.query(String(query).replace(/table_schema\s*=\s*'public'/g, "table_schema = 'app'")));
  return comeJson(Array.isArray(r) ? r.flatMap((x) => x.rows) : r.rows);
}

export async function query(testo, parametri, email) {
  return comeJson((await sessione(email, (c) => c.query(String(testo), parametri || []))).rows);
}

export const chiudi = () => pool.end();

const richiesta = new AsyncLocalStorage();
export const conChi = (email, fn) => richiesta.run({ email }, fn);
export const chi = () => richiesta.getStore()?.email || "raccoglitore";
export const leggi = (tabella, q = "select=*") => rest("GET", `${tabella}?${q}`, undefined, {}, chi());
export const inserisci = async (tabella, riga) => (await rest("POST", tabella, { creato_da: chi(), ...riga }, { Prefer: "return=representation" }, chi()))[0];
export const aggiorna = async (tabella, id, modifica) => (await rest("PATCH", `${tabella}?id=eq.${encodeURIComponent(id)}`, modifica, { Prefer: "return=representation" }, chi()))[0];
