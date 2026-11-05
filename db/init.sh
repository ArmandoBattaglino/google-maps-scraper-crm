#!/bin/sh
# Prepara il database al primo avvio (lo lancia l'immagine di Postgres, una volta sola, a volume vuoto).
set -eu

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -v pw="$APP_DB_PASSWORD" <<'SQL'
create role crm_admin login nosuperuser nocreatedb nocreaterole;
create role crm_app login password :'pw' nosuperuser nocreatedb nocreaterole nobypassrls noinherit;
create role authenticated nologin noinherit nobypassrls;
create role anon nologin noinherit nobypassrls;
grant authenticated to crm_app;
create database crm owner crm_admin;
SQL

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d crm <<'SQL'
revoke all on database crm from public;
grant connect, temporary on database crm to crm_app;
alter role crm_app in database crm set search_path = app;
SQL

for f in schema semi; do
  psql -q -v ON_ERROR_STOP=1 -U crm_admin -d crm -f "/kit/$f.sql" >/dev/null
done
echo "database pronto"
