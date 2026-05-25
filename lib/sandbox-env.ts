import { serializeEnv } from '@/lib/secrets-store';

const DEFAULT_PROJECT_ID = 'default';

export const getRequestOrigin = (request: Request) => {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
};

export const serializeSandboxEnv = async (origin: string, projectId: string = DEFAULT_PROJECT_ID) => {
  const baseEnv = (await serializeEnv(projectId)).trimEnd();
  const platformOrigin = `VITE_OPEN_LOVABLE_API_URL=${JSON.stringify(origin)}`;
  const platformProjectId = `VITE_OPEN_LOVABLE_PROJECT_ID=${JSON.stringify(projectId)}`;

  return `${baseEnv ? `${baseEnv}\n` : ''}${platformOrigin}\n${platformProjectId}\n`;
};