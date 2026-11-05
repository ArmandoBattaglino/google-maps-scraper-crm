# Istruzioni per Claude

Un CRM e uno scraper di Google Maps in tre container: `db`, `crm`, `raccoglitore`. Cosa fa e come si usa: `README.md`.

## Com'è fatto

```
   file                        cosa
   ──────────────────────────────────────────────────────────────────────────────
   api/server.mjs              le rotte e il giro di ogni richiesta
   api/server.mjs (in alto)    niente login: un utente solo, io@crm.local, e gli host ammessi
   api/db.mjs                  la sessione: ogni richiesta è una transazione col ruolo
                               authenticated e l'email nelle claims, così vale la RLS
   api/regole.mjs              la lista bianca: risorse, colonne, operatori
   api/query.mjs               il motore delle query: albero di filtri → SQL a parametri
   api/mcp.mjs                 /crm/mcp: gli strumenti crm_*
   api/raccolte-mcp.mjs        gli strumenti raccolta_*: chiedono al raccoglitore
   web/src/crm/                le pagine dell'app
   raccoglitore/raccolte.mjs   la coda e le rotte /api/raccolte
   raccoglitore/raccolte/      Maps (maps*.mjs), griglia, geometria, siti, fonti/
   db/schema.sql               lo schema, applicato una volta al primo avvio
```

## Le regole

```
   regola                                 perché
   ──────────────────────────────────────────────────────────────────────────────
   niente SQL dal browser                 dal browser solo nomi, confrontati con la lista
                                          bianca, e valori come parametri
   l'accesso lo decide il database        RLS con app.e_socio(): «socio» è il nome interno
                                          di un utente del CRM
   elenchi di aziende con pertinente()    (api/regole.mjs) altrimenti tornano le non-aziende
   mai dati di aziende nei log            solo id, numeri e codici d'errore
   mai segreti nel repo                   stanno in .env, che git ignora
   mai pubblicare la porta senza protezione  non c'è un login: vedi il README
```

## Il database

⚠️ `db/init.sh` gira solo a volume vuoto: una modifica a `db/schema.sql` non tocca un database già creato.

Per cambiare lo schema di un database esistente: scrivi l'`alter`, applicalo con
`docker compose exec -T db psql -U crm_admin -d crm < modifica.sql` e aggiorna anche `db/schema.sql`, così un'installazione
nuova resta uguale. Le tabelle nuove devono concedere i permessi al ruolo `authenticated` e avere una politica RLS.

⭐ Le tabelle `app.contatti` e `app.attivita` e i trigger `crm.ponte_*` sono un meccanismo interno: tengono allineate
trattative e chiamate, e sono ciò che fa uscire un'azienda dalla coda quando nasce una trattativa e porta l'esito di una
chiamata sull'azienda. Non toglierli senza sostituire questi due comportamenti.

## Provare

```bash
docker compose up -d --build
node test/prova.mjs      # lascia qualche «Azienda di prova»
```

Le modifiche a `web/` si controllano con `npx tsc -b && npx vite build` dentro `web/`.
