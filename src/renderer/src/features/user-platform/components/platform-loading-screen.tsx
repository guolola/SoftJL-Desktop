// Coordinates real route requests and shows a brief status without simulated progress or timed holds.
import { Spinner } from "../../../shared/ui/spinner.js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "../../../shared/ui/utils.js";

type PlatformLoadingScreenVariant = "fullscreen" | "content";

type PlatformLoadingEntries = Record<string, string>;

type PlatformLoadingCoordinatorContextValue = {
  entries: PlatformLoadingEntries;
  setRouteLoading: (id: string, message: string, active: boolean) => void;
};

const PlatformLoadingCoordinatorContext =
  createContext<PlatformLoadingCoordinatorContextValue | null>(null);

export function PlatformLoadingCoordinatorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [entries, setEntries] = useState<PlatformLoadingEntries>({});
  const setRouteLoading = useCallback(
    (id: string, message: string, active: boolean) => {
      setEntries((current) => {
        if (!active) {
          if (!(id in current)) return current;
          const { [id]: _removed, ...rest } = current;
          return rest;
        }
        if (current[id] === message) return current;
        return { ...current, [id]: message };
      });
    },
    [],
  );
  const value = useMemo(
    () => ({ entries, setRouteLoading }),
    [entries, setRouteLoading],
  );

  return (
    <PlatformLoadingCoordinatorContext.Provider value={value}>
      {children}
    </PlatformLoadingCoordinatorContext.Provider>
  );
}

export function usePlatformRouteLoading(message: string, active: boolean) {
  const id = useId();
  const coordinator = useContext(PlatformLoadingCoordinatorContext);
  const setRouteLoading = coordinator?.setRouteLoading;

  useEffect(() => {
    if (!setRouteLoading) return;
    setRouteLoading(id, message, active);
    return () => {
      setRouteLoading(id, message, false);
    };
  }, [active, id, message, setRouteLoading]);

  return Boolean(setRouteLoading);
}

export function usePlatformLoadingCoordinatorState() {
  const coordinator = useContext(PlatformLoadingCoordinatorContext);
  const messages = coordinator ? Object.values(coordinator.entries) : [];
  const message = messages[messages.length - 1] ?? null;
  return {
    active: messages.length > 0,
    message,
  };
}

export function PlatformLoadingScreen({
  message,
  variant = "fullscreen",
  className,
}: {
  message: string;
  variant?: PlatformLoadingScreenVariant;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 items-center justify-center gap-2 bg-background p-6 text-sm text-muted-foreground", className)}
      data-testid="platform-loading-screen"
      data-loading-variant={variant}
      role="status"
      aria-busy="true"
    >
      <Spinner aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
