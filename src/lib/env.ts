/**
 * 환경 변수 — lazy validation.
 * 앱 시작 시 죽지 않고, 실제 사용 시점에 검증.
 */

function lazyEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return lazyEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return lazyEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get googleAiApiKey() {
    return lazyEnv("GOOGLE_GENERATIVE_AI_API_KEY");
  },
} as const;
