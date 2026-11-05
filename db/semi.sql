-- I dati di partenza: l'utente unico, il percorso di vendita, le sue fasi, le soglie e le viste. Nessun dato di persone o aziende.

set search_path = '';

insert into app.soci (email, nome) values ('io@crm.local', 'Io');

insert into app.percorsi (id, nome, ordine) values ('freddo', 'Vendite', 1);
insert into app.fasi_lead (id, nome, ordine, colore, percorso, tipo) values
  ('nuovo',      'Nuovo',      10, '#8a95a5', 'freddo', 'aperta'),
  ('contattato', 'Contattato', 20, '#3b82f6', 'freddo', 'aperta'),
  ('incontro',   'Incontro',   30, '#8b5cf6', 'freddo', 'aperta'),
  ('proposta',   'Proposta',   40, '#f59e0b', 'freddo', 'aperta'),
  ('cliente',    'Cliente',    50, '#10b981', 'freddo', 'cliente'),
  ('perso',      'Perso',      60, '#ef4444', 'freddo', 'perso');

INSERT INTO crm.impostazioni VALUES ('soglia_ferma_giorni', '7', '2026-11-05 13:52:59.355823+00', '');
INSERT INTO crm.impostazioni VALUES ('soglie_ferma_fasi', '{}', '2026-11-05 13:52:59.958452+00', '');

INSERT INTO crm.viste VALUES ('00000000-0000-4000-a029-000000000001', 'Le mie trattative', 'trattative', 'team', 'tabella', '{"e": [{"op": "uguale", "campo": "segue", "valore": {"io": true}}, {"op": "vuoto", "campo": "archiviata_il"}, {"op": "uguale", "campo": "fase.tipo", "valore": "aperta"}]}', '[{"dir": "asc", "campo": "prossimo_il"}]', 'fase_id', '["azienda.nome", "persona.nome", "fase.nome", {"campo": "valore", "totale": "somma"}, "prossimo_passo", "prossimo_il", "mossa_il"]', 'prossimo_il', 0, NULL, '2026-11-05 13:53:00.131372+00', '2026-11-05 13:53:00.131372+00', '');
INSERT INTO crm.viste VALUES ('00000000-0000-4000-a029-000000000002', 'Ferme da 7 giorni', 'trattative', 'team', 'tabella', '{"e": [{"op": "minore", "campo": "mossa_il", "valore": {"da_adesso": -7}}, {"op": "vuoto", "campo": "archiviata_il"}, {"op": "uguale", "campo": "fase.tipo", "valore": "aperta"}]}', '[{"dir": "asc", "campo": "mossa_il"}]', NULL, '["azienda.nome", "persona.nome", "fase.nome", "valore", "prossimo_passo", "prossimo_il", "mossa_il", "segue"]', NULL, 0, NULL, '2026-11-05 13:53:00.131372+00', '2026-11-05 13:53:00.131372+00', '');
INSERT INTO crm.viste VALUES ('00000000-0000-4000-a029-000000000003', 'Da richiamare oggi', 'aziende', 'team', 'tabella', '{"e": [{"op": "uguale", "campo": "esito", "valore": "richiamare"}, {"op": "minore", "campo": "richiamare_il", "valore": {"da_oggi": 1}}]}', '[{"dir": "asc", "campo": "richiamare_il"}]', NULL, '["nome", "telefono", "comune", "categoria", "tentativi", "ultima_chiamata", "richiamare_il", "chiamato_da"]', 'richiamare_il', 0, NULL, '2026-11-05 13:53:00.131372+00', '2026-11-05 13:53:00.131372+00', '');
INSERT INTO crm.viste VALUES ('00000000-0000-4000-a029-000000000004', 'Senza prossimo passo', 'trattative', 'team', 'tabella', '{"e": [{"op": "vuoto", "campo": "prossimo_passo"}, {"op": "vuoto", "campo": "archiviata_il"}, {"op": "uguale", "campo": "fase.tipo", "valore": "aperta"}]}', '[{"dir": "asc", "campo": "mossa_il"}]', NULL, '["azienda.nome", "persona.nome", "fase.nome", "valore", "mossa_il", "segue"]', NULL, 0, NULL, '2026-11-05 13:53:00.131372+00', '2026-11-05 13:53:00.131372+00', '');
INSERT INTO crm.viste VALUES ('00000000-0000-4000-a029-000000000005', 'Proposte inviate', 'trattative', 'team', 'tabella', '{"e": [{"op": "contiene", "campo": "fase.nome", "valore": "proposta"}, {"op": "vuoto", "campo": "archiviata_il"}]}', '[{"dir": "asc", "campo": "mossa_il"}]', NULL, '["azienda.nome", "persona.nome", "fase.nome", {"campo": "valore", "totale": "somma"}, "prossimo_passo", "prossimo_il", "mossa_il", "segue"]', NULL, 0, NULL, '2026-11-05 13:53:00.131372+00', '2026-11-05 13:53:00.131372+00', '');
INSERT INTO crm.viste VALUES ('00000000-0000-4000-a029-000000000006', 'Aziende da chiamare per comune', 'aziende', 'team', 'tabella', '{"e": [{"op": "uguale", "campo": "esito", "valore": "da-chiamare"}]}', '[{"dir": "asc", "campo": "comune"}, {"dir": "asc", "campo": "nome"}]', 'comune', '["nome", "comune", "categoria", "telefono", "tentativi"]', NULL, 0, NULL, '2026-11-05 13:53:00.131372+00', '2026-11-05 13:53:00.131372+00', '');
INSERT INTO crm.viste VALUES ('00000000-0000-4000-a029-000000000007', 'Compiti scaduti del team', 'attivita', 'team', 'tabella', '{"e": [{"op": "uguale", "campo": "tipo", "valore": "compito"}, {"op": "vuoto", "campo": "fatto_il"}, {"op": "minore", "campo": "scadenza", "valore": {"da_adesso": 0}}]}', '[{"dir": "asc", "campo": "scadenza"}]', NULL, '["testo", "scadenza", "azienda.nome", "persona.nome", "creato_da"]', 'scadenza', 0, NULL, '2026-11-05 13:53:00.131372+00', '2026-11-05 13:53:00.131372+00', '');
