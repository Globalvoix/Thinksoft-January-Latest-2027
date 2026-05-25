import { query } from '@/lib/db';
import { findIntegrationSpecs, integrationCatalog } from '@/lib/integrations/catalog';
import { getSecretsObject } from '@/lib/secrets-store';

const DEFAULT_PROJECT_ID = 'default';

export interface ProjectBlueprint {
  summary?: string;
  features?: string[];
  pages?: string[];
  database?: string[];
  auth?: string[];
  integrations?: string[];
  dependencies?: string[];
  requiredEnv?: string[];
}

export const getProjectContext = async (projectId = DEFAULT_PROJECT_ID) => {
  const project = await query<{ id: string; name: string; blueprint: ProjectBlueprint }>(
    `select id, name, blueprint from projects where id = $1`,
    [projectId]
  );

  const integrations = await query<{
    provider: string;
    display_name: string;
    status: string;
    required_secrets: any;
    connected_secrets: any;
    metadata: any;
  }>(
    `select provider, display_name, status, required_secrets, connected_secrets, metadata
     from project_integrations
     where project_id = $1
     order by display_name asc`,
    [projectId]
  );

  const secrets = await getSecretsObject(projectId);

  return {
    project: project.rows[0] || { id: projectId, name: 'Default Project', blueprint: {} },
    integrations: integrations.rows.map(row => ({
      provider: row.provider,
      displayName: row.display_name,
      status: row.status,
      requiredSecrets: row.required_secrets || [],
      connectedSecrets: row.connected_secrets || [],
      metadata: row.metadata || {}
    })),
    availableSecrets: Object.keys(secrets).sort()
  };
};

export const updateProjectBlueprint = async (blueprint: ProjectBlueprint, projectId = DEFAULT_PROJECT_ID) => {
  const current = await getProjectContext(projectId);
  const nextBlueprint = {
    ...(current.project.blueprint || {}),
    ...blueprint,
    features: blueprint.features || current.project.blueprint?.features || [],
    pages: blueprint.pages || current.project.blueprint?.pages || [],
    database: blueprint.database || current.project.blueprint?.database || [],
    auth: blueprint.auth || current.project.blueprint?.auth || [],
    integrations: blueprint.integrations || current.project.blueprint?.integrations || [],
    dependencies: blueprint.dependencies || current.project.blueprint?.dependencies || [],
    requiredEnv: blueprint.requiredEnv || current.project.blueprint?.requiredEnv || []
  };

  const result = await query<{ blueprint: ProjectBlueprint }>(
    `update projects set blueprint = $2::jsonb, updated_at = now() where id = $1 returning blueprint`,
    [projectId, JSON.stringify(nextBlueprint)]
  );

  await upsertDetectedIntegrations(nextBlueprint.integrations?.join(' ') || '', projectId);
  return result.rows[0]?.blueprint || nextBlueprint;
};

export const upsertDetectedIntegrations = async (text: string, projectId = DEFAULT_PROJECT_ID) => {
  const specs = findIntegrationSpecs(text);
  const secrets = await getSecretsObject(projectId);

  for (const spec of specs) {
    const connectedSecrets = spec.requiredSecrets.filter(secret => Boolean(secrets[secret.name])).map(secret => secret.name);
    const status = connectedSecrets.length === spec.requiredSecrets.length ? 'connected' : 'missing_secrets';
    await query(
      `insert into project_integrations (project_id, provider, display_name, status, required_secrets, connected_secrets, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now())
       on conflict (project_id, provider)
       do update set display_name = excluded.display_name,
         status = excluded.status,
         required_secrets = excluded.required_secrets,
         connected_secrets = excluded.connected_secrets,
         updated_at = now()`,
      [projectId, spec.provider, spec.displayName, status, JSON.stringify(spec.requiredSecrets), JSON.stringify(connectedSecrets)]
    );
  }

  return specs;
};

export const buildProjectContextPrompt = async (userPrompt: string, projectId = DEFAULT_PROJECT_ID) => {
  await upsertDetectedIntegrations(userPrompt, projectId);
  const project = await query<{ id: string; name: string; blueprint: ProjectBlueprint }>(
    `select id, name, blueprint from projects where id = $1`,
    [projectId]
  );
  const blueprint = project.rows[0]?.blueprint || {};

  return `PROJECT BLUEPRINT (what the user has described so far):
- Summary: ${blueprint.summary || 'not yet summarized'}
- Features: ${(blueprint.features || []).join(', ') || 'none described yet'}
- Pages: ${(blueprint.pages || []).join(', ') || 'none described yet'}
- Integrations: ${(blueprint.integrations || []).join(', ') || 'none described yet'}

KNOWN INTEGRATION CATALOG (reference for secret names — only use if the user asks for that integration):
${integrationCatalog.map(spec => `- ${spec.displayName} (${spec.provider}): ${spec.requiredSecrets.map(secret => `${secret.name}${secret.public ? ' public' : ' private'}`).join(', ')}. ${spec.clientUsage}`).join('\n')}`;
};
