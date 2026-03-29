import { z } from "zod";

export const artifactTypeSchema = z.enum(["discussion", "document"]);

const discussionMetadataSchema = z.object({
  type: z.literal("discussion"),
});

const documentMetadataSchema = z.object({
  type: z.literal("document"),
});

export const artifactMetadataSchema = z.discriminatedUnion("type", [
  discussionMetadataSchema,
  documentMetadataSchema,
]);

export const artifactSchema = z.object({
  id: z.string(),
  type: artifactTypeSchema,
  title: z.string(),
  content: z.string(),
  createdBy: z.enum(["user", "agent"]),
  metadata: artifactMetadataSchema,
  refs: z.array(z.string()),
  conversationId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
