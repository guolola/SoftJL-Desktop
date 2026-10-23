// Provides browser-only navigation for the copied workbench without a Next.js server.
import { forwardRef } from "react";
export const usePathname = () => window.location.pathname;
const Link = forwardRef<HTMLAnchorElement, any>(
  ({ href, prefetch, replace, scroll, ...props }, ref) => (
    <a
      ref={ref}
      href={typeof href === "string" ? href : href?.pathname}
      {...props}
    />
  ),
);
export default Link;

export function useRouter() {
  const navigate = (href: string, replace = false) => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: () => Promise.resolve(),
  };
}
