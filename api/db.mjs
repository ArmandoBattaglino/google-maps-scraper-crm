import pg from "pg";
import { RISORSE } from "./regole.mjs";

export const SOCIO_SQL = "select current_user = 'authenticated' and app.e_socio() as ok";

const CONTROPROVA = process.env.CRM_CONTROPROVA || "";
if (CONTROPROVA && !["senza-claims", "senza-ruolo", "senza-eventi", "mostra-non-aziende"].includes(CONTROPROVA)) throw new Error("CRM_CONTROPROVA sconosciuta");
if (CONTROPROVA) console.error(`⚠️ controprova attiva: ${CONTROPROVA} (solo per le prove)`);

export function creaDb(connectionString) {
  const pool = new pg.Pool({ connectionString, max: Number(process.env.DB_POOL || 10), idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000, application_name: "crm" });
  pool.on("error", (e) => console.error(`db: ${e.message}`));

  async function conLaSessione(email, fn) {
    const c = await pool.connect();
    let rotta = false;
    try {
      await c.query("begin");
      await c.query("set local statement_timeout = '20s'");
      if (CONTROPROVA !== "senza-ruolo") await c.query("set local role authenticated");
      if (CONTROPROVA !== "senza-claims") {
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ email, role: "authenticated" })]);
      }
      const r = await fn(c);
      await c.query("commit");
      return r;
    } catch (e) {
      try { await c.query("rollback"); } catch { rotta = true; }
      throw e;
    } finally {
      c.release(rotta);
    }
  }

  async function catalogo() {
    const voci = Object.entries(RISORSE);
    const { rows } = await pool.query(`
      select n.nspname as schema, c.relname as tabella, a.attname as colonna, format_type(a.atttypid, a.atttypmod) as tipo,
             t.typcategory = 'A' as array, a.atttypid in ('json'::regtype, 'jsonb'::regtype) as json, a.attgenerated <> '' as generata,
             exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary and a.attnum = any(i.indkey)) as pk
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_type t on t.oid = a.atttypid
       where c.relkind in ('r', 'p', 'v') and a.attnum > 0 and not a.attisdropped
         and (n.nspname || '.' || c.relname) = any($1)
       order by n.nspname, c.relname, a.attnum`, [voci.map(([, r]) => `${r.schema}.${r.tabella}`)]);
    const m = new Map();
    for (const r of rows) {
      for (const [nome, v] of voci) {
        if (v.schema !== r.schema || v.tabella !== r.tabella) continue;
        if (!m.has(nome)) m.set(nome, new Map());
        m.get(nome).set(r.colonna, { tipo: r.tipo, json: r.json, array: r.array, pk: r.pk, generata: r.generata });
      }
    }
    const mancano = voci.filter(([nome, v]) => !m.has(nome) && !v.facoltativa).map(([, v]) => `${v.schema}.${v.tabella}`);
    if (mancano.length) throw new Error(`schema incompleto, mancano: ${mancano.join(", ")}`);
    for (const [nome, cols] of m) {
      const k = RISORSE[nome].chiave || "id";
      if (!cols.has(k)) throw new Error(`${nome}: manca la chiave «${k}»`);
    }
    return m;
  }

  return { pool, conLaSessione, catalogo };
}
