# GitHub Manager — Local Actix Web Repository Control Plane

A local-first fullstack application powered by **Actix Web 4 (Rust)** and **React + TypeScript (Vite)** for managing your GitHub repositories with a Personal Access Token (PAT).

---

## Capabilities

- **Token & Session Management**: Authenticate via `GITHUB_PAT` in `.env` or connect/switch tokens at runtime in the web UI. Inspect detected OAuth scopes (`X-OAuth-Scopes`), token source, and live GitHub REST API rate-limit quotas (`remaining / limit` + reset window).
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
This creates `.env` (if absent), installs & builds the frontend into `./web/dist`, and launches the Actix Web server at **`http://127.0.0.1:8080`**.

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

# Terminal 2 — Vite HMR dev server on http://localhost:5173 (proxies /api/v1 -> :8080)
cd web && npm run dev
```

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

Designed following the **AgencyOS-Inspired UI/UX Skill** adapted specifically to a developer repository control plane (*"Blueprint & Slate"*):
- **Palette & Contrast**: Verified WCAG 2.2 AA contrast (`>= 4.5:1` for text, `>= 3.0:1` for interactive borders & focus indicators) across Light, Dark, and System themes (`web/src/__tests__/contrast.test.ts`), with synchronous pre-paint theme initialization to prevent FOUC.
- **Typography**: Locally bundled `IBM Plex Sans` and `IBM Plex Mono` with `font-variant-numeric: tabular-nums` on counts, metrics, commit SHAs, sizes, and quota gauges.
- **Semantics & Keyboard Access**: Skip link, visible `:focus-visible` outlines, keyboard shortcuts (`/`, `c`, `[`), focus-trapped modals with `Escape` and focus restoration, WAI-ARIA `tablist`/`tab`/`tabpanel` arrow-key navigation, icon+label status badges (never color-only), `prefers-reduced-motion` support, and safeguarded type-to-confirm destructive actions.
