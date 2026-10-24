// Defines durable File and Image result parts independently of project modeling contracts.
import { z } from "zod";

const artifactUrl = z.string().min(1).max(8_000_000).refine(value => /^\/api\//u.test(value)
  || /^data:[a-z0-9.+/-]+;base64,[a-z0-9+/=\r\n]+$/iu.test(value)
  || (() => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } })(), "产物地址无效");
export const standardConversationArtifactSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("file"), url: artifactUrl, filename: z.string().min(1).max(256), mimeType: z.string().min(1).max(128) }).strict(),
  z.object({ type: z.literal("image"), url: artifactUrl, filename: z.string().max(256).optional() }).strict(),
]);
export type StandardConversationArtifact = z.infer<typeof standardConversationArtifactSchema>;
export const standardConversationArtifactsSchema = z.array(standardConversationArtifactSchema).max(8);
