import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

describe('GitHub Manager Fullstack UI Workflows & Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            server: 'actix-web',
            version: '0.1.0',
            github_api_base: 'https://api.github.com',
            env_token_present: false,
            session_token_present: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/auth/status')) {
        return new Response(
          JSON.stringify({
            authenticated: false,
            token_source: 'none',
            scopes: [],
            api_base: 'https://api.github.com',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: { message: 'Not mocked' } }), { status: 404 });
    });
  });

  it('opens mobile navigation, traps focus, and restores focus on escape', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375, writable: true });
    render(<App />);
    const open = await screen.findByRole('button', { name: 'Open navigation menu' });
    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Navigation menu' });
    const close = within(dialog).getByRole('button', { name: 'Close navigation menu' });
    expect(close).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: /Token & Connection/i })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();
    expect(open).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    window.innerWidth = 1024;
  });

  it('keeps compact sidebar destinations accessible and expands again', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Collapse navigation rail' }));
    expect(screen.getByRole('button', { name: 'Repositories' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand navigation rail' }));
    expect(screen.getByRole('button', { name: 'Collapse navigation rail' })).toBeInTheDocument();
  });

  it('closes the mobile drawer when resized to desktop', async () => {
    const user = userEvent.setup();
    window.innerWidth = 375;
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
    act(() => {
      window.innerWidth = 1024;
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument());
  });

  it('shows honest unconfigured PAT state on initial boot and labels Sample Workspace clearly', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /Connect GitHub Personal Access Token/i, level: 1 })
    ).toBeInTheDocument();

    const sampleBtn = screen.getByRole('button', {
      name: /Explore Sample Workspace \(Demo Data\)/i,
    });
    await user.click(sampleBtn);

    // Verify persistent Demo Data disclosure banner
    expect(await screen.findByText(/SAMPLE WORKSPACE · DEMO DATA/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Repository Ledger', level: 1 })).toBeInTheDocument();
  });

  it('supports quick-editing repository name, visibility, and description from the ledger', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole('button', { name: /Explore Sample Workspace \(Demo Data\)/i })
    );
    await screen.findByText('github-manager');

    await user.click(
      screen.getByRole('button', { name: /Quick edit demo-maintainer\/github-manager/i })
    );

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/Repository Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'github-control-plane');

    const visSelect = within(dialog).getByLabelText(/Visibility/i);
    await user.selectOptions(visSelect, 'private');

    const descInput = within(dialog).getByLabelText(/Description/i);
    await user.clear(descInput);
    await user.type(descInput, 'Updated local Actix Web repository manager');

    await user.click(within(dialog).getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('github-control-plane')).toBeInTheDocument();
    expect(screen.getByText('Updated local Actix Web repository manager')).toBeInTheDocument();
  });

  it('enforces exact owner/repo phrase before enabling destructive repository deletion', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole('button', { name: /Explore Sample Workspace \(Demo Data\)/i })
    );
    await screen.findByText('legacy-webhook-relay');

    await user.click(
      screen.getByRole('button', { name: /Delete demo-maintainer\/legacy-webhook-relay/i })
    );

    const dialog = await screen.findByRole('dialog');
    const deleteConfirmBtn = within(dialog).getByRole('button', {
      name: /Permanently Delete Repository/i,
    });
    expect(deleteConfirmBtn).toBeDisabled();

    const confirmInput = within(dialog).getByLabelText(/Type .* to confirm/i);
    await user.type(confirmInput, 'wrong-name');
    expect(deleteConfirmBtn).toBeDisabled();

    await user.clear(confirmInput);
    await user.type(confirmInput, 'demo-maintainer/legacy-webhook-relay');
    expect(deleteConfirmBtn).toBeEnabled();

    await user.click(deleteConfirmBtn);
    await waitFor(() => {
      expect(screen.queryByText('legacy-webhook-relay')).not.toBeInTheDocument();
    });
  });

  it('supports keyboard ArrowRight navigation across deep repository workspace tabs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole('button', { name: /Explore Sample Workspace \(Demo Data\)/i })
    );

    await user.click(
      await screen.findByRole('button', {
        name: /Open full workspace for demo-maintainer\/edge-telemetry-rs/i,
      })
    );

    const generalTab = await screen.findByRole('tab', { name: /General & Metadata/i });
    expect(generalTab).toHaveAttribute('aria-selected', 'true');

    generalTab.focus();
    await user.keyboard('{ArrowRight}');

    const featuresTab = screen.getByRole('tab', { name: /Features & Merge/i });
    expect(featuresTab).toHaveAttribute('aria-selected', 'true');
    expect(featuresTab).toHaveFocus();
  });
});
