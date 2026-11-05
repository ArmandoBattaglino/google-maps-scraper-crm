import * as archivio from "./archivio.mjs";
import { apriBrowser, cercaMaps, Captcha, PaginaCambiata } from "./raccolte/maps.mjs";
import { cercaMapsIbrida, IbridaNonVa } from "./raccolte/maps-ibrida.mjs";
import { leggiSito } from "./raccolte/siti.mjs";
import { zonaDa } from "./raccolte/geo.mjs";
import { eseguiGriglia } from "./raccolte/griglia.mjs";
import { etichettaDi } from "./raccolte/etichetta.mjs";
import { avvisa } from "./avvisi.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR_FONTI = path.join(path.dirname(fileURLToPath(import.meta.url)), "raccolte", "fonti");
const fontiDisponibili = () => fs.readdirSync(DIR_FONTI).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4));

const PG = process.env.DATABASE_URL ? archivio : null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPI = new Set(["google-maps", "siti"]);
const STRADE = new Set(["ibrida", "browser"]);
const ora = () => new Date().toISOString();
const aCaso = (min, max) => min + Math.random() * (max - min);
const attesa = (ms, segnale) => new Promise((ok) => {
  const t = setTimeout(ok, ms);
  segnale?.addEventListener("abort", () => { clearTimeout(t); ok(); }, { once: true });
});
const PARALLELI_SITI = 4;
const PAUSA_CAPTCHA_S = () => Math.max(10, Number(process.env.RACCOLTE_PAUSA_CAPTCHA_S || 3 * 3600));

export const FONTE_DI_BASE = "zoom";
const PERTINENTE = "a.dati->>'etichetta' is distinct from 'non-azienda'";

export const SALVA_SQL = `select s.in_lista_nuova, p.segnata from jsonb_array_elements($3::jsonb) with ordinality e(v, n)
  cross join lateral app.salva_azienda(e.v, $1::uuid, $2::uuid) s
  cross join lateral app.segna_provenienza(s.azienda_id, $2::uuid, $1::uuid, e.v->'provenienza', s.nuova) p(segnata) order by e.n`;

export function postiDa(parametri, tutte) {
  const P = parametri || {}, griglia = P.modo === "griglia";
  return [...new Map(tutte.map((x) => [x.fonte_id ?? `senza-id-${Math.random()}`, x])).values()].map((x) => {
    const categorie = x.dati?.categorie?.length ? x.dati.categorie : x.categoria ? [x.categoria] : [];
    return {
      nome: x.nome, telefono: x.telefono || "", sito: x.sito || "", email: x.email || "", piva: x.dati?.piva || "",
      indirizzo: x.indirizzo || "", comune: x.citta || "", categoria: x.categoria || "", categorie,
      valutazione: x.valutazione ?? null, recensioni: x.recensioni ?? null, place_id: x.dati?.place_id || x.fonte_id || null,
      dati: { ...(x.dati || {}), categorie, fonte: x.fonte || "google-maps" },
      provenienza: { parola: x.dati?.parola || P.cosa || "", luogo: x.citta || "", zona: griglia ? P.zona_nome || P.zona || "" : "",
        fonte: x.dati?.strada || P.fonte || P.strada || "", metodo: griglia ? "griglia" : "luoghi", etichetta: etichettaDi(categorie) },
    };
  });
}

export function luoghi(x) {
  const lista = (Array.isArray(x) ? x : String(x ?? "").split(/[\n;,]+/)).map((s) => String(s).trim().replace(/\s+/g, " ")).filter(Boolean);
  const visti = new Set();
  return lista.filter((s) => !visti.has(s.toLowerCase()) && visti.add(s.toLowerCase()));
}

export function parametriDi(b, Errore) {
  const tipo = String(b.tipo || "google-maps");
  if (!TIPI.has(tipo)) throw new Errore(400, `tipo: «google-maps» o «siti» (non «${tipo.slice(0, 40)}»)`);
  if (tipo === "google-maps" && b.zona !== undefined && b.zona !== null && b.zona !== "") {
    let zona;
    try { zona = zonaDa(String(b.zona)); } catch (e) { throw new Errore(400, e.message); }
    const grezze = Array.isArray(b.parole) ? b.parole : Array.isArray(b.cosa) ? b.cosa : [b.parole ?? b.cosa];
    const parole = [...new Map(grezze.map((x) => String(x ?? "").trim().replace(/\s+/g, " ")).filter(Boolean).map((x) => [x.toLowerCase(), x])).values()];
    if (!parole.length || parole.length > 6 || parole.some((x) => x.length < 2 || x.length > 120)) throw new Errore(400, "parole: da 1 a 6 parole da cercare (2-120 caratteri l'una), es. [\"carpenteria metallica\", \"lavorazioni lamiera\"]");
    const tetto = b.tetto === undefined ? 160 : Number(b.tetto);
    if (![60, 100, 160].includes(tetto)) throw new Errore(400, "tetto: 160 (di base), 100 o 60 posti per cella");
    const fonte = String(b.fonte || FONTE_DI_BASE);
    if (!fontiDisponibili().includes(fonte)) throw new Errore(400, `fonte: una di ${fontiDisponibili().join(", ")} (non «${fonte.slice(0, 40)}»)`);
    const soloNicchia = b.solo_nicchia === true;
    if (soloNicchia && b.campione === false) throw new Errore(400, "solo_nicchia: la nicchia si ricava dal campione, non si può togliere (campione = false)");
    return { tipo, parametri: { modo: "griglia", zona: String(b.zona).trim(), zona_nome: zona.nome, zona_tipo: zona.tipo, comuni: zona.comuni.length,
      parole, campione: b.campione === true || soloNicchia, solo_nicchia: soloNicchia, tetto, fonte, poi_siti: b.poi_siti === true } };
  }
  if (tipo === "google-maps") {
    const cosa = String(b.cosa || "").trim().replace(/\s+/g, " ");
    if (cosa.length < 2 || cosa.length > 120) throw new Errore(400, "cosa: cosa cercare su Maps, da 2 a 120 caratteri (es. «autotrasporti», «officine meccaniche»)");
    const dove = luoghi(b.dove);
    if (!dove.length || dove.length > 30 || dove.some((d) => d.length > 80)) throw new Errore(400, "dove: da 1 a 30 luoghi (città, quartieri, paesi), ognuno fino a 80 caratteri");
    const massimo = b.massimo === undefined ? 60 : Number(b.massimo);
    if (!Number.isInteger(massimo) || massimo < 1 || massimo > 200) throw new Errore(400, "massimo: quante aziende per luogo, da 1 a 200 (Maps ne mostra al massimo ~120 per ricerca)");
    const strada = b.strada === undefined || b.strada === null || b.strada === "" ? "ibrida" : String(b.strada);
    if (!STRADE.has(strada)) throw new Errore(400, "strada: «ibrida» (di base, col browser di riserva) o «browser»");
    return { tipo, parametri: { cosa, dove, massimo, poi_siti: b.poi_siti === true, strada } };
  }
  const massimo = b.massimo === undefined ? 300 : Number(b.massimo);
  if (!Number.isInteger(massimo) || massimo < 1 || massimo > 1000) throw new Errore(400, "massimo: quanti siti leggere, da 1 a 1000");
  const solo = b.solo_raccolta ? String(b.solo_raccolta) : null;
  if (solo && !UUID.test(solo)) throw new Errore(400, "solo_raccolta: l'id di una raccolta");
  return { tipo, parametri: { massimo, ...(solo ? { solo_raccolta: solo } : {}) } };
}

export function creaRaccolte({ Errore }) {
  const attivi = new Map();
  const corsie = { maps: { attesa: [], gira: false }, siti: { attesa: [], gira: false } };

  function disponibile() {
    if (!PG) throw new Errore(503, "manca DATABASE_URL");
  }
  const q = (sql, par) => PG.query(sql, par, archivio.chi());
  async function soloSoci() {
    disponibile();
    const [x] = await q("select current_user = 'authenticated' and app.e_socio() as ok", []);
    if (!x?.ok) throw new Errore(403, `${archivio.chi()} non è fra gli utenti del CRM`);
  }
  async function segna(id, patch) {
    try { await archivio.aggiorna("raccolte", id, { ...patch, aggiornato: ora() }); }
    catch (e) { console.error(`raccolte: un aggiornamento non è stato scritto (${e.code || String(e.message).slice(0, 80)})`); }
  }

  async function trova(chiave) {
    disponibile();
    const s = String(chiave ?? "").trim().replace(/^#/, "");
    const filtro = UUID.test(s) ? `id=eq.${s}` : /^\d{1,9}$/.test(s) ? `numero=eq.${s}` : null;
    if (!filtro) throw new Errore(400, "raccolta: l'id (uuid) o il numero della raccolta");
    const [r] = await archivio.leggi("raccolte", `select=*&${filtro}`);
    if (!r) throw new Errore(404, `raccolta ${s} non trovata`);
    return interrotta(r);
  }
  async function interrotta(r) {
    if (r.stato !== "in-corso" || attivi.has(r.id)) return r;
    const x = await archivio.aggiorna("raccolte", r.id, { stato: "interrotta", passo: "", aggiornato: ora() });
    return x || { ...r, stato: "interrotta" };
  }

  async function lista(b, parametri) {
    if (b.lista) {
      const id = String(b.lista);
      if (!UUID.test(id)) throw new Errore(400, "lista: l'id (uuid) di una lista a freddo (da GET /api/raccolte/liste)");
      const [l] = await archivio.leggi("liste_freddo", `select=id,nome&id=eq.${id}`);
      if (!l) throw new Errore(404, "lista non trovata");
      return l;
    }
    const nome = String(b.nuova_lista || "").trim() ||
      (parametri.modo === "griglia" ? `${parametri.parole[0][0].toUpperCase()}${parametri.parole[0].slice(1)} · ${parametri.zona_nome}` : "") ||
      (parametri.cosa ? `${parametri.cosa[0].toUpperCase()}${parametri.cosa.slice(1)} · ${parametri.dove[0]}${parametri.dove.length > 1 ? ` +${parametri.dove.length - 1}` : ""}` : "");
    if (!nome) throw new Errore(400, "serve la lista dove mettere le aziende: lista (id) o nuova_lista (nome)");
    return archivio.inserisci("liste_freddo", { nome: nome.slice(0, 120), ...(b.nicchia && UUID.test(String(b.nicchia)) ? { nicchia_id: String(b.nicchia) } : {}) });
  }

  async function apri(b, da) {
    disponibile();
    const { tipo, parametri } = parametriDi(b || {}, Errore);
    const l = await lista(b, parametri);
    const riga = await archivio.inserisci("raccolte", { lista_id: l.id, tipo, parametri, da_dove: da, passo: "in coda" });
    metti(riga);
    return { ...riga, lista: { id: l.id, nome: l.nome } };
  }
  function metti(riga) {
    const a = { ctl: new AbortController(), email: archivio.chi() };
    attivi.set(riga.id, a);
    const c = corsie[riga.tipo === "siti" ? "siti" : "maps"];
    c.attesa.push({ riga, a });
    posti(c);
    gira(c);
  }
  function posti(c) {
    c.attesa.forEach(({ riga, a }, i) => {
      const prima = i ? c.attesa[i - 1].riga.numero : c.davanti;
      archivio.conChi(a.email, () => segna(riga.id, { passo: `in coda · ${i + 1}ª${prima ? ` (dopo #${prima})` : ""}` })).catch(() => {});
    });
  }
  async function gira(c) {
    if (c.gira) return;
    c.gira = true;
    while (c.attesa.length) {
      const { riga, a } = c.attesa.shift();
      c.davanti = riga.numero; posti(c);
      try { await archivio.conChi(a.email, () => esegui(riga, a)); }
      catch (e) { console.error(`raccolte: ${e.code || String(e.message).slice(0, 80)}`); }
      c.davanti = null;
    }
    c.gira = false;
  }

  async function esegui(riga, a) {
    let finita = false;
    try {
      if (a.ctl.signal.aborted) return;
      console.log(`raccolte: #${riga.numero} ${riga.tipo} parte`);
      await segna(riga.id, { passo: "parte" });
      const conti = riga.tipo === "siti" ? await siti(riga, a) : riga.parametri?.modo === "griglia" ? await griglia(riga, a) : await maps(riga, a);
      finita = !a.ctl.signal.aborted;
      await segna(riga.id, { ...conti, stato: finita ? "finita" : "fermata", passo: "", finita: ora() });
      console.log(`raccolte: #${riga.numero} ${finita ? "finita" : "fermata"} (trovate ${conti.trovate}, nuove ${conti.nuove ?? 0})`);
    } catch (e) {
      const chiaro = e instanceof Captcha || e instanceof PaginaCambiata || e.name === "Captcha";
      const parole = chiaro ? e.message : `qualcosa non è andato: ${String(e.message || e).split("\n")[0].slice(0, 240)}`;
      const tipo = e instanceof Captcha || e.name === "Captcha" ? "captcha" : e instanceof PaginaCambiata ? "pagina-cambiata" : null;
      console.error(`raccolte: #${riga.numero} errore (${tipo || e.code || e.name || "errore"})`);
      if (tipo) await avvisa(tipo, parole, { raccolta: riga.numero });
      if (tipo === "captcha") {
        const [r] = await archivio.leggi("raccolte", `select=rapporto&id=eq.${riga.id}`).catch(() => []);
        const pause = (r?.rapporto?.pause || 0) + 1, alle = new Date(Date.now() + PAUSA_CAPTCHA_S() * 1000);
        if (pause > 4) await segna(riga.id, { stato: "errore", errore: `${parole} — 4 pause di fila: si ferma (Riprendi per riprovare)`, passo: "", finita: ora() });
        else await segna(riga.id, { stato: "interrotta", riprende_alle: alle.toISOString(), rapporto: { ...(r?.rapporto || {}), pause },
          errore: `captcha di Google: riprende da sola alle ${alle.toISOString().slice(11, 16)} UTC (pausa ${pause} di 4)`, passo: "" });
      } else await segna(riga.id, { stato: "errore", errore: parole, passo: "", finita: ora() });
    } finally {
      if (a.ctl.signal.aborted) await segna(riga.id, { stato: "fermata", passo: "" });
      attivi.delete(riga.id);
    }
    if (finita && riga.tipo === "google-maps" && riga.parametri?.poi_siti) {
      try {
        const dopo = await archivio.inserisci("raccolte", { lista_id: riga.lista_id, tipo: "siti", parametri: { massimo: 1000, solo_raccolta: riga.id }, da_dove: riga.da_dove, passo: "in coda" });
        metti(dopo);
      } catch (e) { console.error(`raccolte: la catena dopo #${riga.numero} non parte (${e.code || String(e.message).slice(0, 80)})`); }
    }
  }

  async function griglia(riga, a) {
    const P = riga.parametri, zona = zonaDa(P.zona);
    const [ora_] = await archivio.leggi("raccolte", `select=rapporto&id=eq.${riga.id}`);
    const rap = { ...(ora_?.rapporto || riga.rapporto || {}) };
    let ripresa = null;
    if (rap.giro?.parole && !rap.giro.finito) {
      const celle = await q(`select id, parola, sud, ovest, nord, est, profondita, stato, dentro, luogo, comune_istat, madre_id
        from app.raccolte_celle where raccolta_id = $1 order by creato`, [riga.id]);
      const visti = (await q(`select k.valore from app.aziende_provenienze p join app.aziende_chiavi k on k.azienda_id = p.azienda_id and k.tipo = 'place_id'
        where p.raccolta_id = $1`, [riga.id])).map((x) => x.valore);
      ripresa = { giro: rap.giro, celle, visti };
      console.log(`raccolte: #${riga.numero} griglia ripresa dalla parola ${rap.giro.i + 1} di ${rap.giro.parole.length} · ${celle.length} celle già salvate`);
    }
    const modulo = await import(pathToFileURL(path.join(DIR_FONTI, `${P.fonte}.mjs`)).href);
    const fonte = await modulo.apri({ segnale: a.ctl.signal });
    let ultimo = 0;
    const scrivi = (fn) => fn().catch((e) => { console.error(`raccolte: una cella non è stata scritta (${e.code || "errore"})`); return [{}]; });
    try {
      const { rapporto, conti, giro } = await eseguiGriglia({
        zona, parole: P.parole, campione: P.campione, soloNicchia: P.solo_nicchia === true, tetto: P.tetto, fonte, nomeFonte: P.fonte, segnale: a.ctl.signal, ripresa,
        nuovaCella: async (c) => (await scrivi(() => q(`insert into app.raccolte_celle (raccolta_id, parola, luogo, comune_istat, madre_id, sud, ovest, nord, est,
            profondita, stato, tetto) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'da-fare', $11) returning id`,
          [riga.id, c.parola, c.luogo, c.comune.istat, c.madre_id, c.r.sud, c.r.ovest, c.r.nord, c.r.est, c.profondita, c.tetto])))[0]?.id || null,
        aggiornaCella: (id, c) => id ? scrivi(() => q(`update app.raccolte_celle set stato = $2, motivo = $3, r_metri = $4, distanza_max = $5, dentro = $6, oltre = $7,
            posti = $8, nuovi = $9, richieste = $10, pagine = $11, tetto = $12, aggiornato = now() where id = $1`,
          [id, c.stato, String(c.motivo || "").slice(0, 300), c.r_metri, c.distanza_max, c.dentro, c.oltre, c.posti, c.nuovi, c.richieste, c.pagine, c.tetto])) : null,
        salvaGiro: (g) => { rap.giro = g; return segna(riga.id, { rapporto: rap }); },
        salvaPosti: (righe) => salva(riga, righe),
        avanza: async (passo, c) => { if (Date.now() - ultimo > 2000) { ultimo = Date.now(); await segna(riga.id, { passo: passo.slice(0, 200), trovate: c.trovate, nuove: c.nuove, aggiornate: c.aggiornate }); } },
      });
      const { riprese, pause, riprese_a_mano } = rap;
      await segna(riga.id, { rapporto: { ...rapporto, giro, ...(riprese ? { riprese } : {}), ...(pause ? { pause } : {}), ...(riprese_a_mano ? { riprese_a_mano } : {}) } });
      console.log(`raccolte: #${riga.numero} griglia: ${rapporto.celle ? Object.entries(rapporto.celle).map(([k, v]) => `${k} ${v}`).join(" · ") : ""} · copertura ${rapporto.copertura}% · richieste ${rapporto.richieste}`);
      return { trovate: conti.trovate, nuove: conti.nuove, aggiornate: conti.aggiornate };
    } finally { await fonte.chiudi(); }
  }

  async function unLuogo(ctx, riga, dove, a) {
    const { cosa, massimo, strada = "ibrida" } = riga.parametri;
    if (strada === "ibrida") {
      try {
        const r = await cercaMapsIbrida(ctx, { cosa, dove, massimo, segnale: a.ctl.signal });
        return { ...r, strada: "ibrida" };
      } catch (e) {
        if (e instanceof Captcha) throw e;
        console.log(`raccolte: #${riga.numero} un luogo passa al browser (${e instanceof IbridaNonVa ? "ibrida-non-va" : e instanceof PaginaCambiata ? "json-cambiato" : e.name || "errore"})`);
        if (e instanceof PaginaCambiata) await avvisa("json-cambiato", `la via ibrida non legge più il JSON di Maps, i luoghi passano al browser: ${e.message}`, { raccolta: riga.numero });
        if (a.ctl.signal.aborted) return { aziende: [], fine: "ferma", strada: "ibrida" };
      }
    }
    const r = await cercaMaps(ctx, { cosa, dove, massimo, segnale: a.ctl.signal });
    for (const x of r.aziende) x.dati = { ...x.dati, strada: "browser" };
    return { ...r, strada: "browser" };
  }

  async function maps(riga, a) {
    const { dove } = riga.parametri;
    const conti = { trovate: 0, nuove: 0, aggiornate: 0 };
    const strade = { ibrida: 0, browser: 0 };
    const { browser, ctx } = await apriBrowser();
    try {
      for (let i = 0; i < dove.length; i++) {
        if (a.ctl.signal.aborted) break;
        await segna(riga.id, { ...conti, passo: `${dove[i]} (${i + 1} di ${dove.length})` });
        const r = await unLuogo(ctx, riga, dove[i], a);
        strade[r.strada]++;
        conti.trovate += r.aziende.length;
        const s = await salva(riga, r.aziende);
        conti.nuove += s.nuove; conti.aggiornate += s.aggiornate;
        await segna(riga.id, { ...conti, passo: `${dove[i]} (${i + 1} di ${dove.length}) · ${r.strada}` });
        if (i < dove.length - 1) await attesa(aCaso(3000, 7000), a.ctl.signal);
      }
    } finally { await browser.close().catch(() => {}); }
    console.log(`raccolte: #${riga.numero} luoghi per strada: ibrida ${strade.ibrida} · browser ${strade.browser}`);
    return conti;
  }

  async function salva(riga, tutte) {
    const posti = postiDa(riga.parametri, tutte);
    if (!posti.length) return { nuove: 0, aggiornate: 0 };
    const r = await q(SALVA_SQL, [riga.lista_id, riga.id, JSON.stringify(posti)]);
    const nuove = r.filter((x) => x.in_lista_nuova).length;
    return { nuove, aggiornate: r.length - nuove };
  }

  async function siti(riga, a) {
    const { massimo, solo_raccolta } = riga.parametri;
    const daLeggere = await q(`select a.id, a.sito from app.liste_aziende la join app.aziende a on a.id = la.azienda_id
       where la.lista_id = $1 and a.sito <> '' and a.email = '' and not (a.dati ? 'sito_letto') and ${PERTINENTE} ${solo_raccolta ? "and la.raccolta_id = $3" : ""}
       order by la.creato, a.nome limit $2`, solo_raccolta ? [riga.lista_id, massimo, solo_raccolta] : [riga.lista_id, massimo]);
    const conti = { trovate: 0, nuove: 0, aggiornate: 0 };
    let fatte = 0, prossima = 0;
    const tot = daLeggere.length;
    await segna(riga.id, { passo: `siti: 0 di ${tot}` });
    const lavora = async () => {
      while (prossima < tot && !a.ctl.signal.aborted) {
        const x = daLeggere[prossima++];
        const s = await leggiSito(x.sito, { segnale: a.ctl.signal });
        const dati = { sito_letto: ora(), ...(s.pec ? { pec: s.pec } : {}), ...(s.piva ? { piva: s.piva } : {}),
          ...(s.email_tutte?.length > 1 ? { email_tutte: s.email_tutte } : {}), ...(s.errore ? { sito_errore: s.errore } : {}) };
        try {
          await q("select app.azienda_dal_sito($1::uuid, $2, $3, $4::jsonb)", [x.id, s.email || "", s.piva || "", JSON.stringify(dati)]);
          conti.aggiornate++;
          if (s.email) conti.trovate++;
        } catch (e) { console.error(`raccolte: un'azienda non è stata aggiornata (${e.code || "errore"})`); }
        if (++fatte % 5 === 0 || fatte === tot) await segna(riga.id, { ...conti, passo: `siti: ${fatte} di ${tot}` });
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLELI_SITI, tot) }, lavora));
    return conti;
  }

  async function elenco(u) {
    disponibile();
    const limite = Math.min(100, Math.max(1, Number(u.searchParams.get("limite")) || 20));
    const l = u.searchParams.get("lista");
    if (l && !UUID.test(l)) throw new Errore(400, "lista: un uuid");
    const righe = await archivio.leggi("raccolte", `select=*${l ? `&lista_id=eq.${l}` : ""}&order=creato.desc&limit=${limite}`);
    return Promise.all(righe.map(interrotta));
  }
  async function liste() {
    disponibile();
    return q(`select l.id, l.nome, l.nicchia_id, l.creato,
                count(a.id) filter (where ${PERTINENTE})::int as aziende,
                count(a.id) filter (where a.dati->>'etichetta' = 'non-azienda')::int as non_aziende,
                count(a.id) filter (where ${PERTINENTE} and a.telefono <> '')::int as con_telefono,
                count(a.id) filter (where ${PERTINENTE} and a.email <> '')::int as con_email,
                count(a.id) filter (where ${PERTINENTE} and a.esito = 'da-chiamare' and a.contatto_id is null)::int as da_chiamare,
                count(a.id) filter (where ${PERTINENTE} and a.contatto_id is not null)::int as gia_nel_crm,
                count(a.id) filter (where ${PERTINENTE} and a.unione = 'da-controllare')::int as da_controllare
               from app.liste_freddo l left join app.liste_aziende la on la.lista_id = l.id left join app.aziende a on a.id = la.azienda_id
              group by l.id order by l.creato desc`, []);
  }
  async function dettaglio(chiave) {
    const r = await trova(chiave);
    const campione = await q(`select a.nome, a.telefono, a.comune as citta, a.sito, a.email, a.categoria, a.valutazione, a.recensioni,
       a.contatto_id is not null as gia_nel_crm, a.unione,
       (select string_agg(x.v, ', ' order by x.v) from (select distinct p.parola || ' · ' || coalesce(nullif(p.zona, ''), p.luogo) as v
          from app.aziende_provenienze p where p.azienda_id = a.id and p.raccolta_id = $1) x) as trovata_da
       from app.aziende a where ${PERTINENTE} and exists (select 1 from app.aziende_provenienze p where p.azienda_id = a.id and p.raccolta_id = $1)
       order by a.creato limit 15`, [r.id]);
    const [nn] = await q(`select count(*)::int as n from app.aziende a where a.dati->>'etichetta' = 'non-azienda'
       and exists (select 1 from app.aziende_provenienze p where p.azienda_id = a.id and p.raccolta_id = $1)`, [r.id]);
    const [l] = await archivio.leggi("liste_freddo", `select=id,nome&id=eq.${r.lista_id}`);
    return { ...r, lista: l || null, campione, non_aziende: nn?.n || 0 };
  }
  async function ferma(chiave) {
    const r = await trova(chiave);
    const a = attivi.get(r.id);
    if (!a) return r;
    a.ctl.abort();
    return (await archivio.aggiorna("raccolte", r.id, { fermata_da: archivio.chi(), passo: "si ferma…", aggiornato: ora() })) || r;
  }
  async function riprendi(chiave, da) {
    const r = await trova(chiave);
    if (r.stato === "in-corso") throw new Errore(409, `la raccolta #${r.numero} è ancora in corso`);
    if (r.stato === "finita") {
      const riga = await archivio.inserisci("raccolte", { lista_id: r.lista_id, tipo: r.tipo, parametri: r.parametri, da_dove: da, passo: "in coda" });
      metti(riga);
      return riga;
    }
    const rapporto = { ...(r.rapporto || {}), riprese_a_mano: (r.rapporto?.riprese_a_mano || 0) + 1, pause: 0 };
    const riga = await archivio.aggiorna("raccolte", r.id, { stato: "in-corso", riprende_alle: null, errore: "", fermata_da: null, finita: null, rapporto, passo: "in coda (ripresa)", aggiornato: ora() });
    metti(riga || { ...r, stato: "in-corso", rapporto });
    return riga || r;
  }

  async function continua({ avvio = false } = {}) {
    if (!PG) return 0;
    let rimesse = 0;
    for (const x of await q("select * from app.raccolte_da_continuare()", [])) {
      if (attivi.has(x.id)) continue;
      try {
        await archivio.conChi(x.creato_da, async () => {
          const [r] = await archivio.leggi("raccolte", `select=*&id=eq.${x.id}`);
          if (!r || attivi.has(r.id)) return;
          let rapporto = { ...(r.rapporto || {}) }, passo;
          if (r.stato === "in-corso") {
            if (!avvio) return;
            rapporto.riprese = (rapporto.riprese || 0) + 1;
            if (rapporto.riprese > 2) {
              await segna(r.id, { stato: "errore", errore: "il raccoglitore è ripartito 3 volte durante questa raccolta: si ferma (Riprendi per riprovare)", passo: "", finita: ora() });
              return;
            }
            passo = `in coda (ripresa ${rapporto.riprese} dopo un riavvio)`;
          } else if (r.stato === "interrotta" && r.riprende_alle && new Date(r.riprende_alle) <= new Date()) {
            passo = "in coda (ripresa dopo la pausa del captcha)";
          } else return;
          await segna(r.id, { stato: "in-corso", riprende_alle: null, errore: "", rapporto, passo });
          metti({ ...r, stato: "in-corso", riprende_alle: null, rapporto });
          rimesse++;
        });
      } catch (e) { console.error(`raccolte: la ripresa di #${x.numero} non è partita (${e.code || e.name || "errore"})`); }
    }
    if (avvio || rimesse) console.log(`raccolte: ${avvio ? "all'avvio " : ""}${rimesse} raccolte rimesse in coda`);
    return rimesse;
  }
  const riprendiAllAvvio = () => continua({ avvio: true });

  async function gestisci(req, res, u, parti, { corpo, json }) {
    await soloSoci();
    const da = req.headers["x-utente-da"] === "mcp" ? "mcp" : "pagina";
    const [, , chiave, azione] = parti;
    if (!chiave && req.method === "GET") return json(res, await elenco(u));
    if (!chiave && req.method === "POST") return json(res, await apri(await corpo(req), da), 201);
    if (chiave === "liste" && !azione && req.method === "GET") return json(res, await liste());
    if (chiave && azione === "celle" && req.method === "GET") {
      const x = await trova(chiave);
      return json(res, await q(`select parola, luogo, comune_istat, sud, ovest, nord, est, profondita, stato, motivo, r_metri, distanza_max, dentro, oltre, posti,
        nuovi, richieste, pagine, tetto, creato, aggiornato from app.raccolte_celle where raccolta_id = $1 order by creato limit 5000`, [x.id]));
    }
    if (chiave && !azione && req.method === "GET") return json(res, await dettaglio(chiave));
    if (req.method !== "POST") throw new Errore(405, "metodo non previsto");
    if (azione === "ferma") return json(res, await ferma(chiave));
    if (azione === "riprendi") return json(res, await riprendi(chiave, da), 201);
    throw new Errore(404, "azione sconosciuta");
  }

  return { gestisci, attivi, riprendiAllAvvio, continua };
}
