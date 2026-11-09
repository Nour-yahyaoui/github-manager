# GitHub Manager

**A local control plane for the work behind your GitHub repositories.** Search, edit, and manage repositories without bouncing between settings pages.

Built with Actix Web 4 (Rust) and React + TypeScript. Start at the landing page (`/`), then open the workspace (`/app`) to connect a GitHub Personal Access Token (PAT) or explore labeled sample data.

[Get started](#quick-start-local) · [Capabilities](#capabilities) · [Token permissions](#recommended-github-pat-scopes) · [API reference](#actix-web-rest-api-apiv1) · [Security](#security-and-operational-notes)

> This is a local development tool, not a hosted multi-user service. Keep the server on a trusted machine and network; repository operations can modify or delete real GitHub data.

---

## Capabilities

- **Multi-account workspaces**: Add GitHub accounts using PATs, switch from the header, and remove session accounts from Token & Connection. Each account request uses its own token; selections and repository data reset on switch. Inspect scopes and API quotas for the active account.
- **Sample Workspace (Demo Data)**: Clearly badged in-memory sample mode to preview workflows before connecting a real Personal Access Token.
- **Repository Ledger & Quick Edit**:
  - Filter by visibility (`Public`, `Private`), `Archived`, `Templates & Forks`, owner, language, or keyword (`/`); sort by push date, name, stars, open issues, or disk size.
  - **Slide-over Quick Edit** directly from the table to rename a repository, switch visibility (`public` ↔ `private`), update descriptions, edit homepage URLs, manage topics, or toggle archive status without losing ledger context.
- **Create Repository**: Personal or organization repositories with visibility selection, `.gitignore` and license templates, auto-init README, initial topics, and merge policy defaults.
- **Deep Single-Repository Control Workspace** (8 keyboard-accessible tabs):
  1. **General & Metadata**: Rename, visibility (with confirmation safeguard), description, homepage, topics, default branch, template toggle, and clone URL copy.
  2. **Features & Merge**: Toggle Issues, Projects, Wiki, Discussions, Squash/Merge/Rebase strategies, auto-merge, and automatic head branch deletion on merge.
  3. **Branches**: Inspect branch heads & protection flags, create branches from any ref SHA, rename branches, and delete non-default branches.
  4. **README & Files**: Browse root files and edit/commit `README.md` directly to GitHub.
  5. **Issues & PRs**: Filter open/closed items, create new issues, and close/reopen issues.
  6. **Releases**: View releases, publish new tags/releases (with optional auto-generated release notes), and delete releases.
  7. **Access & Webhooks**: Invite/update/remove collaborators and register, pause/enable, test-ping, or delete webhooks.
  8. **Danger Zone**: Archive/unarchive, transfer repository ownership, or permanently delete a repository (protected by exact `owner/repo` phrase confirmation).
- **Batch Operations**: Multi-select repositories to bulk-update visibility, append/replace topics, standardize feature & merge policies, archive/unarchive, or batch-delete (protected by `DELETE SELECTED` phrase confirmation).
- **Operational Session Audit Log**: Chronological log of every mutation performed during the local session.

---

## Quick Start (Local)

### Prerequisites
- **Rust** (`1.78+`, Cargo) — uses `rustls-tls` so no system OpenSSL C headers are required
- **Node.js** (`20+`, npm)

### 1. One-Command Local Launch
```bash
chmod +x scripts/start-local.sh
./scripts/start-local.sh
```
This creates `.env` (if absent), installs & builds the frontend into `./web/dist`, and launches the Actix Web server at **`http://127.0.0.1:8080`**. Open that address for the landing page, then choose **Open workspace**. No token is needed for the sample workspace.

### 2. Manual / Development Workflow
```bash
# Optional: set GITHUB_PAT in .env (or leave blank and enter it in the UI)
cp .env.example .env

# Build frontend & run single-port Actix Web server on :8080
cd web && npm install && npm run build && cd ..
cargo run
```
For frontend hot-module replacement alongside Actix Web:
```bash
# Terminal 1 — Actix Web API on http://127.0.0.1:8080
cargo run

# Terminal 2 — Vite HMR dev server on http://localhost:5173 (forwards /api/v1 to :8080 when available)
cd web && npm run dev
```

The Vite development server includes a server-side bridge: it forwards API requests to Actix when available and can handle them itself when Actix is unavailable. Its runtime token and audit log are separate from Actix. Vite binds to all interfaces by default in this project; use it only on a trusted network.

### Configuration

Copy `.env.example` to `.env` for the Actix server. `GITHUB_PAT` (or `GH_PAT`) is optional; `HOST` and `PORT` default to `127.0.0.1` and `8080`, `STATIC_DIR` defaults to `./web/dist`, and `GITHUB_API_BASE` defaults to GitHub's public API. `RUST_LOG` controls logging. The Vite bridge also accepts `ACTIX_URL` as its upstream address. See `.env.example` for details.

### Checks

```bash
cd web
npm ci
npm run typecheck
npm test
npm run build
# From the repository root, with Rust installed:
cargo test
```

### Working with multiple accounts

1. Open **Token & Connection**, enter a PAT, and select **Verify & Add Account**. The app verifies its GitHub identity before switching.
2. Add another PAT in the same panel. Re-adding a PAT for the same GitHub user replaces that user's session token.
3. Use the **Account** selector in the header to switch, or remove a session account from the account list. Switching clears the current selection and reloads that account's repositories. An already-started request remains associated with the account that started it; it is not cancelled by switching.
4. Accounts added in the UI exist only in the current browser tab's memory. Reloading or closing the tab requires adding those tokens again. Removing an account does not revoke its PAT; revoke it in GitHub if needed.

A token configured on the server via `.env` or the legacy session API appears as a **server configured** account. It is managed on the server and cannot be removed through the session account list. Server configuration is shared across tabs; avoid changing it while another tab is using it. The audit log is server-session-wide, not separated by account.

GitHub Manager supports the operations listed above, not every GitHub feature. Available actions depend on token permissions, repository access, GitHub policies, and API limits.

## Security and operational notes

- PATs added through the account UI are held in browser-tab memory and sent in an `X-GitHub-Token` header to the local server for each account request. They are not stored in localStorage or on disk by the app; browser extensions or scripts with page access may still access them. Legacy runtime tokens are held in server process memory; a token set in `.env` is stored on disk. Do not commit or share `.env`. Clearing a server runtime token does not remove a configured environment token.
- The API is intended for local use and does not provide multi-user authentication. Do not expose it or the Vite development server to untrusted networks. The server's CORS policy is not an authentication boundary.
- Use the minimum token permissions and repository access required for your task. GitHub organization policies and token type may further restrict operations. Revoke a compromised token on GitHub.
- Sample workspace data is in memory and is not a backup. The session audit log is operational history, not a durable security audit. Confirm destructive operations carefully.

### Troubleshooting

- **The server shows an API-only page:** run `cd web && npm ci && npm run build`, then reload.
- **Authentication or permissions fail:** check the token, expiration, repository selection, organization authorization, and permissions in GitHub; reconnect it in the workspace.
- **Port already in use:** change `PORT` in `.env`; if using Vite alongside Actix, set `ACTIX_URL` to the matching server URL when starting Vite.
- **Rate limited:** inspect the quota in the workspace and wait for the reset or use a token with an appropriate quota.

---

## Recommended GitHub PAT Scopes

- **Classic PAT (`ghp_…`)**:
  - `repo` — Read/write public & private repository settings, branches, contents, issues, and releases
  - `delete_repo` — Required only if permanently deleting repositories
  - `admin:repo_hook` — Manage repository webhooks
  - `read:org` — List organizations when creating organization repositories
- **Fine-Grained PAT (`github_pat_…`)**:
  - **Administration**: Read & write
  - **Contents**: Read & write
  - **Issues & Pull requests**: Read & write
  - **Metadata**: Read-only
  - **Webhooks**: Read & write

---

## Actix Web REST API (`/api/v1`)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Server health & latest rate-limit snapshot |
| `GET` | `/api/v1/auth/status` | Validate active PAT, user profile, scopes & rate limit |
| `POST` | `/api/v1/auth/token` | Verify & store PAT in local runtime session memory |
| `DELETE` | `/api/v1/auth/token` | Clear runtime session PAT |
| `GET` | `/api/v1/orgs` | List organizations for the authenticated user |
| `GET` | `/api/v1/repos` | List repositories (`owner,collaborator,organization_member`) |
| `POST` | `/api/v1/repos` | Create a personal or organization repository |
| `GET` | `/api/v1/repos/{owner}/{repo}` | Inspect single repository |
| `PATCH` | `/api/v1/repos/{owner}/{repo}` | Update name, visibility, description, homepage, features, merge policies, default branch, or archive state |
| `DELETE` | `/api/v1/repos/{owner}/{repo}` | Permanently delete repository |
| `GET` / `PUT` | `/api/v1/repos/{owner}/{repo}/topics` | Get or replace repository topics |
| `POST` | `/api/v1/repos/{owner}/{repo}/transfer` | Transfer repository ownership |
| `GET` / `POST` | `/api/v1/repos/{owner}/{repo}/branches` | List or create branches |
| `POST` | `/api/v1/repos/{owner}/{repo}/branches/rename` | Rename branch |
| `DELETE` | `/api/v1/repos/{owner}/{repo}/branches/{branch}` | Delete branch ref |
| `GET` | `/api/v1/repos/{owner}/{repo}/readme` | Get UTF-8 decoded README |
| `GET` / `PUT` | `/api/v1/repos/{owner}/{repo}/contents/{path}` | Browse contents or commit UTF-8 file updates |
| `GET` / `POST` / `PATCH` | `/api/v1/repos/{owner}/{repo}/issues[/{number}]` | List, open, or update issues |
| `GET` / `POST` / `DELETE` | `/api/v1/repos/{owner}/{repo}/releases[/{id}]` | List, publish, or delete releases |
| `GET` / `PUT` / `DELETE` | `/api/v1/repos/{owner}/{repo}/collaborators[/{username}]` | Manage collaborators |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/v1/repos/{owner}/{repo}/hooks[/{id}]` | Manage & ping webhooks |
| `POST` | `/api/v1/bulk/repos` | Execute batch operations across selected repositories |
| `GET` / `DELETE` | `/api/v1/audit` | Read or clear the session operational audit log |

---

## UI/UX & Accessibility Design Notes

Designed following the **AgencyOS-Inspired UI/UX Skill** adapted specifically to a developer repository control plane (*"Graphite & Electric Blue"*):
- **Palette & Contrast**: Verified WCAG 2.2 AA contrast (`>= 4.5:1` for text, `>= 3.0:1` for interactive borders & focus indicators) across Light, Dark, and System themes (`web/src/__tests__/contrast.test.ts`), with synchronous pre-paint theme initialization to prevent FOUC.
- **Typography**: Locally bundled `IBM Plex Sans` and `IBM Plex Mono` with `font-variant-numeric: tabular-nums` on counts, metrics, commit SHAs, sizes, and quota gauges.
- **Semantics & Keyboard Access**: Skip link, visible `:focus-visible` outlines, keyboard shortcuts (`/`, `c`, `[`), focus-trapped modals with `Escape` and focus restoration, WAI-ARIA `tablist`/`tab`/`tabpanel` arrow-key navigation, icon+label status badges (never color-only), `prefers-reduced-motion` support, and safeguarded type-to-confirm destructive actions.
