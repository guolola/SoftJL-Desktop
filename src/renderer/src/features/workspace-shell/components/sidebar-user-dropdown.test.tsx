// Verifies sidebar account navigation, keyboard/mobile access, and successful/failed logout transitions.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../../shared/i18n/index.js';
import { DefaultSidebar } from '../../../shared/template/layout/default-sidebar.js';
import { SidebarProvider, useSidebar } from '../../../shared/ui/sidebar.js';
import { AuthenticatedRouteSessionProvider } from '../../user-platform/components/authenticated-route-session.js';
import { type PlatformAccountProfileResponse } from '../../user-platform/services/platform-api.js';
import { SidebarUserDropdown } from './sidebar-user-dropdown.js';
const profile: PlatformAccountProfileResponse = {
  mfa: { enabled: false, enforcement: "totp" },
  user: { id: 'user-1', username: 'sidebar-user', displayName: '侧栏用户', avatarUrl: null, status: 'active', mfaEnabled: false },
  session: { id: 'session-1', userId: 'user-1', createdAt: '', expiresAt: '', lastSeenAt: '', ipAddress: null, userAgent: null },
};
function SidebarControls() {
    const { openMobile, setOpenMobile, setOpen } = useSidebar();
    return <>
    <button onClick={() => setOpen(false)}>折叠侧栏</button>
    <button onClick={() => setOpenMobile(true)}>打开手机侧栏</button>
    <output data-testid="mobile-open">{String(openMobile)}</output>
  </>;
}
function renderSidebar(session: PlatformAccountProfileResponse | null = profile) {
    const actions = { onOpenAccount: vi.fn(), onNavigate: vi.fn() };
    render(<I18nextProvider i18n={i18n}>
    <AuthenticatedRouteSessionProvider value={session}>
      <SidebarProvider>
        <SidebarControls />
        <DefaultSidebar footer={<SidebarUserDropdown {...actions}/>}>
          <span>侧栏导航</span>
        </DefaultSidebar>
      </SidebarProvider>
    </AuthenticatedRouteSessionProvider>
  </I18nextProvider>);
    return { ...actions, user: userEvent.setup() };
}
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '用户菜单：侧栏用户' }));
    return screen.findByRole('menu');
}
afterEach(() => {
    vi.restoreAllMocks();
    window.innerWidth = 1440;
});
describe('sidebar user dropdown', () => {
    it('updates the arrow direction with menu opening, closing and Escape dismissal', async () => {
        const { user } = renderSidebar();
        const trigger = screen.getByRole('button', { name: '用户菜单：侧栏用户' });
        const arrow = trigger.querySelector('[data-slot="user-menu-chevron"]');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(arrow).not.toHaveClass('rotate-180');
        await user.click(trigger);
        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
        expect(arrow).toHaveClass('rotate-180');
        await user.click(trigger);
        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
        expect(arrow).not.toHaveClass('rotate-180');
        await user.click(trigger);
        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
        expect(arrow).toHaveClass('rotate-180');
        await user.keyboard('{Escape}');
        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
        expect(arrow).not.toHaveClass('rotate-180');
    });
    it('uses the real user in the footer and opens all existing account destinations', async () => {
        const { user, onOpenAccount, onNavigate } = renderSidebar();
        const trigger = screen.getByRole('button', { name: '用户菜单：侧栏用户' });
        expect(trigger.closest('[data-slot="sidebar-footer"]')).not.toBeNull();
        expect(within(trigger).getByText(profile.user.username)).toBeInTheDocument();
        let menu = await openMenu(user);
        expect(within(menu).getByText(profile.user.displayName)).toBeInTheDocument();
        expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual([
            i18n.t('account.settings'), i18n.t('nav.dashboard'), i18n.t('nav.projects'),
            i18n.t('nav.tutorial'),
        ]);
        await user.click(within(menu).getByRole('menuitem', { name: i18n.t('account.settings') }));
        expect(onOpenAccount).toHaveBeenCalledOnce();
        for (const [label, path] of [
            ['nav.dashboard', '/dashboard'], ['nav.projects', '/projects'],

        ]) {
            menu = await openMenu(user);
            await user.click(within(menu).getByRole('menuitem', { name: i18n.t(label) }));
            expect(onNavigate).toHaveBeenLastCalledWith(path);
        }
    });
    it('keeps the collapsed avatar accessible from the keyboard', async () => {
        const { user } = renderSidebar();
        await user.click(screen.getByRole('button', { name: '折叠侧栏' }));
        const trigger = screen.getByRole('button', { name: '用户菜单：侧栏用户' });
        expect(trigger.closest('[data-state]')).toHaveAttribute('data-state', 'collapsed');
        trigger.focus();
        await user.keyboard('{Enter}');
        expect(await screen.findByRole('menu')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });
    it('closes the mobile sidebar and opens the online guide without using the app router', async () => {
        window.innerWidth = 390;
        const { user, onNavigate } = renderSidebar();
        await user.click(screen.getByRole('button', { name: '打开手机侧栏' }));
        expect(screen.getByTestId('mobile-open')).toHaveTextContent('true');
        const menu = await openMenu(user);
        const guide = within(menu).getByRole('menuitem', { name: '使用文档' });
        expect(guide).toHaveAttribute('href', 'https://jianglisoftware.com/tutorial');
        expect(guide).toHaveAttribute('target', '_blank');
        expect(guide).toHaveAttribute('rel', 'noopener noreferrer');
        await user.click(guide);
        expect(onNavigate).not.toHaveBeenCalled();
        expect(screen.getByTestId('mobile-open')).toHaveTextContent('false');
    });
    it('shows the local identity while its saved profile is loading',()=>{renderSidebar(null);expect(screen.getByRole('button',{name:i18n.t('desktopShell.userMenu')+'：'+i18n.t('desktopShell.localName')})).toBeEnabled();expect(screen.getByText(i18n.t('desktopShell.localOnly'))).toBeInTheDocument();expect(screen.queryByRole('button',{name:i18n.t('auth.login')})).not.toBeInTheDocument();});

});
