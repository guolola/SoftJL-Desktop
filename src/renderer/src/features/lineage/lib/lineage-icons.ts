// Resolves icons from durable type identifiers, independent of display language.
import { Network, Layers3, ListChecks, FileText, type LucideIcon } from 'lucide-react';
import { REQUIREMENT_DIAGRAM_ICON, DESIGN_DIAGRAM_ICON } from '../../../entities/diagram/model-icons.js';
import type { RequirementRuleType } from '../../../../../shared/contracts/index.js';
import { RULE_KIND_ICON as RULE_ICONS } from '../../../entities/requirement-rule/model-icons.js';
import type { DiagramKind, DesignDiagramKind } from '../../../../../shared/contracts/index.js';
import type { LineageNode } from './lineage-graph-model.js';

export { RULE_KIND_ICON as RULE_ICONS } from '../../../entities/requirement-rule/model-icons.js';
export const REQUIREMENT_ICONS = REQUIREMENT_DIAGRAM_ICON;
export const DESIGN_ICONS = DESIGN_DIAGRAM_ICON;
export function lineageIcon(node: Pick<LineageNode, 'kind' | 'payload'>): LucideIcon {
  if (node.kind === 'rule') return RULE_ICONS[node.payload?.ruleKind as RequirementRuleType] ?? ListChecks;
  if (node.kind === 'requirement-model') return REQUIREMENT_ICONS[node.payload?.diagramKind as DiagramKind] ?? Network;
  if (node.kind === 'design-model') return DESIGN_ICONS[node.payload?.designDiagramKind as DesignDiagramKind] ?? Layers3;
  return FileText;
}
