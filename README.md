# Google Maps Scraper + CRM

Un CRM completo e uno scraper di aziende da Google Maps, sulla tua macchina, con i tuoi dati e nessun servizio a
pagamento. Si comanda dall'app oppure da Claude Code, tramite il server MCP incluso.

```
   pezzo          cosa fa
   ──────────────────────────────────────────────────────────────────────────────
   crm            aziende, persone, trattative a colonne, attività e compiti, viste,
                  filtri, tag, campi personalizzati, coda delle chiamate, WhatsApp
   raccoglitore   cerca aziende su Google Maps, poi legge email, PEC e P.IVA dai siti
   mcp            10 strumenti per lavorare dal tuo Claude Code
   db             Postgres, in un volume Docker sulla tua macchina
```

## Avvio

Serve solo Docker con Compose.

```bash
docker compose up -d --build     # la prima volta qualche minuto
```

L'app è su `http://127.0.0.1:5330/crm/`, senza login. Al primo avvio il database è vuoto: nessun dato di esempio.

```
   cosa                       comando
   ──────────────────────────────────────────────────────────────────────────────
   fermare                    docker compose down              (i dati restano)
   salvare i dati             docker compose exec -T db pg_dump -U postgres crm > copia.sql
   cambiare nome o porta      copia .env.example in .env (facoltativo)
   provare un'installazione   node test/prova.mjs     (serve Node; lascia qualche
                              «Azienda di prova»: falla sulla prima)
```

⚠️ `docker compose down -v` cancella anche il database.

## Collegare Claude Code

Aprendo Claude Code in questa cartella, il server `crm` è già configurato (`.mcp.json`): basta approvarlo. Da un'altra
cartella:

```bash
claude mcp add --transport http crm http://127.0.0.1:5330/crm/mcp
```

```
   strumento           cosa fa
   ──────────────────────────────────────────────────────────────────────────────
   crm_cerca           trova aziende, persone e trattative
   crm_scheda          legge una scheda con legami e cronologia
   crm_vista           legge una vista salvata, o un albero di filtri
   crm_crea            crea azienda, persona o trattativa
   crm_attivita        scrive una nota, una chiamata o un compito
   raccolta_liste      le liste, coi conti
   raccolta_avvia      cerca aziende su Google Maps
   raccolta_stato      a che punto è una raccolta
   raccolta_ferma      la ferma; quello che ha già letto resta
   raccolta_riprendi   la riprende o la rifà
```

Nessuno strumento cancella.

Da chiedere al tuo Claude, per esempio: «cerca gli idraulici in provincia di Bergamo, leggi i siti e dimmi quanti
hanno un'email».

## Come funziona lo scraper

Una raccolta è un lavoro che gira da solo in coda. Le aziende finiscono in una lista e nel CRM, senza doppioni: se la
stessa azienda torna, si aggiorna.

```
   come coprire la zona        quando
   ──────────────────────────────────────────────────────────────────────────────
   griglia, fonte «zoom»       di base con «zona»: un comune o una provincia intera,
                               divisa in celle, da 1 a 6 parole
   griglia, fonte «ibrida»     come sopra, col nome del comune nella ricerca
   «cosa × dove»               luoghi precisi: veloce, ma Maps si ferma a 140-190
                               risultati per ricerca

   come leggere Maps           come
   ──────────────────────────────────────────────────────────────────────────────
   ibrida (di base)            il JSON interno di Maps, chiesto da dentro Chrome:
                               più campi (recensioni, CAP, categorie, orari)
   browser (riserva)           scorre la lista e legge le carte; entra in gioco da
                               solo se l'ibrida non va

   leggere i siti              HTTP diretto alla home e a 1-2 pagine contatti
                               → email, PEC, P.IVA (poi_siti: true)
```

Consigli che valgono più del metodo: la parola al singolare, e più parole sulla stessa zona.

```
   da sapere                   nota
   ──────────────────────────────────────────────────────────────────────────────
   nessun login Google         niente API a pagamento, niente proxy
   IP                          esce dal tuo; al primo captcha si ferma, riprova da sola
                               dopo 3 ore (RACCOLTE_PAUSA_CAPTCHA_S) e riparte dalla cella
   griglia                     solo Italia: usa i confini dei comuni ISTAT
   non-aziende                 parcheggi, fermate e simili si salvano, ma le liste le nascondono
   manutenzione                il JSON di Maps non è documentato: se Google lo cambia si passa
                               al browser, e il raccoglitore lo scrive nei suoi log
```

I log: `docker compose logs -f raccoglitore`. Non contengono mai dati delle aziende.

## Portarlo su un server

⚠️ **Non c'è un login: chi raggiunge il CRM può leggere e scrivere tutto.** Per questo ascolta solo su `127.0.0.1` e
risponde solo a `localhost` e `127.0.0.1`, e il database non ha porte aperte.

Per usarlo da un server, mettilo dietro qualcosa che controlli l'accesso: una VPN come Tailscale, oppure un reverse
proxy con HTTPS e autenticazione. Poi aggiungi in `.env` il nome con cui lo apri, per esempio
`CONSENTI_HOST=crm.miodominio.it`. Se lo apri a più persone, cambia anche `POSTGRES_PASSWORD` e `APP_DB_PASSWORD` prima
del primo avvio.

## Com'è fatto

```
   cartella        cosa
   ──────────────────────────────────────────────────────────────────────────────
   api/            il servizio Node (node:http + pg): API, tempo reale, /crm/mcp
   web/            l'app React (ra-core + shadcn/ui, base Atomic CRM)
   raccoglitore/   lo scraper (patchright + Chrome) e i confini ISTAT
   db/             schema, dati di partenza e script del primo avvio
   test/           prova.mjs, la prova del sistema acceso
```

Il nome si cambia con `APP_NOME` in `.env`. Le regole per chi modifica il codice stanno in `CLAUDE.md`.

## Licenza e responsabilità

Licenza MIT (`LICENSE`), software fornito «così com'è». Le parti di terzi sono in `NOTICE`. Il modo in cui usi lo
scraper e i dati raccolti, comprese le condizioni di Google e le regole sul contatto delle aziende, è responsabilità
di chi lo usa.
