import { SOCIO_SQL } from "./db.mjs";
import { ErroreApi, regole, q } from "./regole.mjs";
import { motivoCampi } from "./campi.mjs";

export { ErroreApi };

export function creaDati({ conLaSessione, catalogo }) {
  const { risorsa, idValido, leggiElenco, leggiCorpo, ponte, fuori } = regole(catalogo);

  const scrivi = (email, fn) => conLaSessione(email, async (c) => {
    if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "solo gli utenti scrivono nel CRM", "socio");
    return fn(c);
  });

  return async function dati({ metodo, risorsa: nome, id, azione, cerca, corpo, email }) {
    const R = risorsa(nome);
    const esci = fuori(R);
    const params = [];
    const chiave = q(R.chiave);
    if ((metodo !== "GET" && metodo !== "HEAD") && !R.scrive) throw new ErroreApi(405, `${R.nome}: in sola lettura`, "metodo");

    if (id === undefined) {
      if (metodo === "GET") {
        const { where, order, start, end } = leggiElenco(R, cerca, params);
        const { totale, righe } = await conLaSessione(email, async (c) => {
          const n = (await c.query(`select count(*)::bigint as n from ${R.tab}${where}`, params)).rows[0].n;
          const r = await c.query(`select * from ${R.tab}${where}${order} limit ${end - start} offset ${start}`, params);
          return { totale: Number(n), righe: r.rows };
        });
        const fine = righe.length ? `${start}-${start + righe.length - 1}` : "*";
        return { stato: 200, corpo: righe.map(esci), intestazioni: {
          "X-Total-Count": String(totale), "Content-Range": `${R.nome} ${fine}/${totale}`,
          "Access-Control-Expose-Headers": "X-Total-Count, Content-Range" } };
      }
      if (metodo === "POST") {
        if ([...cerca.keys()].length) throw new ErroreApi(400, "parametro fuori lista", "parametro");
        const coppie = leggiCorpo(R, corpo);
        const sql = coppie.length
          ? `insert into ${R.tab} (${coppie.map(([k]) => q(k)).join(", ")}) values (${coppie.map(([, v]) => { params.push(v); return `$${params.length}`; }).join(", ")}) returning *`
          : `insert into ${R.tab} default values returning *`;
        const r = await scrivi(email, (c) => c.query(sql, params));
        return { stato: 201, corpo: esci(r.rows[0]) };
      }
      throw new ErroreApi(405, "metodo non ammesso", "metodo");
    }

    idValido(R, id);
    if ([...cerca.keys()].length) throw new ErroreApi(400, "parametro fuori lista", "parametro");

    if (azione !== undefined) {
      if (azione !== "archivia" && azione !== "riprendi") throw new ErroreApi(404, "non trovato");
      if (metodo !== "POST") throw new ErroreApi(405, "metodo non ammesso", "metodo");
      if (!R.cols.has("archiviata_il")) throw new ErroreApi(405, `${R.nome}: non si archivia`, "metodo");
      const nuovo = azione === "riprendi" ? "null" : `coalesce("archiviata_il", now())`;
      const r = await scrivi(email, (c) => c.query(
        `update ${R.tab} set "archiviata_il" = ${nuovo} where ${chiave} = $1 returning *`, [id]));
      if (!r.rows.length) throw new ErroreApi(404, "non trovato");
      return { stato: 200, corpo: esci(r.rows[0]) };
    }

    if (metodo === "GET") {
      const r = await conLaSessione(email, (c) => c.query(`select * from ${R.tab} where ${chiave} = $1`, [id]));
      if (!r.rows.length) throw new ErroreApi(404, "non trovato");
      return { stato: 200, corpo: esci(r.rows[0]) };
    }
    if (metodo === "PUT" || metodo === "PATCH") {
      const coppie = leggiCorpo(R, corpo, { aggiorna: true });
      const set = coppie.map(([k, v]) => { params.push(v); return `${q(k)} = $${params.length}`; });
      if (set.length && R.cols.has("aggiornato")) set.push(`"aggiornato" = now()`);
      params.push(id);
      const sql = set.length
        ? `update ${R.tab} set ${set.join(", ")} where ${chiave} = $${params.length} returning *`
        : `select * from ${R.tab} where ${chiave} = $${params.length}`;
      const r = await scrivi(email, (c) => c.query(sql, params));
      if (!r.rows.length) throw new ErroreApi(404, "non trovato");
      return { stato: 200, corpo: esci(r.rows[0]) };
    }
    if (metodo === "DELETE") {
      if (R.cancella === "no") throw new ErroreApi(405, `${R.nome}: non si cancella da qui`, "metodo");
      if (R.nome === "attivita") {
        const tolta = await scrivi(email, (c) => eliminaAttivita(c, id));
        if (!tolta) throw new ErroreApi(404, "non trovato");
        return { stato: 200, corpo: esci(tolta) };
      }
      const legata = ponte(R);
      const r = await scrivi(email, async (c) => {
        const tolta = await c.query(`delete from ${R.tab} where ${chiave} = $1${legata ? ` and not ${legata}` : ""} returning *`, [id]);
        if (tolta.rows.length || !legata) return tolta;
        const c2 = await c.query(`select ${legata} as ponte from ${R.tab} where ${chiave} = $1`, [id]);
        if (c2.rows[0]?.ponte) {
          throw new ErroreApi(409, R.cols.has("archiviata_il")
            ? `${R.nome}: questa riga non si cancella, si archivia (POST …/${R.nome}/<id>/archivia)`
            : `${R.nome}: questa riga non si cancella`, "ponte");
        }
        return tolta;
      });
      if (!r.rows.length) throw new ErroreApi(404, "non trovato");
      return { stato: 200, corpo: esci(r.rows[0]) };
    }
    throw new ErroreApi(405, "metodo non ammesso", "metodo");
  };
}

const eliminaAttivita = async (c, id) => {
  await c.query("select set_config('crm.ponte', 'crm', true)");
  const a = (await c.query("delete from crm.attivita where id = $1 returning *", [id])).rows[0];
  if (a?.attivita_app_id) await c.query("delete from app.attivita where id = $1", [a.attivita_app_id]);
  if (a?.tipo === "chiamata" && !a.trattativa_id && a.azienda_id) {
    const ultima = `from crm.attivita x where x.azienda_id = z.id and x.tipo = 'chiamata' and x.trattativa_id is null`;
    const conEsito = `${ultima} and x.esito_azienda is not null order by x.quando desc, x.aggiornato desc limit 1`;
    await c.query(
      `update app.aziende z set
         tentativi = greatest(z.tentativi - 1, 0),
         esito = coalesce((select x.esito_azienda ${conEsito}), 'da-chiamare'),
         richiamare_il = (select case when x.esito_azienda = 'richiamare' then x.scadenza end ${conEsito}),
         ultima_chiamata = (select max(x.quando) ${ultima}),
         aggiornato = now()
       where z.id = $1`,
      [a.azienda_id],
    );
  }
  await c.query("select set_config('crm.ponte', '', true)");
  return a ?? null;
};

export function traduciErrorePg(e) {
  const nome = (s) => (typeof s === "string" && /^[a-z0-9_]{1,63}$/.test(s) ? ` (${s})` : "");
  switch (e?.code) {
    case "42501": return { stato: 403, message: "non puoi", code: e.code };
    case "23505": return { stato: 409, message: `doppione${nome(e.constraint)}`, code: e.code };
    case "23503": return { stato: 409, message: `riferimento non valido${nome(e.constraint)}`, code: e.code };
    case "23514": return { stato: 400, message: motivoCampi(e) ?? `valore non ammesso${nome(e.constraint)}`, code: e.code };
    case "23502": return { stato: 400, message: `manca un valore${nome(e.column)}`, code: e.code };
    case "22P02": case "22007": case "22008": case "22003": case "22023": case "42804": case "2201B": case "22001":
    case "22021": case "22P05": case "2202E": case "22025": case "428C9": case "42883": case "22012":
      return { stato: 400, message: "valore non valido", code: e.code };
    case "P0001": return { stato: 400, message: "modifica non ammessa", code: e.code };
    case "57014": return { stato: 504, message: "la richiesta ha impiegato troppo", code: e.code };
    default: return null;
  }
}
