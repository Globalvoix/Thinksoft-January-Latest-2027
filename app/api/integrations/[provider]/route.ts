import { NextRequest, NextResponse } from 'next/server';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getSecretValue } from '@/lib/secrets-store';
import { getProjectIdFromRequest, ensureProject } from '@/lib/project-id';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-project-id'
};

const json = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: { ...corsHeaders, ...(init?.headers || {}) } });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const projectId = getProjectIdFromRequest(request);
  await ensureProject(projectId);

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    const system = typeof body.system === 'string' ? body.system : undefined;

    if (!prompt.trim()) {
      return json({ success: false, error: 'Prompt is required.' }, { status: 400 });
    }

    if (provider === 'gemini') {
      const apiKey = await getSecretValue(['GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'GOOGLE_API_KEY'], projectId);
      if (!apiKey) return json({ success: false, error: 'Missing GEMINI_API_KEY.' }, { status: 400 });
      const google = createGoogleGenerativeAI({ apiKey });
      const result = await generateText({ model: google(body.model || 'gemini-2.5-flash'), prompt, system });
      return json({ success: true, text: result.text });
    }

    if (provider === 'openai') {
      const apiKey = await getSecretValue(['OPENAI_API_KEY'], projectId);
      if (!apiKey) return json({ success: false, error: 'Missing OPENAI_API_KEY.' }, { status: 400 });
      const openai = createOpenAI({ apiKey });
      const result = await generateText({ model: openai(body.model || 'gpt-4o-mini'), prompt, system });
      return json({ success: true, text: result.text });
    }

    if (provider === 'anthropic') {
      const apiKey = await getSecretValue(['ANTHROPIC_API_KEY'], projectId);
      if (!apiKey) return json({ success: false, error: 'Missing ANTHROPIC_API_KEY.' }, { status: 400 });
      const anthropic = createAnthropic({ apiKey });
      const result = await generateText({ model: anthropic(body.model || 'claude-3-5-haiku-latest'), prompt, system });
      return json({ success: true, text: result.text });
    }

    if (provider === 'groq') {
      const apiKey = await getSecretValue(['GROQ_API_KEY'], projectId);
      if (!apiKey) return json({ success: false, error: 'Missing GROQ_API_KEY.' }, { status: 400 });
      const groq = createGroq({ apiKey });
      const result = await generateText({ model: groq(body.model || 'llama-3.1-8b-instant'), prompt, system });
      return json({ success: true, text: result.text });
    }

    if (provider === 'resend') {
      const apiKey = await getSecretValue(['RESEND_API_KEY'], projectId);
      if (!apiKey) return json({ success: false, error: 'Missing RESEND_API_KEY.' }, { status: 400 });
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body.email || body)
      });
      const data = await response.json();
      return json({ success: response.ok, data, error: response.ok ? undefined : data.message }, { status: response.status });
    }

    return json({ success: false, error: `Integration provider ${provider} is not implemented yet.` }, { status: 404 });
  } catch (error) {
    console.error(`[integrations/${provider}] Request failed:`, error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Integration request failed.' }, { status: 500 });
  }
}