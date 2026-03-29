// ============================================================
// Artifact — 균일 인터페이스의 핵심 계약.
//
// 모든 도구 출력, 사용자 행동, 저장, 렌더링이 이 인터페이스를 통과한다.
// 새 타입 추가 시 AGENTS.md의 "Artifact 균일 인터페이스" 절차를 따른다.
// ============================================================

// ─── ArtifactType ──────────────────────────────────────────

export type ArtifactType =
  | "discussion" // 대화
  | "document"; // 범용 문서 (프로젝트별 확장)

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
