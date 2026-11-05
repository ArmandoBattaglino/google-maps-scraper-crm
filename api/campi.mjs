import { SOCIO_SQL } from "./db.mjs";
import { ErroreApi, regole } from "./regole.mjs";

export const RISORSA_CAMPI = "campi_definizioni";

const OGGETTI = { azienda: "crm.schede_aziende", persona: "crm.persone", trattativa: "crm.trattative" };
const TIPI = ["testo", "numero", "data", "scelta", "multi", "booleano", "link", "telefono", "email", "valuta"];
const CON_OPZIONI = new Set(["scelta", "multi"]);
const CHIAVE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_OPZIONI = 200, MAX_VALORE = 120, MAX_COLORE = 40, MAX_ORDINE = 2147483647;
const FISSE = ["oggetto", "chiave", "tipo"];
const CAMBIANO = ["etichetta", "opzioni", "ordine"];
const IGNORATE = new Set(["id", "creato", "creato_da", "aggiornato", "archiviato_il"]);

const CHIAVE_SQL = "(?:[a-z][a-z0-9_]{0,39}|\\(chiave non valida\\))";
const MOTIVI = [
  new RegExp(`^campo personalizzato non definito: ${CHIAVE_SQL}$`),
  new RegExp(`^campo personalizzato ${CHIAVE_SQL}: valore non valido per il tipo (?:${TIPI.join("|")})$`),
  /^campi personalizzati: devono essere un oggetto$/,
  /^campo personalizzato: oggetto e chiave non si cambiano \(si archivia e se ne crea un altro\)$/,
];

export function motivoCampi(e) {
  const m = typeof e?.message === "string" ? e.message : "";
  return MOTIVI.some((r) => r.test(m)) ? m : null;
}

const male = (message) => new ErroreApi(400, message, "campo");
const valoreDi = (o) => (typeof o === "string" ? o : o?.valore);
const quante = (n) => `${n} ${n === 1 ? "riga" : "righe"}`;

function etichettaValida(v) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > 80) throw male("etichetta: da 1 a 80 caratteri");
  return v.trim();
}

function ordineValido(v) {
  if (!Number.isInteger(v) || Math.abs(v) > MAX_ORDINE) throw male("ordine: serve un numero intero");
  return v;
}

function opzioniValide(v, tipo) {
  if (!Array.isArray(v)) throw male("opzioni: serve un elenco");
  if (!CON_OPZIONI.has(tipo)) {
    if (v.length) throw male(`opzioni: il tipo ${tipo} non ne ha`);
    return v;
  }
  if (v.length > MAX_OPZIONI) throw male(`opzioni: al massimo ${MAX_OPZIONI}`);
  const visti = new Set();
  for (const o of v) {
    const oggetto = o !== null && typeof o === "object" && !Array.isArray(o);
    if (typeof o !== "string" && !oggetto) throw male("opzioni: ognuna è un testo o { valore, colore }");
    if (oggetto && Object.keys(o).some((k) => k !== "valore" && k !== "colore")) throw male("opzioni: ognuna è un testo o { valore, colore }");
    if (oggetto && o.colore !== undefined && (typeof o.colore !== "string" || o.colore.length > MAX_COLORE)) throw male(`opzioni: colore fino a ${MAX_COLORE} caratteri`);
    const x = valoreDi(o);
    if (typeof x !== "string" || !x.trim() || x !== x.trim() || x.length > MAX_VALORE) throw male(`opzioni: ogni valore è un testo da 1 a ${MAX_VALORE} caratteri, senza spazi ai lati`);
    if (visti.has(x)) throw male("opzioni: due volte lo stesso valore");
    visti.add(x);
  }
  return v;
}

async function righeCheUsano(c, def, valore) {
  const cerca = { [def.chiave]: def.tipo === "multi" ? [valore] : valore };
  return (await c.query(`select count(*)::int as n from ${OGGETTI[def.oggetto]} where campi @> $1::jsonb`, [JSON.stringify(cerca)])).rows[0].n;
}

export function creaCampi({ conLaSessione, catalogo, dati }) {
  const { risorsa, colonna, idValido } = regole(catalogo);

  const scrivi = (email, fn) => conLaSessione(email, async (c) => {
    if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "solo gli utenti scrivono nel CRM", "socio");
    return fn(c);
  });

  function leggi(R, corpo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroreApi(400, "il corpo è un oggetto", "valore");
    const b = {};
    for (const [k, v] of Object.entries(corpo)) {
      const [n] = colonna(R, k);
      if (!IGNORATE.has(n)) b[n] = v;
    }
    return b;
  }

  async function crea(R, corpo, email) {
    const b = leggi(R, corpo);
    if (!Object.hasOwn(OGGETTI, String(b.oggetto))) throw male(`oggetto: uno fra ${Object.keys(OGGETTI).join(", ")}`);
    if (typeof b.chiave !== "string" || !CHIAVE.test(b.chiave)) throw male("chiave: minuscole, cifre e _, inizia con una lettera, fino a 40 caratteri");
    if (!TIPI.includes(b.tipo)) throw male(`tipo: uno fra ${TIPI.join(", ")}`);
    const etichetta = etichettaValida(b.etichetta);
    const opzioni = opzioniValide(b.opzioni ?? [], b.tipo);
    const ordine = b.ordine === undefined ? 0 : ordineValido(b.ordine);
    return scrivi(email, async (c) => {
      const r = await c.query(`insert into ${R.tab} (oggetto, chiave, etichetta, tipo, opzioni, ordine) values ($1, $2, $3, $4, $5::jsonb, $6)
        on conflict (oggetto, chiave) do nothing returning *`, [b.oggetto, b.chiave, etichetta, b.tipo, JSON.stringify(opzioni), ordine]);
      if (r.rows.length) return { stato: 201, corpo: r.rows[0] };
      const gia = await c.query(`select archiviato_il from ${R.tab} where oggetto = $1 and chiave = $2`, [b.oggetto, b.chiave]);
      throw new ErroreApi(409, gia.rows[0]?.archiviato_il
        ? `chiave ${b.chiave}: c'è già un campo archiviato su ${b.oggetto}, si ripristina (POST …/${R.nome}/<id>/ripristina) o si sceglie un'altra chiave`
        : `chiave ${b.chiave}: c'è già su ${b.oggetto}`, "chiave");
    });
  }

  async function aggiorna(R, id, corpo, email) {
    const b = leggi(R, corpo);
    if (b.etichetta !== undefined) b.etichetta = etichettaValida(b.etichetta);
    if (b.ordine !== undefined) ordineValido(b.ordine);
    return scrivi(email, async (c) => {
      const def = (await c.query(`select * from ${R.tab} where id = $1 for update`, [id])).rows[0];
      if (!def) throw new ErroreApi(404, "non trovato");
      for (const k of FISSE) {
        if (b[k] !== undefined && b[k] !== def[k]) throw male(`${k}: non si cambia (si archivia e se ne crea un altro; l'etichetta si cambia)`);
      }
      if (b.opzioni !== undefined) {
        opzioniValide(b.opzioni, def.tipo);
        const restano = new Set(b.opzioni.map(valoreDi));
        const usate = [];
        for (const o of def.opzioni) {
          const valore = valoreDi(o);
          if (restano.has(valore)) continue;
          const righe = await righeCheUsano(c, def, valore);
          if (righe) usate.push({ valore, righe });
        }
        if (usate.length) {
          const message = usate.map((u) => `opzione «${u.valore}» usata da ${quante(u.righe)}`).join(" · ");
          return { stato: 409, corpo: { error: { message, code: "opzione_usata", usate } } };
        }
      }
      const params = [];
      const set = CAMBIANO.filter((k) => b[k] !== undefined).map((k) => {
        params.push(k === "opzioni" ? JSON.stringify(b[k]) : b[k]);
        return `${k} = $${params.length}${k === "opzioni" ? "::jsonb" : ""}`;
      });
      if (!set.length) return { stato: 200, corpo: def };
      params.push(id);
      return { stato: 200, corpo: (await c.query(`update ${R.tab} set ${set.join(", ")} where id = $${params.length} returning *`, params)).rows[0] };
    });
  }

  const archivio = (R, id, email, valore) => scrivi(email, async (c) => {
    const r = await c.query(`update ${R.tab} set archiviato_il = ${valore} where id = $1 returning *`, [id]);
    if (!r.rows.length) throw new ErroreApi(404, "non trovato");
    return { stato: 200, corpo: r.rows[0] };
  });
  const archivia = (R, id, email) => archivio(R, id, email, "coalesce(archiviato_il, now())");
  const ripristina = (R, id, email) => archivio(R, id, email, "null");

  return async function campi(richiesta) {
    const { metodo, risorsa: nome, id, azione, cerca, corpo, email } = richiesta;
    if (nome !== RISORSA_CAMPI) return dati(richiesta);
    const scrittura = id === undefined ? metodo === "POST"
      : azione === undefined ? ["PUT", "PATCH", "DELETE"].includes(metodo)
      : azione === "archivia" || azione === "ripristina";
    if (!scrittura) return dati(richiesta);

    const R = risorsa(nome);
    if ([...cerca.keys()].length) throw new ErroreApi(400, "parametro fuori lista", "parametro");
    if (id === undefined) return crea(R, corpo, email);
    idValido(R, id);
    if (azione !== undefined && metodo !== "POST") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    if (azione === "ripristina") return ripristina(R, id, email);
    if (azione === "archivia" || metodo === "DELETE") return archivia(R, id, email);
    return aggiorna(R, id, corpo, email);
  };
}
