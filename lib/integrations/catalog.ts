export interface IntegrationSecretSpec {
  name: string;
  label: string;
  public?: boolean;
  description?: string;
}

export interface IntegrationSpec {
  provider: string;
  displayName: string;
  aliases: string[];
  requiredSecrets: IntegrationSecretSpec[];
  clientUsage: string;
}

export const integrationCatalog: IntegrationSpec[] = [
  {
    provider: 'gemini',
    displayName: 'Google Gemini',
    aliases: ['gemini', 'google ai', 'google generative ai'],
    requiredSecrets: [{ name: 'GEMINI_API_KEY', label: 'Gemini API key' }],
    clientUsage: "Call import.meta.env.VITE_OPEN_LOVABLE_API_URL + '/api/integrations/gemini'."
  },
  {
    provider: 'openai',
    displayName: 'OpenAI',
    aliases: ['openai', 'gpt', 'chatgpt'],
    requiredSecrets: [{ name: 'OPENAI_API_KEY', label: 'OpenAI API key' }],
    clientUsage: "Call import.meta.env.VITE_OPEN_LOVABLE_API_URL + '/api/integrations/openai'."
  },
  {
    provider: 'anthropic',
    displayName: 'Anthropic',
    aliases: ['anthropic', 'claude'],
    requiredSecrets: [{ name: 'ANTHROPIC_API_KEY', label: 'Anthropic API key' }],
    clientUsage: "Call import.meta.env.VITE_OPEN_LOVABLE_API_URL + '/api/integrations/anthropic'."
  },
  {
    provider: 'clerk',
    displayName: 'Clerk Auth',
    aliases: ['clerk', 'clerk auth', 'authentication', 'auth'],
    requiredSecrets: [
      { name: 'VITE_CLERK_PUBLISHABLE_KEY', label: 'Clerk publishable key', public: true },
      { name: 'CLERK_SECRET_KEY', label: 'Clerk secret key' }
    ],
    clientUsage: 'Use VITE_CLERK_PUBLISHABLE_KEY in browser code. Never expose CLERK_SECRET_KEY.'
  },
  {
    provider: 'stripe',
    displayName: 'Stripe',
    aliases: ['stripe', 'payments', 'checkout'],
    requiredSecrets: [
      { name: 'VITE_STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key', public: true },
      { name: 'STRIPE_SECRET_KEY', label: 'Stripe secret key' },
      { name: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook secret' }
    ],
    clientUsage: 'Use publishable key in browser. Use platform/server routes for secret Stripe actions.'
  },
  {
    provider: 'supabase',
    displayName: 'Supabase',
    aliases: ['supabase', 'database', 'postgres'],
    requiredSecrets: [
      { name: 'VITE_SUPABASE_URL', label: 'Supabase URL', public: true },
      { name: 'VITE_SUPABASE_ANON_KEY', label: 'Supabase anon key', public: true },
      { name: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase service role key' }
    ],
    clientUsage: 'Use anon key in browser. Never expose service role key.'
  },
  {
    provider: 'gmail',
    displayName: 'Gmail / Google OAuth',
    aliases: ['gmail', 'google oauth', 'google mail'],
    requiredSecrets: [
      { name: 'GOOGLE_CLIENT_ID', label: 'Google OAuth client ID' },
      { name: 'GOOGLE_CLIENT_SECRET', label: 'Google OAuth client secret' },
      { name: 'GOOGLE_REDIRECT_URI', label: 'Google OAuth redirect URI', public: true }
    ],
    clientUsage: 'Use platform OAuth/server routes. Do not call Gmail with client secret from browser.'
  },
  {
    provider: 'resend',
    displayName: 'Resend Email',
    aliases: ['resend', 'email', 'send email'],
    requiredSecrets: [{ name: 'RESEND_API_KEY', label: 'Resend API key' }],
    clientUsage: "Call import.meta.env.VITE_OPEN_LOVABLE_API_URL + '/api/integrations/resend'."
  }
];

export const findIntegrationSpecs = (text: string) => {
  const normalized = text.toLowerCase();
  return integrationCatalog.filter(spec =>
    spec.aliases.some(alias => normalized.includes(alias))
  );
};

export const formatIntegrationCatalogForPrompt = () =>
  integrationCatalog
    .map(spec => `- ${spec.displayName} (${spec.provider}): secrets ${spec.requiredSecrets.map(secret => `${secret.name}${secret.public ? ' public' : ' private'}`).join(', ')}. ${spec.clientUsage}`)
    .join('\n');
