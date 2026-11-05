import { ESITI, lasciaLeMie, percorsoDiOggi, scriviChiamata } from "./coda.mjs";
import { SOCIO_SQL } from "./db.mjs";
import { ErroreApi } from "./regole.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPI = new Set(["azienda_id", "percorso", "persona", "prossimo_il", "segue", "nota", "chiamata"]);
const FONTE = "Chiamata a freddo";
const PASSO = "Ricontattare";
const NOME_MAX = 200, NOTA_MAX = 10_000, DURATA_MAX = 86_400;
const giornoRoma = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

function leggiCorpo(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroreApi(400, "il corpo è un oggetto", "valore");
  if (Object.keys(corpo).some((k) => !CAMPI.has(k))) throw new ErroreApi(400, "campo fuori lista: servono azienda_id e percorso", "colonna");
  const { azienda_id, percorso, persona, prossimo_il, segue, nota, chiamata } = corpo;
  if (typeof azienda_id !== "string" || !UUID.test(azienda_id)) throw new ErroreApi(400, "azienda_id non valido", "valore");
  const finestra = persona !== undefined;
  if (percorso !== undefined || !finestra) {
    if (typeof percorso !== "string" || !percorso || percorso.length > 120) throw new ErroreApi(400, "percorso non valido", "valore");
  }
  if (!finestra) {
    if ([prossimo_il, segue, nota, chiamata].some((x) => x !== undefined)) throw new ErroreApi(400, "manca il nome di chi ha parlato", "valore");
    return { azienda_id, percorso };
  }
  if (typeof persona !== "string" || !persona.trim() || persona.length > NOME_MAX) throw new ErroreApi(400, "scrivi il nome di chi ha parlato", "valore");
  const quando = typeof prossimo_il === "string" ? Date.parse(prossimo_il) : NaN;
  if (Number.isNaN(quando) || !/^\d{4}-\d{2}-\d{2}T/.test(prossimo_il)) throw new ErroreApi(400, "scegli la data e l'ora del prossimo passo", "valore");
  if (giornoRoma.format(new Date(quando)) < giornoRoma.format(new Date())) throw new ErroreApi(400, "il prossimo passo non può essere già passato", "valore");
  if (segue !== undefined && (typeof segue !== "string" || !segue.includes("@") || segue.length > 320)) throw new ErroreApi(400, "segue: un'email", "valore");
  if (nota !== undefined && (typeof nota !== "string" || nota.length > NOTA_MAX)) throw new ErroreApi(400, "nota troppo lunga", "valore");
  if (chiamata !== undefined) {
    if (!chiamata || typeof chiamata !== "object" || Array.isArray(chiamata) || Object.keys(chiamata).some((k) => k !== "durata")) throw new ErroreApi(400, "chiamata: solo la durata", "valore");
    if (chiamata.durata !== undefined && (!Number.isInteger(chiamata.durata) || chiamata.durata < 0 || chiamata.durata > DURATA_MAX)) throw new ErroreApi(400, "chiamata: durata in secondi", "valore");
  }
  return { azienda_id, percorso, persona: persona.trim(), prossimo_il, segue: segue?.toLowerCase(), nota: nota?.trim() || null, chiamata };
}

export function creaIngressi({ conLaSessione }) {
  const fuoriDallaCoda = (c, azienda, contatto) => c.query(
    `update app.aziende set contatto_id = $2, aggiornato = now() where id = $1 and contatto_id is null`, [azienda, contatto]);

  return async function daAzienda({ metodo, cerca, corpo, email }) {
    if (metodo !== "POST") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    if ([...cerca.keys()].length) throw new ErroreApi(400, "parametro fuori lista", "parametro");
    const f = leggiCorpo(corpo);
    const { azienda_id } = f;

    return conLaSessione(email, async (c) => {
      if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "solo gli utenti scrivono nel CRM", "socio");

      const a = (await c.query(`select id, telefono, email, referente, esito, tentativi, contatto_id from app.aziende where id = $1 for update`, [azienda_id])).rows[0];
      if (!a) throw new ErroreApi(404, "non trovato");

      const percorso = f.percorso ?? percorsoDiOggi((await c.query(`select id from app.percorsi order by ordine, id`)).rows);
      const fase = (await c.query(
        `select id from app.fasi_lead where percorso = $1 and tipo = 'aperta' order by ordine, id limit 1`, [percorso])).rows[0];
      if (!fase) throw new ErroreApi(400, "percorso fuori lista o senza colonne aperte", "valore");

      const aperta = (await c.query(
        `select t.* from crm.trattative t join app.fasi_lead f on f.id = t.fase_id
          where t.azienda_id = $1 and t.archiviata_il is null and f.tipo = 'aperta' order by t.creato desc, t.id limit 1`, [azienda_id])).rows[0];
      if (aperta) {
        await fuoriDallaCoda(c, azienda_id, aperta.contatto_id);
        return { stato: 200, corpo: aperta };
      }
      if (f.chiamata) {
        const fatta = await scriviChiamata(c, { azienda_id, esito: ESITI.interessato, testo: "", scadenza: null, durata: f.chiamata.durata ?? null }, email, a.tentativi);
        a.esito = fatta.azienda.esito;
      }
      if (!a.contatto_id && a.esito !== "interessato") throw new ErroreApi(409, "l'azienda non è ancora «interessato»: prima l'esito della chiamata", "esito");

      let persona = null;
      const nome = f.persona ?? a.referente;
      if (nome.trim()) {
        persona = (await c.query(
          `select id from crm.persone where azienda_id = $1 and lower(trim(nome)) = lower(trim($2)) and archiviata_il is null
            order by creato, id limit 1`, [azienda_id, nome])).rows[0]?.id
          ?? (await c.query(
            `insert into crm.persone (azienda_id, nome, telefono, email, fonte)
             values ($1, left(trim($2), 200), left($3, 40), left($4, 254), $5) returning id`,
            [azienda_id, nome, a.telefono, a.email, FONTE])).rows[0].id;
      }

      const nuova = (await c.query(
        `insert into crm.trattative (azienda_id, persona_id, percorso, fase_id, segue, prossimo_passo, prossimo_il) values ($1, $2, $3, $4, lower($5), $6, $7) returning id`,
        [azienda_id, persona, percorso, fase.id, f.segue ?? email, f.persona ? PASSO : "", f.prossimo_il ?? null])).rows[0].id;
      const riga = (await c.query(`select * from crm.trattative where id = $1`, [nuova])).rows[0];

      if (!riga.contatto_id) {
        const nota = (await c.query(`select errore_sqlstate from crm.ponte_registro where riga_id = $1 order by quando desc limit 1`, [nuova])).rows[0];
        console.error(`da-azienda: il ponte non ha creato il contatto (azienda ${azienda_id}, sqlstate ${nota?.errore_sqlstate || "nessuno"})`);
        throw new ErroreApi(503, "il contatto non è nato: non è stato salvato niente, riprova", "ponte");
      }
      await fuoriDallaCoda(c, azienda_id, riga.contatto_id);
      if (f.nota) {
        await c.query(`insert into crm.attivita (tipo, trattativa_id, azienda_id, persona_id, testo) values ('nota', $1, $2, $3, $4)`, [nuova, azienda_id, persona, f.nota]);
      }
      if (f.chiamata) await lasciaLeMie(c, email, azienda_id);
      return { stato: 201, corpo: riga };
    });
  };
}
