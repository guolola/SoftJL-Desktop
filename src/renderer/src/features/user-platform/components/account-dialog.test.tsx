// Covers supported settings navigation, retained drafts and connection settings requests.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { i18n } from '../../../shared/i18n/i18n';
import { AppI18nProvider } from '../../../shared/i18n/i18n-provider';
import { ThemeProvider } from '../../../shared/ui/theme-provider';
import { SidebarProvider } from '../../../shared/ui/sidebar';
import { invalidateProviderConfigCache } from '../services/provider-config-cache';
import { AccountDialog } from './account-dialog';
const user={id:'local',username:'Admin',displayName:'Admin',status:'active',mfaEnabled:false};
function openSettings(request=0){return render(<AppI18nProvider><ThemeProvider><SidebarProvider><AccountDialog initialUser={user} onNavigate={vi.fn()} globalSettingsRequestId={request}/></SidebarProvider></ThemeProvider></AppI18nProvider>);}
beforeEach(()=>{localStorage.clear();invalidateProviderConfigCache();vi.stubGlobal('fetch',vi.fn(async(url)=>Response.json(String(url).includes('/integrations')?{servers:[],skills:[]}:{providerConfigs:[]})));});
it('shows only profile, models, MCP and Skills and opens profile by default', async () => {
  openSettings();
  await userEvent.click(screen.getByRole('button', { name: i18n.t('account.settings') }));
  const dialog = await screen.findByRole('dialog');
  const navigation = within(dialog).getByRole('tablist', { name: i18n.t('account.settings') });
  const tabs = within(navigation).getAllByRole('tab');
  expect(tabs.map(tab => tab.textContent)).toEqual([
    'account.profile', 'account.block37.models', 'integrations.mcpTitle', 'integrations.skillsTitle',
  ].map(key => i18n.t(key)));
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  for (const key of ['account.block37.theme', 'account.block37.layout', 'account.block37.language', 'desktopShell.workbench']) {
    expect(within(dialog).queryByRole('tab', { name: i18n.t(key), hidden: true })).not.toBeInTheDocument();
  }
  expect(within(dialog).queryByRole('tab', { name: /MFA|安全设置|登录会话/ })).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(([url]) => /account\/(security|sessions|profile)/.test(String(url)))).toBe(false);
});

it('preserves a profile draft across pages and allows resetting it', async () => {
  openSettings();
  await userEvent.click(screen.getByRole('button', { name: i18n.t('account.settings') }));
  const dialog = await screen.findByRole('dialog');
  const name = within(dialog).getByLabelText(i18n.t('account.displayName'));
  await userEvent.clear(name);
  await userEvent.type(name, '新的昵称');
  expect(within(dialog).getByRole('button', { name: i18n.t('account.block37.save') })).toBeEnabled();
  await userEvent.click(within(dialog).getByRole('tab', { name: i18n.t('account.block37.models') }));
  await userEvent.click(within(dialog).getByRole('tab', { name: i18n.t('account.profile') }));
  expect(name).toHaveValue('新的昵称');
  expect(within(dialog).getByRole('status')).toHaveTextContent(i18n.t('account.block37.unsaved'));
  expect(vi.mocked(fetch).mock.calls.some(([url]) => /account\/profile/.test(String(url)))).toBe(false);
  await userEvent.click(within(dialog).getByRole('button', { name: i18n.t('account.block37.reset') }));
  expect(name).toHaveValue(user.displayName);
  expect(within(dialog).getByRole('button', { name: i18n.t('account.block37.save') })).toBeDisabled();
});
it('opens the model page for a connection settings request and closes on cancel',async()=>{openSettings(1);await userEvent.click(screen.getByRole('button',{name:i18n.t('account.settings')}));const dialog=await screen.findByRole('dialog');expect(within(dialog).getByRole('tab',{name:i18n.t('account.block37.models')})).toHaveAttribute('aria-selected','true');await userEvent.click(within(dialog).getByRole('button',{name:i18n.t('account.block37.cancel')}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();});

it('keeps every desktop settings category reachable with the keyboard', async () => {
  openSettings();
  await userEvent.click(screen.getByRole('button', { name: i18n.t('account.settings') }));
  const dialog = await screen.findByRole('dialog');
  const navigation = within(dialog).getByRole('tablist', { name: i18n.t('account.settings') });
  const tabs = within(navigation).getAllByRole('tab');
  tabs[0].focus();
  for (const tab of tabs.slice(1)) {
    await userEvent.keyboard('{ArrowDown}');
    expect(tab).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(tab).toHaveAttribute('aria-selected', 'true')); 
  }
});
