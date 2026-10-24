// Requirement, coverage, traceability, and UML diagram kind contract schemas shared across run stages.
import { z } from "zod";
import { requirementRuleTypeSchema } from "./requirement-rule-types.js";

export const diagramKindSchema = z.enum([
  "context",
  "function",
  "usecase",
  "class",
  "activity",
  "deployment",
  "prototype",
  "analysis",
]);
export type DiagramKind = z.infer<typeof diagramKindSchema>;

export const designDiagramKindSchema = z.enum([
  "architecture",
  "sequence",
  "navigation",
  "class",
  "component",
  "deployment",
  "table",
]);
export type DesignDiagramKind = z.infer<typeof designDiagramKindSchema>;

export const umlDiagramKindSchema = z.union([
  diagramKindSchema,
  designDiagramKindSchema,
]);
export type UmlDiagramKind = z.infer<typeof umlDiagramKindSchema>;

export const requirementRuleSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceFragment: z.string().min(1).optional(),
  type: requirementRuleTypeSchema,
}).strict();
export type RequirementRule = z.infer<typeof requirementRuleSchema>;

function addDuplicateRequirementRuleIdIssues(
  rules: RequirementRule[],
  ctx: z.RefinementCtx,
) {
  const seen = new Map<string, number>();
  rules.forEach((rule, index) => {
    const key = rule.id.trim().toLowerCase();
    const firstIndex = seen.get(key);
    if (firstIndex === undefined) {
      seen.set(key, index);
      return;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Requirement rule id "${rule.id}" duplicates rule at index ${firstIndex}.`,
      path: [index, "id"],
    });
  });
}

export function requirementRulesArraySchema(minLength = 0) {
  const schema = z.array(requirementRuleSchema);
  return (minLength > 0 ? schema.min(minLength) : schema).superRefine(
    addDuplicateRequirementRuleIdIssues,
  );
}

export const requirementRulesSchema = requirementRulesArraySchema();

// Extracted rules must carry real source evidence; manual rules may omit it.
