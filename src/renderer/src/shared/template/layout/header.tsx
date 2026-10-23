// Adapts the AdminCN default-layout Header source to platform navigation and actions.
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SidebarTrigger } from '../../ui/sidebar.js';
import { Separator } from '../../ui/separator.js';
import { useShellChrome } from './shell-chrome.js';

export function AdmincnHeader({ navigation, actions, showSidebar = true }: { navigation: ReactNode; actions: ReactNode; showSidebar?: boolean }) {
  const chrome = useShellChrome();
  // Portals preserve route/session/sidebar context even though the toolbar lives above the workspace.
  if (chrome) return chrome.headerTarget ? createPortal(
    <div className="desktop-toolbar" data-slot="desktop-toolbar">
      <div className="desktop-toolbar-navigation">
        {showSidebar && <SidebarTrigger className="size-8 [&_svg]:size-4" />}
        {navigation}
      </div>
      <div className="desktop-toolbar-actions">{actions}</div>
    </div>, chrome.headerTarget,
  ) : null;
  return (
    <header className='sticky top-0 z-50 px-4 before:absolute before:inset-0 before:rounded-t-xl before:mask-[linear-gradient(var(--card),var(--card)_18%,transparent_100%)] before:backdrop-blur-md sm:px-6'>
      <div className='bg-card relative z-51 mx-auto mt-3 flex min-h-10 w-full max-w-348 items-center justify-between rounded-xl border px-6 py-2'>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-4">
          {showSidebar && <SidebarTrigger className="[&_svg]:size-5!" />}
          <Separator orientation="vertical" className="hidden h-4! self-center! sm:block" />
          {navigation}
        </div>
        {/* Horizontal scrolling also clips vertically: reserve halo space and cancel its layout height. */}
        <div className="-my-3 flex min-w-0 items-center gap-1.5 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{actions}</div>
      </div>
    </header>
  );
}
