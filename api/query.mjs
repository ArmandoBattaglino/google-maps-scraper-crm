import { ULTIMA_NOTA } from "./nota.mjs";
import { arrivoJson, testoOrigine, voceOrigine } from "./origini.mjs";
import { ErroreApi, RISORSE, FINESTRA, pertinente, TUTTE_LE_ETICHETTE, q } from "./regole.mjs";
import { calcolatiAzienda, haTrattative, segueSu, statoSegni, statoTesto } from "./stato.mjs";

export const LIMITI = Object.freeze({ profondita: 5, condizioni: 50, valori: 1000, gruppi: 2, ordini: 5, totali: 10, colonne: 60,
  quanti: FINESTRA, righeGruppi: 2000, giorni: 36500 });

export const OPERATORI = Object.freeze({
  testo: ["uguale", "diverso", "in", "non_in", "contiene", "inizia", "vuoto", "non_vuoto"],
  numero: ["uguale", "diverso", "in", "non_in", "maggiore", "minore", "tra", "vuoto", "non_vuoto"],
  istante: ["uguale", "diverso", "maggiore", "minore", "tra", "vuoto", "non_vuoto", "negli_ultimi_giorni", "entro_giorni"],
  data: ["uguale", "diverso", "maggiore", "minore", "tra", "vuoto", "non_vuoto", "negli_ultimi_giorni", "entro_giorni"],
  booleano: ["uguale", "diverso", "vuoto", "non_vuoto"],
  uuid: ["uguale", "diverso", "in", "non_in", "vuoto", "non_vuoto"],
  elenco: ["contiene", "in", "non_in", "vuoto", "non_vuoto"],
  multi: ["contiene", "in", "non_in", "vuoto", "non_vuoto"],
});
const AGGREGATI = Object.freeze({ count: () => true, somma: (k) => k === "numero", media: (k) => k === "numero",
  min: (k) => ["numero", "istante", "data"].includes(k), max: (k) => ["numero", "istante", "data"].includes(k) });
const AGGREGATI_SQL = { count: "count", somma: "sum", media: "avg", min: "min", max: "max" };

const AZIENDA = { risorsa: "aziende", da: "azienda_id", colonne: ["nome", "comune", "categoria", "esito", "telefono"] };
const PERSONA = { risorsa: "persone", da: "persona_id", colonne: ["nome", "ruolo", "telefono", "email"] };
const LEGAMI = Object.freeze({
  aziende: { scheda: { risorsa: "schede_aziende", da: "id", a: "azienda_id", colonne: ["segue"] } },
  persone: { azienda: AZIENDA },
  trattative: { azienda: AZIENDA, persona: PERSONA, fase: { risorsa: "fasi_lead", da: "fase_id", colonne: ["nome", "tipo", "ordine"] } },
  attivita: { azienda: AZIENDA, persona: PERSONA, trattativa: { risorsa: "trattative", da: "trattativa_id", colonne: ["fase_id", "segue", "prossimo_passo"] } },
});
const PERSONALI = Object.freeze({
  aziende: { oggetto: "azienda", legame: "scheda" },
  persone: { oggetto: "persona" },
  trattative: { oggetto: "trattativa" },
});
const CLASSE_DEL_TIPO = Object.freeze({ testo: "testo", link: "testo", telefono: "testo", email: "testo", scelta: "testo",
  numero: "numero", valuta: "numero", booleano: "booleano", data: "data", multi: "multi" });
const STATI = Object.freeze({ aziende: statoTesto.aziende("t"), persone: statoTesto.persone("t") });
const SEGNI = Object.freeze({ aziende: statoSegni.aziende("t"), persone: statoSegni.persone("t") });
const DAL_CALCOLO = calcolatiAzienda("t", `"j_scheda"."segue"`);
const CAMPI_CALCOLATI = Object.freeze({
  tentativi: { classe: "numero", expr: DAL_CALCOLO.tentativi },
  ultima_chiamata: { classe: "istante", expr: DAL_CALCOLO.ultima_chiamata },
  chiamato_da: { classe: "testo", expr: DAL_CALCOLO.chiamato_da },
  richiamare_il: { classe: "istante", expr: DAL_CALCOLO.richiamare_il },
  "scheda.segue": { classe: "testo", expr: DAL_CALCOLO.segue, legame: "scheda" },
});
const A_FREDDO = Object.freeze({ "freddo.tentativi": { classe: "numero", expr: "t.tentativi" }, "freddo.ultima_chiamata": { classe: "istante", expr: "t.ultima_chiamata" },
  "freddo.chiamato_da": { classe: "testo", expr: "t.chiamato_da" }, "freddo.richiamare_il": { classe: "istante", expr: "t.richiamare_il" },
  "freddo.segue": { classe: "testo", expr: `"j_scheda"."segue"`, legame: "scheda" } });
const CALCOLATI = Object.freeze({ aziende: { lat: { colonna: "dati", chiave: "lat", classe: "numero" }, lng: { colonna: "dati", chiave: "lng", classe: "numero" },
  etichetta: { colonna: "dati", chiave: "etichetta", classe: "testo", operatori: Object.freeze([...OPERATORI.testo, TUTTE_LE_ETICHETTE]) } } });

const AZIENDA_DI = Object.freeze({ aziende: "t.id", persone: "t.azienda_id", trattative: "t.azienda_id" });
const listaDi = (az) => `(select l.nome from app.liste_aziende la join app.liste_freddo l on l.id = la.lista_id where la.azienda_id = ${az} order by la.creato, la.id limit 1)`;
const DA_DOVE = Object.freeze(Object.fromEntries(Object.entries(AZIENDA_DI).map(([r, az]) => [r, `coalesce(${testoOrigine(az)}, ${listaDi(az)})`])));
const CANALE = Object.freeze(Object.fromEntries(Object.entries(AZIENDA_DI).map(([r, az]) => [r, voceOrigine(az)])));
const DA_DOVE_DATI = Object.freeze(Object.fromEntries(Object.entries(AZIENDA_DI).map(([r, az]) => [r, `jsonb_strip_nulls(jsonb_build_object('arrivo', ${arrivoJson(az)}, 'lista', ${listaDi(az)}))`])));

export const CERCABILI = Object.freeze(Object.keys(LEGAMI));
const FUSO = "'Europe/Rome'";
const OGGI = `(now() at time zone ${FUSO})::date`;
const inizioDi = (giorno) => `((${giorno})::timestamp at time zone ${FUSO})`;
const CHIAVE = /^[a-z][a-z0-9_]{0,39}$/;
const NOME = /^[a-z][a-z0-9_.]{0,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERO = /^-?\d{1,30}(\.\d{1,30})?$/;
const GIORNO = /^\d{4}-\d{2}-\d{2}$/;
const ISTANTE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)?$/i;
const CON_FUSO = /(Z|[+-]\d{2}(:?\d{2})?)$/i;
const CHIAVI_CORPO = new Set(["filtri", "ordine", "gruppi", "totali", "colonne", "inizio", "quanti"]);

const male = (messaggio, code = "filtro") => new ErroreApi(400, messaggio, code);
const nomeDetto = (s) => (typeof s === "string" && NOME.test(s) ? s : "(nome non valido)");
const eOggetto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

function classeColonna(info) {
  if (info.array) return "elenco";
  if (info.json) return null;
  if (/^(text|character|citext)\b/.test(info.tipo)) return "testo";
  if (/^(smallint|integer|bigint|numeric|real|double precision)\b/.test(info.tipo)) return "numero";
  if (/^timestamp\b/.test(info.tipo)) return "istante";
  if (/^date\b/.test(info.tipo)) return "data";
  if (/^boolean\b/.test(info.tipo)) return "booleano";
  if (/^uuid\b/.test(info.tipo)) return "uuid";
  return null;
}

function dentroJson(alias, colonna, chiave, classe) {
  const j = `${alias}.${q(colonna)}`, k = `'${chiave}'`;
  switch (classe) {
    case "numero": return `(case when jsonb_typeof(${j} -> ${k}) = 'number' then (${j} ->> ${k})::numeric end)`;
    case "booleano": return `(case when jsonb_typeof(${j} -> ${k}) = 'boolean' then (${j} ->> ${k})::boolean end)`;
    case "data": return `(case when pg_input_is_valid(${j} ->> ${k}, 'date') then (${j} ->> ${k})::date end)`;
    case "multi": return `(${j} -> ${k})`;
    default: return `(${j} ->> ${k})`;
  }
}

export function creaMotore({ catalogo, conLaSessione }) {
  const colonneDi = (risorsa) => catalogo.get(risorsa);
  const tabellaDi = (risorsa) => `${q(RISORSE[risorsa].schema)}.${q(RISORSE[risorsa].tabella)}`;
  const chiaveDi = (risorsa) => RISORSE[risorsa].chiave || "id";

  function controllaRisorsa(risorsa) {
    if (typeof risorsa !== "string" || !Object.hasOwn(LEGAMI, risorsa)) throw male(`si cerca solo su ${CERCABILI.join(", ")}`, "risorsa");
    return risorsa;
  }

  async function definizioni(c, risorsa) {
    const p = PERSONALI[risorsa];
    if (!p) return new Map();
    const { rows } = await c.query(`select chiave, etichetta, tipo, opzioni, ordine, archiviato_il from crm.campi_definizioni
      where oggetto = $1 order by ordine, chiave`, [p.oggetto]);
    return new Map(rows.map((r) => [r.chiave, r]));
  }

  function trovaCampo(risorsa, nome, defs, grezzi = false) {
    if (typeof nome !== "string" || nome.length > 90) throw male("campo non valido");
    const fuori = () => male(`campo fuori lista: ${risorsa}.${nomeDetto(nome)}`, "campo");
    if (risorsa === "aziende") {
      if (Object.hasOwn(A_FREDDO, nome)) return { campo: nome, legame: null, ...A_FREDDO[nome] };
      if (!grezzi && Object.hasOwn(CAMPI_CALCOLATI, nome)) return { campo: nome, legame: null, calcolato: true, ...CAMPI_CALCOLATI[nome] };
    }
    const punto = nome.indexOf(".");
    if (punto < 0) {
      if (nome === "stato" && Object.hasOwn(STATI, risorsa)) return { campo: nome, classe: "testo", expr: STATI[risorsa], legame: null };
      if (nome === "ultima_nota" && Object.hasOwn(ULTIMA_NOTA, risorsa)) return { campo: nome, classe: "testo", expr: ULTIMA_NOTA[risorsa]("t.id"), legame: null, soloLettura: true };
      if (nome === "da_dove" && Object.hasOwn(DA_DOVE, risorsa)) return { campo: nome, classe: "testo", expr: DA_DOVE[risorsa], legame: null };
      if (nome === "canale" && Object.hasOwn(CANALE, risorsa)) return { campo: nome, classe: "testo", expr: CANALE[risorsa], legame: null };
      const calcolato = CALCOLATI[risorsa] && Object.hasOwn(CALCOLATI[risorsa], nome) ? CALCOLATI[risorsa][nome] : null;
      if (calcolato) return { campo: nome, classe: calcolato.classe, expr: dentroJson("t", calcolato.colonna, calcolato.chiave, calcolato.classe), legame: null, operatori: calcolato.operatori };
      const info = colonneDi(risorsa).get(nome);
      if (!info) throw fuori();
      return { campo: nome, classe: classeColonna(info), expr: `t.${q(nome)}`, legame: null };
    }
    const prima = nome.slice(0, punto), resto = nome.slice(punto + 1);
    if (prima === "campi") {
      const p = PERSONALI[risorsa];
      if (!p || !CHIAVE.test(resto) || !defs.has(resto)) throw fuori();
      const classe = CLASSE_DEL_TIPO[defs.get(resto).tipo];
      if (!classe) throw fuori();
      const alias = p.legame ? `"j_${p.legame}"` : "t";
      return { campo: nome, classe, expr: dentroJson(alias, "campi", resto, classe), legame: p.legame || null, personale: true };
    }
    if (prima === "azienda" && (resto === "lat" || resto === "lng") && LEGAMI[risorsa].azienda) {
      return { campo: nome, classe: "numero", expr: dentroJson('"j_azienda"', "dati", resto, "numero"), legame: "azienda" };
    }
    if (!Object.hasOwn(LEGAMI[risorsa], prima)) throw fuori();
    const l = LEGAMI[risorsa][prima];
    const info = colonneDi(l.risorsa)?.get(resto);
    if (!l.colonne.includes(resto) || !info) throw fuori();
    return { campo: nome, classe: classeColonna(info), expr: `"j_${prima}".${q(resto)}`, legame: prima };
  }

  function compilaFiltri(risorsa, filtri, st) {
    const param = (v, tipo) => { st.params.push(v); return `$${st.params.length}::${tipo}`; };

    const testo = (v, nome) => {
      if (eOggetto(v) && v.io === true && Object.keys(v).length === 1) {
        if (!st.email) throw male(`${nome}: «io» qui non vale`, "valore");
        return String(st.email).toLowerCase();
      }
      if (typeof v !== "string" || v.length > 500 || v.includes("\0")) throw male(`${nome}: serve un testo fino a 500 caratteri`, "valore");
      return v;
    };
    const numero = (v, nome) => {
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
      if (typeof v === "string" && NUMERO.test(v)) return v;
      throw male(`${nome}: serve un numero`, "valore");
    };
    const uuid = (v, nome) => {
      if (typeof v !== "string" || !UUID.test(v)) throw male(`${nome}: serve un uuid`, "valore");
      return v;
    };
    const elenco = (v, nome, conv) => {
      if (!Array.isArray(v) || !v.length || v.length > LIMITI.valori) throw male(`${nome}: serve un elenco di 1-${LIMITI.valori} valori`, "valore");
      return v.map((x) => conv(x, nome));
    };
    const giorni = (v, nome) => {
      if (!Number.isInteger(v) || Math.abs(v) > LIMITI.giorni) throw male(`${nome}: serve un numero intero di giorni`, "valore");
      return v;
    };
    const tempo = (v, nome) => {
      if (typeof v === "string") {
        if (GIORNO.test(v)) return { g: param(v, "date") };
        if (ISTANTE.test(v)) return { i: CON_FUSO.test(v) ? param(v, "timestamptz") : `(${param(v, "timestamp")} at time zone ${FUSO})` };
      } else if (eOggetto(v) && Object.keys(v).length === 1) {
        if (Object.hasOwn(v, "da_adesso")) return { i: `(now() + make_interval(days => ${param(giorni(v.da_adesso, nome), "int")}))` };
        if (Object.hasOwn(v, "da_oggi")) return { g: `(${OGGI} + ${param(giorni(v.da_oggi, nome), "int")})` };
      }
      throw male(`${nome}: serve una data, un istante, { da_adesso: n } o { da_oggi: n }`, "valore");
    };
    const giornoDi = (t) => t.g || `((${t.i}) at time zone ${FUSO})::date`;

    function condTempo(f, op, valore, nome) {
      const e = f.expr, sulGiorno = f.classe === "data";
      if (op === "negli_ultimi_giorni" || op === "entro_giorni") {
        if (giorni(valore, nome) < 0) throw male(`${nome}: i giorni non sono negativi`, "valore");
        const n = param(valore, "int");
        if (op === "negli_ultimi_giorni") {
          return sulGiorno ? `(${e} >= ${OGGI} - ${n} and ${e} <= ${OGGI})` : `(${e} >= ${inizioDi(`${OGGI} - ${n}`)} and ${e} <= now())`;
        }
        return sulGiorno ? `(${e} >= ${OGGI} and ${e} <= ${OGGI} + ${n})` : `(${e} >= now() and ${e} < ${inizioDi(`${OGGI} + ${n} + 1`)})`;
      }
      if (op === "tra") {
        if (!Array.isArray(valore) || valore.length !== 2) throw male(`${nome}: serve [da, a]`, "valore");
        const [da, a] = valore.map((x) => tempo(x, nome));
        if (sulGiorno) return `(${e} >= ${giornoDi(da)} and ${e} <= ${giornoDi(a)})`;
        return `(${e} >= ${da.g ? inizioDi(da.g) : da.i} and ${a.g ? `${e} < ${inizioDi(`${a.g} + 1`)}` : `${e} <= ${a.i}`})`;
      }
      const t = tempo(valore, nome);
      if (sulGiorno) {
        const g = giornoDi(t);
        return { uguale: `${e} = ${g}`, diverso: `${e} is distinct from ${g}`, maggiore: `${e} > ${g}`, minore: `${e} < ${g}` }[op];
      }
      if (t.g) {
        const da = inizioDi(t.g), dopo = inizioDi(`${t.g} + 1`);
        return { uguale: `(${e} >= ${da} and ${e} < ${dopo})`, diverso: `(${e} is null or ${e} < ${da} or ${e} >= ${dopo})`,
          maggiore: `${e} >= ${dopo}`, minore: `${e} < ${da}` }[op];
      }
      return { uguale: `${e} = ${t.i}`, diverso: `${e} is distinct from ${t.i}`, maggiore: `${e} > ${t.i}`, minore: `${e} < ${t.i}` }[op];
    }

    function condValori(f, op, valore, nome, conv, tipo) {
      const e = f.expr;
      switch (op) {
        case "uguale": return `${e} = ${param(conv(valore, nome), tipo)}`;
        case "diverso": return `${e} is distinct from ${param(conv(valore, nome), tipo)}`;
        case "in": return `${e} = any(${param(elenco(valore, nome, conv), `${tipo}[]`)})`;
        case "non_in": return `(${e} is null or ${e} <> all(${param(elenco(valore, nome, conv), `${tipo}[]`)}))`;
        case "maggiore": return `${e} > ${param(conv(valore, nome), tipo)}`;
        case "minore": return `${e} < ${param(conv(valore, nome), tipo)}`;
        case "tra": {
          if (!Array.isArray(valore) || valore.length !== 2) throw male(`${nome}: serve [da, a]`, "valore");
          return `(${e} >= ${param(conv(valore[0], nome), tipo)} and ${e} <= ${param(conv(valore[1], nome), tipo)})`;
        }
        default: throw male(`operatore fuori lista: ${nome}`, "operatore");
      }
    }

    const scappa = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);
    function condizione(nodo) {
      for (const k of Object.keys(nodo)) if (!["campo", "op", "valore"].includes(k)) throw male(`condizione: chiave fuori lista: ${nomeDetto(k)}`);
      if (++st.condizioni > LIMITI.condizioni) throw male(`troppe condizioni (massimo ${LIMITI.condizioni})`);
      const f = trovaCampo(risorsa, nodo.campo, st.defs, st.grezzi);
      const nome = f.campo, op = nodo.op, valore = nodo.valore;
      if (!f.classe) throw male(`${risorsa}.${nome}: non si filtra`, "campo");
      if (typeof op !== "string" || !(f.operatori ?? OPERATORI[f.classe]).includes(op)) throw male(`operatore fuori lista per ${nome}: ${nomeDetto(op)}`, "operatore");
      if (f.legame) st.legami.add(f.legame);
      const e = f.expr;
      if (nome === "etichetta") st.etichettaScelta = true;
      if (op === TUTTE_LE_ETICHETTE) {
        if (valore !== undefined && valore !== null) throw male(`${nome}: ${op} non vuole un valore`, "valore");
        return "true";
      }
      if (op === "vuoto" || op === "non_vuoto") {
        if (valore !== undefined && valore !== null) throw male(`${nome}: ${op} non vuole un valore`, "valore");
        const vuoto = {
          testo: `coalesce(${e}, '') = ''`,
          elenco: `coalesce(cardinality(${e}), 0) = 0`,
          multi: `coalesce(jsonb_array_length(case when jsonb_typeof(${e}) = 'array' then ${e} end), 0) = 0`,
        }[f.classe] || `${e} is null`;
        return op === "vuoto" ? `(${vuoto})` : `(not (${vuoto}))`;
      }
      switch (f.classe) {
        case "testo":
          if (op === "contiene") return `${e} ilike ${param(`%${scappa(testo(valore, nome))}%`, "text")}`;
          if (op === "inizia") return `${e} ilike ${param(`${scappa(testo(valore, nome))}%`, "text")}`;
          return condValori(f, op, valore, nome, testo, "text");
        case "numero": return condValori(f, op, valore, nome, numero, "numeric");
        case "uuid": return condValori(f, op, valore, nome, uuid, "uuid");
        case "booleano": {
          if (typeof valore !== "boolean") throw male(`${nome}: serve vero o falso`, "valore");
          return op === "uguale" ? `${e} = ${param(valore, "boolean")}` : `${e} is distinct from ${param(valore, "boolean")}`;
        }
        case "istante": case "data": return condTempo(f, op, valore, nome);
        case "elenco":
          if (op === "contiene") return `${param(testo(valore, nome), "text")} = any(${e})`;
          if (op === "in") return `coalesce(${e}, '{}') && ${param(elenco(valore, nome, testo), "text[]")}`;
          return `(not (coalesce(${e}, '{}') && ${param(elenco(valore, nome, testo), "text[]")}))`;
        case "multi":
          if (op === "contiene") return `${e} @> to_jsonb(${param(testo(valore, nome), "text")})`;
          if (op === "in") return `coalesce(${e} ?| ${param(elenco(valore, nome, testo), "text[]")}, false)`;
          return `(not coalesce(${e} ?| ${param(elenco(valore, nome, testo), "text[]")}, false))`;
        default: throw male(`${risorsa}.${nome}: non si filtra`, "campo");
      }
    }

    function nodo(n, livello) {
      if (!eOggetto(n)) throw male(`un nodo dell'albero è un oggetto`);
      const gruppo = Object.hasOwn(n, "e") ? "e" : Object.hasOwn(n, "o") ? "o" : null;
      if (!gruppo) return condizione(n);
      if (Object.keys(n).length !== 1) throw male("un gruppo ha una chiave sola: e oppure o");
      if (livello > LIMITI.profondita) throw male(`albero troppo profondo (massimo ${LIMITI.profondita} livelli)`);
      if (!Array.isArray(n[gruppo])) throw male(`«${gruppo}» vuole un elenco`);
      const pezzi = n[gruppo].map((x) => nodo(x, livello + 1)).filter(Boolean);
      if (!pezzi.length) return null;
      return pezzi.length === 1 ? pezzi[0] : `(${pezzi.join(gruppo === "e" ? " and " : " or ")})`;
    }

    let dove = null;
    if (Array.isArray(filtri)) {
      if (filtri.length) throw male("filtri: serve { e: […] } o { o: […] }");
    } else if (filtri !== undefined && filtri !== null) dove = nodo(filtri, 1);
    if (RISORSE[risorsa].nascoste && !st.etichettaScelta) dove = dove ? `(${dove}) and ${pertinente("t")}` : pertinente("t");
    return dove ? ` where ${dove}` : "";
  }

  function elencoCorto(v, nome, max) {
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v) || v.length > max) throw male(`${nome}: serve un elenco di al massimo ${max} voci`);
    return v;
  }
  function intero(v, nome, dflt, max) {
    if (v === undefined || v === null) return dflt;
    if (!Number.isInteger(v) || v < 0 || v > max) throw male(`${nome}: serve un intero fra 0 e ${max}`);
    return v;
  }

  function compila(risorsaChiesta, richiesta, chi = {}) {
    const risorsa = controllaRisorsa(risorsaChiesta);
    const corpo = richiesta === undefined || richiesta === null ? {} : richiesta;
    if (!eOggetto(corpo)) throw male("il corpo è un oggetto", "valore");
    for (const k of Object.keys(corpo)) if (!CHIAVI_CORPO.has(k)) throw male(`parametro fuori lista: ${nomeDetto(k)}`, "parametro");
    const defs = chi.definizioni || new Map();
    const grezzi = chi.grezzi === true;
    const st = { params: [], condizioni: 0, legami: new Set(), defs, email: chi.email, grezzi };
    const where = compilaFiltri(risorsa, corpo.filtri, st);
    const legamiDove = new Set(st.legami);
    const pk = chiaveDi(risorsa);

    const dirDi = new Map();
    const ordine = elencoCorto(corpo.ordine, "ordine", LIMITI.ordini).map((o) => {
      if (!eOggetto(o) || Object.keys(o).some((k) => k !== "campo" && k !== "dir")) throw male("ordine: ogni voce è { campo, dir }", "parametro");
      const f = trovaCampo(risorsa, o.campo, defs, grezzi);
      if (!f.classe || f.classe === "elenco" || f.classe === "multi" || f.soloLettura) throw male(`${f.campo}: non si ordina`, "campo");
      const dir = o.dir === undefined ? "asc" : String(o.dir).toLowerCase();
      if (dir !== "asc" && dir !== "desc") throw male(`ordine fuori lista per ${f.campo}`, "parametro");
      if (f.legame) st.legami.add(f.legame);
      dirDi.set(f.campo, dir);
      return `${f.expr} ${dir} nulls last`;
    });
    if (!dirDi.has(pk)) ordine.push(`t.${q(pk)} asc`);

    const gruppi = elencoCorto(corpo.gruppi, "gruppi", LIMITI.gruppi).map((nome) => {
      const f = trovaCampo(risorsa, nome, defs, grezzi);
      if (!f.classe || f.classe === "elenco" || f.classe === "multi" || f.soloLettura) throw male(`${f.campo}: non si raggruppa`, "campo");
      if (f.legame) legamiDove.add(f.legame);
      return f;
    });
    if (new Set(gruppi.map((g) => g.campo)).size !== gruppi.length) throw male("gruppi: lo stesso campo due volte", "parametro");

    const visti = new Set();
    const totali = [];
    for (const t of elencoCorto(corpo.totali, "totali", LIMITI.totali)) {
      if (!eOggetto(t) || Object.keys(t).some((k) => k !== "fn" && k !== "campo")) throw male("totali: ogni voce è { fn, campo }", "parametro");
      if (typeof t.fn !== "string" || !Object.hasOwn(AGGREGATI, t.fn)) throw male(`totale fuori lista: ${nomeDetto(t.fn)}`, "operatore");
      if (t.campo === undefined || t.campo === null) {
        if (t.fn !== "count") throw male(`${t.fn}: manca il campo`, "parametro");
        continue;
      }
      const f = trovaCampo(risorsa, t.campo, defs, grezzi);
      if (!f.classe || !AGGREGATI[t.fn](f.classe)) throw male(`${t.fn} non vale per ${f.campo}`, "operatore");
      if (f.legame) legamiDove.add(f.legame);
      const chiave = `${t.fn}:${f.campo}`;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      totali.push({ chiave, classe: f.classe, fn: t.fn, sql: `${AGGREGATI_SQL[t.fn]}(${f.expr})${f.classe === "data" && t.fn !== "count" ? "::text" : ""}`, alias: `a${totali.length}` });
    }

    const scelte = elencoCorto(corpo.colonne, "colonne", LIMITI.colonne);
    const legamiRighe = new Set([...st.legami]);
    const personali = PERSONALI[risorsa];
    const select = [];
    if (!scelte.length) {
      select.push("t.*");
      if (personali?.legame) {
        legamiRighe.add(personali.legame);
        select.push(`coalesce("j_${personali.legame}"."campi", '{}'::jsonb) as "campi"`, `${grezzi ? `"j_${personali.legame}"."segue"` : DAL_CALCOLO.segue} as "scheda.segue"`);
      }
      if (risorsa === "aziende" && !grezzi) {
        for (const [nome, c] of Object.entries(CAMPI_CALCOLATI)) if (!c.legame) select.push(`${c.expr} as ${q(nome)}`);
        select.push(`${haTrattative("t")} as "ha_trattative"`, `${segueSu("t")} as "segue_su"`);
      }
    } else {
      const fatte = new Set([pk]);
      select.push(`t.${q(pk)}`);
      let conCampi = false, conCalcolati = false;
      for (const nome of scelte) {
        const f = trovaCampo(risorsa, nome, defs, grezzi);
        if (f.personale) { conCampi = true; continue; }
        if (fatte.has(f.campo)) continue;
        fatte.add(f.campo);
        if (f.legame) legamiRighe.add(f.legame);
        select.push(f.legame || f.campo.includes(".") || CALCOLATI[risorsa]?.[f.campo] || f.campo === "stato" || f.campo === "da_dove" || f.campo === "canale" || f.soloLettura || f.calcolato ? `${f.expr} as ${q(f.campo)}` : f.expr);
        if (f.campo === "stato") select.push(`${SEGNI[risorsa]} as "stato_segni"`);
        if (f.campo === "da_dove") select.push(`${DA_DOVE_DATI[risorsa]} as "da_dove_dati"`);
        if (f.calcolato) conCalcolati = true;
      }
      if (conCalcolati) select.push(`${haTrattative("t")} as "ha_trattative"`);
      if (fatte.has("scheda.segue") && !grezzi && risorsa === "aziende") select.push(`${segueSu("t")} as "segue_su"`);
      if (conCampi && !fatte.has("campi")) {
        if (personali.legame) legamiRighe.add(personali.legame);
        select.push(`coalesce(${personali.legame ? `"j_${personali.legame}"` : "t"}."campi", '{}'::jsonb) as "campi"`);
      }
    }

    const da = (legami) => {
      let s = `${tabellaDi(risorsa)} as t`;
      for (const nome of legami) {
        const l = LEGAMI[risorsa][nome];
        s += ` left join ${tabellaDi(l.risorsa)} as "j_${nome}" on "j_${nome}".${q(l.a || chiaveDi(l.risorsa))} = t.${q(l.da)}`;
      }
      return s;
    };

    const inizio = intero(corpo.inizio, "inizio", 0, 1_000_000_000);
    const quanti = intero(corpo.quanti, "quanti", 25, LIMITI.quanti);
    const fine = { params: st.params, inizio, quanti, gruppi: gruppi.map((g) => g.campo), classiGruppi: gruppi.map((g) => g.classe), totali, conta: null, aggrega: null, righe: null };
    const aggregati = totali.map((t) => `${t.sql} as ${t.alias}`);
    if (gruppi.length) {
      const exprs = gruppi.map((g) => g.expr).join(", ");
      const voci = gruppi.map((g, i) => `${g.expr}${g.classe === "data" ? "::text" : ""} as g${i}`);
      const ordineG = gruppi.map((g, i) => `g${i} ${dirDi.get(g.campo) || "asc"} nulls last`);
      fine.aggrega = `select ${[...voci, `grouping(${exprs})::int as liv`, "count(*)::bigint as n", ...aggregati].join(", ")} from ${da(legamiDove)}${where}`
        + ` group by rollup(${exprs}) order by liv desc, ${ordineG.join(", ")} limit ${LIMITI.righeGruppi + 2}`;
    } else if (totali.length) {
      fine.aggrega = `select ${["count(*)::bigint as n", ...aggregati].join(", ")} from ${da(legamiDove)}${where}`;
    } else {
      fine.conta = `select count(*)::bigint as n from ${da(legamiDove)}${where}`;
    }
    if (quanti > 0) {
      fine.righe = `select ${select.join(", ")} from ${da(legamiRighe)}${where} order by ${ordine.join(", ")} limit ${quanti} offset ${inizio}`;
    }
    return fine;
  }

  async function esegui(c, risorsa, richiesta, chi = {}) {
    controllaRisorsa(risorsa);
    const defs = await definizioni(c, risorsa);
    const p = compila(risorsa, richiesta, { email: chi.email, definizioni: defs, grezzi: chi.grezzi });
    const numeroDi = (t, v) => (v === null || v === undefined ? null : (t.classe === "numero" || t.fn === "count") ? Number(v) : v);
    const totaliDi = (r) => Object.fromEntries(p.totali.map((t) => [t.chiave, numeroDi(t, r[t.alias])]));
    const valoreDi = (r, i) => (r[`g${i}`] !== null && p.classiGruppi[i] === "numero" ? Number(r[`g${i}`]) : r[`g${i}`]);
    const esito = { righe: [], totale: 0, inizio: p.inizio, quanti: p.quanti, totali: {}, gruppi: [], gruppi_troncati: false };
    if (p.conta) {
      esito.totale = Number((await c.query(p.conta, p.params)).rows[0].n);
    } else {
      const { rows } = await c.query(p.aggrega, p.params);
      if (!p.gruppi.length) {
        esito.totale = Number(rows[0].n);
        esito.totali = totaliDi(rows[0]);
      } else {
        const tutto = p.gruppi.length === 1 ? 1 : 3;
        const padri = new Map();
        esito.gruppi_troncati = rows.length > LIMITI.righeGruppi + 1;
        for (const r of rows.slice(0, LIMITI.righeGruppi + 1)) {
          if (r.liv === tutto) {
            esito.totale = Number(r.n);
            esito.totali = totaliDi(r);
          } else if (p.gruppi.length === 1 || r.liv === 1) {
            const g = { campo: p.gruppi[0], valore: valoreDi(r, 0), n: Number(r.n), totali: totaliDi(r) };
            if (p.gruppi.length === 2) { g.gruppi = []; padri.set(JSON.stringify(r.g0), g); }
            esito.gruppi.push(g);
          } else {
            padri.get(JSON.stringify(r.g0))?.gruppi.push({ campo: p.gruppi[1], valore: valoreDi(r, 1), n: Number(r.n), totali: totaliDi(r) });
          }
        }
      }
    }
    if (p.righe) esito.righe = (await c.query(p.righe, p.params)).rows;
    return esito;
  }

  async function valida(c, risorsa, richiesta, chi = {}) {
    controllaRisorsa(risorsa);
    compila(risorsa, richiesta, { email: chi.email || "io@prova.invalid", definizioni: await definizioni(c, risorsa) });
  }

  async function controllaCampoData(c, risorsa, nome) {
    const f = trovaCampo(controllaRisorsa(risorsa), nome, await definizioni(c, risorsa));
    if (f.classe !== "data" && f.classe !== "istante") throw male(`${f.campo}: non è una data`, "campo");
  }

  async function descrivi(c, risorsa) {
    controllaRisorsa(risorsa);
    const defs = await definizioni(c, risorsa);
    const voce = (campo, classe, altro = {}) => ({ campo, tipo: classe, operatori: OPERATORI[classe],
      ordinabile: classe !== "elenco" && classe !== "multi", raggruppabile: classe !== "elenco" && classe !== "multi",
      totali: Object.keys(AGGREGATI).filter((fn) => AGGREGATI[fn](classe)), ...altro });
    const campi = [];
    for (const [nome, info] of colonneDi(risorsa)) {
      const k = classeColonna(info);
      if (k) campi.push(voce(nome, k));
    }
    for (const [nome, c] of Object.entries(CALCOLATI[risorsa] || {})) campi.push(voce(nome, c.classe, { calcolato: true, ...(c.operatori ? { operatori: c.operatori } : {}) }));
    if (Object.hasOwn(STATI, risorsa)) campi.push(voce("stato", "testo", { calcolato: true }));
    if (Object.hasOwn(DA_DOVE, risorsa)) campi.push(voce("da_dove", "testo", { calcolato: true, totali: [] }), voce("canale", "testo", { calcolato: true, totali: [] }));
    if (Object.hasOwn(ULTIMA_NOTA, risorsa)) campi.push(voce("ultima_nota", "testo", { calcolato: true, ordinabile: false, raggruppabile: false, totali: [] }));
    for (const [legame, l] of Object.entries(LEGAMI[risorsa])) {
      for (const col of l.colonne) {
        const info = colonneDi(l.risorsa)?.get(col);
        const k = info && classeColonna(info);
        if (k) campi.push(voce(`${legame}.${col}`, k, { legato: true }));
      }
    }
    for (const [chiave, d] of defs) {
      if (d.archiviato_il) continue;
      const k = CLASSE_DEL_TIPO[d.tipo];
      if (k) campi.push(voce(`campi.${chiave}`, k, { personalizzato: true, etichetta: d.etichetta, tipo_campo: d.tipo, opzioni: d.opzioni, ordine: d.ordine }));
    }
    return { risorsa, campi, limiti: LIMITI };
  }

  async function rotta({ metodo, risorsa, id, azione, cerca, corpo, email }) {
    if (id !== "cerca" || azione !== undefined || !CERCABILI.includes(risorsa)) return null;
    if ([...cerca.keys()].length) throw male("parametro fuori lista", "parametro");
    if (metodo === "GET") return { stato: 200, corpo: await conLaSessione(email, (c) => descrivi(c, risorsa)) };
    if (metodo !== "POST") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    return { stato: 200, corpo: await conLaSessione(email, (c) => esegui(c, risorsa, corpo, { email })) };
  }

  return { compila, esegui, valida, descrivi, definizioni, controllaCampoData, rotta };
}
