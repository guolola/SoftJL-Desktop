// Owns the persistent desktop titlebar and routes application toolbars into its single row.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ShellChromeContext } from "./src/shared/template/layout/shell-chrome.js";
import { ProductLogo } from "./src/shared/ui/product-logo.js";
import type { DesktopBridge } from "../shared/bridge.js";

function toHexColor(value: string, fallback: string) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return fallback;
  context.fillStyle = fallback;
  context.fillStyle = value;
  // Canvas normalizes computed oklch/theme colors to sRGB for the native caption buttons.
  context.fillRect(0, 0, 1, 1);
  return "#" + Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3),
    channel => channel.toString(16).padStart(2, "0")).join("");
}

export function DesktopFrame({ children }: { children: ReactNode }) {
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [english, setEnglish] = useState(false);
  const chrome = useMemo(() => ({ headerTarget }), [headerTarget]);

  useEffect(() => {
    const root = document.documentElement;
    let animationFrame = 0;
    let lastColors = "";
    const sync = () => {
      setEnglish(root.lang.startsWith("en"));
      const titlebar = document.querySelector<HTMLElement>(".desktop-titlebar");
      if (!titlebar) return;
      const style = getComputedStyle(titlebar);
      const colors = {
        color: toHexColor(style.backgroundColor, "#fafafa"),
        symbolColor: toHexColor(style.color, "#262626"),
      };
      const serialized = JSON.stringify(colors);
      if (serialized !== lastColors) {
        lastColors = serialized;
        void (window.desktop as DesktopBridge).setWindowColors(colors).catch(console.error);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(schedule);
    const openMenuFromKeyboard = (event: KeyboardEvent) => {
      if (event.altKey && event.code === "KeyM" && !event.repeat) {
        event.preventDefault();
        void window.desktop.showApplicationMenu(root.lang.startsWith("en") ? "en" : "zh-CN").catch(console.error);
      }
    };
    window.addEventListener("keydown", openMenuFromKeyboard);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style", "lang"] });
    schedule();
    return () => {
      observer.disconnect(); cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", openMenuFromKeyboard);
    };
  }, []);

  return <ShellChromeContext.Provider value={chrome}>
    <div className="desktop-frame">
      <header className="desktop-titlebar" aria-label={english ? "Application title bar" : "应用标题栏"}>
        <button type="button" className="desktop-application-menu" aria-haspopup="menu"
          aria-label={english ? "Application menu" : "应用菜单"}
          title={english ? "Application menu (Alt+M)" : "应用菜单 (Alt+M)"}
          onClick={() => void window.desktop.showApplicationMenu(english ? "en" : "zh-CN").catch(console.error)}>
          <ProductLogo className="size-5 shrink-0" />
          <span>SoftJL</span><ChevronDown className="size-3 opacity-50" />
        </button>
        <div ref={setHeaderTarget} className="desktop-toolbar-host" />
      </header>
      <div className="desktop-workspace">{children}</div>
    </div>
  </ShellChromeContext.Provider>;
}
