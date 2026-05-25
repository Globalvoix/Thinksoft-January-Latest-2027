import { NextRequest, NextResponse } from 'next/server';
import { getProjectContext, updateProjectBlueprint, upsertDetectedIntegrations } from '@/lib/project-memory';
import { getProjectIdFromRequest, ensureProject } from '@/lib/project-id';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const projectId = getProjectIdFromRequest(request);
    await ensureProject(projectId);
    return NextResponse.json({ success: true, context: await getProjectContext(projectId) });
  } catch (error) {
    console.error('[project-context] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get project context' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const projectId = getProjectIdFromRequest(request);
    await ensureProject(projectId);
    const body = await request.json();
    const blueprint = body.blueprint ? await updateProjectBlueprint(body.blueprint, projectId) : undefined;
    const integrations = body.prompt ? await upsertDetectedIntegrations(body.prompt, projectId) : undefined;

    return NextResponse.json({
      success: true,
      blueprint,
      integrations,
      context: await getProjectContext(projectId)
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update project context' },
      { status: 500 }
    );
  }
}