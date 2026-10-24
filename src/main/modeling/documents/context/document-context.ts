// Supplies labels shared by generated project documents and their library entries.
import type { DocumentKind } from "../../../../shared/contracts/index.js";
export function documentTitle(kind: DocumentKind) {
  return kind === "requirementsSpec" ? "需求规格说明书" : "软件设计说明书";
}
export function documentDiagramLabel(diagramKind: string, sectionTitle?: string) {
  const title = sectionTitle?.replace(/^\s*(?:\d+(?:\.\d+)*[.、．]?|[一二三四五六七八九十]+[、．.])\s*/u, "").trim();
  if (title) return title;
  const labels: Record<string, string> = {
    function: "功能结构图",
    usecase: "用例图",
    class: "领域概念模型",
    activity: "总体业务流程",
    deployment: "部署需求模型",
    prototype: "原型界面关系",
    analysis: "需求分析模型",
    context: "系统上下文图（系统环境图）",
    architecture: "总体架构图",
    sequence: "用例实现设计",
    component: "组件（构件）关系",
    table: "数据库设计",
  };
  return labels[diagramKind] ?? "UML 图";
}
