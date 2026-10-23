// Lets the desktop host own window chrome while route toolbars keep their React providers.
import { createContext, useContext } from "react";

export const ShellChromeContext = createContext<{ headerTarget: HTMLElement | null } | null>(null);

export function useShellChrome() {
  return useContext(ShellChromeContext);
}
