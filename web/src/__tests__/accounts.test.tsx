import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { demoStore, DEMO_USER } from '../api/sampleData';

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('account workspaces', () => {
  const calls: Array<{ url: string; token?: string }> = [];
  beforeEach(() => {
    localStorage.setItem('ghm-onboarding-complete-v1', 'yes');
    calls.length = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
      const url = String(input);
      const token = (options?.headers as Record<string, string> | undefined)?.['X-GitHub-Token'];
      calls.push({ url, token });
      if (url.includes('/auth/status')) {
        if (token === 'invalid') return response({ error: { message: 'Invalid token', status: 401 } }, 401);
        if (!token) return response({ authenticated: false, token_source: 'none', scopes: [], api_base: 'https://api.github.com' });
        const login = token === 'token-a' ? 'alice' : 'bob';
        return response({ authenticated: true, token_source: 'request_header', scopes: [], api_base: 'https://api.github.com', user: { ...DEMO_USER, login, id: login === 'alice' ? 1 : 2 } });
      }
      if (url.includes('/repos?')) {
        const login = token === 'token-a' ? 'alice' : 'bob';
        const repo = (await demoStore.listRepos())[0];
        return response([{ ...repo, name: `${login}-project`, full_name: `${login}/${login}-project`, owner: { ...repo.owner, login } }]);
      }
      if (url.includes('/orgs') || url.includes('/audit')) return response([]);
      if (url.includes('/health')) return response({ status: 'ok', server: 'actix-web', version: '0.1.0', github_api_base: 'https://api.github.com', env_token_present: false, session_token_present: false });
      return response({ error: { message: 'Not mocked', status: 404 } }, 404);
    });
  });
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem('ghm-onboarding-complete-v1'); });

  it('adds, switches and removes session accounts without persisting tokens or carrying selections', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Personal Access Token'), 'token-a');
    await user.click(screen.getByRole('button', { name: 'Verify & Add Account' }));
    await screen.findByText('alice-project');
    await user.click(screen.getByLabelText('Select alice/alice-project'));
    expect(screen.getByRole('region', { name: 'Selected repositories actions' })).toHaveTextContent('1 repository selected');
    await user.click(screen.getByRole('button', { name: 'Token & Connection' }));
    await user.type(screen.getByLabelText('Personal Access Token'), 'token-b');
    await user.click(screen.getByRole('button', { name: 'Verify & Add Account' }));
    await screen.findByText('bob-project');
    expect(screen.queryByText('alice-project')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Selected repositories actions' })).not.toBeInTheDocument();
    expect(calls.filter((call) => call.url.includes('/repos?')).map((call) => call.token)).toEqual(expect.arrayContaining(['token-a', 'token-b']));
    expect(JSON.stringify(localStorage)).not.toContain('token-a');
    expect(JSON.stringify(localStorage)).not.toContain('token-b');
    expect(calls.some((call) => call.url.endsWith('/auth/token'))).toBe(false);
    await user.selectOptions(screen.getByLabelText('Switch GitHub account'), 'account:1');
    await screen.findByText('alice-project');
    expect(screen.queryByText('bob-project')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Token & Connection' }));
    const panel = screen.getByRole('region', { name: 'GitHub accounts' });
    await user.click(within(panel).getByRole('button', { name: 'Remove @alice' }));
    await screen.findByText('bob-project');
    expect(screen.getByLabelText('Switch GitHub account')).toHaveValue('account:2');
  });

  it('keeps the current account when token verification fails', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Personal Access Token'), 'token-a');
    await user.click(screen.getByRole('button', { name: 'Verify & Add Account' }));
    await screen.findByText('alice-project');
    await user.click(screen.getByRole('button', { name: 'Token & Connection' }));
    await user.type(screen.getByLabelText('Personal Access Token'), 'invalid');
    await user.click(screen.getByRole('button', { name: 'Verify & Add Account' }));
    await waitFor(() => expect(screen.getAllByText('Invalid token').length).toBeGreaterThan(0));
    expect(screen.getByLabelText('Switch GitHub account')).toHaveValue('account:1');
  });
});
