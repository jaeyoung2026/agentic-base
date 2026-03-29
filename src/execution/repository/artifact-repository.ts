/**
 * Artifact Repository — 균일 인터페이스의 영속 계약.
 *
 * 모든 Artifact CRUD는 이 인터페이스를 통과한다.
 * Supabase 구현이 기본이지만, 테스트에서는 in-memory 구현으로 교체 가능.
 *
 * 규칙:
 * - 모든 메서드에 userId를 강제한다 (테넌트 격리)
 * - DB 스키마(snake_case)와 도메인 모델(camelCase)은 mapper로 분리한다
 * - 새 영속 경로를 만들지 않는다 — 이 Repository가 유일한 경로
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtifactType, CreateArtifactParams } from "@/domain";
import type { Artifact } from "@/domain";
import { artifactSchema } from "@/domain";

// ─── 인터페이스 ──────────────────────────────────────────

export interface ArtifactRepository {
  insertForUser(params: CreateArtifactParams, userId: string): Promise<Artifact>;
  updateForUser(id: string, params: CreateArtifactParams, userId: string): Promise<Artifact>;
  findByIdForUser(id: string, userId: string): Promise<Artifact | null>;
  listByTypeForUser(type: ArtifactType, userId: string, limit?: number): Promise<Artifact[]>;
}

// ─── DB Row ↔ Domain Model 매퍼 ─────────────────────────

interface ArtifactRow {
  id: string;
  type: string;
  title: string;
  content: string;
  created_by: string;
  metadata: Record<string, unknown>;
  refs: string[];
  conversation_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

function mapArtifactRow(row: ArtifactRow): Artifact {
  // DB JSONB를 Zod 스키마로 검증 후 반환. 캐스팅이 아니라 검증 후 생성.
  const parsed = artifactSchema.safeParse({
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    metadata: row.metadata,
    refs: row.refs,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  if (!parsed.success) {
    throw new Error(`Invalid artifact data (id=${row.id}): ${parsed.error.message}`);
  }

  return parsed.data;
}

// ─── Supabase 구현 ──────────────────────────────────────

export function createArtifactRepository(client: SupabaseClient): ArtifactRepository {
  return {
    async insertForUser(params, userId) {
      const { data, error } = await client
        .from("artifacts")
        .insert({
          type: params.type,
          title: params.title,
          content: params.content,
          created_by: params.createdBy,
          metadata: params.metadata,
          refs: params.refs ?? [],
          conversation_id: params.conversationId,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Insert failed: ${error.message}`);
      return mapArtifactRow(data as ArtifactRow);
    },

    async updateForUser(id, params, userId) {
      const { data, error } = await client
        .from("artifacts")
        .update({
          title: params.title,
          content: params.content,
          metadata: params.metadata,
          refs: params.refs ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw new Error(`Update failed: ${error.message}`);
      return mapArtifactRow(data as ArtifactRow);
    },

    async findByIdForUser(id, userId) {
      const { data, error } = await client
        .from("artifacts")
        .select()
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw new Error(`Find failed: ${error.message}`);
      if (!data) return null;
      return mapArtifactRow(data as ArtifactRow);
    },

    async listByTypeForUser(type, userId, limit = 50) {
      const { data, error } = await client
        .from("artifacts")
        .select()
        .eq("type", type)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(`List failed: ${error.message}`);
      return (data as ArtifactRow[]).map(mapArtifactRow);
    },
  };
}
