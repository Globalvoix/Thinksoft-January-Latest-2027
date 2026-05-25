import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSecret,
  listSecrets,
  upsertSecrets
} from '@/lib/secrets-store';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getRequestOrigin, serializeSandboxEnv } from '@/lib/sandbox-env';
import { getProjectIdFromRequest, ensureProject } from '@/lib/project-id';

export const dynamic = 'force-dynamic';

declare global {
  var activeSandboxProvider: any;
}

const syncSecretsToSandbox = async (request: NextRequest, projectId: string) => {
  const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
  if (!provider) {
    return { synced: false, reason: 'No active sandbox' };
  }

  const envContent = await serializeSandboxEnv(getRequestOrigin(request), projectId);
  await provider.writeFile('.env.local', envContent);

  try {
    if (typeof provider.restartViteServer === 'function') {
      await provider.restartViteServer();
    }
  } catch (error) {
    console.warn('[secrets] Failed to restart Vite after env update:', error);
  }

  return { synced: true };
};

export async function GET(request: NextRequest) {
  try {
    const projectId = getProjectIdFromRequest(request);
    await ensureProject(projectId);
    return NextResponse.json({
      success: true,
      secrets: await listSecrets(projectId)
    });
  } catch (error) {
    console.error('[secrets] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list secrets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const projectId = getProjectIdFromRequest(request);
    await ensureProject(projectId);
    const { secrets } = await request.json();

    if (!Array.isArray(secrets)) {
      return NextResponse.json(
        { success: false, error: 'secrets must be an array' },
        { status: 400 }
      );
    }

    const updated = await upsertSecrets(secrets, projectId);
    const sync = await syncSecretsToSandbox(request, projectId);

    return NextResponse.json({
      success: true,
      updated: updated.map(secret => secret.name),
      secrets: await listSecrets(projectId),
      sync
    });
  } catch (error) {
    console.error('[secrets] Failed to save secrets:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const projectId = getProjectIdFromRequest(request);
    await ensureProject(projectId);
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    await deleteSecret(name, projectId);
    const sync = await syncSecretsToSandbox(request, projectId);

    return NextResponse.json({
      success: true,
      secrets: await listSecrets(projectId),
      sync
    });
  } catch (error) {
    console.error('[secrets] Failed to delete secret:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}