// Defines the single user-facing requirement type and deterministic model routing.
import { z } from "zod";

export const requirementRuleTypeSchema = z.enum([
  "functional", "business-rule", "data", "interaction", "interface", "exception", "quality", "operations",
]);
export type RequirementRuleType = z.infer<typeof requirementRuleTypeSchema>;
