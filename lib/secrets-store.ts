import { query } from '@/lib/db';
import { integrationCatalog } from '@/lib/integrations/catalog';

export interface ProjectSecret {
  name: string;
  value: string;
  updatedAt: number;
  integration?: string | null;
  isPublic?: boolean;
}

const DEFAULT_PROJECT_ID = 'default';

export const normalizeSecretName = (name: string) =>
  name
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const inferSecretMetadata = (name: string) => {
  for (const integration of integrationCatalog) {
    const spec = integration.requiredSecrets.find(secret => secret.name === name);
    if (spec) {
      return { integration: integration.provider, isPublic: Boolean(spec.public) };
    }
  }

  return { integration: null, isPublic: name.startsWith('VITE_') };
};

export const listSecrets = async (projectId = DEFAULT_PROJECT_ID) => {
  const result = await query<{
    key_name: string;
    value: string;
    updated_at: string;
    integration: string | null;
    is_public: boolean;
  }>(
    `select key_name, value, updated_at, integration, is_public
     from project_secrets
     where project_id = $1
     order by key_name asc`,
    [projectId]
  );

  return result.rows.map(secret => ({
    name: secret.key_name,
    maskedValue: secret.value ? '********' : '',
    hasValue: Boolean(secret.value),
    updatedAt: secret.updated_at ? new Date(secret.updated_at).getTime() : Date.now(),
    integration: secret.integration,
    isPublic: secret.is_public
  }));
};

export const getSecretsObject = async (projectId = DEFAULT_PROJECT_ID) => {
  const result = await query<{ key_name: string; value: string }>(
    `select key_name, value from project_secrets where project_id = $1`,
    [projectId]
  );

  return Object.fromEntries(result.rows.map(secret => [secret.key_name, secret.value]));
};

export const getSecretValue = async (names: string[], projectId = DEFAULT_PROJECT_ID) => {
  const normalizedNames = names.map(normalizeSecretName).filter(Boolean);
  if (normalizedNames.length === 0) return null;

  const result = await query<{ value: string; key_name: string }>(
    `select value, key_name from project_secrets
     where project_id = $1 and key_name = any($2::text[])
     order by array_position($2::text[], key_name)
     limit 1`,
    [projectId, normalizedNames]
  );

  return result.rows[0]?.value || null;
};

export const upsertSecrets = async (
  secrets: Array<{ name: string; value: string; integration?: string; public?: boolean }>,
  projectId = DEFAULT_PROJECT_ID
) => {
  const updated: ProjectSecret[] = [];

  for (const secret of secrets) {
    const name = normalizeSecretName(secret.name);
    if (!name) continue;

    const inferred = inferSecretMetadata(name);
    const integration = secret.integration || inferred.integration;
    const isPublic = typeof secret.public === 'boolean' ? secret.public : inferred.isPublic;
    const value = secret.value ?? '';

    const result = await query<{ key_name: string; value: string; updated_at: Date; integration: string | null; is_public: boolean }>(
      `insert into project_secrets (project_id, key_name, encrypted_value, iv, auth_tag, value, integration, is_public, created_at, updated_at)
       values ($1, $2, $3, '', '', $3, $4, $5, now()::text, now()::text)
       on conflict (project_id, key_name)
       do update set encrypted_value = excluded.encrypted_value,
         value = excluded.value,
         integration = coalesce(excluded.integration, project_secrets.integration),
         is_public = excluded.is_public,
         updated_at = now()::text
       returning key_name, value, updated_at, integration, is_public`,
      [projectId, name, value, integration, isPublic]
    );

    const row = result.rows[0];
    const updatedAt = typeof row.updated_at === 'string' ? new Date(row.updated_at).getTime() : (row.updated_at as unknown as Date).getTime();
    updated.push({
      name: row.key_name,
      value: row.value,
      updatedAt,
      integration: row.integration,
      isPublic: row.is_public
    });
  }

  await refreshIntegrationStatuses(projectId);
  return updated;
};

export const deleteSecret = async (name: string, projectId = DEFAULT_PROJECT_ID) => {
  const normalized = normalizeSecretName(name);
  const result = await query(
    `delete from project_secrets where project_id = $1 and key_name = $2`,
    [projectId, normalized]
  );
  await refreshIntegrationStatuses(projectId);
  return (result.rowCount || 0) > 0;
};

export const serializeEnv = async (projectId = DEFAULT_PROJECT_ID) => {
  const result = await query<{ key_name: string; value: string }>(
    `select key_name, value from project_secrets where project_id = $1 order by key_name asc`,
    [projectId]
  );

  return result.rows.map(secret => `${secret.key_name}=${JSON.stringify(secret.value)}`).join('\n') + '\n';
};

export const refreshIntegrationStatuses = async (projectId = DEFAULT_PROJECT_ID) => {
  const secrets = await getSecretsObject(projectId);

  for (const integration of integrationCatalog) {
    const connectedSecrets = integration.requiredSecrets
      .filter(secret => Boolean(secrets[secret.name]))
      .map(secret => secret.name);
    const status = connectedSecrets.length === integration.requiredSecrets.length ? 'connected' : 'missing_secrets';

    if (connectedSecrets.length > 0 || status === 'connected') {
      await query(
        `insert into project_integrations (project_id, provider, display_name, status, required_secrets, connected_secrets, updated_at)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now())
         on conflict (project_id, provider)
         do update set status = excluded.status,
           required_secrets = excluded.required_secrets,
           connected_secrets = excluded.connected_secrets,
           updated_at = now()`,
        [
          projectId,
          integration.provider,
          integration.displayName,
          status,
          JSON.stringify(integration.requiredSecrets),
          JSON.stringify(connectedSecrets)
        ]
      );
    }
  }
};
