import type { PoolClient } from "pg";

export async function configureRuntimeAccess(client: PoolClient, password: string): Promise<void> {
  if (!password) throw new Error("RUNTIME_DATABASE_PASSWORD is required.");

  // Refuse to reuse a role with elevated attributes, memberships, or object ownership.
  const role = await client.query<{ unsafe: boolean }>(`
    SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
      OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
      OR EXISTS (SELECT 1 FROM pg_class WHERE relowner = r.oid)
      OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = r.oid)
      OR EXISTS (SELECT 1 FROM pg_proc WHERE proowner = r.oid)
      OR EXISTS (SELECT 1 FROM pg_database WHERE datdba = r.oid) AS unsafe
    FROM pg_roles r WHERE rolname = 'tenisu_api'
  `);
  if (role.rows[0]?.unsafe) throw new Error("Runtime role has elevated privileges; refusing to use it.");

  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenisu_api') THEN
      CREATE ROLE tenisu_api LOGIN NOINHERIT NOCREATEDB NOCREATEROLE;
    END IF;
  END $$`);
  const credentials = await client.query<{ command: string }>(
    "SELECT format('ALTER ROLE tenisu_api LOGIN PASSWORD %L', $1::text) AS command",
    [password],
  );
  await client.query(credentials.rows[0]!.command);
  await client.query(`DO $$ BEGIN
    EXECUTE format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM tenisu_api', current_database());
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO tenisu_api', current_database());
  END $$;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    REVOKE ALL ON SCHEMA public FROM tenisu_api;
    GRANT USAGE ON SCHEMA public TO tenisu_api;
    REVOKE ALL ON TABLE public.countries, public.players FROM tenisu_api;
    GRANT SELECT, INSERT ON TABLE public.countries, public.players TO tenisu_api;
    REVOKE ALL ON SEQUENCE public.players_id_seq FROM tenisu_api;
    GRANT USAGE ON SEQUENCE public.players_id_seq TO tenisu_api;
  `);
}
