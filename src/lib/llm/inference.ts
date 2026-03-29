/**
 * LLM 이원화 래퍼.
 *
 * - structuredInference(): 에이전트 수준. Zod 스키마 검증된 JSON 반환.
 * - streamExecution(): 실행 수준. 스트리밍 응답 + tool use.
 *
 * 내부 구현은 AI SDK 6의 generateText/streamText를 사용하지만,
 * 외부 계약은 이 래퍼를 통해 안정적으로 유지한다.
 */

import { google } from "@ai-sdk/google";
import { generateText, streamText, Output, stepCountIs, type ToolSet } from "ai";
import type { z } from "zod";

// ─── 모델 설정 (이 파일만 변경하면 프로바이더 교체 가능) ────

export const PRIMARY_MODEL = "gemini-3-flash-preview";
export const LITE_MODEL = "gemini-3-flash-preview"; // 경량 모델이 나오면 교체

// ─── Plan 수준: 구조화된 추론 ─────────────────────────────

export async function structuredInference<T>(params: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
}): Promise<{ object: T; usage: { inputTokens: number; outputTokens: number } }> {
  const result = await generateText({
    model: google(PRIMARY_MODEL),
    output: Output.object({ schema: params.schema }),
    system: params.system,
    prompt: params.prompt,
    abortSignal: params.signal,
  });

  return {
    object: params.schema.parse(result.output),
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
  };
}

// ─── Execute 수준: 스트리밍 응답 ──────────────────────────

export function streamExecution(params: {
  model?: string;
  system: string;
  messages: NonNullable<Parameters<typeof streamText>[0]["messages"]>;
  tools?: ToolSet;
  maxSteps?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}) {
  return streamText({
    model: google(params.model ?? PRIMARY_MODEL),
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    stopWhen: [stepCountIs(params.maxSteps ?? 6)],
    maxOutputTokens: params.maxOutputTokens ?? 4096,
    abortSignal: params.signal,
  });
}
