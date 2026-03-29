/**
 * 환경 변수 검증. 앱 시작 시 누락된 변수를 즉시 감지.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  googleAiApiKey: requireEnv("GOOGLE_GENERATIVE_AI_API_KEY"),
} as const;
