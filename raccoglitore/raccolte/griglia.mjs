import { figli, toccaZona, comuneDi, lato, raggio, copertura, centro, areaKm2, boxZona } from "./geo.mjs";
import { etichettaDi, NON_AZIENDA } from "./etichetta.mjs";

export const MINIMO_M = 200;
export const TETTI = [160, 100, 60];
const norma = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const DOPPI = new Set(["castro", "livo", "peglio", "samone", "san teodoro"]);
export const luogoDi = (c) => DOPPI.has(norma(c.nome)) ? `${c.nome} ${c.sigla}` : c.nome;
export const cellePartenza = (zona) => zona.comuni.map((c) => ({ r: { sud: c.box[0], ovest: c.box[1], nord: c.box[2], est: c.box[3] }, luogo: luogoDi(c), comune: c, profondita: 0 }));

export function rigaDa(p, comune, { fonte, parola, dubbio }) {
  return {
    nome: String(p.nome || "").slice(0, 300), telefono: String(p.telefono || "").slice(0, 40), citta: comune.nome,
    sito: String(p.sito || "").slice(0, 500), indirizzo: String(p.indirizzo || "").slice(0, 300), categoria: String(p.categoria || "").slice(0, 120),
    valutazione: Number.isFinite(p.voto) ? Math.round(p.voto * 10) / 10 : null, recensioni: Number.isFinite(p.recensioni) ? Math.round(p.recensioni) : null,
    fonte: "google-maps", fonte_id: p.place_id,
    dati: { place_id: p.place_id, ...(p.link ? { maps: p.link } : {}), lat: p.lat, lng: p.lng, comune_istat: comune.istat, sigla: comune.sigla,
      ...(p.cap ? { cap: p.cap } : {}), ...(p.provincia ? { provincia: p.provincia } : {}), ...(p.categorie?.length > 1 ? { categorie: p.categorie.slice(0, 8) } : {}),
      ...(p.orari ? { orari: p.orari } : {}), ...(p.sito_tipo ? { sito_tipo: p.sito_tipo } : {}), ...(p.sito_grezzo ? { sito_grezzo: String(p.sito_grezzo).slice(0, 1000) } : {}), strada: fonte, parola, ...(dubbio ? { dubbio: true } : {}) },
  };
}

export function cellaCampione(zona) {
  const nome = norma(zona.nome.replace(/^(provincia|città metropolitana) di /i, ""));
  const c = zona.comuni.find((x) => norma(x.nome) === nome) || zona.comuni.reduce((m, x) => ((x.box[2] - x.box[0]) * (x.box[3] - x.box[1]) > (m.box[2] - m.box[0]) * (m.box[3] - m.box[1]) ? x : m));
  const lat = (c.box[0] + c.box[2]) / 2, lng = (c.box[1] + c.box[3]) / 2, d = 1 / 111.32, e = 1 / (111.32 * Math.cos(lat * Math.PI / 180));
  return { r: { sud: lat - d, ovest: lng - e, nord: lat + d, est: lng + e }, luogo: luogoDi(c) };
}

export async function eseguiGriglia({ zona, parole: semi, campione = true, tetto = TETTI[0], fonte, nomeFonte = "ibrida", soloNicchia = false,
  nuovaCella = async () => null, aggiornaCella = async () => {}, salvaGiro = async () => {}, ripresa = null,
  salvaPosti = async () => ({ nuove: 0, aggiornate: 0 }), avanza = async () => {}, segnale, saturazione = 0.05 }) {
  const t0 = Date.now();
  const prima = ripresa?.giro?.parole ? ripresa.giro : null, celleSalvate = ripresa?.celle || [];
  const visti = new Set(ripresa?.visti || []), fuori = new Set(), dubbi = new Set(), inNicchiaVisti = new Set(), nonAziende = new Set();
  let rilevante = null;
  const conti = { trovate: 0, nuove: 0, aggiornate: 0, richieste: prima?.conti?.richieste || 0, pagine: prima?.conti?.pagine || 0 };
  const rapporto = { zona: { nome: zona.nome, tipo: zona.tipo, comuni: zona.comuni.length, km2_box: Math.round(areaKm2(boxZona(zona))) }, fonte: nomeFonte,
    modo: soloNicchia ? "solo nicchia" : "tutto", parole: prima?.curve || [], prova_figlio: prima?.prova_figlio || [],
    categorie_nicchia: prima?.categorie_nicchia || [], parole_scartate: prima?.parole_scartate || [],
    ...(prima ? { ripresa: { dalla_parola: prima.i + 1, celle_gia_salvate: celleSalvate.length } } : {}) };
  const giro = prima ? { ...prima, prova: [...(prima.prova || [])] } : { parole: null, ammesse: [], i: 0, prova: [], t: tetto };
  let erroriDiFila = 0, salvato = 0;
  const ferma = () => segnale?.aborted;
  async function salvaStato(subito) {
    if (!subito && Date.now() - salvato < 5000) return;
    salvato = Date.now();
    await salvaGiro({ ...giro, conti: { richieste: conti.richieste, pagine: conti.pagine },
      fuori_n: (prima?.fuori_n || 0) + fuori.size, dubbi_n: (prima?.dubbi_n || 0) + dubbi.size, in_nicchia_n: (prima?.in_nicchia_n || 0) + inNicchiaVisti.size,
      non_aziende_n: (prima?.non_aziende_n || 0) + nonAziende.size,
      curve: rapporto.parole, prova_figlio: rapporto.prova_figlio, categorie_nicchia: rapporto.categorie_nicchia, parole_scartate: rapporto.parole_scartate });
  }

  async function cerca(parola, r, t, luogo) {
    const x = await fonte.cercaCella({ cosa: parola, rettangolo: r, tetto: t, luogo, rilevante: soloNicchia ? rilevante : null });
    conti.richieste += x.richieste || 0; conti.pagine += x.pagine || 0;
    if (x.fine === "errore") { if (++erroriDiFila >= 5) throw new Error(`5 celle di fila in errore: ${x.errore}`); } else erroriDiFila = 0;
    const righe = [], vistiQui = new Set(); let nuovi = 0;
    for (const p of x.posti || []) {
      if (vistiQui.has(p.place_id)) continue;
      vistiQui.add(p.place_id);
      const com = comuneDi(zona, p.lat, p.lng);
      if (!com) { fuori.add(p.place_id); continue; }
      const dubbio = !!rilevante && !rilevante(p);
      if (dubbio) dubbi.add(p.place_id); else inNicchiaVisti.add(p.place_id);
      if (etichettaDi(p.categorie?.length ? p.categorie : [p.categoria]) === NON_AZIENDA) nonAziende.add(p.place_id);
      if (!visti.has(p.place_id)) { visti.add(p.place_id); nuovi++; }
      righe.push(rigaDa(p, com, { fonte: nomeFonte, parola, dubbio }));
    }
    if (righe.length) {
      const s = await salvaPosti(righe);
      conti.trovate += righe.length; conti.nuove += s.nuove || 0; conti.aggiornate += s.aggiornate || 0;
    }
    return { x, nuovi, inZona: righe.length };
  }

  const comuneDaIstat = (istat) => zona.comuni.find((c) => c.istat === istat) || null;
  async function dividi(parola, cella, t) {
    const out = [], suo = { comuni: [cella.comune] };
    for (const f of figli(cella.r)) {
      if (!toccaZona(suo, f)) continue;
      const c = { r: f, profondita: cella.profondita + 1, luogo: cella.luogo, comune: cella.comune };
      c.id = await nuovaCella({ parola, ...c, madre_id: cella.id, tetto: t });
      out.push(c);
    }
    return out;
  }

  async function quadtree(parola, t) {
    const coda = [], foglie = [], stato = { completa: 0, piena: 0, densa: 0, errore: 0 };
    const mie = celleSalvate.filter((c) => c.parola === parola);
    if (mie.length) {
      const conFigli = new Set(mie.filter((c) => c.madre_id).map((c) => c.madre_id));
      for (const c of mie) {
        const cella = { id: c.id, r: { sud: c.sud, ovest: c.ovest, nord: c.nord, est: c.est }, profondita: c.profondita, luogo: c.luogo, comune: comuneDaIstat(c.comune_istat) };
        if (!cella.comune) continue;
        if (c.stato === "completa" || c.stato === "densa") { foglie.push({ ...cella, stato: c.stato, dentro: c.dentro }); stato[c.stato]++; }
        else if (c.stato === "da-fare" || c.stato === "errore") coda.push(cella);
        else if (c.stato === "piena" && !conFigli.has(c.id)) coda.push(...await dividi(parola, cella, t));
      }
    } else {
      for (const c of cellePartenza(zona)) { c.id = await nuovaCella({ parola, ...c, madre_id: null, tetto: t }); coda.push(c); }
    }
    let fatte = 0, nuovi = 0, inZona = 0;
    while (coda.length && !ferma()) {
      const cella = coda.shift();
      const { x, nuovi: n, inZona: z } = await cerca(parola, cella.r, t, cella.luogo);
      nuovi += n; inZona += z; fatte++;
      let s = x.fine === "errore" ? "errore" : x.fine;
      if (s === "piena" && lato(cella.r) / 2 < MINIMO_M) s = "densa";
      await aggiornaCella(cella.id, { stato: s, motivo: x.fine === "errore" ? x.errore || "errore" : x.fine, r_metri: Math.round(raggio(cella.r)),
        distanza_max: x.distanza_max ?? null, dentro: x.dentro ?? 0, oltre: x.oltre ?? 0, posti: z, nuovi: n, richieste: x.richieste || 0, pagine: x.pagine || 0, tetto: t });
      if (s === "piena") coda.push(...await dividi(parola, cella, t));
      else foglie.push({ ...cella, stato: s, dentro: x.dentro });
      stato[s]++;
      await salvaStato(false);
      await avanza(`«${parola}» · celle ${fatte} fatte, ${coda.length} da fare`, conti);
    }
    stato.piena = 0;
    stato.da_fare = coda.length;
    return { foglie, stato, nuovi, inZona, celle: fatte };
  }

  const parole = giro.parole ? [...giro.parole] : [...new Map(semi.map((p) => [norma(p), p.trim()])).values()];
  const daSemi = new Set([...new Map(semi.map((p) => [norma(p), p.trim()])).keys()]);
  const radici = [...new Set([...daSemi].flatMap((p) => p.split(/[^a-z0-9]+/)).filter((w) => w.length >= 5).map((w) => w.slice(0, 6)))];
  const inNicchia = (c) => radici.some((r) => norma(c).includes(r));
  rapporto.radici = radici;
  const conAmmesse = (ammesse) => { if (radici.length && ammesse) rilevante = (p) => (p.categorie?.length ? p.categorie : [p.categoria]).some((c) => c && (ammesse.has(norma(c)) || inNicchia(c))); };
  if (giro.parole) conAmmesse(giro.ammesse_ok ? new Set(giro.ammesse) : null);
  else {
    if (campione && !ferma()) {
      const cc = cellaCampione(zona), visteCampione = new Set(), conteggio = new Map();
      for (const p of parole) {
        const x = await fonte.cercaCella({ cosa: p, rettangolo: cc.r, tetto: 60, luogo: cc.luogo });
        conti.richieste += x.richieste || 0; conti.pagine += x.pagine || 0;
        for (const q of x.posti || []) {
          visteCampione.add(q.place_id);
          const cat = (q.categorie?.length ? q.categorie : [q.categoria]).filter(Boolean);
          if (!cat.some(inNicchia)) continue;
          for (const c of cat) conteggio.set(norma(c), (conteggio.get(norma(c)) || 0) + 1);
        }
      }
      const ammesse = new Set([...conteggio.entries()].filter(([, n]) => n >= 2).map(([c]) => c));
      conAmmesse(ammesse);
      giro.ammesse = [...ammesse]; giro.ammesse_ok = true;
      const ordinate = [...conteggio.entries()].sort((a, b) => b[1] - a[1]);
      rapporto.categorie_nicchia = ordinate.filter(([, n]) => n >= 2).map(([c]) => c);
      const candidate = ordinate.filter(([c, n]) => n >= 3 && !daSemi.has(c)).slice(0, 6).map(([c]) => c);
      for (const c of candidate) {
        if (ferma()) break;
        const x = await fonte.cercaCella({ cosa: c, rettangolo: cc.r, tetto: 60, luogo: cc.luogo });
        conti.richieste += x.richieste || 0; conti.pagine += x.pagine || 0;
        const ricevuti = (x.posti || []).length, nuovi = (x.posti || []).filter((q) => !visteCampione.has(q.place_id)).length;
        (x.posti || []).forEach((q) => visteCampione.add(q.place_id));
        if (ricevuti && nuovi / ricevuti >= saturazione) parole.push(c);
        else rapporto.parole_scartate.push({ parola: c, campione_nuovi: nuovi, campione_ricevuti: ricevuti });
      }
    }
    giro.parole = parole;
    await salvaStato(true);
  }

  for (let i = giro.i; i < parole.length && !ferma(); i++) {
    giro.i = i; await salvaStato(true);
    const parola = parole[i], t = giro.t;
    const g = await quadtree(parola, t);
    if (ferma()) break;
    const curva = { parola, seme: daSemi.has(norma(parola)), celle: g.celle, letti_in_zona: g.inZona, nuovi: g.nuovi,
      quota_nuovi: g.inZona ? Math.round((g.nuovi / g.inZona) * 1000) / 1000 : 0, stato: g.stato, tetto: t };
    if (!giro.prova.includes(parola)) {
      const complete = g.foglie.filter((f) => f.stato === "completa").sort((a, b) => (b.dentro || 0) - (a.dentro || 0)).slice(0, 20);
      for (let giroProva = 0; complete.length && !ferma() && giroProva < TETTI.length; giroProva++) {
        let nuoviProva = 0, celleConNuovi = 0;
        for (const f of complete) {
          let qui = 0;
          for (const h of figli(f.r)) if (toccaZona({ comuni: [f.comune] }, h)) qui += (await cerca(parola, h, giro.t, f.luogo)).nuovi;
          if (qui) { celleConNuovi++; nuoviProva += qui; }
        }
        rapporto.prova_figlio.push({ parola, tetto: giro.t, celle_provate: complete.length, celle_con_nuovi: celleConNuovi, nuovi: nuoviProva });
        curva.nuovi += nuoviProva;
        if (!nuoviProva) break;
        const prossimo = TETTI.find((x) => x < giro.t);
        if (!prossimo) break;
        giro.t = prossimo;
      }
      if (ferma()) break;
      giro.prova.push(parola);
    }
    rapporto.parole.push(curva);
    rapporto.copertura ??= Math.round(copertura(zona, g.foglie.filter((f) => f.stato === "completa" || f.stato === "densa").map((f) => f.r)) * 1000) / 10;
    giro.i = i + 1; await salvaStato(true);
    if (!curva.seme && curva.quota_nuovi < saturazione) { rapporto.saturazione = `ferma dopo «${parola}»: ${Math.round(curva.quota_nuovi * 100)}% di nuovi`; break; }
  }

  Object.assign(rapporto, { posti_in_zona: visti.size, in_nicchia: (prima?.in_nicchia_n || 0) + inNicchiaVisti.size, fuori_zona: (prima?.fuori_n || 0) + fuori.size,
    dubbi: (prima?.dubbi_n || 0) + dubbi.size, non_aziende: (prima?.non_aziende_n || 0) + nonAziende.size, richieste: conti.richieste, pagine: conti.pagine, secondi: Math.round((Date.now() - t0) / 1000), tetto_finale: giro.t,
    celle: rapporto.parole.reduce((s, p) => { for (const [k, v] of Object.entries(p.stato)) s[k] = (s[k] || 0) + v; return s; }, {}) });
  if (!ferma()) { giro.finito = true; await salvaStato(true); }
  return { rapporto, conti, giro };
}

export { centro };
