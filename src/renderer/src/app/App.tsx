// Composes application providers, route matching, workspace shell layout, and top-level page selection.
"use client";

import React,{ useCallback,useEffect,useState,type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DashboardPage } from "../features/dashboard/components/dashboard-page.js";
import { OnboardingTourProvider } from "../features/onboarding/components/onboarding-tour-provider.js";
import { ProviderAvailabilityNotice } from "../features/settings/components/provider-availability-notice.js";
import { StandardWorkspace } from "../features/standard-project/components/standard-workspace.js";
import { AuthenticatedRoute,ProjectNewPage,ProjectSectionPage,ProjectWorkspaceAccessBoundary,ProjectsIndexPage,useProjectOverview } from "../features/user-platform/components/user-platform-pages.js";
import { PlatformSidebar } from "../features/workspace-shell/components/platform-sidebar.js";
import { TopBar } from "../features/workspace-shell/components/top-bar.js";
import { AppI18nProvider,useAppI18n } from "../shared/i18n/i18n-provider.js";
import { DefaultPagesLayout } from "../shared/template/layout/default-pages-layout.js";
import Error404 from "../shared/template/views/pages/misc/error-page-404/index.js";
import { FeedbackDialogProvider } from "../shared/ui/feedback-dialog.js";
import { FloatingAlertProvider } from "../shared/ui/floating-alert.js";
import { PageErrorBoundary } from "../shared/ui/page-error-boundary.js";
import { SidebarProvider } from "../shared/ui/sidebar.js";
import { ThemeProvider } from "../shared/ui/theme-provider.js";
import { TooltipProvider } from "../shared/ui/tooltip.js";
import { matchAppRoute,type AppRoute,type ProjectRouteSection } from "./app-routes.js";

function getProtectedRoutePath(route: AppRoute) {
  // Project sections share one authentication scope so menu changes keep the workspace mounted.
  if (route.kind === "project-workspace") {
    return `/projects/${encodeURIComponent(route.projectId)}`;
  }
  if (
    route.kind === "shell" ||
    route.kind === "dashboard" ||
    route.kind === "projects-index" ||
    route.kind === "projects-new" ||
    route.kind === "legacy-account"
  ) {
    return route.path;
  }
  return null;
}

function ProjectWorkspaceShell({ header, projectId, projectSection, onOpenAccount, onNavigate }: {
  header: React.ReactNode; projectId: string; projectSection: ProjectRouteSection | null;
  onOpenAccount: () => void; onNavigate: (route: string) => void;
}) {
  const overview = useProjectOverview(projectId);
  return <StandardWorkspace key={projectId} projectId={projectId}
    canEdit={overview.project?.status === "active" && ["owner", "editor"].includes(overview.membership?.role ?? "")}
    header={header} onNavigate={onNavigate} onOpenAccount={onOpenAccount} projectSection={projectSection}
    sectionContent={projectSection ? <ProjectSectionPage projectId={projectId} section={projectSection} onNavigate={onNavigate} /> : undefined} />;
}

export function Shell({ initialPath }: { initialPath?: string }) {
  const { locale } = useAppI18n();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [globalSettingsRequestId, setGlobalSettingsRequestId] = useState(0);
  const openProviderSettings = useCallback(() => {
    setGlobalSettingsRequestId((current) => current + 1);
    setAccountDialogOpen(true);
  }, []);
  const [loginLoadingRoute, setLoginLoadingRoute] = useState<string | null>(
    null,
  );
  const [route, setRoute] = useState<AppRoute>(() => {
    const pathname =
      initialPath ??
      (typeof window === "undefined" ? "/" : window.location.pathname);
    return matchAppRoute(pathname);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      new URLSearchParams(window.location.search).get("account") === "profile"
    ) {
      setAccountDialogOpen(true);
    }
  }, [route]);

  useEffect(() => {
    document.documentElement.dataset.template = "admincn";
    // Keep head metadata aligned with client-side History API navigation.
  }, [locale, route]);

  useEffect(() => {
    const handlePopState = () => {
      setLoginLoadingRoute(null);
      setRoute(matchAppRoute(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = useCallback(
    (nextPath: string, options?: { fromLogin?: boolean }) => {
      const nextUrl = new URL(
        options?.fromLogin && nextPath === "/workspace"
          ? "/projects"
          : nextPath,
        window.location.origin,
      );
      const nextRoute = matchAppRoute(nextUrl.pathname);
      setLoginLoadingRoute(
        options?.fromLogin &&
          (nextRoute.kind === "dashboard" ||
            nextRoute.kind === "projects-index")
          ? nextRoute.path
          : null,
      );
      const nextLocation = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (
        `${window.location.pathname}${window.location.search}` !== nextLocation
      ) {
        window.history.pushState({}, "", nextLocation);
        window.dispatchEvent(
          new CustomEvent("uml-route-change", {
            detail: { path: nextUrl.pathname, location: nextLocation },
          }),
        );
      }
      setRoute(nextRoute);
    },
    [],
  );

  // OAuth consent is a standalone screen while ordinary connection setup keeps the workbench shell.
  const renderRoute = () => {
    if (route.kind === "shell" || route.kind === "legacy-account")
      return <RedirectRoute to="/projects" onNavigate={navigate} />;
    if (route.kind === "legacy-redirect")
      return <RedirectRoute to={route.to} onNavigate={navigate} />;

    if (route.kind === "dashboard") {
      return <DashboardPage onNavigate={navigate} />;
    }
    if (route.kind === "projects-index") {
      return <ProjectsIndexPage onNavigate={navigate} />;
    }
    if (route.kind === "projects-new") {
      return <ProjectNewPage onNavigate={navigate} />;
    }
    if (route.kind === "project-workspace") {
      return (
        <ProjectWorkspaceAccessBoundary
          projectId={route.projectId}
          onNavigate={navigate}
        >
            <ProjectWorkspaceShell
              header={
                <TopBar
                  currentRoute={route.path}
                  onNavigate={navigate}
                  accountDialogOpen={accountDialogOpen}
                  onAccountDialogOpenChange={setAccountDialogOpen}
                  globalSettingsRequestId={globalSettingsRequestId}
                />
              }
              projectId={route.projectId}
              projectSection={route.section ?? null}
              onOpenAccount={() => setAccountDialogOpen(true)}
              onNavigate={navigate}
            />
        </ProjectWorkspaceAccessBoundary>
      );
    }
    return <Error404 />;
  };

  const protectedRoutePath = getProtectedRoutePath(route);
  const routeContent = renderRoute();
  const showWorkspaceTopBar =
    route.kind !== "project-workspace" &&
    route.kind !== "legacy-redirect" &&
    route.kind !== "not-found";
  const renderPlatformLayout = (content: ReactNode) => (
    <DefaultPagesLayout
      sidebar={
        <PlatformSidebar
          path={route.path}
          onOpenAccount={() => setAccountDialogOpen(true)}
          onNavigate={navigate}
        />
      }
      header={
        <TopBar
          currentRoute={route.path}
          onNavigate={navigate}
          accountDialogOpen={accountDialogOpen}
          onAccountDialogOpenChange={setAccountDialogOpen}
          globalSettingsRequestId={globalSettingsRequestId}
        />
      }
      contentClassName={
        route.kind === "dashboard" ? "min-w-0 p-0 sm:p-0" : "min-w-0 p-0"
      }
    >
      {content}
    </DefaultPagesLayout>
  );
  const shellContent = (
    <FloatingAlertProvider>
      <SidebarProvider
        resizable={route.kind === "project-workspace"}
        className={
          route.kind === "not-found"
            ? "block min-h-screen w-full"
            : "flex min-h-svh w-full flex-col bg-background text-foreground"
        }
      >
        <PageErrorBoundary resetKey={route.path}>
          {protectedRoutePath ? (
            <AuthenticatedRoute
              routeKey={protectedRoutePath}
              onNavigate={navigate}
              showLoadingScreen={
                route.kind === "project-workspace" ||
                loginLoadingRoute === route.path
              }
              renderLayout={
                showWorkspaceTopBar ? renderPlatformLayout : undefined
              }
            >
              <ProviderAvailabilityNotice key={route.path} onConfigure={openProviderSettings} />
              {routeContent}
            </AuthenticatedRoute>
          ) : showWorkspaceTopBar ? (
            renderPlatformLayout(routeContent)
          ) : (
            routeContent
          )}
        </PageErrorBoundary>
      </SidebarProvider>
    </FloatingAlertProvider>
  );
  // All protected pages share a stable provider tree; public pages keep their standalone layout.
  return protectedRoutePath ? (
    <OnboardingTourProvider>{shellContent}</OnboardingTourProvider>
  ) : (
    shellContent
  );
}

function RedirectRoute({
  to,
  onNavigate,
}: {
  to: string;
  onNavigate: (route: string) => void;
}) {
  useEffect(() => {
    onNavigate(to);
  }, [onNavigate, to]);

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
      <RedirectMessage />
    </main>
  );
}

function RedirectMessage() {
  const { t } = useTranslation();
  return <>{t("common.loading")}</>;
}

export default function App({ initialPath }: { initialPath?: string }) {
  return (
    <AppI18nProvider>
      <ThemeProvider>
        <TooltipProvider>
          <FeedbackDialogProvider>
                <Shell initialPath={initialPath} />
          </FeedbackDialogProvider>
        </TooltipProvider>
      </ThemeProvider>
    </AppI18nProvider>
  );
}
