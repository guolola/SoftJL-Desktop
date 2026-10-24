// Builds black-box test cases and coverage links from requirement and design models.
import { Card } from "../../../shared/ui/card.js";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { PageContainer, PageHeader } from "../../../shared/template/layout/page.js";
import { Filter, ShieldCheck } from "lucide-react";
import type { BlackBoxTestCase, TestCoverageRelation, TestScenarioType } from "../../../../../shared/contracts/index.js";
import { Badge } from "../../../shared/ui/badge.js";
import { SelectControl } from "../../../shared/ui/select.js";
import { StudioDataTable } from "../../../shared/ui/studio-data-table.js";
import { cn } from "../../../shared/ui/utils.js";
import { categoryChipTone } from "../../../shared/ui/category-tones.js";

const SCENARIO_TYPES: Array<TestScenarioType | "all"> = [
  "all", "normal", "alternative", "exception", "boundary", "decision-table",
];

type DisplayTestCase = Omit<BlackBoxTestCase, "scenarioType" | "priority"> & { scenarioType?: TestScenarioType; priority?: BlackBoxTestCase["priority"] };
export type TestModelPageData = { testCases: DisplayTestCase[]; coverageRelations: TestCoverageRelation[] };
export function TestModelPage({ result }: { result: TestModelPageData }) {
  const { t } = useTranslation();
  const [scenarioFilter, setScenarioFilter] = useState<TestScenarioType | "all">("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const filteredCases = useMemo(() => {
    const cases = result?.testCases ?? [];
    return scenarioFilter === "all"
      ? cases
      : cases.filter((testCase) => testCase.scenarioType === scenarioFilter);
  }, [result, scenarioFilter]);

  const coverageByCase = useMemo(() => {
    return new Map((result?.coverageRelations ?? []).map((item) => [item.testCaseId, item]));
  }, [result?.coverageRelations]);

  useEffect(() => {
    setPagination(current => ({ ...current, pageIndex: 0 }));
  }, [result, scenarioFilter]);

  const testColumns = useMemo<ColumnDef<DisplayTestCase>[]>(() => [
    {
      accessorKey: "title",
      header: t("testingPage.columns.case"),
      size: 260,
      cell: ({ row }) => (
        <div className="min-w-56 max-w-80 whitespace-normal">
          <div className="font-semibold text-foreground">{row.original.title}</div>
          <details className="mt-1 text-[11px] text-muted-foreground"><summary className="cursor-pointer">{t("uxReview.details")}</summary><span className="break-all">{row.original.id}</span></details>
        </div>
      ),
    },
    {
      accessorKey: "scenarioType",
      header: t("testingPage.columns.scenario"),
      size: 140,
      cell: ({ row }) => <Badge variant="outline" className={categoryChipTone(SCENARIO_TYPES.indexOf(row.original.scenarioType ?? "all") - 1)}>{row.original.scenarioType ? t(`testingPage.scenarios.${row.original.scenarioType.replace("-", "_")}`) : t("standardProject.unclassified")}</Badge>,
    },
    {
      id: "steps",
      header: t("testingPage.columns.steps"),
      size: 330,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="min-w-72 max-w-[34rem] space-y-2 whitespace-normal">
          {row.original.steps.slice(0, 3).map(step => (
            <div key={step.order} className="rounded-md bg-muted/40 px-3 py-2">
              <div className="text-xs font-medium text-foreground">{step.order}. {step.action}</div>
              <div className="mt-1 text-xs text-muted-foreground">{step.expectedResult}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "coverage",
      header: t("standardProject.businessAndModels"),
      size: 210,
      enableSorting: false,
      cell: ({ row }) => {
        const coverage = coverageByCase.get(row.original.id);
        return (
          <div className="flex min-w-40 max-w-64 flex-wrap gap-1 whitespace-normal">
            {(coverage?.requirementIds ?? []).map(id => <Badge key={id} variant="outline" className="text-[10px]">{id}</Badge>)}
            {(coverage?.useCaseIds ?? []).map(id => <Badge key={id} variant="secondary" className="text-[10px]">{id}</Badge>)}
          </div>
        );
      },
    },
    {
      accessorKey: "priority",
      header: t("testingPage.columns.priority"),
      size: 100,
      cell: ({ row }) => (
        <span className={cn(
          "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
          row.original.priority === "P0" ? "bg-destructive/10 text-destructive"
            : row.original.priority === "P1" ? "bg-warning/10 text-warning"
              : row.original.priority === "P2" ? "bg-info/10 text-info"
                : "bg-muted text-muted-foreground",
        )}>{row.original.priority ?? t("standardProject.unspecified")}</span>
      ),
    },
  ], [coverageByCase, t]);

  const coveredRequirements = new Set(
    (result?.coverageRelations ?? []).flatMap((item) => item.requirementIds),
  );
  const coveredUseCases = new Set(
    (result?.coverageRelations ?? []).flatMap((item) => item.useCaseIds),
  );

  return (
    <PageContainer className="flex min-h-full flex-col">
      <div className="flex w-full flex-col gap-5">
          <PageHeader
            title={t("testingPage.title")}
            description={t("standardProject.testDescription")}
          />

          <div
            data-testid="test-summary-grid"
            className="grid w-full grid-cols-2 gap-3 lg:gap-6 xl:grid-cols-4"
          >
            {[
              [t("testingPage.summary.cases"), result?.testCases.length ?? 0],
              [t("standardProject.relatedBusiness"), coveredRequirements.size],
              [t("standardProject.relatedModels"), coveredUseCases.size],
              [t("standardProject.relatedRecords"), result?.coverageRelations.length ?? 0],
            ].map(([label, value]) => (
              <Card key={label} className="gap-0 py-0 min-w-0 p-4">
                <div className="truncate text-sm text-muted-foreground">
                  {label}
                </div>
                <div className="mt-1 text-lg font-semibold leading-6 text-foreground">
                  {value}
                </div>
              </Card>
            ))}
          </div>

          <StudioDataTable
            columns={testColumns}
            data={filteredCases}
            getRowId={testCase => testCase.id}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageSizeOptions={[10, 25, 50]}
            tableClassName="min-w-[1040px]"
            emptyState={t("testingPage.empty")}
            footerLabel={t("testingPage.pagination.itemLabel", { defaultValue: "个测试用例" })}
            toolbarLeading={
              <div className="flex shrink-0 items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{t("testingPage.blackBox")}</h3>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {filteredCases.length}
                </Badge>
              </div>
            }
            filters={
              <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground sm:gap-2">
                <Filter className="size-3.5" />
                <SelectControl
                  aria-label={t("testingPage.filterAria")}
                  value={scenarioFilter}
                  onValueChange={(value) => {
                    setScenarioFilter(value as TestScenarioType | "all");
                    setPagination((current) => ({ ...current, pageIndex: 0 }));
                  }}
                  className="h-8 w-36 shrink-0 text-sm"
                  size="sm"
                  options={SCENARIO_TYPES.map((value) => ({ value, label: t(`testingPage.scenarios.${value.replace("-", "_")}`) }))}
                />
              </label>
            }
          />
      </div>
    </PageContainer>
  );
}
