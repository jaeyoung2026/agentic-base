// ============================================================
// Artifact — 균일 인터페이스의 핵심 계약.
//
// 모든 도구 출력, 사용자 행동, 저장, 렌더링이 이 인터페이스를 통과한다.
// 새 타입 추가 시 AGENTS.md의 "Artifact 균일 인터페이스" 절차를 따른다.
// ============================================================

// ─── ArtifactType ──────────────────────────────────────────
//
// discussion: append-only. 메시지를 이어 붙인다. 내용 수정 불가.
// document:   editable. 내용을 교체/수정할 수 있다.
//
// 이 시맨틱 차이를 지키지 않으면 store/repository 우회가 생긴다.
// 새 타입 추가 시 append-only인지 editable인지 반드시 명시할 것.

export type ArtifactType =
  | "discussion" // append-only 대화
  | "document"; // editable 범용 문서 (프로젝트별 확장)

// ─── 타입별 metadata ────────────────────────────────────────

export interface DiscussionMetadata {
  type: "discussion";
}

export interface DocumentMetadata {
  type: "document";
  // 프로젝트별 확장: search, pdf, collection, graph 등
}

// 판별 유니온
export type ArtifactMetadata = DiscussionMetadata | DocumentMetadata;

// ─── Artifact ──────────────────────────────────────────────

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  createdBy: "user" | "agent";
  metadata: ArtifactMetadata;
  refs: string[];
  conversationId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Create params ─────────────────────────────────────────

export interface CreateArtifactParams {
  type: ArtifactType;
  title: string;
  content: string;
  createdBy: "user" | "agent";
  metadata: ArtifactMetadata;
  refs?: string[];
  conversationId: string;
}
