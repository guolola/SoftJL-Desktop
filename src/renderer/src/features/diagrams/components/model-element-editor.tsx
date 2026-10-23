// Presents every supported element field from the phase-specific contract.
import type { ModelingStage } from "../../../../../shared/contracts/index.js";
import { ContractFields, modelCollectionSchema } from "./model-contract-fields.js";
import type { EditableCollection } from "../lib/model-editing.js";
type Item = Record<string, unknown>;
type Option = { value: string; label: string };
export function ModelElementEditor({ editorDraft, collection, item, itemId, updateItem, stage = "requirements", sourceRuleOptions = [], showSourceReferences = true }: {
  editorDraft: Item; collection: EditableCollection; item: Item; itemId: string; stage?: ModelingStage;
  updateItem: (collection: EditableCollection, id: string, update: (item: Item) => Item) => void;
  actorOptions: Option[]; laneOptions: Option[]; messageOptions: Option[]; tableOptions: Option[]; columnsForTable: (id: string) => Option[];
  showSourceReferences?: boolean; sourceRuleOptions?: Array<{ id: string; label: string }>;
}) {
  return <ContractFields showSourceReferences={showSourceReferences} owner={collection.label} schema={modelCollectionSchema(editorDraft, stage, collection.key)} value={item} model={editorDraft}
    options={{ sourceRequirementIds: sourceRuleOptions.map((rule) => ({ value: rule.id, label: rule.label })), sourceRequirementId: sourceRuleOptions.map((rule) => ({ value: rule.id, label: rule.label })) }}
    onChange={(next) => updateItem(collection, itemId, () => next as Item)} />;
}
