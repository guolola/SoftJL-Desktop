// Evaluates saved workspace prerequisites and deterministic session state rules.

import type { DocumentKind, DocumentStyleSettings } from "../../../../../shared/contracts/index.js";

import { findRequirementModelByKind } from "../../../entities/diagram/model.js";
import type { WorkspaceRecord } from "../../../entities/workspace/model.js";
import type { RequirementRule } from "../../../entities/requirement-rule/model.js";

import { type RunHistoryItem } from "../../../entities/run-history/index.js";

import type { GenerationSubtask } from "../model/session-state.js";

import { snapshotInputFingerprint } from "./fingerprint.js";

import { designLabels, orderedDesignDiagrams } from "./generation-planning.js";

import { type OperationFailurePresentation } from "./operation-failure.js";

import { designErrorDiagrams, sequenceModelsCoverUseCases } from "./workspace-context.js";

export function downstreamDesignBlockReason(input: {
  designDiagramErrors: WorkspaceRecord["designDiagramErrors"];
  designModels: WorkspaceRecord["designModels"];
  models: WorkspaceRecord["models"];
}) {
  const erroredDiagrams = orderedDesignDiagrams([
    ...designErrorDiagrams(input.designDiagramErrors),
  ]);
  if (erroredDiagrams.length > 0) {
    return `设计模型存在失败项，请先回到设计页修复或重新生成：${designLabels(erroredDiagrams).join("、")}`;
  }

  const hasSequenceModels = Object.values(input.designModels).some(
    (model) => model.diagramKind === "sequence",
  );
  const useCaseModel = findRequirementModelByKind(input.models, "usecase");
  const hasUseCaseTargets =
    Boolean(useCaseModel) &&
    "useCases" in useCaseModel &&
    useCaseModel.useCases.length > 0;
  if (
    hasSequenceModels &&
    hasUseCaseTargets &&
    !sequenceModelsCoverUseCases(input.designModels, useCaseModel)
  ) {
    return "用例实现设计覆盖不足，请先回到设计页补齐用例实现设计";
  }

  return null;
}

export function withStartupValidationFailure(
  subtasks: GenerationSubtask[],
  failure: OperationFailurePresentation,
  detail: string,
) {
  const validationFailure: GenerationSubtask = {
    id: "start_validation",
    label: "启动校验",
    status: "failed",
    message: null,
    messageCode: failure.code,
    messageParams: failure.params,
    errorMessage: detail,
  };
  return [
    validationFailure,
    ...subtasks.filter((subtask) => subtask.id !== validationFailure.id),
  ];
}

export function latestTrustedMatrices(historyItems: RunHistoryItem[]) {
  const latest = [...historyItems]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .map((item) => item.snapshot)
    .find(
      (snapshot) =>
        Boolean(snapshot?.coverageMatrix) ||
        Boolean(snapshot?.traceabilityMatrix),
    );
  return {
    coverageMatrix: latest?.coverageMatrix ?? null,
    traceabilityMatrix: latest?.traceabilityMatrix ?? null,
  };
}

export function documentGenerationInputFingerprint(input: {
  designModelTraceability: WorkspaceRecord["designModelTraceability"];
  designModels: WorkspaceRecord["designModels"];
  documentKind: DocumentKind;
  documentStyle?: DocumentStyleSettings;
  models: WorkspaceRecord["models"];
  requirementModelTraceability: WorkspaceRecord["requirementModelTraceability"];
  requirementText: string;
  rules: RequirementRule[];
}) {
  const baseInput = {
    documentKind: input.documentKind,
    documentStyle: input.documentStyle ?? null,
    models: input.models,
    requirementModelTraceability: input.requirementModelTraceability,
    requirementText: input.requirementText,
    rules: input.rules,
  };

  if (input.documentKind === "requirementsSpec") {
    return snapshotInputFingerprint(baseInput);
  }

  return snapshotInputFingerprint({
    ...baseInput,
    designModelTraceability: input.designModelTraceability,
    designModels: input.designModels,
  });
}

export function pruneRequirementTraceabilityForRules(
  traceability: WorkspaceRecord["requirementModelTraceability"],
  rules: RequirementRule[],
) {
  const ruleIds = new Set(
    rules.map((rule) => rule.id.trim().toLowerCase()).filter(Boolean),
  );
  if (ruleIds.size === 0) return [];
  return traceability.filter((entry) =>
    ruleIds.has(entry.ruleId.trim().toLowerCase()),
  );
}
