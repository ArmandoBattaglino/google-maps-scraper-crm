-- Lo schema del CRM: si applica una volta sola, al primo avvio del database (db/init.sh).

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA app;

CREATE SCHEMA auth;

CREATE SCHEMA crm;

CREATE FUNCTION app.azienda_dal_sito(p_azienda uuid, p_email text, p_piva text, p_dati jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'app', 'pg_temp'
    AS $$
declare v_piva text := case when app.piva_valida(p_piva) then regexp_replace(p_piva, '\D', '', 'g') else '' end;
        v_email text := lower(trim(coalesce(p_email, ''))); v_altra uuid;
begin
  update app.aziende a set email = case when a.email = '' then v_email else a.email end,
    piva = case when a.piva = '' then v_piva else a.piva end, dati = a.dati || coalesce(p_dati, '{}'::jsonb), aggiornato = now()
  where a.id = p_azienda;
  if v_piva <> '' then
    insert into app.aziende_chiavi (tipo, valore, azienda_id) values ('piva', v_piva, p_azienda) on conflict (tipo, valore) do nothing;
    select c.azienda_id into v_altra from app.aziende_chiavi c where c.tipo = 'piva' and c.valore = v_piva;
    if v_altra <> p_azienda then
      update app.aziende a set unione = 'da-controllare',
        unione_motivo = case when a.unione_motivo = '' then 'la P.IVA (dal sito) uguale a un''altra azienda' else a.unione_motivo end
      where a.id in (p_azienda, v_altra);
    end if;
  end if;
  if v_email <> '' then
    update app.aziende a set contatto_id = c.id
      from (select ct.id from app.contatti ct where lower(ct.email) = v_email order by ct.creato limit 1) c
     where a.id = p_azienda and a.contatto_id is null;
  end if;
end $$;

CREATE FUNCTION app.dominio_email(email text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select case when d = '' or d = any (array['gmail.com', 'googlemail.com', 'libero.it', 'hotmail.com', 'hotmail.it', 'outlook.com',
                'outlook.it', 'live.com', 'live.it', 'msn.com', 'yahoo.com', 'yahoo.it', 'icloud.com', 'me.com', 'virgilio.it', 'alice.it',
                'tin.it', 'tiscali.it', 'fastwebnet.it', 'email.it', 'inwind.it', 'iol.it', 'aruba.it', 'pec.it', 'legalmail.it',
                'arubapec.it', 'postacert.it', 'pec.libero.it', 'gigapec.it', 'sicurezzapostale.it', 'cert.legalmail.it'])
              or d like '%.pec.it' or d like 'pec.%'
         then '' else d end
    from (select lower(split_part(trim(coalesce(email, '')), '@', 2)) as d) s
$$;

CREATE FUNCTION app.e_socio() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'app'
    AS $$
  select exists (select 1 from app.soci where email = lower(coalesce(auth.jwt()->>'email', '')));
$$;

CREATE FUNCTION app.norma_dominio(sito text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $_$
  select case when d = '' or d !~ '\.' or d = any (array['facebook.com', 'm.facebook.com', 'fb.com', 'instagram.com', 'linkedin.com',
                'it.linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com', 'google.com', 'maps.google.com',
                'sites.google.com', 'business.google.com', 'goo.gl', 'g.page', 'maps.app.goo.gl', 'paginegialle.it', 'paginebianche.it',
                'tripadvisor.it', 'tripadvisor.com', 'booking.com', 'linktr.ee', 'wa.me', 'api.whatsapp.com', 'subito.it', 'ebay.it',
                'amazon.it', 'europages.it', 'kompass.com', 'virgilio.it', 'misterimprese.it', 'registroimprese.it'])
         then '' else d end
    from (select lower(regexp_replace(regexp_replace(trim(coalesce(sito, '')), '^[a-z][a-z0-9+.-]*://', '', 'i'), '^www\.|[/:?#].*$', '', 'gi')) as d) s
$_$;

CREATE FUNCTION app.norma_telefono(t text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select case when length(x) < 6 then ''
              when x like '0039%' then substr(x, 3)
              when x like '39%' and length(x) >= 11 then x
              else '39' || x end
    from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as x) s
$$;

CREATE FUNCTION app.piva_valida(p text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    AS $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int := 0; c int; i int;
begin
  if length(d) <> 11 or d = '00000000000' then return false; end if;
  for i in 1..10 loop
    c := substr(d, i, 1)::int;
    if i % 2 = 0 then c := c * 2; if c > 9 then c := c - 9; end if; end if;
    s := s + c;
  end loop;
  return (10 - s % 10) % 10 = substr(d, 11, 1)::int;
end $$;

CREATE FUNCTION app.proteggi_colonne_chiuse() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'app'
    AS $$
begin
  if tg_op = 'DELETE' then
    if (old.tipo <> 'aperta' or old.fissa) and exists (select 1 from percorsi where id = old.percorso) then
      raise exception 'Questa colonna non si può eliminare';
    end if;
    return old;
  end if;
  if (old.tipo <> 'aperta' or old.fissa)
     and (new.nome <> old.nome or new.tipo <> old.tipo or new.ordine <> old.ordine or new.fissa <> old.fissa or new.percorso <> old.percorso) then
    raise exception 'Questa colonna non si può cambiare';
  end if;
  return new;
end $$;

CREATE FUNCTION app.proteggi_percorsi() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'app'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.fisso then raise exception 'Il percorso Pubblicità Meta non si può eliminare'; end if;
    if exists (select 1 from contatti where percorso = old.id) then raise exception 'Il percorso ha ancora dei lead: spostali prima'; end if;
    return old;
  end if;
  if old.fisso and (new.nome <> old.nome or not new.fisso) then raise exception 'Il percorso Pubblicità Meta non si può cambiare'; end if;
  return new;
end $$;

CREATE FUNCTION app.raccolte_da_continuare() RETURNS TABLE(id uuid, numero integer, creato_da text, stato text, riprende_alle timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'app', 'pg_temp'
    AS $$
  select r.id, r.numero, r.creato_da, r.stato, r.riprende_alle from app.raccolte r
   where r.stato = 'in-corso' or (r.stato = 'interrotta' and r.riprende_alle is not null and r.riprende_alle <= now())
   order by r.creato
$$;

CREATE FUNCTION app.raccolte_da_riprendere() RETURNS TABLE(id uuid, numero integer, creato_da text, aggiornato timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'app', 'pg_temp'
    AS $$
  select r.id, r.numero, r.creato_da, r.aggiornato from app.raccolte r where r.stato = 'in-corso' order by r.creato
$$;

CREATE FUNCTION app.salva_azienda(posto jsonb, p_lista uuid, p_raccolta uuid DEFAULT NULL::uuid) RETURNS TABLE(azienda_id uuid, nuova boolean, in_lista_nuova boolean, unione text)
    LANGUAGE plpgsql
    SET search_path TO 'app', 'pg_temp'
    AS $$
#variable_conflict use_column
declare
  v_place text := nullif(trim(coalesce(posto->>'place_id', '')), '');
  v_piva text := case when app.piva_valida(posto->>'piva') then regexp_replace(posto->>'piva', '\D', '', 'g') else '' end;
  v_tel text := app.norma_telefono(posto->>'telefono');
  v_dom text := app.norma_dominio(posto->>'sito');
  v_email text := lower(trim(coalesce(posto->>'email', '')));
  v_id uuid; v_nuova boolean := false; v_motivo text := ''; v_altra uuid; v_n int; k record;
  v_cat text[] := coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(posto->'categorie') = 'array' then posto->'categorie' else '[]'::jsonb end)), '{}');
begin
  perform pg_advisory_xact_lock(hashtext('azienda:' || coalesce(v_place, nullif(v_piva, ''), nullif(v_tel, ''), nullif(v_dom, ''), lower(coalesce(posto->>'nome', '')))));
  if v_place is not null then select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'place_id' and c.valore = v_place; end if;
  if v_id is null and v_piva <> '' then select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'piva' and c.valore = v_piva; end if;
  if v_id is null and v_tel <> '' then
    select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'telefono' and c.valore = v_tel and c.usi < 2;
    if v_id is not null then
      v_motivo := 'unita per lo stesso telefono';
      update app.aziende_chiavi c set usi = c.usi + 1 where c.tipo = 'telefono' and c.valore = v_tel;
    end if;
  end if;
  if v_id is null and v_dom <> '' then
    select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'dominio' and c.valore = v_dom and c.usi < 2;
    if v_id is not null then
      v_motivo := 'unita per lo stesso sito';
      update app.aziende_chiavi c set usi = c.usi + 1 where c.tipo = 'dominio' and c.valore = v_dom;
    end if;
  end if;

  if v_id is null then
    insert into app.aziende (nome, telefono, telefono_norm, sito, dominio, piva, email, indirizzo, comune, categoria, categorie,
                             valutazione, recensioni, place_id, dati)
    values (left(trim(posto->>'nome'), 300), coalesce(posto->>'telefono', ''), v_tel, coalesce(posto->>'sito', ''), v_dom, v_piva, v_email,
            coalesce(posto->>'indirizzo', ''), coalesce(posto->>'comune', ''), coalesce(posto->>'categoria', ''), v_cat,
            nullif(posto->>'valutazione', '')::numeric, nullif(posto->>'recensioni', '')::int, v_place, coalesce(posto->'dati', '{}'::jsonb))
    returning id into v_id;
    v_nuova := true;
  else
    update app.aziende a set
      telefono = case when a.telefono = '' then coalesce(posto->>'telefono', '') else a.telefono end,
      telefono_norm = case when a.telefono_norm = '' then v_tel else a.telefono_norm end,
      sito = case when a.sito = '' then coalesce(posto->>'sito', '') else a.sito end,
      dominio = case when a.dominio = '' then v_dom else a.dominio end,
      piva = case when a.piva = '' then v_piva else a.piva end,
      email = case when a.email = '' then v_email else a.email end,
      indirizzo = case when a.indirizzo = '' then coalesce(posto->>'indirizzo', '') else a.indirizzo end,
      comune = case when a.comune = '' then coalesce(posto->>'comune', '') else a.comune end,
      categoria = case when a.categoria = '' then coalesce(posto->>'categoria', '') else a.categoria end,
      categorie = case when cardinality(a.categorie) = 0 then v_cat else a.categorie end,
      valutazione = coalesce(nullif(posto->>'valutazione', '')::numeric, a.valutazione),
      recensioni = coalesce(nullif(posto->>'recensioni', '')::int, a.recensioni),
      place_id = coalesce(a.place_id, v_place),
      dati = a.dati || coalesce(posto->'dati', '{}'::jsonb),
      unione = case when v_motivo <> '' then 'da-controllare' else a.unione end,
      unione_motivo = case when v_motivo <> '' and a.unione_motivo = '' then v_motivo else a.unione_motivo end,
      aggiornato = now()
    where a.id = v_id;
  end if;

  for k in select * from (values ('place_id', v_place), ('piva', nullif(v_piva, '')), ('telefono', nullif(v_tel, '')), ('dominio', nullif(v_dom, ''))) x(tipo, valore)
           where x.valore is not null loop
    insert into app.aziende_chiavi (tipo, valore, azienda_id) values (k.tipo, k.valore, v_id) on conflict (tipo, valore) do nothing;
    select c.azienda_id into v_altra from app.aziende_chiavi c where c.tipo = k.tipo and c.valore = k.valore;
    if v_altra <> v_id and k.tipo in ('place_id', 'piva') then
      update app.aziende a set unione = 'da-controllare',
        unione_motivo = case when a.unione_motivo = '' then format('%s uguale a un''altra azienda', case k.tipo when 'piva' then 'la P.IVA' else 'la scheda di Maps' end) else a.unione_motivo end
      where a.id in (v_id, v_altra);
    end if;
  end loop;

  update app.aziende a set contatto_id = c.id
    from (select ct.id from app.contatti ct
           where (v_tel <> '' and app.norma_telefono(ct.telefono) = v_tel)
              or (v_email <> '' and lower(ct.email) = v_email)
              or (v_dom <> '' and app.dominio_email(ct.email) = v_dom)
           order by ct.creato limit 1) c
   where a.id = v_id and a.contatto_id is null;

  insert into app.liste_aziende (lista_id, azienda_id, raccolta_id) values (p_lista, v_id, p_raccolta) on conflict (lista_id, azienda_id) do nothing;
  get diagnostics v_n = row_count;
  return query select v_id, v_nuova, v_n > 0, (select a.unione from app.aziende a where a.id = v_id);
end $$;

CREATE FUNCTION app.segna_provenienza(p_azienda uuid, p_raccolta uuid, p_lista uuid, p jsonb, p_nuova boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'app', 'pg_temp'
    AS $$
declare v_etichetta text;
begin
  insert into app.aziende_provenienze (azienda_id, raccolta_id, lista_id, parola, luogo, zona, fonte, metodo)
  values (p_azienda, p_raccolta, p_lista, left(trim(coalesce(p->>'parola', '')), 120), left(coalesce(p->>'luogo', ''), 120),
          left(coalesce(p->>'zona', ''), 120), left(coalesce(p->>'fonte', ''), 40), left(coalesce(p->>'metodo', ''), 40))
  on conflict on constraint aziende_provenienze_unica
    do update set ultima_vista = now(), volte = app.aziende_provenienze.volte + 1;

  if coalesce(p->>'etichetta', '') <> '' then
    select case when p->>'etichetta' = 'non-azienda' and (p_nuova or a.dati->>'etichetta' = 'non-azienda') then 'non-azienda' else 'pertinente' end
      into v_etichetta from app.aziende a where a.id = p_azienda;
    update app.aziende a set dati = a.dati || jsonb_build_object('etichetta', v_etichetta)
     where a.id = p_azienda and a.dati->>'etichetta' is distinct from v_etichetta;
  end if;
  return true;
end $$;

CREATE FUNCTION app.segnala_cambio() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'app'
    AS $$
declare
  riga jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  chiave jsonb := '{}'::jsonb;
  prima jsonb := '{}'::jsonb;
  c text;
  messaggio jsonb;
begin
  foreach c in array tg_argv loop
    chiave := chiave || jsonb_build_object(c, riga -> c);
    if tg_op = 'UPDATE' then prima := prima || jsonb_build_object(c, to_jsonb(old) -> c); end if;
  end loop;
  messaggio := jsonb_build_object('tabella', tg_table_name, 'evento', tg_op, 'chiave', chiave);
  if tg_nargs = 1 then messaggio := messaggio || jsonb_build_object('id', riga -> tg_argv[0]); end if;
  if tg_op = 'UPDATE' and prima <> chiave then messaggio := messaggio || jsonb_build_object('prima', prima); end if;
  perform pg_notify('app', messaggio::text);
  return null;
end $$;

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

CREATE FUNCTION crm.attivita_muove() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
begin
  if new.trattativa_id is not null then
    update crm.trattative set mossa_il = now() where id = new.trattativa_id;
  end if;
  return null;
end $$;

CREATE FUNCTION crm.campo_stabile() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
begin
  if new.oggetto is distinct from old.oggetto or new.chiave is distinct from old.chiave then
    raise exception 'campo personalizzato: oggetto e chiave non si cambiano (si archivia e se ne crea un altro)'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

CREATE FUNCTION crm.norma_telefono_riga() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
begin
  new.telefono_norm := app.norma_telefono(new.telefono);
  return new;
end $$;

CREATE FUNCTION crm.ponte_cambi(p_prima jsonb, p_dopo jsonb, p_altra jsonb, OUT cambi text[], OUT conflitti text[]) RETURNS record
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select array_agg(k order by k) filter (where p_prima -> k is distinct from p_dopo -> k),
         array_agg(k order by k) filter (where p_prima -> k is distinct from p_dopo -> k
                                           and p_altra -> k is distinct from p_prima -> k
                                           and p_altra -> k is distinct from p_dopo -> k)
    from jsonb_object_keys(p_dopo) k
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE app.attivita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contatto_id uuid NOT NULL,
    tipo text DEFAULT 'nota'::text NOT NULL,
    testo text DEFAULT ''::text NOT NULL,
    quando timestamp with time zone DEFAULT now() NOT NULL,
    da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    fase text,
    esito text,
    file_path text,
    file_nome text,
    CONSTRAINT attivita_esito_check CHECK ((esito = ANY (ARRAY['risposto'::text, 'non-risponde'::text, 'richiamare'::text, 'numero-errato'::text, 'inviato'::text, 'ha-risposto'::text, 'fatta'::text, 'non-presentato'::text, 'spostata'::text]))),
    CONSTRAINT attivita_tipo_check CHECK ((tipo = ANY (ARRAY['chiamata'::text, 'messaggio'::text, 'meet'::text, 'nota'::text, 'fase'::text])))
);

CREATE FUNCTION crm.ponte_campi_attivita_app(a app.attivita) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select jsonb_build_object('tipo', a.tipo, 'testo', coalesce(a.testo, ''), 'esito', a.esito, 'quando', a.quando, 'fase', a.fase)
$$;

CREATE TABLE crm.attivita (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text DEFAULT 'nota'::text NOT NULL,
    azienda_id uuid,
    persona_id uuid,
    trattativa_id uuid,
    esito text,
    testo text DEFAULT ''::text NOT NULL,
    scadenza timestamp with time zone,
    fatto_il timestamp with time zone,
    durata integer,
    registrazione text,
    fase text,
    attivita_app_id uuid,
    origine text DEFAULT 'crm'::text NOT NULL,
    ponte_il timestamp with time zone,
    quando timestamp with time zone DEFAULT now() NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    esito_azienda text,
    assegnato_a text,
    CONSTRAINT attivita_durata_check CHECK ((durata >= 0)),
    CONSTRAINT attivita_esito_azienda_check CHECK ((esito_azienda = ANY (ARRAY['da-chiamare'::text, 'non-risponde'::text, 'richiamare'::text, 'non-interessato'::text, 'interessato'::text]))),
    CONSTRAINT attivita_esito_check CHECK ((esito = ANY (ARRAY['risposto'::text, 'non-risponde'::text, 'richiamare'::text, 'numero-errato'::text, 'inviato'::text, 'ha-risposto'::text, 'fatta'::text, 'non-presentato'::text, 'spostata'::text]))),
    CONSTRAINT attivita_legata CHECK ((num_nonnulls(azienda_id, persona_id, trattativa_id) >= 1)),
    CONSTRAINT attivita_origine_check CHECK ((origine = ANY (ARRAY['crm'::text, 'app'::text]))),
    CONSTRAINT attivita_registrazione_check CHECK ((char_length(registrazione) <= 2000)),
    CONSTRAINT attivita_tipo_check CHECK ((tipo = ANY (ARRAY['chiamata'::text, 'nota'::text, 'email'::text, 'compito'::text, 'whatsapp'::text, 'messaggio'::text, 'meet'::text, 'fase'::text])))
);

CREATE FUNCTION crm.ponte_campi_attivita_crm(x crm.attivita) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select jsonb_build_object('tipo', crm.ponte_tipo_app(x.tipo), 'testo', coalesce(x.testo, ''), 'esito', crm.ponte_esito_app(x.esito),
                            'quando', x.quando, 'fase', x.fase)
$$;

CREATE TABLE app.contatti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    telefono text NOT NULL,
    azienda text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    nicchia_id uuid,
    fonte text DEFAULT ''::text NOT NULL,
    campagna text DEFAULT ''::text NOT NULL,
    fase text DEFAULT 'nuovo'::text NOT NULL,
    assegnato_a text,
    prossima_azione text DEFAULT ''::text NOT NULL,
    prossima_data timestamp with time zone,
    note text DEFAULT ''::text NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    cliente_dal date,
    avvio numeric(10,2),
    canone numeric(10,2),
    accordo text DEFAULT ''::text NOT NULL,
    da_fare jsonb DEFAULT '[]'::jsonb NOT NULL,
    percorso text DEFAULT 'freddo'::text NOT NULL,
    promemoria_inviato timestamp with time zone,
    link_meet text DEFAULT ''::text NOT NULL,
    conferma_inviata timestamp with time zone,
    promemoria_inviati integer[] DEFAULT '{}'::integer[] NOT NULL,
    temperatura text,
    pain text,
    costo_problema text,
    chi_decide text,
    proposta_avvio numeric(10,2),
    proposta_canone numeric(10,2),
    proposta_inviata date,
    motivo_perso text,
    inserzione text DEFAULT ''::text NOT NULL,
    gruppo_inserzioni text DEFAULT ''::text NOT NULL,
    piattaforma text DEFAULT ''::text NOT NULL,
    unito_a uuid,
    prenotato_il timestamp with time zone,
    CONSTRAINT contatti_chi_decide_check CHECK ((chi_decide = ANY (ARRAY['lui'::text, 'con-socio'::text, 'altro'::text]))),
    CONSTRAINT contatti_costo_problema_check CHECK ((char_length(costo_problema) <= 120)),
    CONSTRAINT contatti_motivo_perso_check CHECK ((motivo_perso = ANY (ARRAY['non-risponde'::text, 'per-sbaglio'::text, 'fuori-target'::text, 'non-si-presenta'::text, 'prezzo'::text, 'altra-soluzione'::text, 'non-convinto'::text, 'altro'::text]))),
    CONSTRAINT contatti_pain_check CHECK ((char_length(pain) <= 300)),
    CONSTRAINT contatti_proposta_avvio_check CHECK (((proposta_avvio >= (0)::numeric) AND (proposta_avvio <> 'NaN'::numeric))),
    CONSTRAINT contatti_proposta_canone_check CHECK (((proposta_canone >= (0)::numeric) AND (proposta_canone <> 'NaN'::numeric))),
    CONSTRAINT contatti_temperatura_check CHECK ((temperatura = ANY (ARRAY['caldo'::text, 'tiepido'::text, 'freddo'::text])))
);

CREATE FUNCTION crm.ponte_campi_contatto(c app.contatti) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select jsonb_build_object(
    'nome', crm.ponte_nome(c.nome), 'telefono', left(coalesce(c.telefono, ''), 40), 'email', left(coalesce(c.email, ''), 254),
    'fase_id', c.fase, 'percorso', c.percorso, 'segue', c.assegnato_a, 'prossimo_passo', left(coalesce(c.prossima_azione, ''), 300),
    'prossimo_il', c.prossima_data, 'note', coalesce(c.note, ''), 'temperatura', c.temperatura, 'motivo_perso', c.motivo_perso,
    'avvio', c.proposta_avvio, 'canone', c.proposta_canone)
$$;

CREATE TABLE crm.persone (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    azienda_id uuid,
    nome text NOT NULL,
    ruolo text DEFAULT ''::text NOT NULL,
    telefono text DEFAULT ''::text NOT NULL,
    telefono_norm text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    campi jsonb DEFAULT '{}'::jsonb NOT NULL,
    fonte text DEFAULT ''::text NOT NULL,
    origine text DEFAULT 'crm'::text NOT NULL,
    ponte_il timestamp with time zone,
    archiviata_il timestamp with time zone,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT persone_campi_check CHECK ((jsonb_typeof(campi) = 'object'::text)),
    CONSTRAINT persone_email_check CHECK ((char_length(email) <= 254)),
    CONSTRAINT persone_fonte_check CHECK ((char_length(fonte) <= 120)),
    CONSTRAINT persone_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 1) AND (length(TRIM(BOTH FROM nome)) <= 200))),
    CONSTRAINT persone_origine_check CHECK ((origine = ANY (ARRAY['crm'::text, 'app'::text]))),
    CONSTRAINT persone_ruolo_check CHECK ((char_length(ruolo) <= 120)),
    CONSTRAINT persone_telefono_check CHECK ((char_length(telefono) <= 40))
);

CREATE TABLE crm.trattative (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    azienda_id uuid,
    persona_id uuid,
    percorso text DEFAULT 'freddo'::text NOT NULL,
    fase_id text DEFAULT 'nuovo'::text NOT NULL,
    avvio numeric(10,2),
    canone numeric(10,2),
    valore numeric(12,2) GENERATED ALWAYS AS ((COALESCE(avvio, (0)::numeric) + ((12)::numeric * COALESCE(canone, (0)::numeric)))) STORED,
    prossimo_passo text DEFAULT ''::text NOT NULL,
    prossimo_il timestamp with time zone,
    segue text,
    mossa_il timestamp with time zone DEFAULT now() NOT NULL,
    temperatura text,
    motivo_perso text,
    note text DEFAULT ''::text NOT NULL,
    contatto_id uuid,
    campi jsonb DEFAULT '{}'::jsonb NOT NULL,
    origine text DEFAULT 'crm'::text NOT NULL,
    ponte_il timestamp with time zone,
    archiviata_il timestamp with time zone,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT trattative_avvio_check CHECK (((avvio >= (0)::numeric) AND (avvio <> 'NaN'::numeric))),
    CONSTRAINT trattative_campi_check CHECK ((jsonb_typeof(campi) = 'object'::text)),
    CONSTRAINT trattative_canone_check CHECK (((canone >= (0)::numeric) AND (canone <> 'NaN'::numeric))),
    CONSTRAINT trattative_motivo_perso_check CHECK ((motivo_perso = ANY (ARRAY['non-risponde'::text, 'per-sbaglio'::text, 'fuori-target'::text, 'non-si-presenta'::text, 'prezzo'::text, 'altra-soluzione'::text, 'non-convinto'::text, 'altro'::text]))),
    CONSTRAINT trattative_origine_check CHECK ((origine = ANY (ARRAY['crm'::text, 'app'::text]))),
    CONSTRAINT trattative_prossimo_passo_check CHECK ((char_length(prossimo_passo) <= 300)),
    CONSTRAINT trattative_temperatura_check CHECK ((temperatura = ANY (ARRAY['caldo'::text, 'tiepido'::text, 'freddo'::text])))
);

CREATE FUNCTION crm.ponte_campi_trattativa(t crm.trattative, p crm.persone) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select jsonb_build_object(
    'nome', crm.ponte_nome(p.nome), 'telefono', left(coalesce(p.telefono, ''), 40), 'email', left(coalesce(p.email, ''), 254),
    'fase_id', t.fase_id, 'percorso', t.percorso, 'segue', t.segue, 'prossimo_passo', left(coalesce(t.prossimo_passo, ''), 300),
    'prossimo_il', t.prossimo_il, 'note', coalesce(t.note, ''), 'temperatura', t.temperatura, 'motivo_perso', t.motivo_perso,
    'avvio', t.avvio, 'canone', t.canone)
$$;

CREATE FUNCTION crm.ponte_crea_trattativa(c app.contatti) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare v_az uuid; v_p uuid; v_t uuid;
begin
  select a.id into v_az from app.aziende a where a.contatto_id = c.id order by a.creato limit 1;
  if v_az is null then
    v_az := crm.trova_o_crea_azienda(jsonb_build_object(
      'nome', coalesce(nullif(trim(c.azienda), ''), nullif(trim(c.nome), ''), 'Senza nome'),
      'telefono', c.telefono, 'email', c.email, 'contatto_id', c.id, 'creato_da', coalesce(c.creato_da, ''),
      'dati', jsonb_build_object('origine', 'lead')));
    update app.aziende set contatto_id = c.id where id = v_az and contatto_id is null;
  end if;
  insert into crm.persone (azienda_id, nome, telefono, email, fonte, origine, ponte_il, creato, creato_da)
  values (v_az, crm.ponte_nome(c.nome), left(coalesce(c.telefono, ''), 40), left(coalesce(c.email, ''), 254),
          left(coalesce(c.fonte, ''), 120), 'app', now(), c.creato, c.creato_da)
  returning id into v_p;
  insert into crm.trattative (azienda_id, persona_id, percorso, fase_id, avvio, canone, prossimo_passo, prossimo_il, segue,
                              mossa_il, temperatura, motivo_perso, note, contatto_id, origine, ponte_il, creato, creato_da)
  values (v_az, v_p, c.percorso, c.fase, c.proposta_avvio, c.proposta_canone, left(coalesce(c.prossima_azione, ''), 300),
          c.prossima_data, c.assegnato_a,
          greatest(c.creato, coalesce((select max(a.quando) from app.attivita a where a.contatto_id = c.id), c.creato)),
          c.temperatura, c.motivo_perso, coalesce(c.note, ''), c.id, 'app', now(), c.creato, c.creato_da)
  returning id into v_t;
  return v_t;
end $$;

CREATE FUNCTION crm.ponte_da_app_attivita() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare
  v_prima text := current_setting('crm.ponte', true);
  x crm.attivita; t crm.trattative; c app.contatti; v_cambi text[]; v_conflitti text[];
begin
  if v_prima = 'crm' then return null; end if;
  if tg_op = 'DELETE' then
    perform crm.ponte_nota('app', 'app.attivita', old.id, 'delete', false, null, '{}');
    return null;
  end if;
  begin
    perform set_config('crm.ponte', 'app', true);
    select * into t from crm.trattative where contatto_id = new.contatto_id;
    if not found then
      select * into c from app.contatti where id = new.contatto_id;
      perform crm.ponte_crea_trattativa(c);
      select * into t from crm.trattative where contatto_id = new.contatto_id;
    end if;
    select * into x from crm.attivita where attivita_app_id = new.id;
    if not found then
      insert into crm.attivita (tipo, azienda_id, persona_id, trattativa_id, esito, testo, fase, attivita_app_id, origine,
                                ponte_il, quando, creato_da)
      values (new.tipo, t.azienda_id, t.persona_id, t.id, new.esito, coalesce(new.testo, ''), new.fase, new.id, 'app',
              now(), new.quando, new.da);
      perform crm.ponte_nota('app', 'app.attivita', new.id, 'insert', false, null, '{}');
    elsif tg_op = 'UPDATE' then
      select y.cambi, y.conflitti into v_cambi, v_conflitti
        from crm.ponte_cambi(crm.ponte_campi_attivita_app(old), crm.ponte_campi_attivita_app(new), crm.ponte_campi_attivita_crm(x)) y;
      if new.contatto_id is distinct from old.contatto_id then v_cambi := coalesce(v_cambi, '{}') || array['trattativa_id']; end if;
      if v_cambi is not null then
        update crm.attivita y set
          tipo = case when 'tipo' = any (v_cambi) then new.tipo else y.tipo end,
          testo = case when 'testo' = any (v_cambi) then coalesce(new.testo, '') else y.testo end,
          esito = case when 'esito' = any (v_cambi) then new.esito else y.esito end,
          quando = case when 'quando' = any (v_cambi) then new.quando else y.quando end,
          fase = case when 'fase' = any (v_cambi) then new.fase else y.fase end,
          trattativa_id = case when 'trattativa_id' = any (v_cambi) then t.id else y.trattativa_id end,
          persona_id = case when 'trattativa_id' = any (v_cambi) then t.persona_id else y.persona_id end,
          azienda_id = case when 'trattativa_id' = any (v_cambi) then t.azienda_id else y.azienda_id end,
          ponte_il = now()
        where y.id = x.id;
        perform crm.ponte_nota('app', 'app.attivita', new.id, 'update', v_conflitti is not null, null, v_cambi);
      end if;
    end if;
    perform set_config('crm.ponte', coalesce(v_prima, ''), true);
  exception when others then
    perform crm.ponte_nota('app', 'app.attivita', new.id, lower(tg_op), false, sqlstate, '{}');
  end;
  return null;
end $$;

CREATE FUNCTION crm.ponte_da_app_aziende() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare v_prima text := current_setting('crm.ponte', true); v_id uuid;
begin
  if v_prima = 'crm' then return null; end if;
  if tg_op = 'INSERT' and new.esito = 'da-chiamare' and new.tentativi = 0 and new.ultima_chiamata is null then return null; end if;
  if tg_op = 'UPDATE' and (new.esito, new.tentativi, new.ultima_chiamata) is not distinct from (old.esito, old.tentativi, old.ultima_chiamata) then
    return null;
  end if;
  begin
    perform set_config('crm.ponte', 'app', true);
    insert into crm.attivita (tipo, azienda_id, esito, esito_azienda, testo, scadenza, quando, origine, ponte_il, creato_da)
    values ('chiamata', new.id, crm.ponte_esito_app(new.esito), new.esito, '',
            case when new.esito = 'richiamare' then new.richiamare_il end,
            case when new.ultima_chiamata is not null and (tg_op = 'INSERT' or new.ultima_chiamata is distinct from old.ultima_chiamata)
                 then new.ultima_chiamata else now() end,
            'app', now(), coalesce(new.chiamato_da, lower(coalesce(auth.jwt()->>'email', ''))))
    returning id into v_id;
    perform crm.ponte_nota('app', 'app.aziende', new.id, lower(tg_op), false, null, array['esito', 'tentativi', 'ultima_chiamata']);
    perform set_config('crm.ponte', coalesce(v_prima, ''), true);
  exception when others then
    perform crm.ponte_nota('app', 'app.aziende', new.id, lower(tg_op), false, sqlstate, '{}');
  end;
  return null;
end $$;

CREATE FUNCTION crm.ponte_da_app_contatti() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare
  v_prima text := current_setting('crm.ponte', true);
  t crm.trattative; p crm.persone; v_pid uuid; v_cambi text[]; v_conflitti text[];
begin
  if v_prima = 'crm' then return null; end if;
  begin
    perform set_config('crm.ponte', 'app', true);
    select * into t from crm.trattative where contatto_id = new.id;
    if not found then
      perform crm.ponte_crea_trattativa(new);
      perform crm.ponte_nota('app', 'app.contatti', new.id, lower(tg_op), false, null, '{}');
    elsif tg_op = 'UPDATE' then
      if t.persona_id is not null then select * into p from crm.persone where id = t.persona_id; end if;
      select x.cambi, x.conflitti into v_cambi, v_conflitti
        from crm.ponte_cambi(crm.ponte_campi_contatto(old), crm.ponte_campi_contatto(new), crm.ponte_campi_trattativa(t, p)) x;
      if v_cambi is not null then
        update crm.trattative x set
          fase_id = case when 'fase_id' = any (v_cambi) then new.fase else x.fase_id end,
          percorso = case when 'percorso' = any (v_cambi) then new.percorso else x.percorso end,
          segue = case when 'segue' = any (v_cambi) then new.assegnato_a else x.segue end,
          prossimo_passo = case when 'prossimo_passo' = any (v_cambi) then left(coalesce(new.prossima_azione, ''), 300) else x.prossimo_passo end,
          prossimo_il = case when 'prossimo_il' = any (v_cambi) then new.prossima_data else x.prossimo_il end,
          note = case when 'note' = any (v_cambi) then coalesce(new.note, '') else x.note end,
          temperatura = case when 'temperatura' = any (v_cambi) then new.temperatura else x.temperatura end,
          motivo_perso = case when 'motivo_perso' = any (v_cambi) then new.motivo_perso else x.motivo_perso end,
          avvio = case when 'avvio' = any (v_cambi) then new.proposta_avvio else x.avvio end,
          canone = case when 'canone' = any (v_cambi) then new.proposta_canone else x.canone end,
          ponte_il = now()
        where x.id = t.id;
        if v_cambi && array['nome', 'telefono', 'email'] then
          if p.id is null then
            insert into crm.persone (azienda_id, nome, telefono, email, fonte, origine, ponte_il, creato_da)
            values (t.azienda_id, crm.ponte_nome(new.nome), left(coalesce(new.telefono, ''), 40), left(coalesce(new.email, ''), 254),
                    left(coalesce(new.fonte, ''), 120), 'app', now(), new.creato_da)
            returning id into v_pid;
            update crm.trattative set persona_id = v_pid where id = t.id;
          else
            update crm.persone x set
              nome = case when 'nome' = any (v_cambi) then crm.ponte_nome(new.nome) else x.nome end,
              telefono = case when 'telefono' = any (v_cambi) then left(coalesce(new.telefono, ''), 40) else x.telefono end,
              email = case when 'email' = any (v_cambi) then left(coalesce(new.email, ''), 254) else x.email end,
              ponte_il = now()
            where x.id = p.id;
            perform set_config('crm.ponte', 'crm', true);
            update app.contatti x set
              nome = case when 'nome' = any (v_cambi) then new.nome else x.nome end,
              telefono = case when 'telefono' = any (v_cambi) then new.telefono else x.telefono end,
              email = case when 'email' = any (v_cambi) then new.email else x.email end,
              aggiornato = now()
            where x.id in (select o.contatto_id from crm.trattative o where o.persona_id = p.id and o.contatto_id <> new.id)
              and (x.nome, x.telefono, x.email) is distinct from (
                   case when 'nome' = any (v_cambi) then new.nome else x.nome end,
                   case when 'telefono' = any (v_cambi) then new.telefono else x.telefono end,
                   case when 'email' = any (v_cambi) then new.email else x.email end);
            perform set_config('crm.ponte', 'app', true);
          end if;
        end if;
        perform crm.ponte_nota('app', 'app.contatti', new.id, 'update', v_conflitti is not null, null, v_cambi);
      end if;
    end if;
    perform set_config('crm.ponte', coalesce(v_prima, ''), true);
  exception when others then
    perform crm.ponte_nota('app', 'app.contatti', new.id, lower(tg_op), false, sqlstate, '{}');
  end;
  return null;
end $$;

CREATE FUNCTION crm.ponte_da_app_contatti_via() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare v_prima text := current_setting('crm.ponte', true);
begin
  if v_prima = 'crm' then return old; end if;
  begin
    perform set_config('crm.ponte', 'app', true);
    update crm.trattative set archiviata_il = coalesce(archiviata_il, now()), ponte_il = now() where contatto_id = old.id;
    if found then perform crm.ponte_nota('app', 'app.contatti', old.id, 'archivia', false, null, array['archiviata_il']); end if;
    perform set_config('crm.ponte', coalesce(v_prima, ''), true);
  exception when others then
    perform crm.ponte_nota('app', 'app.contatti', old.id, 'archivia', false, sqlstate, '{}');
  end;
  return old;
end $$;

CREATE FUNCTION crm.ponte_da_crm_attivita() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare
  v_prima text := current_setting('crm.ponte', true);
  v_contatto uuid; v_id uuid; a app.attivita; v_cambi text[]; v_conflitti text[]; v_ultima boolean;
begin
  if v_prima = 'app' then return null; end if;
  begin
    perform set_config('crm.ponte', 'crm', true);
    if new.tipo = 'chiamata' and new.trattativa_id is null and new.azienda_id is not null then
      select not exists (select 1 from crm.attivita y
                          where y.azienda_id = new.azienda_id and y.tipo = 'chiamata' and y.trattativa_id is null
                            and y.id <> new.id and y.esito_azienda is not null and y.quando > new.quando)
        into v_ultima;
      if tg_op = 'INSERT' then
        update app.aziende x set
          tentativi = x.tentativi + 1,
          ultima_chiamata = greatest(coalesce(x.ultima_chiamata, new.quando), new.quando),
          chiamato_da = coalesce(nullif(new.creato_da, ''), x.chiamato_da),
          esito = case when v_ultima and new.esito_azienda is not null then new.esito_azienda else x.esito end,
          richiamare_il = case when v_ultima and new.esito_azienda = 'richiamare' then new.scadenza else x.richiamare_il end,
          aggiornato = now()
        where x.id = new.azienda_id;
        perform crm.ponte_nota('crm', 'crm.attivita', new.id, 'insert', false, null,
                               array['esito', 'tentativi', 'ultima_chiamata', 'chiamato_da']);
      elsif v_ultima and new.esito_azienda is not null
            and (new.esito_azienda, new.scadenza) is distinct from (old.esito_azienda, old.scadenza) then
        update app.aziende x set esito = new.esito_azienda,
          richiamare_il = case when new.esito_azienda = 'richiamare' then new.scadenza else x.richiamare_il end, aggiornato = now()
        where x.id = new.azienda_id and (x.esito, x.richiamare_il) is distinct from
              (new.esito_azienda, case when new.esito_azienda = 'richiamare' then new.scadenza else x.richiamare_il end);
        if found then perform crm.ponte_nota('crm', 'crm.attivita', new.id, 'update', false, null, array['esito']); end if;
      end if;
    elsif new.trattativa_id is not null and crm.ponte_tipo_app(new.tipo) is not null then
      select t.contatto_id into v_contatto from crm.trattative t where t.id = new.trattativa_id;
      if tg_op = 'INSERT' or new.attivita_app_id is null and old.attivita_app_id is null then
        if v_contatto is not null and new.attivita_app_id is null and (tg_op = 'INSERT' or new.ponte_il is null) then
          insert into app.attivita (contatto_id, tipo, testo, quando, da, fase, esito)
          values (v_contatto, crm.ponte_tipo_app(new.tipo), coalesce(new.testo, ''), new.quando, new.creato_da, new.fase,
                  crm.ponte_esito_app(new.esito))
          returning id into v_id;
          update crm.attivita set attivita_app_id = v_id, ponte_il = now() where id = new.id;
          perform crm.ponte_nota('crm', 'crm.attivita', new.id, lower(tg_op), false, null, '{}');
        end if;
      elsif tg_op = 'UPDATE' and new.attivita_app_id is not null and old.attivita_app_id is not distinct from new.attivita_app_id then
        select * into a from app.attivita where id = new.attivita_app_id;
        if found then
          select y.cambi, y.conflitti into v_cambi, v_conflitti
            from crm.ponte_cambi(crm.ponte_campi_attivita_crm(old), crm.ponte_campi_attivita_crm(new), crm.ponte_campi_attivita_app(a)) y;
          if new.trattativa_id is distinct from old.trattativa_id and v_contatto is not null and v_contatto <> a.contatto_id then
            v_cambi := coalesce(v_cambi, '{}') || array['contatto_id'];
          end if;
          if v_cambi is not null then
            update app.attivita y set
              tipo = case when 'tipo' = any (v_cambi) then crm.ponte_tipo_app(new.tipo) else y.tipo end,
              testo = case when 'testo' = any (v_cambi) then coalesce(new.testo, '') else y.testo end,
              esito = case when 'esito' = any (v_cambi) then crm.ponte_esito_app(new.esito) else y.esito end,
              quando = case when 'quando' = any (v_cambi) then new.quando else y.quando end,
              fase = case when 'fase' = any (v_cambi) then new.fase else y.fase end,
              contatto_id = case when 'contatto_id' = any (v_cambi) then v_contatto else y.contatto_id end
            where y.id = a.id;
            perform crm.ponte_nota('crm', 'crm.attivita', new.id, 'update', v_conflitti is not null, null, v_cambi);
          end if;
        end if;
      end if;
    end if;
    perform set_config('crm.ponte', coalesce(v_prima, ''), true);
  exception when others then
    perform crm.ponte_nota('crm', 'crm.attivita', new.id, lower(tg_op), false, sqlstate, '{}');
  end;
  return null;
end $$;

CREATE FUNCTION crm.ponte_da_crm_persone() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare
  v_prima text := current_setting('crm.ponte', true);
  c app.contatti; v_cambi text[]; v_conflitti text[]; v_c text[]; v_k text[]; v_conflitto boolean := false;
  v_vecchio jsonb; v_nuovo jsonb;
begin
  if v_prima = 'app' then return null; end if;
  v_vecchio := jsonb_build_object('nome', crm.ponte_nome(old.nome), 'telefono', left(coalesce(old.telefono, ''), 40),
                                  'email', left(coalesce(old.email, ''), 254));
  v_nuovo := jsonb_build_object('nome', crm.ponte_nome(new.nome), 'telefono', left(coalesce(new.telefono, ''), 40),
                                'email', left(coalesce(new.email, ''), 254));
  if v_vecchio = v_nuovo then return null; end if;
  begin
    perform set_config('crm.ponte', 'crm', true);
    for c in select x.* from app.contatti x join crm.trattative t on t.contatto_id = x.id where t.persona_id = new.id loop
      select y.cambi, y.conflitti into v_c, v_k
        from crm.ponte_cambi(v_vecchio, v_nuovo, jsonb_build_object('nome', crm.ponte_nome(c.nome),
               'telefono', left(coalesce(c.telefono, ''), 40), 'email', left(coalesce(c.email, ''), 254))) y;
      v_cambi := v_c;
      v_conflitto := v_conflitto or v_k is not null;
      update app.contatti x set
        nome = case when 'nome' = any (v_c) then crm.ponte_nome(new.nome) else x.nome end,
        telefono = case when 'telefono' = any (v_c) then coalesce(new.telefono, '') else x.telefono end,
        email = case when 'email' = any (v_c) then coalesce(new.email, '') else x.email end,
        aggiornato = now()
      where x.id = c.id
        and (x.nome, x.telefono, x.email) is distinct from (
             case when 'nome' = any (v_c) then crm.ponte_nome(new.nome) else x.nome end,
             case when 'telefono' = any (v_c) then coalesce(new.telefono, '') else x.telefono end,
             case when 'email' = any (v_c) then coalesce(new.email, '') else x.email end);
    end loop;
    if v_cambi is not null then
      perform crm.ponte_nota('crm', 'crm.persone', new.id, 'update', v_conflitto, null, v_cambi);
    end if;
    perform set_config('crm.ponte', coalesce(v_prima, ''), true);
  exception when others then
    perform crm.ponte_nota('crm', 'crm.persone', new.id, 'update', false, sqlstate, '{}');
  end;
  return null;
end $$;

CREATE FUNCTION crm.ponte_da_crm_trattative() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare
  v_prima text := current_setting('crm.ponte', true);
  c app.contatti; p crm.persone; p_prima crm.persone; v_id uuid; v_cambi text[]; v_conflitti text[];
  v_cliente boolean; v_entra boolean; v_soldi boolean; v_contatto uuid;
  v_oggi date := (now() at time zone 'utc')::date;
begin
  if v_prima = 'app' then return null; end if;
  begin
    perform set_config('crm.ponte', 'crm', true);
    if new.persona_id is not null then select * into p from crm.persone where id = new.persona_id; end if;
    v_cliente := exists (select 1 from app.fasi_lead f where f.id = new.fase_id and f.tipo = 'cliente');
    if new.contatto_id is null then
      if new.archiviata_il is null and (tg_op = 'INSERT' or old.contatto_id is null) then
        insert into app.contatti (nome, telefono, azienda, email, fonte, percorso, fase, assegnato_a, prossima_azione,
                                  prossima_data, note, temperatura, motivo_perso, proposta_avvio, proposta_canone, creato_da,
                                  cliente_dal, avvio, canone)
        values (crm.ponte_nome(p.nome), coalesce(p.telefono, ''),
                coalesce((select a.nome from app.aziende a where a.id = new.azienda_id), ''), coalesce(p.email, ''),
                coalesce(nullif(p.fonte, ''), 'CRM'), new.percorso, new.fase_id, new.segue, coalesce(new.prossimo_passo, ''),
                new.prossimo_il, coalesce(new.note, ''), new.temperatura, new.motivo_perso, new.avvio, new.canone, new.creato_da,
                case when v_cliente then v_oggi end, case when v_cliente then new.avvio end,
                case when v_cliente then new.canone end)
        returning id into v_id;
        update crm.trattative set contatto_id = v_id, ponte_il = now() where id = new.id;
        perform crm.ponte_nota('crm', 'crm.trattative', new.id, lower(tg_op), false, null, '{}');
      end if;
    else
      select * into c from app.contatti where id = new.contatto_id;
      if found then
        if tg_op = 'UPDATE' and new.persona_id is not distinct from old.persona_id then
          p_prima := p;
        elsif tg_op = 'UPDATE' and old.persona_id is not null then
          select * into p_prima from crm.persone where id = old.persona_id;
        end if;
        select x.cambi, x.conflitti into v_cambi, v_conflitti
          from crm.ponte_cambi(case when tg_op = 'UPDATE' and old.contatto_id is not distinct from new.contatto_id
                                    then crm.ponte_campi_trattativa(old, p_prima) else crm.ponte_campi_contatto(c) end,
                               crm.ponte_campi_trattativa(new, p), crm.ponte_campi_contatto(c)) x;
        if v_cambi is not null then
          v_entra := v_cliente and 'fase_id' = any (v_cambi);
          v_soldi := v_cliente and (v_entra or v_cambi && array['avvio', 'canone']);
          update app.contatti x set
            nome = case when 'nome' = any (v_cambi) then crm.ponte_nome(p.nome) else x.nome end,
            telefono = case when 'telefono' = any (v_cambi) then coalesce(p.telefono, '') else x.telefono end,
            email = case when 'email' = any (v_cambi) then coalesce(p.email, '') else x.email end,
            fase = case when 'fase_id' = any (v_cambi) then new.fase_id else x.fase end,
            percorso = case when 'percorso' = any (v_cambi) then new.percorso else x.percorso end,
            assegnato_a = case when 'segue' = any (v_cambi) then new.segue else x.assegnato_a end,
            prossima_azione = case when 'prossimo_passo' = any (v_cambi) then coalesce(new.prossimo_passo, '') else x.prossima_azione end,
            prossima_data = case when 'prossimo_il' = any (v_cambi) then new.prossimo_il else x.prossima_data end,
            note = case when 'note' = any (v_cambi) then coalesce(new.note, '') else x.note end,
            temperatura = case when 'temperatura' = any (v_cambi) then new.temperatura else x.temperatura end,
            motivo_perso = case when 'motivo_perso' = any (v_cambi) then new.motivo_perso else x.motivo_perso end,
            proposta_avvio = case when 'avvio' = any (v_cambi) then new.avvio else x.proposta_avvio end,
            proposta_canone = case when 'canone' = any (v_cambi) then new.canone else x.proposta_canone end,
            cliente_dal = case when v_entra then coalesce(x.cliente_dal, v_oggi) else x.cliente_dal end,
            avvio = case when v_soldi then coalesce(x.avvio, new.avvio) else x.avvio end,
            canone = case when v_soldi then coalesce(x.canone, new.canone) else x.canone end,
            aggiornato = now()
          where x.id = c.id;
          perform crm.ponte_nota('crm', 'crm.trattative', new.id, lower(tg_op), v_conflitti is not null, null,
                                 v_cambi || array_remove(array[
                                   case when v_entra and c.cliente_dal is null then 'cliente_dal' end,
                                   case when v_soldi and c.avvio is null and new.avvio is not null then 'contratto_avvio' end,
                                   case when v_soldi and c.canone is null and new.canone is not null then 'contratto_canone' end], null));
        end if;
      end if;
    end if;
    v_contatto := coalesce(new.contatto_id, v_id);
    if v_contatto is not null and new.azienda_id is not null and new.archiviata_il is null
       and (tg_op = 'INSERT' or new.azienda_id is distinct from old.azienda_id or new.contatto_id is distinct from old.contatto_id) then
      update app.aziende set contatto_id = v_contatto, aggiornato = now() where id = new.azienda_id and contatto_id is null;
    end if;
    perform set_config('crm.ponte', coalesce(v_prima, ''), true);
  exception when others then
    perform crm.ponte_nota('crm', 'crm.trattative', new.id, lower(tg_op), false, sqlstate, '{}');
  end;
  return null;
end $$;

CREATE FUNCTION crm.ponte_esito_app(e text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select case when e in ('risposto', 'non-risponde', 'richiamare', 'numero-errato', 'inviato', 'ha-risposto', 'fatta',
                         'non-presentato', 'spostata') then e end
$$;

CREATE FUNCTION crm.ponte_niente_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
begin
  if old.contatto_id is not null then
    raise exception 'crm.trattative: una trattativa col suo contatto si archivia, non si cancella' using errcode = '23001';
  end if;
  return old;
end $$;

CREATE FUNCTION crm.ponte_nome(t text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select case when coalesce(trim(t), '') = '' then 'Senza nome' else left(t, 200) end
$$;

CREATE FUNCTION crm.ponte_nota(p_da text, p_tabella text, p_riga uuid, p_azione text, p_conflitto boolean, p_sqlstate text, p_colonne text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
begin
  insert into crm.ponte_registro (da, tabella, riga_id, azione, conflitto, errore_sqlstate, colonne)
  values (p_da, p_tabella, p_riga, p_azione, coalesce(p_conflitto, false), p_sqlstate, coalesce(p_colonne, '{}'));
exception when others then
  raise warning 'crm.ponte_registro: sqlstate %', sqlstate;
end $$;

CREATE FUNCTION crm.ponte_tipo_app(t text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select case when t in ('whatsapp', 'email') then 'messaggio' when t in ('chiamata', 'messaggio', 'meet', 'nota', 'fase') then t end
$$;

CREATE FUNCTION crm.prendi_dalla_coda(p_candidate uuid[]) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
declare
  v_id uuid;
  v_presa uuid;
begin
  loop
    select a.id into v_id
      from unnest(p_candidate) with ordinality as c(id, ordine)
      join app.aziende a on a.id = c.id
     where not exists (select 1 from crm.coda_prese p where p.azienda_id = a.id and p.fino_a > now())
     order by c.ordine
     limit 1
       for no key update of a skip locked;
    if not found then
      return null;
    end if;
    insert into crm.coda_prese as p (azienda_id) values (v_id)
    on conflict (azienda_id) do update
      set preso_da = excluded.preso_da, fino_a = excluded.fino_a, creato = excluded.creato, creato_da = excluded.creato_da
      where p.fino_a <= now()
    returning p.azienda_id into v_presa;
    if v_presa is not null then
      return v_presa;
    end if;
  end loop;
end $$;

CREATE FUNCTION crm.segnala_cambio() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
declare
  v_id jsonb := case when tg_op = 'DELETE' then to_jsonb(old) -> tg_argv[0] else to_jsonb(new) -> tg_argv[0] end;
begin
  perform pg_notify('crm', jsonb_build_object('schema', tg_table_schema, 'tabella', tg_table_name,
                                              'evento', tg_op, 'id', v_id)::text);
  return null;
end $$;

CREATE FUNCTION crm.tocca_aggiornato() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
begin
  if tg_table_name = 'trattative'
     and (to_jsonb(new) - 'mossa_il' - 'aggiornato' - 'valore') = (to_jsonb(old) - 'mossa_il' - 'aggiornato' - 'valore') then
    return new;
  end if;
  new.aggiornato := now();
  return new;
end $$;

CREATE FUNCTION crm.trattativa_mossa() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $$
begin
  if new.fase_id is distinct from old.fase_id then new.mossa_il := now(); end if;
  return new;
end $$;

CREATE FUNCTION crm.trova_o_crea_azienda(posto jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'app', 'pg_temp'
    AS $$
declare
  v_place text := nullif(trim(coalesce(posto->>'place_id', '')), '');
  v_piva text := case when app.piva_valida(posto->>'piva') then regexp_replace(posto->>'piva', '\D', '', 'g') else '' end;
  v_tel text := app.norma_telefono(posto->>'telefono');
  v_dom text := app.norma_dominio(posto->>'sito');
  v_nome text := left(coalesce(nullif(trim(posto->>'nome'), ''), 'Senza nome'), 300);
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('azienda:' || coalesce(v_place, nullif(v_piva, ''), nullif(v_tel, ''), nullif(v_dom, ''), lower(v_nome))));
  if v_place is not null then
    select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'place_id' and c.valore = v_place;
  end if;
  if v_id is null and v_piva <> '' then
    select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'piva' and c.valore = v_piva;
  end if;
  if v_id is null and v_tel <> '' then
    select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'telefono' and c.valore = v_tel and c.usi < 2;
  end if;
  if v_id is null and v_dom <> '' then
    select c.azienda_id into v_id from app.aziende_chiavi c where c.tipo = 'dominio' and c.valore = v_dom and c.usi < 2;
  end if;
  if v_id is not null then return v_id; end if;

  insert into app.aziende (nome, telefono, telefono_norm, sito, dominio, piva, email, place_id, dati, contatto_id, creato_da)
  values (v_nome, coalesce(posto->>'telefono', ''), v_tel, coalesce(posto->>'sito', ''), v_dom, v_piva,
          lower(trim(coalesce(posto->>'email', ''))), v_place,
          case when jsonb_typeof(posto->'dati') = 'object' then posto->'dati' else '{}'::jsonb end,
          nullif(posto->>'contatto_id', '')::uuid, coalesce(posto->>'creato_da', lower(coalesce(auth.jwt()->>'email', ''))))
  returning id into v_id;
  insert into app.aziende_chiavi (tipo, valore, azienda_id, creato_da)
  select x.tipo, x.valore, v_id, coalesce(posto->>'creato_da', lower(coalesce(auth.jwt()->>'email', '')))
    from (values ('place_id', v_place), ('piva', v_piva), ('telefono', v_tel), ('dominio', v_dom)) x(tipo, valore)
   where length(coalesce(x.valore, '')) between 3 and 300
  on conflict (tipo, valore) do nothing;
  return v_id;
end $$;

CREATE FUNCTION crm.valida_campi() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'crm', 'pg_temp'
    AS $_$
declare
  v_oggetto text := tg_argv[0];
  k text;
  v jsonb;
  d record;
  v_nome text;
  v_ok boolean;
begin
  if jsonb_typeof(new.campi) is distinct from 'object' then
    raise exception 'campi personalizzati: devono essere un oggetto' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.campi = old.campi then
    return new;
  end if;
  for k, v in select e.key, e.value from jsonb_each(new.campi) e loop
    if tg_op = 'UPDATE' and old.campi ? k and old.campi -> k = v then
      continue;
    end if;
    v_nome := case when k ~ '^[a-z][a-z0-9_]{0,39}$' then k else '(chiave non valida)' end;
    select c.tipo, c.opzioni into d
      from crm.campi_definizioni c
     where c.oggetto = v_oggetto and c.chiave = k and c.archiviato_il is null;
    if not found then
      raise exception 'campo personalizzato non definito: %', v_nome using errcode = 'check_violation';
    end if;
    if jsonb_typeof(v) = 'null' then
      continue;
    end if;
    v_ok := case d.tipo
      when 'testo' then jsonb_typeof(v) = 'string' and char_length(v #>> '{}') <= 2000
      when 'numero' then jsonb_typeof(v) = 'number'
      when 'valuta' then jsonb_typeof(v) = 'number'
      when 'booleano' then jsonb_typeof(v) = 'boolean'
      when 'data' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
      when 'link' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~* '^https?://[^\s]+$' and char_length(v #>> '{}') <= 2000
      when 'telefono' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^[0-9+ ()./-]{3,40}$'
      when 'email' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(v #>> '{}') <= 254
      when 'scelta' then jsonb_typeof(v) = 'string'
        and exists (select 1 from jsonb_array_elements(d.opzioni) o where o = v or o -> 'valore' = v)
      when 'multi' then jsonb_typeof(v) = 'array'
        and not exists (select 1 from jsonb_array_elements(v) x
                         where jsonb_typeof(x) <> 'string'
                            or not exists (select 1 from jsonb_array_elements(d.opzioni) o where o = x or o -> 'valore' = x))
      else false
    end;
    if v_ok and d.tipo = 'data' then
      begin
        perform (v #>> '{}')::date;
      exception when others then
        v_ok := false;
      end;
    end if;
    if not coalesce(v_ok, false) then
      raise exception 'campo personalizzato %: valore non valido per il tipo %', v_nome, d.tipo using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $_$;

CREATE TABLE app.aziende (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    telefono text DEFAULT ''::text NOT NULL,
    telefono_norm text DEFAULT ''::text NOT NULL,
    sito text DEFAULT ''::text NOT NULL,
    dominio text DEFAULT ''::text NOT NULL,
    piva text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    indirizzo text DEFAULT ''::text NOT NULL,
    comune text DEFAULT ''::text NOT NULL,
    categoria text DEFAULT ''::text NOT NULL,
    categorie text[] DEFAULT '{}'::text[] NOT NULL,
    valutazione numeric(2,1),
    recensioni integer,
    place_id text,
    dati jsonb DEFAULT '{}'::jsonb NOT NULL,
    contatto_id uuid,
    unione text DEFAULT 'ok'::text NOT NULL,
    unione_motivo text DEFAULT ''::text NOT NULL,
    esito text DEFAULT 'da-chiamare'::text NOT NULL,
    tentativi integer DEFAULT 0 NOT NULL,
    richiamare_il timestamp with time zone,
    ultima_chiamata timestamp with time zone,
    chiamato_da text,
    referente text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT aziende_esito_check CHECK ((esito = ANY (ARRAY['da-chiamare'::text, 'non-risponde'::text, 'richiamare'::text, 'non-interessato'::text, 'interessato'::text]))),
    CONSTRAINT aziende_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 1) AND (length(TRIM(BOTH FROM nome)) <= 300))),
    CONSTRAINT aziende_unione_check CHECK ((unione = ANY (ARRAY['ok'::text, 'da-controllare'::text])))
);

CREATE TABLE app.aziende_chiavi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    valore text NOT NULL,
    azienda_id uuid NOT NULL,
    usi integer DEFAULT 1 NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT aziende_chiavi_tipo_check CHECK ((tipo = ANY (ARRAY['place_id'::text, 'piva'::text, 'telefono'::text, 'dominio'::text]))),
    CONSTRAINT aziende_chiavi_valore_check CHECK (((length(valore) >= 3) AND (length(valore) <= 300)))
);

CREATE TABLE app.aziende_provenienze (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    azienda_id uuid NOT NULL,
    raccolta_id uuid,
    lista_id uuid,
    parola text DEFAULT ''::text NOT NULL,
    luogo text DEFAULT ''::text NOT NULL,
    zona text DEFAULT ''::text NOT NULL,
    fonte text DEFAULT ''::text NOT NULL,
    metodo text DEFAULT ''::text NOT NULL,
    prima_vista timestamp with time zone DEFAULT now() NOT NULL,
    ultima_vista timestamp with time zone DEFAULT now() NOT NULL,
    volte integer DEFAULT 1 NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    canale text DEFAULT 'maps'::text NOT NULL,
    campagna text DEFAULT ''::text NOT NULL,
    gruppo_inserzioni text DEFAULT ''::text NOT NULL,
    inserzione text DEFAULT ''::text NOT NULL,
    piattaforma text DEFAULT ''::text NOT NULL,
    risposte text DEFAULT ''::text NOT NULL,
    risposte_modulo jsonb DEFAULT '[]'::jsonb NOT NULL,
    contatto_id uuid,
    persona_id uuid,
    trattativa_id uuid,
    da_chi text DEFAULT ''::text NOT NULL,
    CONSTRAINT aziende_provenienze_canale_check CHECK ((canale = ANY (ARRAY['meta'::text, 'landing'::text, 'prenota'::text, 'maps'::text, 'indeed'::text, 'lista'::text, 'passaparola'::text, 'manuale'::text])))
);

CREATE TABLE app.fasi_lead (
    id text NOT NULL,
    nome text NOT NULL,
    ordine integer DEFAULT 0 NOT NULL,
    colore text DEFAULT '#8a95a5'::text NOT NULL,
    percorso text DEFAULT 'freddo'::text NOT NULL,
    tipo text DEFAULT 'aperta'::text NOT NULL,
    fissa boolean DEFAULT false NOT NULL,
    con_meet boolean DEFAULT false NOT NULL,
    CONSTRAINT fasi_lead_tipo_check CHECK ((tipo = ANY (ARRAY['aperta'::text, 'cliente'::text, 'perso'::text])))
);

CREATE TABLE app.liste_aziende (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lista_id uuid NOT NULL,
    azienda_id uuid NOT NULL,
    raccolta_id uuid,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
);

CREATE TABLE app.liste_freddo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    nicchia_id uuid,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
);

CREATE TABLE app.percorsi (
    id text NOT NULL,
    nome text NOT NULL,
    ordine integer DEFAULT 0 NOT NULL,
    fisso boolean DEFAULT false NOT NULL,
    assegna_a text[] DEFAULT '{}'::text[] NOT NULL
);

CREATE TABLE app.raccolte (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero integer NOT NULL,
    lista_id uuid NOT NULL,
    tipo text NOT NULL,
    parametri jsonb DEFAULT '{}'::jsonb NOT NULL,
    da_dove text DEFAULT 'pagina'::text NOT NULL,
    stato text DEFAULT 'in-corso'::text NOT NULL,
    trovate integer DEFAULT 0 NOT NULL,
    nuove integer DEFAULT 0 NOT NULL,
    aggiornate integer DEFAULT 0 NOT NULL,
    passo text DEFAULT ''::text NOT NULL,
    errore text DEFAULT ''::text NOT NULL,
    fermata_da text,
    finita timestamp with time zone,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    rapporto jsonb DEFAULT '{}'::jsonb NOT NULL,
    riprende_alle timestamp with time zone,
    CONSTRAINT raccolte_da_dove_check CHECK ((da_dove = ANY (ARRAY['pagina'::text, 'mcp'::text]))),
    CONSTRAINT raccolte_stato_check CHECK ((stato = ANY (ARRAY['in-corso'::text, 'finita'::text, 'fermata'::text, 'errore'::text, 'interrotta'::text]))),
    CONSTRAINT raccolte_tipo_check CHECK ((tipo = ANY (ARRAY['google-maps'::text, 'siti'::text])))
);

CREATE TABLE app.raccolte_celle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    raccolta_id uuid NOT NULL,
    parola text DEFAULT ''::text NOT NULL,
    sud double precision NOT NULL,
    ovest double precision NOT NULL,
    nord double precision NOT NULL,
    est double precision NOT NULL,
    profondita integer DEFAULT 0 NOT NULL,
    stato text DEFAULT 'da-fare'::text NOT NULL,
    motivo text DEFAULT ''::text NOT NULL,
    r_metri integer,
    distanza_max integer,
    dentro integer DEFAULT 0 NOT NULL,
    oltre integer DEFAULT 0 NOT NULL,
    posti integer DEFAULT 0 NOT NULL,
    nuovi integer DEFAULT 0 NOT NULL,
    richieste integer DEFAULT 0 NOT NULL,
    pagine integer DEFAULT 0 NOT NULL,
    tetto integer,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    luogo text DEFAULT ''::text NOT NULL,
    comune_istat text DEFAULT ''::text NOT NULL,
    madre_id uuid,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT raccolte_celle_stato_check CHECK ((stato = ANY (ARRAY['da-fare'::text, 'completa'::text, 'piena'::text, 'densa'::text, 'errore'::text])))
);

CREATE SEQUENCE app.raccolte_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE app.raccolte_numero_seq OWNED BY app.raccolte.numero;

CREATE TABLE app.soci (
    email text NOT NULL,
    nome text DEFAULT ''::text NOT NULL,
    colore text DEFAULT '#e8a10c'::text NOT NULL,
    aggiunto timestamp with time zone DEFAULT now() NOT NULL,
    aggiunto_da text,
    CONSTRAINT soci_email_check CHECK ((email = lower(email)))
);

CREATE TABLE crm.campi_definizioni (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    oggetto text NOT NULL,
    chiave text NOT NULL,
    etichetta text NOT NULL,
    tipo text NOT NULL,
    opzioni jsonb DEFAULT '[]'::jsonb NOT NULL,
    ordine integer DEFAULT 0 NOT NULL,
    archiviato_il timestamp with time zone,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT campi_definizioni_chiave_check CHECK ((chiave ~ '^[a-z][a-z0-9_]{0,39}$'::text)),
    CONSTRAINT campi_definizioni_etichetta_check CHECK (((length(TRIM(BOTH FROM etichetta)) >= 1) AND (length(TRIM(BOTH FROM etichetta)) <= 80))),
    CONSTRAINT campi_definizioni_oggetto_check CHECK ((oggetto = ANY (ARRAY['azienda'::text, 'persona'::text, 'trattativa'::text]))),
    CONSTRAINT campi_definizioni_opzioni_check CHECK ((jsonb_typeof(opzioni) = 'array'::text)),
    CONSTRAINT campi_definizioni_tipo_check CHECK ((tipo = ANY (ARRAY['testo'::text, 'numero'::text, 'data'::text, 'scelta'::text, 'multi'::text, 'booleano'::text, 'link'::text, 'telefono'::text, 'email'::text, 'valuta'::text])))
);

CREATE TABLE crm.coda_prese (
    azienda_id uuid NOT NULL,
    preso_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) NOT NULL,
    fino_a timestamp with time zone DEFAULT (now() + '00:15:00'::interval) NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT coda_prese_preso_da_check CHECK ((preso_da <> ''::text))
);

CREATE VIEW crm.fasi WITH (security_invoker='true') AS
 SELECT f.id,
    f.nome,
    f.ordine,
    f.colore,
    f.tipo,
    f.fissa,
    f.percorso,
    p.nome AS percorso_nome,
    p.ordine AS percorso_ordine
   FROM (app.fasi_lead f
     JOIN app.percorsi p ON ((p.id = f.percorso)));

CREATE TABLE crm.impostazioni (
    chiave text NOT NULL,
    valore jsonb NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT impostazioni_chiave_check CHECK ((chiave ~ '^[a-z][a-z0-9_]{0,59}$'::text))
);

CREATE TABLE crm.modelli_messaggi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    canale text DEFAULT 'whatsapp'::text NOT NULL,
    testo text NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT modelli_messaggi_canale_check CHECK ((canale = 'whatsapp'::text)),
    CONSTRAINT modelli_messaggi_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 1) AND (length(TRIM(BOTH FROM nome)) <= 80))),
    CONSTRAINT modelli_messaggi_testo_check CHECK (((length(TRIM(BOTH FROM testo)) >= 1) AND (length(TRIM(BOTH FROM testo)) <= 4000)))
);

CREATE TABLE crm.ponte_registro (
    id bigint NOT NULL,
    quando timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    da text NOT NULL,
    tabella text NOT NULL,
    riga_id uuid,
    azione text NOT NULL,
    conflitto boolean DEFAULT false NOT NULL,
    errore_sqlstate text,
    colonne text[] DEFAULT '{}'::text[] NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT ponte_registro_azione_check CHECK ((azione = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text, 'archivia'::text, 'riempi'::text]))),
    CONSTRAINT ponte_registro_da_check CHECK ((da = ANY (ARRAY['app'::text, 'crm'::text]))),
    CONSTRAINT ponte_registro_errore_sqlstate_check CHECK ((errore_sqlstate ~ '^[0-9A-Z]{5}$'::text)),
    CONSTRAINT ponte_registro_tabella_check CHECK ((char_length(tabella) <= 60))
);

ALTER TABLE crm.ponte_registro ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME crm.ponte_registro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE crm.schede_aziende (
    azienda_id uuid NOT NULL,
    segue text,
    campi jsonb DEFAULT '{}'::jsonb NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT schede_aziende_campi_check CHECK ((jsonb_typeof(campi) = 'object'::text))
);

CREATE TABLE crm.tag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    colore text DEFAULT '#8a95a5'::text NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT tag_colore_check CHECK ((colore ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT tag_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 1) AND (length(TRIM(BOTH FROM nome)) <= 60)))
);

CREATE TABLE crm.tag_su (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tag_id uuid NOT NULL,
    oggetto text NOT NULL,
    oggetto_id uuid NOT NULL,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT tag_su_oggetto_check CHECK ((oggetto = ANY (ARRAY['azienda'::text, 'persona'::text, 'trattativa'::text])))
);

CREATE TABLE crm.viste (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    tabella text NOT NULL,
    di text DEFAULT 'team'::text NOT NULL,
    tipo text DEFAULT 'tabella'::text NOT NULL,
    filtri jsonb DEFAULT '[]'::jsonb NOT NULL,
    ordine jsonb DEFAULT '[]'::jsonb NOT NULL,
    gruppo text,
    colonne jsonb DEFAULT '[]'::jsonb NOT NULL,
    campo_data text,
    usi integer DEFAULT 0 NOT NULL,
    usata_il timestamp with time zone,
    aggiornato timestamp with time zone DEFAULT now() NOT NULL,
    creato timestamp with time zone DEFAULT now() NOT NULL,
    creato_da text DEFAULT lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)),
    CONSTRAINT viste_campo_data_check CHECK ((char_length(campo_data) <= 80)),
    CONSTRAINT viste_colonne_check CHECK ((jsonb_typeof(colonne) = 'array'::text)),
    CONSTRAINT viste_di_check CHECK (((di = 'team'::text) OR ((di = lower(di)) AND (di ~ '^[^@\s]+@[^@\s]+$'::text)))),
    CONSTRAINT viste_gruppo_check CHECK ((char_length(gruppo) <= 80)),
    CONSTRAINT viste_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 1) AND (length(TRIM(BOTH FROM nome)) <= 80))),
    CONSTRAINT viste_tabella_check CHECK ((tabella = ANY (ARRAY['aziende'::text, 'persone'::text, 'trattative'::text, 'attivita'::text]))),
    CONSTRAINT viste_tipo_check CHECK ((tipo = ANY (ARRAY['tabella'::text, 'kanban'::text, 'calendario'::text, 'mappa'::text]))),
    CONSTRAINT viste_usi_check CHECK ((usi >= 0))
);

ALTER TABLE ONLY app.raccolte ALTER COLUMN numero SET DEFAULT nextval('app.raccolte_numero_seq'::regclass);

ALTER TABLE ONLY app.attivita
    ADD CONSTRAINT attivita_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.aziende_chiavi
    ADD CONSTRAINT aziende_chiavi_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.aziende_chiavi
    ADD CONSTRAINT aziende_chiavi_tipo_valore_key UNIQUE (tipo, valore);

ALTER TABLE ONLY app.aziende
    ADD CONSTRAINT aziende_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_unica UNIQUE (azienda_id, raccolta_id, parola);

ALTER TABLE ONLY app.contatti
    ADD CONSTRAINT contatti_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.fasi_lead
    ADD CONSTRAINT fasi_lead_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.liste_aziende
    ADD CONSTRAINT liste_aziende_lista_id_azienda_id_key UNIQUE (lista_id, azienda_id);

ALTER TABLE ONLY app.liste_aziende
    ADD CONSTRAINT liste_aziende_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.liste_freddo
    ADD CONSTRAINT liste_freddo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.percorsi
    ADD CONSTRAINT percorsi_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.raccolte_celle
    ADD CONSTRAINT raccolte_celle_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.raccolte
    ADD CONSTRAINT raccolte_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.soci
    ADD CONSTRAINT soci_pkey PRIMARY KEY (email);

ALTER TABLE ONLY crm.attivita
    ADD CONSTRAINT attivita_attivita_app_id_key UNIQUE (attivita_app_id);

ALTER TABLE ONLY crm.attivita
    ADD CONSTRAINT attivita_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.campi_definizioni
    ADD CONSTRAINT campi_definizioni_oggetto_chiave_key UNIQUE (oggetto, chiave);

ALTER TABLE ONLY crm.campi_definizioni
    ADD CONSTRAINT campi_definizioni_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.coda_prese
    ADD CONSTRAINT coda_prese_pkey PRIMARY KEY (azienda_id);

ALTER TABLE ONLY crm.impostazioni
    ADD CONSTRAINT impostazioni_pkey PRIMARY KEY (chiave);

ALTER TABLE ONLY crm.modelli_messaggi
    ADD CONSTRAINT modelli_messaggi_nome_key UNIQUE (nome);

ALTER TABLE ONLY crm.modelli_messaggi
    ADD CONSTRAINT modelli_messaggi_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.persone
    ADD CONSTRAINT persone_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.ponte_registro
    ADD CONSTRAINT ponte_registro_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.schede_aziende
    ADD CONSTRAINT schede_aziende_pkey PRIMARY KEY (azienda_id);

ALTER TABLE ONLY crm.tag
    ADD CONSTRAINT tag_nome_key UNIQUE (nome);

ALTER TABLE ONLY crm.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.tag_su
    ADD CONSTRAINT tag_su_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.tag_su
    ADD CONSTRAINT tag_su_tag_id_oggetto_oggetto_id_key UNIQUE (tag_id, oggetto, oggetto_id);

ALTER TABLE ONLY crm.trattative
    ADD CONSTRAINT trattative_contatto_id_key UNIQUE (contatto_id);

ALTER TABLE ONLY crm.trattative
    ADD CONSTRAINT trattative_pkey PRIMARY KEY (id);

ALTER TABLE ONLY crm.viste
    ADD CONSTRAINT viste_pkey PRIMARY KEY (id);

CREATE INDEX attivita_contatto ON app.attivita USING btree (contatto_id, quando DESC);

CREATE INDEX aziende_chiavi_azienda ON app.aziende_chiavi USING btree (azienda_id);

CREATE INDEX aziende_contatto ON app.aziende USING btree (contatto_id);

CREATE INDEX aziende_provenienze_azienda_quando ON app.aziende_provenienze USING btree (azienda_id, prima_vista, id);

CREATE UNIQUE INDEX aziende_provenienze_contatto ON app.aziende_provenienze USING btree (contatto_id) WHERE (contatto_id IS NOT NULL);

CREATE INDEX aziende_provenienze_lista ON app.aziende_provenienze USING btree (lista_id);

CREATE INDEX aziende_provenienze_raccolta ON app.aziende_provenienze USING btree (raccolta_id);

CREATE INDEX aziende_provenienze_trattativa ON app.aziende_provenienze USING btree (trattativa_id) WHERE (trattativa_id IS NOT NULL);

CREATE INDEX aziende_richiami ON app.aziende USING btree (richiamare_il) WHERE (esito = 'richiamare'::text);

CREATE INDEX aziende_telefono ON app.aziende USING btree (telefono_norm) WHERE (telefono_norm <> ''::text);

CREATE INDEX contatti_unito_a ON app.contatti USING btree (unito_a) WHERE (unito_a IS NOT NULL);

CREATE INDEX liste_aziende_azienda ON app.liste_aziende USING btree (azienda_id);

CREATE INDEX liste_aziende_raccolta ON app.liste_aziende USING btree (raccolta_id);

CREATE INDEX raccolte_celle_madre ON app.raccolte_celle USING btree (madre_id);

CREATE INDEX raccolte_celle_raccolta ON app.raccolte_celle USING btree (raccolta_id, creato);

CREATE INDEX raccolte_lista ON app.raccolte USING btree (lista_id, creato DESC);

CREATE UNIQUE INDEX raccolte_numero ON app.raccolte USING btree (numero);

CREATE INDEX attivita_azienda ON crm.attivita USING btree (azienda_id, quando DESC);

CREATE INDEX attivita_persona ON crm.attivita USING btree (persona_id, quando DESC);

CREATE INDEX attivita_quando ON crm.attivita USING btree (quando DESC);

CREATE INDEX attivita_trattativa ON crm.attivita USING btree (trattativa_id, quando DESC);

CREATE INDEX persone_azienda ON crm.persone USING btree (azienda_id);

CREATE INDEX persone_campi ON crm.persone USING gin (campi);

CREATE INDEX persone_telefono ON crm.persone USING btree (telefono_norm) WHERE (telefono_norm <> ''::text);

CREATE INDEX ponte_registro_problemi ON crm.ponte_registro USING btree (quando DESC) WHERE ((errore_sqlstate IS NOT NULL) OR conflitto);

CREATE INDEX ponte_registro_quando ON crm.ponte_registro USING btree (quando DESC);

CREATE INDEX ponte_registro_riga ON crm.ponte_registro USING btree (riga_id);

CREATE INDEX schede_aziende_campi ON crm.schede_aziende USING gin (campi);

CREATE INDEX tag_su_oggetto ON crm.tag_su USING btree (oggetto, oggetto_id);

CREATE INDEX trattative_azienda ON crm.trattative USING btree (azienda_id);

CREATE INDEX trattative_campi ON crm.trattative USING gin (campi);

CREATE INDEX trattative_fase ON crm.trattative USING btree (fase_id, archiviata_il);

CREATE INDEX trattative_percorso ON crm.trattative USING btree (percorso);

CREATE INDEX trattative_persona ON crm.trattative USING btree (persona_id);

CREATE INDEX viste_tabella ON crm.viste USING btree (tabella, di);

CREATE TRIGGER crm_ponte AFTER INSERT OR DELETE OR UPDATE ON app.attivita FOR EACH ROW EXECUTE FUNCTION crm.ponte_da_app_attivita();

CREATE TRIGGER crm_ponte AFTER INSERT OR UPDATE OF esito, tentativi, richiamare_il, ultima_chiamata, chiamato_da ON app.aziende FOR EACH ROW EXECUTE FUNCTION crm.ponte_da_app_aziende();

CREATE TRIGGER crm_ponte AFTER INSERT OR UPDATE OF nome, telefono, email, fase, percorso, assegnato_a, prossima_azione, prossima_data, note, temperatura, motivo_perso, proposta_avvio, proposta_canone ON app.contatti FOR EACH ROW EXECUTE FUNCTION crm.ponte_da_app_contatti();

CREATE TRIGGER crm_ponte_via BEFORE DELETE ON app.contatti FOR EACH ROW EXECUTE FUNCTION crm.ponte_da_app_contatti_via();

CREATE TRIGGER proteggi_colonne_chiuse BEFORE DELETE OR UPDATE ON app.fasi_lead FOR EACH ROW EXECUTE FUNCTION app.proteggi_colonne_chiuse();

CREATE TRIGGER proteggi_percorsi BEFORE DELETE OR UPDATE ON app.percorsi FOR EACH ROW EXECUTE FUNCTION app.proteggi_percorsi();

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.attivita FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.aziende FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.aziende_provenienze FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.contatti FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.fasi_lead FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.liste_aziende FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.liste_freddo FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.percorsi FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.raccolte FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.raccolte_celle FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON app.soci FOR EACH ROW EXECUTE FUNCTION app.segnala_cambio('email');

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.attivita FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.campi_definizioni FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.coda_prese FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.impostazioni FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.modelli_messaggi FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.persone FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.schede_aziende FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.tag FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.tag_su FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.trattative FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER aggiornato BEFORE UPDATE ON crm.viste FOR EACH ROW EXECUTE FUNCTION crm.tocca_aggiornato();

CREATE TRIGGER campo_stabile BEFORE UPDATE ON crm.campi_definizioni FOR EACH ROW EXECUTE FUNCTION crm.campo_stabile();

CREATE TRIGGER mossa BEFORE UPDATE ON crm.trattative FOR EACH ROW EXECUTE FUNCTION crm.trattativa_mossa();

CREATE TRIGGER muove_trattativa AFTER INSERT ON crm.attivita FOR EACH ROW EXECUTE FUNCTION crm.attivita_muove();

CREATE TRIGGER norma_telefono BEFORE INSERT OR UPDATE OF telefono ON crm.persone FOR EACH ROW EXECUTE FUNCTION crm.norma_telefono_riga();

CREATE TRIGGER ponte AFTER INSERT OR UPDATE ON crm.attivita FOR EACH ROW EXECUTE FUNCTION crm.ponte_da_crm_attivita();

CREATE TRIGGER ponte AFTER UPDATE OF nome, telefono, email ON crm.persone FOR EACH ROW EXECUTE FUNCTION crm.ponte_da_crm_persone();

CREATE TRIGGER ponte AFTER INSERT OR UPDATE ON crm.trattative FOR EACH ROW EXECUTE FUNCTION crm.ponte_da_crm_trattative();

CREATE TRIGGER ponte_niente_delete BEFORE DELETE ON crm.trattative FOR EACH ROW EXECUTE FUNCTION crm.ponte_niente_delete();

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.attivita FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.campi_definizioni FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.coda_prese FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('azienda_id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.impostazioni FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('chiave');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.modelli_messaggi FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.persone FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.schede_aziende FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('azienda_id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.tag FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.tag_su FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.trattative FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER segnala_cambio AFTER INSERT OR DELETE OR UPDATE ON crm.viste FOR EACH ROW EXECUTE FUNCTION crm.segnala_cambio('id');

CREATE TRIGGER valida_campi BEFORE INSERT OR UPDATE ON crm.persone FOR EACH ROW EXECUTE FUNCTION crm.valida_campi('persona');

CREATE TRIGGER valida_campi BEFORE INSERT OR UPDATE ON crm.schede_aziende FOR EACH ROW EXECUTE FUNCTION crm.valida_campi('azienda');

CREATE TRIGGER valida_campi BEFORE INSERT OR UPDATE ON crm.trattative FOR EACH ROW EXECUTE FUNCTION crm.valida_campi('trattativa');

ALTER TABLE ONLY app.attivita
    ADD CONSTRAINT attivita_contatto_id_fkey FOREIGN KEY (contatto_id) REFERENCES app.contatti(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.aziende_chiavi
    ADD CONSTRAINT aziende_chiavi_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.aziende
    ADD CONSTRAINT aziende_contatto_id_fkey FOREIGN KEY (contatto_id) REFERENCES app.contatti(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_contatto_id_fkey FOREIGN KEY (contatto_id) REFERENCES app.contatti(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_lista_id_fkey FOREIGN KEY (lista_id) REFERENCES app.liste_freddo(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES crm.persone(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_raccolta_id_fkey FOREIGN KEY (raccolta_id) REFERENCES app.raccolte(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.aziende_provenienze
    ADD CONSTRAINT aziende_provenienze_trattativa_id_fkey FOREIGN KEY (trattativa_id) REFERENCES crm.trattative(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.contatti
    ADD CONSTRAINT contatti_fase_fkey FOREIGN KEY (fase) REFERENCES app.fasi_lead(id) ON UPDATE CASCADE;

ALTER TABLE ONLY app.contatti
    ADD CONSTRAINT contatti_percorso_fkey FOREIGN KEY (percorso) REFERENCES app.percorsi(id);

ALTER TABLE ONLY app.contatti
    ADD CONSTRAINT contatti_unito_a_fkey FOREIGN KEY (unito_a) REFERENCES app.contatti(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.fasi_lead
    ADD CONSTRAINT fasi_lead_percorso_fkey FOREIGN KEY (percorso) REFERENCES app.percorsi(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.liste_aziende
    ADD CONSTRAINT liste_aziende_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.liste_aziende
    ADD CONSTRAINT liste_aziende_lista_id_fkey FOREIGN KEY (lista_id) REFERENCES app.liste_freddo(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.liste_aziende
    ADD CONSTRAINT liste_aziende_raccolta_id_fkey FOREIGN KEY (raccolta_id) REFERENCES app.raccolte(id) ON DELETE SET NULL;

ALTER TABLE ONLY app.raccolte_celle
    ADD CONSTRAINT raccolte_celle_madre_id_fkey FOREIGN KEY (madre_id) REFERENCES app.raccolte_celle(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.raccolte_celle
    ADD CONSTRAINT raccolte_celle_raccolta_id_fkey FOREIGN KEY (raccolta_id) REFERENCES app.raccolte(id) ON DELETE CASCADE;

ALTER TABLE ONLY app.raccolte
    ADD CONSTRAINT raccolte_lista_id_fkey FOREIGN KEY (lista_id) REFERENCES app.liste_freddo(id) ON DELETE CASCADE;

ALTER TABLE ONLY crm.attivita
    ADD CONSTRAINT attivita_attivita_app_id_fkey FOREIGN KEY (attivita_app_id) REFERENCES app.attivita(id) ON DELETE SET NULL;

ALTER TABLE ONLY crm.attivita
    ADD CONSTRAINT attivita_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE CASCADE;

ALTER TABLE ONLY crm.attivita
    ADD CONSTRAINT attivita_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES crm.persone(id) ON DELETE CASCADE;

ALTER TABLE ONLY crm.attivita
    ADD CONSTRAINT attivita_trattativa_id_fkey FOREIGN KEY (trattativa_id) REFERENCES crm.trattative(id) ON DELETE CASCADE;

ALTER TABLE ONLY crm.coda_prese
    ADD CONSTRAINT coda_prese_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE CASCADE;

ALTER TABLE ONLY crm.persone
    ADD CONSTRAINT persone_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE SET NULL;

ALTER TABLE ONLY crm.schede_aziende
    ADD CONSTRAINT schede_aziende_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE CASCADE;

ALTER TABLE ONLY crm.tag_su
    ADD CONSTRAINT tag_su_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES crm.tag(id) ON DELETE CASCADE;

ALTER TABLE ONLY crm.trattative
    ADD CONSTRAINT trattative_azienda_id_fkey FOREIGN KEY (azienda_id) REFERENCES app.aziende(id) ON DELETE SET NULL;

ALTER TABLE ONLY crm.trattative
    ADD CONSTRAINT trattative_contatto_id_fkey FOREIGN KEY (contatto_id) REFERENCES app.contatti(id) ON DELETE SET NULL;

ALTER TABLE ONLY crm.trattative
    ADD CONSTRAINT trattative_fase_id_fkey FOREIGN KEY (fase_id) REFERENCES app.fasi_lead(id) ON UPDATE CASCADE;

ALTER TABLE ONLY crm.trattative
    ADD CONSTRAINT trattative_percorso_fkey FOREIGN KEY (percorso) REFERENCES app.percorsi(id);

ALTER TABLE ONLY crm.trattative
    ADD CONSTRAINT trattative_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES crm.persone(id) ON DELETE SET NULL;

ALTER TABLE app.attivita ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.aziende ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.aziende_chiavi ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.aziende_provenienze ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.contatti ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.fasi_lead ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.liste_aziende ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.liste_freddo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membri aggiungono" ON app.attivita FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.aziende FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.aziende_chiavi FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.aziende_provenienze FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.contatti FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.fasi_lead FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.liste_aziende FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.liste_freddo FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.percorsi FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.raccolte FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri aggiungono" ON app.raccolte_celle FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "membri eliminano" ON app.attivita FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.aziende FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.aziende_chiavi FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.aziende_provenienze FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.contatti FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.fasi_lead FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.liste_aziende FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.liste_freddo FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.percorsi FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.raccolte FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri eliminano" ON app.raccolte_celle FOR DELETE TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.attivita FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.aziende FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON app.aziende_chiavi FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.aziende_provenienze FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON app.contatti FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.fasi_lead FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.liste_aziende FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.liste_freddo FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.percorsi FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.raccolte FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri leggono" ON app.raccolte_celle FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "membri modificano" ON app.attivita FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.aziende FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.aziende_chiavi FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.aziende_provenienze FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.contatti FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.fasi_lead FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.liste_aziende FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.liste_freddo FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.percorsi FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.raccolte FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "membri modificano" ON app.raccolte_celle FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

ALTER TABLE app.percorsi ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.raccolte ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.raccolte_celle ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.soci ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soci aggiungono soci" ON app.soci FOR INSERT TO authenticated WITH CHECK (app.e_socio());

CREATE POLICY "soci leggono soci" ON app.soci FOR SELECT TO authenticated USING (app.e_socio());

CREATE POLICY "soci modificano soci" ON app.soci FOR UPDATE TO authenticated USING (app.e_socio()) WITH CHECK (app.e_socio());

CREATE POLICY "soci tolgono soci" ON app.soci FOR DELETE TO authenticated USING ((app.e_socio() AND (email <> lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));

ALTER TABLE crm.attivita ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.campi_definizioni ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.coda_prese ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.impostazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membri aggiungono" ON crm.attivita FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.campi_definizioni FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.coda_prese FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.impostazioni FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.modelli_messaggi FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.persone FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.schede_aziende FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.tag FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.tag_su FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.trattative FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri aggiungono" ON crm.viste FOR INSERT TO authenticated WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.attivita FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.campi_definizioni FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.coda_prese FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.impostazioni FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.modelli_messaggi FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.persone FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.schede_aziende FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.tag FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.tag_su FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.trattative FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri eliminano" ON crm.viste FOR DELETE TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.attivita FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.campi_definizioni FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.coda_prese FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.impostazioni FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.modelli_messaggi FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.persone FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.ponte_registro FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.schede_aziende FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.tag FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.tag_su FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.trattative FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri leggono" ON crm.viste FOR SELECT TO authenticated USING (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.attivita FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.campi_definizioni FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.coda_prese FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.impostazioni FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.modelli_messaggi FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.persone FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.schede_aziende FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.tag FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.tag_su FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.trattative FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

CREATE POLICY "membri modificano" ON crm.viste FOR UPDATE TO authenticated USING (( SELECT app.e_socio() AS e_socio)) WITH CHECK (( SELECT app.e_socio() AS e_socio));

ALTER TABLE crm.modelli_messaggi ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.persone ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.ponte_registro ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.schede_aziende ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.tag ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.tag_su ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.trattative ENABLE ROW LEVEL SECURITY;

ALTER TABLE crm.viste ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA app TO crm_app;
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT USAGE ON SCHEMA app TO anon;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO anon;

GRANT USAGE ON SCHEMA crm TO authenticated;

REVOKE ALL ON FUNCTION app.azienda_dal_sito(p_azienda uuid, p_email text, p_piva text, p_dati jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION app.azienda_dal_sito(p_azienda uuid, p_email text, p_piva text, p_dati jsonb) TO crm_app;
GRANT ALL ON FUNCTION app.azienda_dal_sito(p_azienda uuid, p_email text, p_piva text, p_dati jsonb) TO authenticated;

GRANT ALL ON FUNCTION app.dominio_email(email text) TO crm_app;
GRANT ALL ON FUNCTION app.dominio_email(email text) TO authenticated;

REVOKE ALL ON FUNCTION app.e_socio() FROM PUBLIC;
GRANT ALL ON FUNCTION app.e_socio() TO crm_app;
GRANT ALL ON FUNCTION app.e_socio() TO authenticated;

GRANT ALL ON FUNCTION app.norma_dominio(sito text) TO crm_app;
GRANT ALL ON FUNCTION app.norma_dominio(sito text) TO authenticated;

GRANT ALL ON FUNCTION app.norma_telefono(t text) TO crm_app;
GRANT ALL ON FUNCTION app.norma_telefono(t text) TO authenticated;

GRANT ALL ON FUNCTION app.piva_valida(p text) TO crm_app;
GRANT ALL ON FUNCTION app.piva_valida(p text) TO authenticated;

GRANT ALL ON FUNCTION app.proteggi_colonne_chiuse() TO crm_app;

GRANT ALL ON FUNCTION app.proteggi_percorsi() TO crm_app;

REVOKE ALL ON FUNCTION app.raccolte_da_continuare() FROM PUBLIC;
GRANT ALL ON FUNCTION app.raccolte_da_continuare() TO crm_app;
GRANT ALL ON FUNCTION app.raccolte_da_continuare() TO authenticated;

REVOKE ALL ON FUNCTION app.raccolte_da_riprendere() FROM PUBLIC;
GRANT ALL ON FUNCTION app.raccolte_da_riprendere() TO crm_app;
GRANT ALL ON FUNCTION app.raccolte_da_riprendere() TO authenticated;

REVOKE ALL ON FUNCTION app.salva_azienda(posto jsonb, p_lista uuid, p_raccolta uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.salva_azienda(posto jsonb, p_lista uuid, p_raccolta uuid) TO crm_app;
GRANT ALL ON FUNCTION app.salva_azienda(posto jsonb, p_lista uuid, p_raccolta uuid) TO authenticated;

REVOKE ALL ON FUNCTION app.segna_provenienza(p_azienda uuid, p_raccolta uuid, p_lista uuid, p jsonb, p_nuova boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION app.segna_provenienza(p_azienda uuid, p_raccolta uuid, p_lista uuid, p jsonb, p_nuova boolean) TO crm_app;
GRANT ALL ON FUNCTION app.segna_provenienza(p_azienda uuid, p_raccolta uuid, p_lista uuid, p jsonb, p_nuova boolean) TO authenticated;

GRANT ALL ON FUNCTION app.segnala_cambio() TO crm_app;

REVOKE ALL ON FUNCTION auth.jwt() FROM PUBLIC;
GRANT ALL ON FUNCTION auth.jwt() TO authenticated;
GRANT ALL ON FUNCTION auth.jwt() TO anon;

REVOKE ALL ON FUNCTION crm.ponte_cambi(p_prima jsonb, p_dopo jsonb, p_altra jsonb, OUT cambi text[], OUT conflitti text[]) FROM PUBLIC;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.attivita TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.attivita TO authenticated;

REVOKE ALL ON FUNCTION crm.ponte_campi_attivita_app(a app.attivita) FROM PUBLIC;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.attivita TO authenticated;

REVOKE ALL ON FUNCTION crm.ponte_campi_attivita_crm(x crm.attivita) FROM PUBLIC;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.contatti TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.contatti TO authenticated;

REVOKE ALL ON FUNCTION crm.ponte_campi_contatto(c app.contatti) FROM PUBLIC;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.persone TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.trattative TO authenticated;

REVOKE ALL ON FUNCTION crm.ponte_campi_trattativa(t crm.trattative, p crm.persone) FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_crea_trattativa(c app.contatti) FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_da_app_attivita() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_da_app_aziende() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_da_app_contatti() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_da_app_contatti_via() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_da_crm_attivita() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_da_crm_persone() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_da_crm_trattative() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_niente_delete() FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.ponte_nota(p_da text, p_tabella text, p_riga uuid, p_azione text, p_conflitto boolean, p_sqlstate text, p_colonne text[]) FROM PUBLIC;

REVOKE ALL ON FUNCTION crm.prendi_dalla_coda(p_candidate uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION crm.prendi_dalla_coda(p_candidate uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION crm.trova_o_crea_azienda(posto jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION crm.trova_o_crea_azienda(posto jsonb) TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.aziende TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.aziende TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.aziende_chiavi TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.aziende_chiavi TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.aziende_provenienze TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.aziende_provenienze TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.fasi_lead TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.fasi_lead TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.liste_aziende TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.liste_aziende TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.liste_freddo TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.liste_freddo TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.percorsi TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.percorsi TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.raccolte TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.raccolte TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.raccolte_celle TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.raccolte_celle TO authenticated;

GRANT SELECT,USAGE ON SEQUENCE app.raccolte_numero_seq TO crm_app;
GRANT SELECT,USAGE ON SEQUENCE app.raccolte_numero_seq TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.soci TO crm_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE app.soci TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.campi_definizioni TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.coda_prese TO authenticated;

GRANT SELECT ON TABLE crm.fasi TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.impostazioni TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.modelli_messaggi TO authenticated;

GRANT SELECT ON TABLE crm.ponte_registro TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.schede_aziende TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.tag TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.tag_su TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE crm.viste TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE crm_admin IN SCHEMA app GRANT SELECT,USAGE ON SEQUENCES TO crm_app;

ALTER DEFAULT PRIVILEGES FOR ROLE crm_admin IN SCHEMA app GRANT ALL ON FUNCTIONS TO crm_app;

ALTER DEFAULT PRIVILEGES FOR ROLE crm_admin IN SCHEMA app GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO crm_app;
