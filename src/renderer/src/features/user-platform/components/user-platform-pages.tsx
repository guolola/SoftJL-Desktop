// Hosts authenticated project, account, and provider pages backed by the platform API.
import type { TFunction } from "i18next";
import {
Loader2
} from "lucide-react";
import {
createContext,
useCallback,
useContext,
useEffect,
useMemo,
useRef,
useState,
} from "react";
import { useTranslation } from "react-i18next";
import { localizeCaughtFailure } from "../../../shared/i18n/api-errors.js";
import NotFound404 from '../../../shared/template/views/pages/misc/error-page-404/index.js';
import Forbidden403 from '../../../shared/template/views/pages/misc/forbidden-403/index.js';
import ServerError500 from '../../../shared/template/views/pages/misc/server-error-500/index.js';

import { PageHeader } from "../../../shared/template/layout/page.js";
import { Button } from "../../../shared/ui/button.js";

import { PROJECT_RUNS_REUSE_MS } from "../../../services/workspace-repository/project-run-reads.js";
import { RouteContentReadyProvider } from "../../../shared/lib/route-content-readiness.js";
import {
AUTH_SESSION_CHANGED_EVENT,
PlatformApiError,
platformApi,
type PlatformAccountProfileResponse,
type PlatformDocument,
type PlatformProject,
type PlatformProjectMember,
type PlatformRunSummary,
type PlatformUser,
} from "../services/platform-api.js";
import { AuthenticatedRouteSessionProvider } from "./authenticated-route-session.js";
import { ManagedProviderSettingsSync } from "./managed-provider-settings-sync.js";
import {
PlatformLoadingCoordinatorProvider,
PlatformLoadingScreen,
usePlatformLoadingCoordinatorState,
usePlatformRouteLoading,
} from "./platform-loading-screen.js";
import { ProjectHistory } from "./project-history.js";
import { ProjectMembers } from "./project-members.js";
import { PageFrame,SectionCard } from "./project-page-layout.js";
import { ProjectSettings } from "./project-settings.js";
export { ProjectNewPage } from "./project-new-page.js";
export { ProjectsIndexPage } from "./projects-index-page.js";

type Navigate = (path: string) => void;

const ACTIVE_RUNS_REFRESH_MS = 8_000;


type ProjectOverviewState = {
  loading: boolean;
  error: string;
  authRequired: boolean;
  forbidden: boolean;
  notFound: boolean;
  project: PlatformProject | null;
  membership: PlatformProjectMember | null;
  members: PlatformProjectMember[];
  runs: PlatformRunSummary[];
  documents: PlatformDocument[];
};

const emptyProjectOverview: ProjectOverviewState = {
  loading: true,
  error: "",
  authRequired: false,
  forbidden: false,
  notFound: false,
  project: null,
  membership: null,
  members: [],
  runs: [],
  documents: [],
};

const ProjectOverviewContext =
  createContext<{ projectId: string; overview: ProjectOverviewState } | null>(null);

export function useProjectOverview(projectId: string) {
  const { t } = useTranslation();
  const providedOverview = useContext(ProjectOverviewContext);
  const contextOverview =
    providedOverview?.projectId === projectId ? providedOverview.overview : null;
  const [state, setState] = useState<ProjectOverviewState>(emptyProjectOverview);

  useEffect(() => {
    if (contextOverview) return;
    let active = true;
    setState({ ...emptyProjectOverview, loading: true });
    Promise.all([
      platformApi.getProject(projectId),
      platformApi.listProjectMembers(projectId),
      platformApi.listProjectRuns(projectId, { maxAgeMs: PROJECT_RUNS_REUSE_MS }),
      platformApi.listProjectDocuments(projectId),
    ])
      .then(([projectResponse, memberResponse, runResponse, documentResponse]) => {
        if (!active) return;
        setState({
          loading: false,
          error: "",
          authRequired: false,
          forbidden: false,
          notFound: false,
          project: projectResponse.project,
          membership: projectResponse.membership ?? null,
          members: memberResponse.members,
          runs: runResponse.runs,
          documents: documentResponse.documents,
        });
      })
      .catch((error) => {
        if (!active) return;
        const status = error instanceof PlatformApiError ? error.status : 0;
        setState({
          ...emptyProjectOverview,
          loading: false,
          authRequired: status === 401,
          forbidden: status === 403,
          notFound: status === 404,
          error: localizeCaughtFailure(error, t("projectShell.access.loadFailedFallback")),
        });
      });
    return () => {
      active = false;
    };
  }, [contextOverview, projectId, t]);

  const hasActiveRuns = state.runs.some(
    (run) => run.status === "queued" || run.status === "running",
  );

  useEffect(() => {
    if (contextOverview || state.loading || !hasActiveRuns) return;
    let active = true;
    const refreshRuns = () => {
      platformApi
        .listProjectRuns(projectId)
        .then((response) => {
          if (!active) return;
          setState((current) => ({
            ...current,
            runs: response.runs,
          }));
        })
        .catch(() => {
          // Project overview remains usable when background run polling misses a beat.
        });
    };
    const intervalId = window.setInterval(refreshRuns, ACTIVE_RUNS_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [contextOverview, hasActiveRuns, projectId, state.loading]);

  useEffect(() => {
    if (contextOverview) return;
    let active = true;
    const refreshCompletedRuns = () => {
      void platformApi.listProjectRuns(projectId).then((response) => {
        if (!active) return;
        setState((current) => ({ ...current, runs: response.runs }));
      }).catch(() => {
        // Completion refresh is best-effort; the manual history refresh remains available.
      });
    };
    window.addEventListener("uml-generation-completed", refreshCompletedRuns);
    return () => {
      active = false;
      window.removeEventListener("uml-generation-completed", refreshCompletedRuns);
    };
  }, [contextOverview, projectId]);

  return contextOverview ?? state;
}

function renderAccessMessage(
  overview: ProjectOverviewState,
  t: TFunction,
  onNavigate?: Navigate,
) {
  if (overview.authRequired) {
    return (
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base">{"本地项目暂时无法打开"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {"请返回项目列表后重试。"}
            </p>
          </div>
          {onNavigate && (
            <Button type="button" onClick={() => onNavigate("/projects")}>
              {"返回项目列表"}
            </Button>
          )}
        </div>
      </SectionCard>
    );
  }
  if (overview.forbidden) return <Forbidden403 />;
  if (overview.notFound) return <NotFound404 />;
  if (overview.error) return <ServerError500 />;
  return null;
}

function ProjectWorkspaceLoadingLayout() {
  return (
    <div
      data-testid="project-workspace-loading-layout"
      className="pointer-events-none grid min-h-0 min-w-0 flex-1 grid-cols-[10%_1px_minmax(0,1fr)] overflow-hidden bg-background"
      aria-hidden="true"
    >
      <aside className="h-full min-w-20 border-r border-sidebar-border bg-sidebar" />
      <div className="h-full bg-border/70" />
      <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
        <div className="h-[53px] shrink-0 border-b border-border bg-card" />
        <div className="h-12 shrink-0 border-b border-border bg-background" />
        <div className="min-h-0 flex-1 bg-background" />
      </main>
    </div>
  );
}

export function AuthenticatedRoute({
  children,
  onNavigate,
  routeKey,
  showLoadingScreen = false,
  renderLayout,
}: {
  children: React.ReactNode;
  onNavigate: Navigate;
  routeKey?: string;
  showLoadingScreen?: boolean;
  renderLayout?: (content: React.ReactNode) => React.ReactNode;
}) {
  return (
    <PlatformLoadingCoordinatorProvider>
      <AuthenticatedRouteContent
        onNavigate={onNavigate}
        routeKey={routeKey}
        showLoadingScreen={showLoadingScreen}
        renderLayout={renderLayout}
      >
        {children}
      </AuthenticatedRouteContent>
    </PlatformLoadingCoordinatorProvider>
  );
}

function AuthenticatedRouteContent({
  children,
  onNavigate,
  routeKey,
  showLoadingScreen,
  renderLayout,
}: {
  children: React.ReactNode;
  onNavigate: Navigate;
  routeKey?: string;
  showLoadingScreen: boolean;
  renderLayout?: (content: React.ReactNode) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(true);
  const [verifiedRouteKey, setVerifiedRouteKey] = useState<string | undefined>(undefined);
  const [authSession, setAuthSession] = useState<PlatformAccountProfileResponse | null>(null);
  const childLoading = usePlatformLoadingCoordinatorState();
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [connectionError, setConnectionError] = useState(false);
  const profileRevision = useRef(0);
  const updateSessionUser = useCallback((user: PlatformUser) => {
    ++profileRevision.current;
    // Share successful profile writes without rechecking auth or remounting route content.
    setAuthSession((current) => current?.user.id === user.id ? { ...current, user } : current);
  }, []);
  const hasVerifiedSession = Boolean(authSession) && verifiedRouteKey === routeKey;
  const effectiveChecking = checking || !hasVerifiedSession;
  const overlayActive = showLoadingScreen && (effectiveChecking || childLoading.active);
  const overlayMessage = childLoading.message ?? t("projectShell.checkingSession");

  const verifySession = useCallback(() => {
    const profileVersion = profileRevision.current;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setConnectionError(false);
    setChecking(true);
    platformApi
      .me()
      .then((response) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        // An auth request started before a profile save must not restore the older avatar.
        setAuthSession((current) => current?.user.id === response.user.id && profileVersion !== profileRevision.current
          ? { ...response, user: current.user }
          : response);
        setConnectionError(false);
        setVerifiedRouteKey(routeKey);
        setChecking(false);
      })
      .catch((error) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        // Local identity is owned by the backend; failures stay here instead of opening a retired login route.
        setAuthSession(null);
        setVerifiedRouteKey(undefined);
        setChecking(false);
        setConnectionError(true);
      });
  }, [routeKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    // Route content stays unmounted until the server has validated the cookie-backed session for this exact route.
    verifySession();
  }, [verifySession]);

  useEffect(() => {
    const handleSessionChanged = () => verifySession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged);
    };
  }, [verifySession]);

  if (connectionError) return <div role="alert" className="m-auto grid max-w-md gap-4 p-6"><h2 className="font-medium">本地工作区暂时无法连接</h2><p className="text-sm text-muted-foreground">请重新连接；如果问题持续，请重启桌面应用。</p><Button onClick={verifySession}>重新连接</Button></div>;

  if (effectiveChecking && (!authSession || !renderLayout)) {
    if (!showLoadingScreen) {
      return <div data-testid="auth-check-placeholder" className="min-h-0 flex-1" aria-busy="true" />;
    }
    return (
      <PlatformLoadingScreen
        message={overlayMessage}
        variant="fullscreen"
      />
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <AuthenticatedRouteSessionProvider value={authSession} onUserUpdate={updateSessionUser}>
        <ManagedProviderSettingsSync session={authSession} />
        {/* Guidance starts as soon as the real session and route requests have finished. */}
        <RouteContentReadyProvider ready={!effectiveChecking && !overlayActive}>
          {renderLayout
            ? renderLayout(effectiveChecking
                ? <div data-testid="auth-check-placeholder" className="min-h-0 flex-1" aria-busy="true" />
                : children)
            : children}
        </RouteContentReadyProvider>
      </AuthenticatedRouteSessionProvider>
      {overlayActive && (
        <PlatformLoadingScreen
          message={overlayMessage}
          variant="fullscreen"
          className="absolute inset-0 z-50"
        />
      )}
    </div>
  );
}

export function ProjectSectionPage({
  projectId,
  section,
  onNavigate,
}: {
  projectId: string;
  section: "settings" | "members" | "history";
  onNavigate: Navigate;
}) {
  const { t } = useTranslation();
  const overview = useProjectOverview(projectId);
  const sectionTitle = {
    settings: t("projectShell.sections.settings"),
    members: t("projectShell.sections.members"),
    history: t("projectShell.sections.history"),
  }[section];
  const projectName =
    overview.project?.name ??
    (overview.loading ? t("projectShell.loadingProject") : t("projectShell.projectFallback", { projectId }));
  const accessMessage = renderAccessMessage(overview, t, onNavigate);

  return (
    <PageFrame onNavigate={onNavigate}>
      <section aria-label={sectionTitle} className="flex min-w-0 flex-col gap-6">
        {section !== "settings" && <PageHeader
          title={sectionTitle}
          description={t(`projectShell.sectionDescriptions.${section}`, { project: projectName })}
          actions={section !== "history" ? <Button type="button" variant="outline" onClick={() => onNavigate(`/projects/${encodeURIComponent(projectId)}`)}>
            {t("projectShell.backToWorkspace")}
          </Button> : undefined}
        />}
        {overview.loading && (
          <SectionCard>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("projectShell.loadingProjectData")}
            </div>
          </SectionCard>
        )}
        {!overview.loading && accessMessage}
        {!overview.loading && !accessMessage && overview.project && section === "settings" && (
          <ProjectSettings
            project={overview.project}
            membershipRole={overview.membership?.role ?? null}
            pageTitle={sectionTitle}
            onProjectDeleted={() => onNavigate("/projects")}
          />
        )}
        {!overview.loading && !accessMessage && overview.project && section === "members" && (
          <ProjectMembers project={overview.project} members={overview.members} membershipRole={overview.membership?.role ?? null} />
        )}
        {!overview.loading && !accessMessage && overview.project && section === "history" && (
          <ProjectHistory projectId={projectId} initialRuns={overview.runs} members={overview.members} />
        )}
      </section>
    </PageFrame>
  );
}

export function ProjectWorkspaceAccessBoundary({
  projectId,
  onNavigate,
  children,
}: {
  projectId: string;
  onNavigate: Navigate;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const overview = useProjectOverview(projectId);
  const accessMessage = renderAccessMessage(overview, t, onNavigate);
  const coordinatedLoading = usePlatformRouteLoading(
    t("projectShell.openingWorkspace"),
    overview.loading,
  );
  const overviewContextValue = useMemo(
    () => ({ projectId, overview }),
    [overview, projectId],
  );

  if (overview.loading) {
    if (coordinatedLoading) {
      return <ProjectWorkspaceLoadingLayout />;
    }
    return (
      <PageFrame onNavigate={onNavigate}>
        <PlatformLoadingScreen
          message={t("projectShell.openingWorkspace")}
          variant="content"
        />
      </PageFrame>
    );
  }

  if (accessMessage || !overview.project) {
    return (
      <PageFrame onNavigate={onNavigate}>{accessMessage}</PageFrame>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <ProjectOverviewContext.Provider value={overviewContextValue}>
        {children}
      </ProjectOverviewContext.Provider>
    </div>
  );
}
