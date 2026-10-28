#!/bin/sh
(
set -eu
: "${HDB_DATABASE_PASSWORD:?Application password is required}"

# Solo se ejecuta al inicializar un volumen vacio. No crea tablas de negocio.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv app_password HDB_DATABASE_PASSWORD
CREATE ROLE hdboutique_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
GRANT USAGE, CREATE ON SCHEMA public TO hdboutique_app;
SELECT format('GRANT CONNECT ON DATABASE %I TO hdboutique_app', current_database()) \gexec
SQL
)
