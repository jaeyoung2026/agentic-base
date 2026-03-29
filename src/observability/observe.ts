/**
 * 관측 레이어.
 *
 * 3층 구조:
 * 1. ObservationEntry — flat log schema
 * 2. TurnContext — turn/phase/tool trace aggregator
 * 3. observe() — 호출 래퍼
 */

export interface ObservationEntry {
  timestamp: string;
  category: "workflow" | "api" | "error" | "cost";
  action: string;
  status: "success" | "fail" | "skip";
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface PhaseTrace {
  name: string;
  status: "success" | "fail" | "skip";
  duration?: number;
  result?: Record<string, unknown>;
}

export interface ToolCallTrace {
  toolName: string;
  status: "success" | "fail";
  duration?: number;
}

export interface TurnTrace {
  turnId: string;
  conversationId: string;
  startedAt: string;
  endedAt?: string;
  phases: PhaseTrace[];
  toolCalls: ToolCallTrace[];
  steps: unknown[];
}

/**
 * 관측 이벤트 발행.
 * 현재는 콘솔 출력. 프로덕션에서는 DB/OTel로 교체.
 */
export function observe(entry: ObservationEntry): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[observe] ${entry.category}:${entry.action} ${entry.status}`, entry.metadata);
  }
  // TODO: DB 저장 또는 OTel span 발행
}

/**
 * 클라이언트 이벤트 추적.
 */
export function track(event: { type: string; data?: Record<string, unknown> }): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[track] ${event.type}`, event.data);
  }
  // TODO: 이벤트 수집 엔드포인트로 전송
}
