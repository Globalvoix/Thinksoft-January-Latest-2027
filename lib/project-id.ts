import { query } from '@/lib/db';

export const getProjectIdFromRequest = (request: Request): string => {
  const projectId = request.headers.get('x-project-id');
  if (projectId && projectId.trim()) {
    return projectId.trim();
  }
  return 'default';
};

export const ensureProject = async (projectId: string, name?: string) => {
  if (projectId === 'default') return;
  await query(
    `insert into projects (id, name) values ($1, $2) on conflict (id) do nothing`,
    [projectId, name || `Project ${projectId.slice(0, 8)}`]
  );
};