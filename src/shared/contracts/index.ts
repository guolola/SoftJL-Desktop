// Central public contract surface for shared schemas and DTOs consumed by apps and prompt builders.
export {
  adminCapabilitySchema,
  adminDataScopeSchema,
  adminPermissionSchema,
  adminRoleCapabilities,
  adminRoleDataScopes,
  adminRolePermissions,
  adminRoleSchema,
} from "./access/admin-rbac.js";
export * from "./access/admin-platform.js";
export type {
  AdminCapability,
  AdminDataScope,
  AdminPermission,
  AdminRole,
} from "./access/admin-rbac.js";
export * from "./access/auth-account.js";
export * from "./access/avatars.js";
export * from "./api-errors.js";
export * from "./dashboard.js";








export * from "./provider-configs.js";
















export * from "./system-notices.js";







export * from "./inbox.js";



export { documentKindSchema, documentStatusSchema, documentLibraryItemSchema, documentLibraryListResponseSchema, documentLibraryVersionItemSchema, documentLibraryVersionsResponseSchema, documentStylePresetNameSchema, documentLineSpacingSchema, documentParagraphStyleSchema, documentHeadingStyleSchema, documentTableStyleSchema, documentStyleSettingsSchema, documentSectionTableSchema, documentSectionSchema, documentContentResultSchema } from "./documents.js";
export type { DocumentKind, DocumentStatus, DocumentLibraryItem, DocumentLibraryListResponse, DocumentLibraryVersionItem, DocumentLibraryVersionsResponse, DocumentStylePresetName, DocumentLineSpacing, DocumentParagraphStyle, DocumentHeadingStyle, DocumentTableStyle, DocumentStyleSettings, DocumentSectionTable, DocumentSection, DocumentContentResult } from "./documents.js";
export { isDesignDiagramKind, designDiagramKindFromRecordKey, designRecordBelongsToDiagramKinds, visibilitySchema, useCaseActorTypeSchema, useCaseActorSchema, useCaseEventFlowTypeSchema, useCaseEventFlowStepActorSchema, useCaseEventFlowStepSchema, useCaseEventFlowSchema, useCaseSpecSchema, systemBoundarySchema, useCaseRelationshipTypeSchema, useCaseRelationshipSchema, useCaseDiagramSpecSchema, functionNodeSchema, functionRelationshipTypeSchema, functionRelationshipSchema, functionStructureDiagramSpecSchema, classKindSchema, classAttributeSchema, operationParameterSchema, classOperationSchema, classEntitySchema, interfaceEntitySchema, enumEntitySchema, classRelationshipTypeSchema, classRelationshipSchema, classDiagramSpecSchema, activityNodeTypeSchema, swimlaneSchema, activityPinSchema, activityStartNodeSchema, activityEndNodeSchema, activityActionNodeSchema, activityDecisionNodeSchema, activityMergeNodeSchema, activityForkNodeSchema, activityJoinNodeSchema, activityObjectNodeSchema, activityFlowFinalNodeSchema, activityNodeSchema, activityRelationshipTypeSchema, activityRelationshipSchema, activityDiagramSpecSchema, deploymentNodeTypeSchema, deploymentNodeSchema, deploymentDatabaseSchema, deploymentComponentSchema, externalSystemSchema, deploymentArtifactSpecSchema, deploymentRelationshipTypeSchema, deploymentRelationshipSchema, deploymentDiagramSpecSchema, sequenceParticipantTypeSchema, sequenceParticipantSchema, sequenceMessageTypeSchema, sequenceMessageSchema, sequenceFragmentTypeSchema, sequenceFragmentBranchSchema, sequenceFragmentSchema, sequenceActivationSchema, sequenceDiagramSpecSchema, analysisSequenceDiagramSpecSchema, prototypeInterfaceNodeTypeSchema, prototypeInterfaceNodeSchema, prototypeInterfaceRelationshipTypeSchema, prototypeInterfaceRelationshipSchema, prototypeInterfaceDiagramSpecSchema, navigationDiagramSpecSchema, architecturePackageSchema, architectureComponentSchema, architectureRelationshipTypeSchema, architectureRelationshipSchema, architectureDiagramSpecSchema, componentRelationshipElementSchema, componentInterfaceSchema, componentRelationshipTypeSchema, componentRelationshipSchema, componentRelationshipDiagramSpecSchema, tableColumnReferenceSchema, tableColumnSchema, tableRelationalConstraintSchema, tableSchema, tableRelationshipTypeSchema, tableRelationshipSchema, tableDiagramSpecSchema, contextElementSchema, contextRelationshipSchema, contextDiagramSpecSchema, requirementClassDiagramSpecSchema, requirementDeploymentDiagramSpecSchema, diagramModelSpecSchema, modelElementRefSchema, designDiagramModelSpecSchema, testScenarioTypeSchema, testPrioritySchema, blackBoxTestStepSchema, blackBoxTestCaseSchema, testCoverageStatusSchema, testCoverageRelationSchema, testGenerationResultSchema, modelRenderMappingSchema, plantUmlArtifactSchema, designPlantUmlArtifactSchema, svgArtifactSchema, designSvgArtifactSchema } from "./modeling/models.js";
export type { Visibility, UseCaseActorType, UseCaseActor, UseCaseEventFlowType, UseCaseEventFlowStepActor, UseCaseEventFlowStep, UseCaseEventFlow, UseCaseSpec, SystemBoundary, UseCaseRelationshipType, UseCaseRelationship, UseCaseDiagramSpec, FunctionNode, FunctionRelationshipType, FunctionRelationship, FunctionStructureDiagramSpec, ClassKind, ClassAttribute, OperationParameter, ClassOperation, ClassEntity, InterfaceEntity, EnumEntity, ClassRelationshipType, ClassRelationship, ClassDiagramSpec, ActivityNodeType, Swimlane, ActivityPin, ActivityStartNode, ActivityEndNode, ActivityActionNode, ActivityDecisionNode, ActivityMergeNode, ActivityForkNode, ActivityJoinNode, ActivityNode, ActivityRelationshipType, ActivityRelationship, ActivityDiagramSpec, DeploymentNodeType, DeploymentNode, DeploymentDatabase, DeploymentComponent, ExternalSystem, DeploymentArtifactSpec, DeploymentRelationshipType, DeploymentRelationship, DeploymentDiagramSpec, SequenceParticipantType, SequenceParticipant, SequenceMessageType, SequenceMessage, SequenceFragmentType, SequenceFragmentBranch, SequenceFragment, SequenceDiagramSpec, AnalysisSequenceDiagramSpec, PrototypeInterfaceNodeType, PrototypeInterfaceNode, PrototypeInterfaceRelationshipType, PrototypeInterfaceRelationship, PrototypeInterfaceDiagramSpec, NavigationDiagramSpec, ArchitecturePackage, ArchitectureComponent, ArchitectureRelationshipType, ArchitectureRelationship, ArchitectureDiagramSpec, ComponentRelationshipElement, ComponentInterface, ComponentRelationshipType, ComponentRelationship, ComponentRelationshipDiagramSpec, TableColumnReference, TableColumn, TableRelationalConstraint, TableSpec, TableRelationshipType, TableRelationship, TableDiagramSpec, ContextElement, ContextRelationship, ContextDiagramSpec, DiagramModelSpec, ModelElementRef, DesignDiagramModelSpec, TestScenarioType, TestPriority, BlackBoxTestStep, BlackBoxTestCase, TestCoverageStatus, TestCoverageRelation, TestGenerationResult, ModelRenderMapping, PlantUmlArtifact, DesignPlantUmlArtifact, SvgArtifact, DesignSvgArtifact } from "./modeling/models.js";
export { findModelByDiagramKind, modelRecordBelongsToDiagramKinds, resolveModelArtifactIdentity } from "./modeling/model-records.js";
export { getStageModelSchemas, getStageModelSchema, getModelGraphElements, isModelRelationshipAllowed, validateModelSemantics, deriveTableModel, assertValidModel, validateModelInput, ModelSemanticError } from "./modeling/model-semantics.js";
export type { ModelingStage, AnyDiagramModel, ModelDiagnostic, ModelGraphElement } from "./modeling/model-semantics.js";
export { projectStatusSchema, projectRetentionPolicySchema, projectBackgroundKeySchema, projectMemberRoleSchema, projectMemberStatusSchema, projectDtoSchema, projectCreateRequestSchema, projectUpdateRequestSchema, projectTransferOwnerRequestSchema, projectRetentionPolicyUpdateRequestSchema, projectPermissionSchema, projectMemberRolePermissions, projectMemberDtoSchema, projectMemberInviteRequestSchema, projectMemberUpdateRequestSchema, projectListResponseSchema, projectResponseSchema, projectMembersResponseSchema, projectInviteeSearchQuerySchema, projectInviteeSearchResponseSchema, projectMemberResponseSchema, projectInvitationCreateRequestSchema, projectInvitationDtoSchema, projectInvitationResponseSchema, projectInvitationAcceptResponseSchema } from "./workspace/projects.js";
export type { ProjectStatus, ProjectRetentionPolicy, ProjectBackgroundKey, ProjectMemberRole, ProjectMemberStatus, ProjectDto, ProjectCreateRequest, ProjectUpdateRequest, ProjectTransferOwnerRequest, ProjectRetentionPolicyUpdateRequest, ProjectPermission, ProjectMemberDto, ProjectMemberInviteRequest, ProjectMemberUpdateRequest, ProjectListResponse, ProjectResponse, ProjectMembersResponse, ProjectInviteeSearchResponse, ProjectMemberResponse, ProjectInvitationCreateRequest, ProjectInvitationDto, ProjectInvitationResponse, ProjectInvitationAcceptResponse } from "./workspace/projects.js";
export { standardModelSchemaForKind, standardModelStage, createStandardProjectState, validateStandardModel, standardDiagramTasks, standardDiagramKinds, standardDiagramKindSchema, standardDiagramLabels, standardScopeChoiceSchema, standardQuestionSchema, standardAnswerSchema, standardOutlineSchema, standardErModelSchema, standardModelSchema, standardTestsSchema, standardAttachmentSchema, standardQuoteSchema, standardConversationMessageSchema, standardTokenUsageSchema, standardOperationSchema, standardDiagramSchema, standardProjectStateSchema, storedStandardProjectStateSchema } from "./workspace/standard-project.js";
export type { StandardDiagramKind, StandardOutline, StandardModel, StandardQuestion, StandardAnswer, StandardDiagram, StandardAttachment, StandardConversationMessage, StandardTokenUsage, StandardOperation, StandardProjectState } from "./workspace/standard-project.js";
export { modelingAttachmentSchema } from "./modeling/modeling-attachments.js";
export type { ModelingAttachment } from "./modeling/modeling-attachments.js";
export { requirementRulesArraySchema, diagramKindSchema, designDiagramKindSchema, umlDiagramKindSchema, requirementRuleSchema, requirementRulesSchema, } from "./requirements/requirements.js";
export type { DiagramKind, DesignDiagramKind, UmlDiagramKind, RequirementRule, } from "./requirements/requirements.js";
export { requirementRuleTypeSchema } from "./requirements/requirement-rule-types.js";
export type { RequirementRuleType } from "./requirements/requirement-rule-types.js";
export { runTokenConsumptionSchema, runStageSchema, runStatusSchema, runErrorCodeSchema, runErrorCategorySchema, runErrorSchema, runSnapshotSchema, queuedRunEventSchema, stageStartedRunEventSchema, stageFinishedRunEventSchema, llmChunkRunEventSchema, stageProgressRunEventSchema, artifactReadyRunEventSchema, completedRunEventSchema, failedRunEventSchema, cancelledRunEventSchema, runActionSchema, runActionRunEventSchema, runInputImageSchema, runInputMetricsSchema, runActivityEventSchema, runEventMetadataSchema, runEventSchema } from "./runs/runs.js";
export type { RunTokenConsumption, RunStage, RunStatus, RunErrorCode, RunErrorCategory, RunError, RunSnapshot, RunAction, RunInputImage, RunInputMetrics, RunActivityEvent, RunEventInput, RunEvent } from "./runs/runs.js";
export { runOperationTypeSchema, runOutputReferenceSchema, runOutputFields } from "./runs/run-outputs.js";
export type { RunOperationType, RunOutputReference } from "./runs/run-outputs.js";
export { renderSvgRequestSchema, renderSvgResponseSchema, renderPngRequestSchema, renderPngResponseSchema, renderPdfRequestSchema, renderPdfResponseSchema } from "./modeling/render.js";
export type { RenderSvgRequest, RenderSvgResponse, RenderPngRequest, RenderPngResponse, RenderPdfRequest, RenderPdfResponse } from "./modeling/render.js";
export { isUnverifiableReviewText, isExcludedDiagramReviewIssue, classifyDiagramReviewIssue, CURRENT_DIAGRAM_REVIEW_VERSION, diagramReviewCategorySchema, diagramReviewFindingSchema, diagramRepairRecordSchema, diagramVisualReviewSchema } from "./modeling/visual-review.js";
export type { DiagramReviewCategory, DiagramReviewFinding, DiagramVisualReview } from "./modeling/visual-review.js";
export { useCaseParticipationGaps } from "./modeling/usecase-participation.js";
export { contractFieldSchema, contractResponseSchema, unknownContractFields, generationResponseSchema } from "./modeling/model-json-schema.js";
export { modelCapacityInputSchema, modelCapacitySchema, modelTokenUsageSchema, modelContextSettingsSchema, providerCapacityResponseSchema } from "./modeling/model-catalog.js";
export type { ModelCapacity, ModelTokenUsage, ModelContextSettings } from "./modeling/model-catalog.js";
export { MAX_GENERATION_REPAIR_ATTEMPTS } from "./runs/generation-policy.js";
export { assertCurrentWorkspaceState, assertCurrentRunSnapshot } from "./workspace/current-workspace.js";
