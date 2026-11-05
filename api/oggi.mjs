import { ErroreApi } from "./regole.mjs";
import { SOCIO_SQL } from "./db.mjs";

const FUSO = "Europe/Rome";
const RIGHE = 5;
const MAX_DA_FARE = 100;
const MAX_FONTE = 1000;
export const MAX_TENTATIVI = 3;
const SOGLIA_DI_BASE = 7;
const ANNI_100 = 36500;
const CONSULENZA = /incontr|appuntament|consulenz|meet/i;
const PROPOSTA = /proposta/i;
const FRECCIA = "→ ";
const NESSUNA = "";

const COL_AZIENDA = ["nome", "telefono", "referente", "esito", "tentativi", "richiamare_il", "chiamato_da"];
const COL_TRATTATIVA = ["azienda_id", "persona_id", "fase_id", "segue", "valore", "prossimo_passo", "prossimo_il", "mossa_il"];
const COL_COMPITO = ["testo", "scadenza", "creato_da", "assegnato_a", "azienda_id", "persona_id", "trattativa_id"];

const cond = (campo, op, valore) => (valore === undefined ? { campo, op } : { campo, op, valore });
const uguale = (campo, valore) => cond(campo, "uguale", valore);
const IO = Object.freeze({ io: true });
const conMe = (di, ...pezzi) => (di === "me" ? pezzi : []);
const miaODiNessuno = (campo) => ({ o: [uguale(campo, IO), cond(campo, "vuoto")] });
export const MIA_O_DI_NESSUNO = Object.freeze(miaODiNessuno("freddo.segue"));
const COMPITO_MIO = Object.freeze({ o: [uguale("assegnato_a", IO), { e: [cond("assegnato_a", "vuoto"), miaODiNessuno("creato_da")] }] });
const ENTRO_OGGI = (campo) => cond(campo, "minore", { da_oggi: 1 });
const PRIMA_DI_OGGI = (campo) => cond(campo, "minore", { da_oggi: 0 });
const DA_DOMANI = (campo) => cond(campo, "maggiore", { da_oggi: 0 });

const RICHIAMO_DOVUTO = { o: [cond("freddo.richiamare_il", "vuoto"), cond("freddo.richiamare_il", "minore", { da_adesso: 0 })] };
const RICHIAMO = uguale("esito", "richiamare");
const LIBERA = cond("contatto_id", "vuoto");

export const IN_CODA = Object.freeze({ e: [LIBERA, { o: [
  uguale("esito", "da-chiamare"),
  { e: [uguale("esito", "non-risponde"), cond("freddo.tentativi", "minore", MAX_TENTATIVI)] },
  { e: [RICHIAMO, RICHIAMO_DOVUTO] },
] }] });

const giornoDi = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const inGiorni = (g) => Date.parse(`${g}T00:00:00Z`) / 86_400_000;

const sogliaValida = (v) => Number.isInteger(v) && v >= 1 && v <= ANNI_100;

export function creaOggi({ conLaSessione, motore }) {
  async function soglie(c) {
    const { rows } = await c.query("select chiave, valore from crm.impostazioni where chiave = any($1)",
      [["soglia_ferma_giorni", "soglie_ferma_fasi"]]);
    const valore = (k) => rows.find((r) => r.chiave === k)?.valore;
    const base = sogliaValida(valore("soglia_ferma_giorni")) ? valore("soglia_ferma_giorni") : SOGLIA_DI_BASE;
    const perFase = valore("soglie_ferma_fasi");
    const mappa = perFase && typeof perFase === "object" && !Array.isArray(perFase) ? perFase : {};
    return { base, di: (id) => (Object.hasOwn(mappa, id) && sogliaValida(mappa[id]) ? mappa[id] : base) };
  }

  function filtriFerme(aperte, soglia, base) {
    const perSoglia = new Map();
    for (const f of aperte) {
      const s = soglia.di(f.id);
      if (!perSoglia.has(s)) perSoglia.set(s, []);
      perSoglia.get(s).push(f.id);
    }
    const voci = [...perSoglia].map(([s, ids]) => ({ e: [cond("fase_id", "in", ids), cond("mossa_il", "minore", { da_oggi: 1 - s })] }));
    return [...base, voci.length ? { o: voci } : uguale("fase_id", NESSUNA)];
  }

  function spostamentiVerso(fasi, settimana, di) {
    const nomi = [...new Set(fasi.map((f) => f.nome))];
    return { e: [uguale("tipo", "fase"), cond("quando", "tra", [settimana.da, settimana.a]), ...conMe(di, uguale("creato_da", IO)),
      { o: [cond("fase", "in", fasi.length ? fasi.map((f) => f.id) : [NESSUNA]),
        ...nomi.map((nome) => cond("testo", "contiene", FRECCIA + nome))] }] };
  }

  async function conta(c, risorsa, filtri, email, righe) {
    const r = await motore.esegui(c, risorsa, { filtri, quanti: righe ? RIGHE : 0, ...(righe || {}) }, { email, grezzi: true });
    return { n: r.totale, righe: r.righe };
  }

  async function conNomi(c, righe, fasi) {
    const nomi = async (tabella, ids) => {
      if (!ids.length) return new Map();
      const { rows } = await c.query(`select id, nome from ${tabella} where id = any($1::uuid[])`, [ids]);
      return new Map(rows.map((r) => [r.id, r.nome]));
    };
    const senzaVuoti = (k) => [...new Set(righe.map((r) => r[k]).filter(Boolean))];
    const aziende = await nomi("app.aziende", senzaVuoti("azienda_id"));
    const persone = await nomi("crm.persone", senzaVuoti("persona_id"));
    const fase = new Map(fasi.map((f) => [f.id, f.nome]));
    return (r) => ({ ...r, "azienda.nome": aziende.get(r.azienda_id) ?? null, "persona.nome": persone.get(r.persona_id) ?? null, "fase.nome": fase.get(r.fase_id) ?? null });
  }

  async function conLegamiDelCompito(c, righe) {
    const manca = (r) => r.trattativa_id && !r.azienda_id && !r.persona_id;
    const ids = [...new Set(righe.filter(manca).map((r) => r.trattativa_id))];
    if (!ids.length) return righe;
    const { rows } = await c.query("select id, azienda_id, persona_id from crm.trattative where id = any($1::uuid[])", [ids]);
    const di = new Map(rows.map((t) => [t.id, t]));
    return righe.map((r) => (manca(r) ? { ...r, azienda_id: di.get(r.trattativa_id)?.azienda_id ?? null, persona_id: di.get(r.trattativa_id)?.persona_id ?? null } : r));
  }

  async function raccogliDaFare(c, { di, email, idAperte, fasi, oggi, fRichiami }) {
    const fTrattative = { e: [cond("fase_id", "in", idAperte), cond("archiviata_il", "vuoto"), ...conMe(di, miaODiNessuno("segue")), ENTRO_OGGI("prossimo_il")] };
    const fCompiti = { e: [uguale("tipo", "compito"), cond("fatto_il", "vuoto"), ENTRO_OGGI("scadenza"), ...conMe(di, COMPITO_MIO)] };
    const fonte = (risorsa, filtri, colonne, campo, quanti) =>
      motore.esegui(c, risorsa, { filtri, colonne, quanti, ordine: [{ campo, dir: "asc" }] }, { email, grezzi: true });
    const trattative = await fonte("trattative", fTrattative, COL_TRATTATIVA, "prossimo_il", MAX_FONTE);
    const compiti = await fonte("attivita", fCompiti, COL_COMPITO, "scadenza", MAX_FONTE);
    const richiami = await fonte("aziende", fRichiami, COL_AZIENDA, "richiamare_il", MAX_DA_FARE);
    const richiamiScaduti = await conta(c, "aziende", { e: [fRichiami, { o: [cond("freddo.richiamare_il", "vuoto"), PRIMA_DI_OGGI("freddo.richiamare_il")] }] }, email);

    const scaduto = (quando) => giornoDi.format(new Date(quando)) < oggi;
    const perTrattativa = new Map(trattative.righe.map((r) => [r.id, { tipo: "trattativa", r, quando: r.prossimo_il, compiti: [] }]));
    const soli = [];
    for (const r of compiti.righe) {
      const sua = perTrattativa.get(r.trattativa_id);
      if (!sua) { soli.push({ tipo: "compito", r, quando: r.scadenza, compiti: [] }); continue; }
      sua.compiti.push(r.testo);
      if (new Date(r.scadenza) < new Date(sua.quando)) sua.quando = r.scadenza;
    }
    const uniti = compiti.righe.length - soli.length;
    const conData = [...perTrattativa.values(), ...soli];
    const posto = (v) => (!v.quando ? [1, 0] : [scaduto(v.quando) ? 0 : 2, new Date(v.quando).getTime()]);
    const prime = [...conData, ...richiami.righe.map((r) => ({ tipo: "richiamo", r, quando: r.richiamare_il, compiti: [] }))]
      .sort((a, b) => { const [ga, ta] = posto(a), [gb, tb] = posto(b); return ga - gb || ta - tb; })
      .slice(0, MAX_DA_FARE);

    const coiLegami = await conLegamiDelCompito(c, prime.filter((v) => v.tipo === "compito").map((v) => v.r));
    const legamiDi = new Map(coiLegami.map((r) => [r.id, r]));
    const nomina = await conNomi(c, [...coiLegami, ...prime.filter((v) => v.tipo === "trattativa").map((v) => v.r)], fasi);
    const scheda = { trattativa: (r) => ["trattative", r.id], richiamo: (r) => ["aziende", r.id],
      compito: (r) => (r.trattativa_id ? ["trattative", r.trattativa_id] : r.persona_id ? ["persone", r.persona_id] : ["aziende", r.azienda_id]) };
    const righe = prime.map(({ tipo, r, quando, compiti: dentro }) => {
      const n = tipo === "richiamo" ? { "azienda.nome": r.nome, "persona.nome": r.referente || null } : nomina(legamiDi.get(r.id) ?? r);
      const [risorsa, id] = scheda[tipo](r);
      return {
        chiave: `${tipo}:${r.id}`, tipo, id: r.id, scheda: { risorsa, id }, quando, scaduto: !quando || scaduto(quando), compiti: dentro,
        cosa: tipo === "trattativa" ? r.prossimo_passo : tipo === "compito" ? r.testo : "",
        azienda: n["azienda.nome"], persona: n["persona.nome"],
        chi: (tipo === "trattativa" ? r.segue : tipo === "compito" ? r.assegnato_a || r.creato_da : r.chiamato_da) || null,
      };
    });

    const n = trattative.totale + compiti.totale + richiami.totale - uniti;
    const scaduti = conData.filter((v) => scaduto(v.quando)).length + richiamiScaduti.n;
    const voce = (risorsa, filtri, r) => ({ n: r.totale, risorsa, filtri });
    return {
      n, scaduti, oggi: n - scaduti, uniti, max: MAX_DA_FARE, righe,
      fonti: { trattative: voce("trattative", fTrattative, trattative), richiami: voce("aziende", fRichiami, richiami), compiti: voce("attivita", fCompiti, compiti) },
      trattativeConCompito: [...new Set(compiti.righe.map((r) => r.trattativa_id).filter(Boolean))],
    };
  }

  async function chiHaFatto(c, soci, periodi, email) {
    const emails = soci.map((s) => s.email);
    const dove = (p) => ({ e: [cond("quando", "tra", [p.da, p.a]), cond("creato_da", "in", emails.length ? emails : [NESSUNA])] });
    const voci = {};
    const totali = {};
    for (const [nome, periodo] of Object.entries(periodi)) {
      const r = await motore.esegui(c, "attivita", { filtri: dove(periodo), gruppi: ["creato_da", "tipo"], quanti: 0 }, { email });
      voci[nome] = new Map(r.gruppi.map((g) => [g.valore, g]));
      totali[nome] = { totale: r.totale };
      for (const g of r.gruppi) for (const t of g.gruppi) totali[nome][t.valore] = (totali[nome][t.valore] || 0) + t.n;
    }
    const perPeriodo = (nome, s) => {
      const g = voci[nome].get(s.email);
      return { totale: g?.n ?? 0, ...Object.fromEntries((g?.gruppi ?? []).map((t) => [t.valore, t.n])) };
    };
    return {
      soci: soci.map((s) => ({ email: s.email, nome: s.nome, colore: s.colore,
        ...Object.fromEntries(Object.keys(periodi).map((nome) => [nome, perPeriodo(nome, s)])) })),
      totali,
      filtri: Object.fromEntries(Object.entries(periodi).map(([nome, p]) => [nome, dove(p)])),
    };
  }

  async function leggi(c, di, email) {
    const { rows: [t] } = await c.query(`select (now() at time zone '${FUSO}')::date::text as oggi, now() as adesso,
      date_trunc('week', now() at time zone '${FUSO}')::date::text as da,
      (date_trunc('week', now() at time zone '${FUSO}')::date + 6)::text as a`);
    const { rows: fasi } = await c.query("select id, nome, tipo from app.fasi_lead");
    const { rows: tuttiSoci } = await c.query("select email, nome, colore from app.soci order by nome, email");
    const soglia = await soglie(c);
    const aperte = fasi.filter((f) => f.tipo === "aperta");
    const idAperte = aperte.length ? aperte.map((f) => f.id) : [NESSUNA];
    const settimana = { da: t.da, a: t.a };

    const fCoda = { e: [IN_CODA, ...conMe(di, MIA_O_DI_NESSUNO)] };
    const baseRichiami = [LIBERA, RICHIAMO, ...conMe(di, miaODiNessuno("freddo.chiamato_da"))];
    const fRichiami = { e: [...baseRichiami, { o: [cond("freddo.richiamare_il", "vuoto"), cond("freddo.richiamare_il", "minore", { da_oggi: 1 })] }] };
    const fScaduti = { e: [...baseRichiami, RICHIAMO_DOVUTO] };
    const coda = await conta(c, "aziende", fCoda, email);
    const richiami = await conta(c, "aziende", fRichiami, email, { colonne: COL_AZIENDA, ordine: [{ campo: "richiamare_il", dir: "asc" }] });
    const scaduti = await conta(c, "aziende", fScaduti, email);

    const { trattativeConCompito, ...daFare } = await raccogliDaFare(c, { di, email, idAperte, fasi, oggi: t.oggi, fRichiami });
    const fuoriDalleCoseDaFare = trattativeConCompito.length ? [cond("id", "non_in", trattativeConCompito)] : [];

    const fFerme = { e: filtriFerme(aperte, soglia, [cond("archiviata_il", "vuoto"), ...conMe(di, uguale("segue", IO))]) };
    const fSenza = { e: [cond("fase_id", "in", idAperte), cond("archiviata_il", "vuoto"), ...conMe(di, miaODiNessuno("segue")), ...fuoriDalleCoseDaFare,
      { o: [cond("prossimo_il", "vuoto"), { e: [cond("prossimo_passo", "vuoto"), DA_DOMANI("prossimo_il")] }] }] };
    const fAltre = { e: [fFerme, cond("prossimo_passo", "non_vuoto"), DA_DOMANI("prossimo_il"), ...fuoriDalleCoseDaFare] };
    const leTrattative = { colonne: COL_TRATTATIVA, ordine: [{ campo: "mossa_il", dir: "asc" }] };
    const ferme = await conta(c, "trattative", fFerme, email, leTrattative);
    const senza = await conta(c, "trattative", fSenza, email, leTrattative);
    const altre = await conta(c, "trattative", fAltre, email, leTrattative);
    const oggiInGiorni = inGiorni(t.oggi);
    const conFermaDa = (r) => ({ ...r, ferma_da: oggiInGiorni - inGiorni(giornoDi.format(r.mossa_il)) });
    const nominata = await conNomi(c, [...ferme.righe, ...senza.righe, ...altre.righe], fasi);

    const voce = async (scelte) => {
      const filtri = spostamentiVerso(scelte, settimana, di);
      return { n: (await conta(c, "attivita", filtri, email)).n, risorsa: "attivita", filtri };
    };
    const consulenze = await voce(aperte.filter((f) => CONSULENZA.test(f.nome)));
    const proposte = await voce(aperte.filter((f) => PROPOSTA.test(f.nome)));
    const firme = await voce(fasi.filter((f) => f.tipo === "cliente"));

    const soci = di === "me" ? tuttiSoci.filter((s) => s.email === String(email).toLowerCase()) : tuttiSoci;
    const fatte = await chiHaFatto(c, soci, { oggi: { da: t.oggi, a: t.oggi }, settimana }, email);

    return {
      di, oggi: t.oggi, adesso: t.adesso,
      da_chiamare: { n: coda.n, risorsa: "aziende", filtri: fCoda },
      da_fare: daFare,
      richiami: { n: richiami.n, scaduti: scaduti.n, oggi: richiami.n - scaduti.n, risorsa: "aziende", filtri: fRichiami, filtri_scaduti: fScaduti, righe: richiami.righe },
      ferme: { n: ferme.n, risorsa: "trattative", filtri: fFerme, soglie: Object.fromEntries(aperte.map((f) => [f.id, soglia.di(f.id)])),
        soglia_di_base: soglia.base, righe: ferme.righe.map(conFermaDa).map(nominata),
        altre: { n: altre.n, risorsa: "trattative", filtri: fAltre, righe: altre.righe.map(conFermaDa).map(nominata) } },
      senza_passo: { n: senza.n, risorsa: "trattative", filtri: fSenza, righe: senza.righe.map(nominata) },
      settimana: { ...settimana, consulenze_fissate: consulenze, proposte_inviate: proposte, firme },
      chi_ha_fatto: fatte,
    };
  }

  async function rotta({ metodo, risorsa, id, cerca, email }) {
    if (risorsa !== "oggi" || id !== undefined) return null;
    if (metodo !== "GET") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    for (const k of new Set(cerca.keys())) if (k !== "di") throw new ErroreApi(400, "parametro fuori lista", "parametro");
    const chiesti = cerca.getAll("di");
    if (chiesti.length > 1 || (chiesti.length && !["me", "team"].includes(chiesti[0]))) throw new ErroreApi(400, "di: me oppure team", "parametro");
    const di = chiesti[0] || "me";
    const corpo = await conLaSessione(email, async (c) => {
      if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "il cruscotto è solo per gli utenti", "socio");
      return leggi(c, di, email);
    });
    return { stato: 200, corpo };
  }

  return { rotta, leggi };
}
