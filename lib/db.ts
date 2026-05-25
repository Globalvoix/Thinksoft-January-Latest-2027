import { Pool, QueryResultRow } from 'pg';

declare global {
  var openLovablePool: Pool | undefined;
  var openLovableDbReady: Promise<void> | undefined;
}

const connectionString = process.env.DATABASE_URL;

export const getPool = () => {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  if (!global.openLovablePool) {
    global.openLovablePool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5
    });
  }

  return global.openLovablePool;
};

export const ensureDb = async () => {
  if (!global.openLovableDbReady) {
    global.openLovableDbReady = (async () => {
      const pool = getPool();

      // Create tables if they don't exist
      await pool.query(`
        create table if not exists projects (
          id text primary key,
          name text,
          blueprint jsonb default '{}'::jsonb,
          created_at timestamptz default now(),
          updated_at timestamptz default now()
        );

        create table if not exists project_secrets (
          project_id text not null,
          key_name text not null,
          encrypted_value text not null default '',
          iv text not null default '',
          auth_tag text not null default '',
          created_at text not null default now()::text,
          updated_at text not null default now()::text,
          value text,
          name text,
          integration text,
          is_public boolean default false,
          primary key (project_id, key_name)
        );

        create table if not exists project_integrations (
          project_id text,
          provider text,
          display_name text,
          status text default 'missing_secrets',
          required_secrets jsonb default '[]'::jsonb,
          connected_secrets jsonb default '[]'::jsonb,
          metadata jsonb default '{}'::jsonb,
          created_at timestamptz default now(),
          updated_at timestamptz default now(),
          primary key (project_id, provider)
        );

        create table if not exists project_configurations (
          project_id text,
          name text,
          value text,
          created_at timestamptz default now(),
          updated_at timestamptz default now(),
          primary key (project_id, name)
        );
      `);

      // Migrate: add missing columns that might not exist in older tables
      try {
        await pool.query(`alter table projects add column if not exists name text`);
        await pool.query(`alter table projects add column if not exists blueprint jsonb`);
        await pool.query(`alter table projects add column if not exists created_at timestamptz`);
        await pool.query(`alter table projects add column if not exists updated_at timestamptz`);
        await pool.query(`alter table project_secrets add column if not exists name text`);
        await pool.query(`alter table project_secrets add column if not exists value text`);
        await pool.query(`alter table project_secrets add column if not exists encrypted_value text`);
        await pool.query(`alter table project_secrets add column if not exists iv text`);
        await pool.query(`alter table project_secrets add column if not exists auth_tag text`);
        await pool.query(`alter table project_secrets add column if not exists integration text`);
        await pool.query(`alter table project_secrets add column if not exists is_public boolean`);
        await pool.query(`alter table project_integrations add column if not exists provider text`);
        await pool.query(`alter table project_integrations add column if not exists display_name text`);
        await pool.query(`alter table project_integrations add column if not exists status text`);
        await pool.query(`alter table project_integrations add column if not exists required_secrets jsonb`);
        await pool.query(`alter table project_integrations add column if not exists connected_secrets jsonb`);
        await pool.query(`alter table project_integrations add column if not exists metadata jsonb`);
        await pool.query(`alter table project_configurations add column if not exists name text`);
        await pool.query(`alter table project_configurations add column if not exists value text`);
      } catch (migrateErr) {
        console.error('[db] Column migration error (non-fatal):', migrateErr);
      }

      // Migrate: ensure primary keys / unique constraints exist for ON CONFLICT support
      try {
        // project_secrets already exists with PK (project_id, key_name)
        // project_integrations already exists with PK (project_id, provider)  
        // project_configurations already exists with PK (project_id, name)
        // Only add PK if missing (for projects table)
        const tables = [
          { name: 'projects', cols: ['id'] },
          { name: 'project_configurations', cols: ['project_id', 'name'] }
        ];
        for (const table of tables) {
          const check = await pool.query(
            `select 1 from pg_constraint
             where conrelid = $1::regclass
             and contype = 'p'`,
            [table.name]
          );
          if (check.rowCount === 0) {
            await pool.query(
              `alter table ${table.name} add primary key (${table.cols.join(', ')})`
            );
          }
        }
      } catch (pkErr) {
        console.error('[db] Primary key migration error (non-fatal):', pkErr);
      }

      try {
        await pool.query(
          `insert into projects (id, name) values ($1, $2) on conflict (id) do nothing`,
          ['default', 'Default Project']
        );
      } catch (insertErr) {
        console.error('[db] Failed to insert default project:', insertErr);
      }
    })();
  }

  return global.openLovableDbReady;
};

export const query = async <T extends QueryResultRow = any>(text: string, params: unknown[] = []) => {
  await ensureDb();
  return getPool().query<T>(text, params);
};
