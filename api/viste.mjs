import { SOCIO_SQL } from "./db.mjs";
import { ErroreApi, regole } from "./regole.mjs";

const male = (messaggio, code = "valore") => new ErroreApi(400, messaggio, code);

export function richiestaDiVista(vista, altro = {}) {
  if (vista.colonne !== undefined && vista.colonne !== null && !Array.isArray(vista.colonne)) throw male("colonne: serve un elenco", "colonne");
  if (vista.gruppo !== undefined && vista.gruppo !== null && typeof vista.gruppo !== "string") throw male("gruppo: serve un testo", "gruppo");
  const colonne = [], totali = [];
  for (const v of vista.colonne ?? []) {
    if (typeof v === "string") { colonne.push(v); continue; }
    if (v === null || typeof v !== "object" || Array.isArray(v) || typeof v.campo !== "string"
        || Object.keys(v).some((k) => k !== "campo" && k !== "totale" && k !== "larghezza")
        || (v.larghezza !== undefined && !(Number.isInteger(v.larghezza) && v.larghezza >= 40 && v.larghezza <= 2000))) {
      throw male("colonne: ogni voce è un nome o { campo, totale, larghezza }", "colonne");
    }
    colonne.push(v.campo);
    if (v.totale !== undefined) totali.push({ fn: v.totale, campo: v.campo });
  }
  const gruppi = vista.gruppo?.trim() ? vista.gruppo.split(",").map((s) => s.trim()) : [];
  const perMostrarla = [...gruppi, ...(vista.campo_data ? [vista.campo_data] : []),
    ...(vista.tipo === "mappa" ? (vista.tabella === "aziende" ? ["lat", "lng"] : ["azienda.lat", "azienda.lng"]) : [])];
  return { filtri: vista.filtri, ordine: vista.ordine, gruppi, totali,
    colonne: colonne.length ? [...new Set([...colonne, ...perMostrarla])] : [], ...altro };
}

export function creaViste({ conLaSessione, catalogo, dati, motore }) {
  const { risorsa, idValido } = regole(catalogo);

  async function valida(c, vista, email) {
    await motore.valida(c, vista.tabella, richiestaDiVista(vista), { email });
    if (vista.campo_data) await motore.controllaCampoData(c, vista.tabella, vista.campo_data);
  }

  async function esegui(c, quale, opzioni = {}, chi = {}) {
    const trovata = quale?.id
      ? await c.query("select * from crm.viste where id = $1", [quale.id])
      : await c.query("select * from crm.viste where lower(nome) = lower($1) order by (di = 'team') desc, creato, id limit 1", [String(quale?.nome ?? "")]);
    let vista = trovata.rows[0];
    if (!vista) throw new ErroreApi(404, "vista non trovata");
    const inizio = opzioni.inizio ?? 0;
    const esito = await motore.esegui(c, vista.tabella, richiestaDiVista(vista, { inizio, quanti: opzioni.quanti ?? 25, ...(opzioni.gruppi ? { gruppi: opzioni.gruppi } : {}) }), chi);
    if (inizio === 0) vista = (await c.query("update crm.viste set usi = usi + 1, usata_il = now() where id = $1 returning *", [vista.id])).rows[0];
    return { vista, ...esito };
  }

  function interoDa(cerca, nome, dflt) {
    if (!cerca.has(nome)) return dflt;
    const v = cerca.get(nome);
    if (cerca.getAll(nome).length !== 1 || !/^\d{1,9}$/.test(v)) throw new ErroreApi(400, `${nome}: serve un intero ≥ 0`, "parametro");
    return Number(v);
  }

  async function righe({ id, cerca, email }) {
    idValido(risorsa("viste"), id);
    for (const k of cerca.keys()) if (k !== "inizio" && k !== "quanti") throw new ErroreApi(400, "parametro fuori lista", "parametro");
    const opzioni = { inizio: interoDa(cerca, "inizio", 0), quanti: interoDa(cerca, "quanti", 25) };
    return { stato: 200, corpo: await conLaSessione(email, (c) => esegui(c, { id }, opzioni, { email })) };
  }

  async function scrivi(richiesta) {
    const { id, corpo, email } = richiesta;
    if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroreApi(400, "il corpo è un oggetto", "valore");
    if (id !== undefined) idValido(risorsa("viste"), id);
    const { usi: _usi, usata_il: _usata, ...pulito } = corpo;
    await conLaSessione(email, async (c) => {
      if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "solo gli utenti scrivono nel CRM", "socio");
      let attuale = null;
      if (id !== undefined) {
        attuale = (await c.query("select * from crm.viste where id = $1", [id])).rows[0];
        if (!attuale) throw new ErroreApi(404, "non trovato");
      }
      const di = pulito.di;
      if (di !== undefined && di !== attuale?.di && di !== "team" && String(di).toLowerCase() !== String(email).toLowerCase()) {
        throw male("una vista è del team o tua");
      }
      if (!attuale || Object.keys(pulito).some((k) => k !== "nome")) await valida(c, { ...attuale, ...pulito }, email);
    });
    return dati({ ...richiesta, corpo: pulito });
  }

  async function rotta(richiesta) {
    const { metodo, risorsa: nome, id, azione } = richiesta;
    if (nome !== "viste") return null;
    if (azione === "righe") {
      if (metodo !== "GET") throw new ErroreApi(405, "metodo non ammesso", "metodo");
      return righe(richiesta);
    }
    if (azione !== undefined) return null;
    if ((metodo === "POST" && id === undefined) || ((metodo === "PUT" || metodo === "PATCH") && id !== undefined)) return scrivi(richiesta);
    return null;
  }

  return { rotta, esegui, valida };
}
