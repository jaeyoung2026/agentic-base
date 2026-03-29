/**
 * Chat API — 에이전트 대화 엔드포인트.
 * plan → execute → audit 파이프라인의 진입점.
 * 비즈니스 로직은 src/product/에서 구현.
 */

export async function POST() {
  // TODO: orchestrator 연결
  return Response.json({ error: "Not implemented" }, { status: 501 });
}
