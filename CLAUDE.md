# Budget Tracker

A family budget tracking application used by Chris and his wife (Sarah). It automatically captures credit card transactions from bank emails, displays them in an Android app, and tracks weekly spending against a budget.

## How It Works

- All purchases are made on a credit card, which triggers email notifications to a monitored inbox.
- The server parses incoming emails to extract the merchant and amount, then creates a transaction record.
- Push notifications are sent to both users' devices when a new transaction is processed.
- The Android app displays the current week's transactions and remaining budget.

## Budget Logic

- Budget is **weekly**. Each week starts fresh with a base allowance plus any carryover.
- **Carryover**: Any surplus or deficit at end of week rolls into the next week. For example, ending the week at -$30 with a $400 weekly budget means $370 available next week.
- **Ignored transactions**: A transaction tagged as "ignored" is excluded from budget calculations. Ignoring a $25 transaction when $100 remains raises the available balance to $125.
- **One-time balance**: A separate discretionary balance pool tracked independently of the weekly budget.

## Architecture

Two independent services + one mobile app:

```
server/
  api/      - Express HTTP server (port 9999)
  mail/     - IMAP listener that parses bank emails and creates transactions
app/        - Expo React Native app (Android only)
```

Both server services share the same MongoDB database and codebase. They are run as separate processes.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| API framework | Express.js |
| Database | MongoDB |
| Scheduling | cron |
| Email | IMAP + mailparser |
| Push notifications | Expo Server SDK |
| Date/time | dayjs (timezone: America/Edmonton) |
| Mobile | React Native (Expo), Android only |
| Language | TypeScript (server: 3.9.10, app: 5.1.3) |

## Data Model

**Transaction** — a single spending event
- `amount`, `date`, `description`, `owner` (Chris or Sarah)
- `tags[]` — category labels
- `ignored` — if true, excluded from budget calculations

**Tag** — a label that can be applied to transactions
- `name`
- `ignore` — if true, transactions with this tag are excluded from budget
- `defaults[]` — default tags auto-applied based on rules

**Balance** — weekly snapshot
- `weekOf` — start date of the week
- `amount` — remaining balance at end of that week (used for carryover)

**OneTime** — discretionary balance pool
- `balance` — current amount

**Device** — push notification registration
- `token` — Expo push token

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/week?date=YYYY-MM-DD` | Current week budget + transactions |
| GET | `/history` | All weekly balance snapshots |
| POST | `/transaction` | Update transaction (tags, ignored) |
| POST | `/transaction/split?newAmount=X` | Split a transaction into two |
| GET | `/transaction/sum-monthly` | Sum spending by tag for a date range |
| GET | `/tags/recent` | Recently used tags (for autocomplete) |
| GET | `/one-time/balance` | Get discretionary balance |
| POST | `/device` | Register device push token |

## Scheduled Jobs

- **Monday midnight** — Calculate and snapshot end-of-week balance, carry surplus/deficit into next week
- **1st of month** — Increase one-time balance by configured amount
- **Friday** — Allowance updates

## Key Files

- `server/lib/config.ts` — Timezone, cron schedules, weekly budget amount
- `server/lib/models.ts` — All data model interfaces
- `server/lib/balances.ts` — Balance carryover calculation logic
- `server/mail/inbox.ts` — Email polling and transaction creation
- `server/mail/notifications.ts` — Push notification dispatch
- `server/api/routes/budget.ts` — Core budget API routes
- `app/lib/screens/transactions/index.tsx` — Main app screen
- `app/lib/models.ts` — Shared TypeScript interfaces for the app

## General Code Guidelines

- Strict typing throughout. Prefer `unknown` over `any`. Treat state as readonly/immutable where possible.
- Object property names are **lowerCamelCase** in TS, JSON, and config files alike. The only place snake_case is allowed is when a contract is owned by an external system (third-party API request/response bodies, etc.).
- Single quotes for string literals. If a string contains an apostrophe, use backticks (`) instead of double quotes to avoid escaping.
- Dates as ISO-8601 UTC; align DTOs with server contracts. This codebase uses `dayjs` for date handling (timezone `America/Edmonton`).
- Log liberally via `console.log` / `console.warn` / `console.error` for external calls, state transitions, errors, and significant decisions.
- **Use the path aliases defined in each subproject's `tsconfig.json` instead of long relative paths.** `app/` declares `@lib/*` and `@assets/*`; `server/` declares `@root/*`, `@lib/*`, and `@api/*`. Sibling (`./bar`) and same-folder (`'.'`) imports stay relative. Single-step parent imports (`'../bar'`) are tolerated but aliases are preferred. Any specifier containing two or more `../` traversals should be rewritten through an alias.

## Shell commands

- Never prepend `cd <current-directory>` to a command. The working directory is already correct — run the command directly. Prepending `cd` triggers a separate permission prompt for every invocation.
- For commands that need a different cwd, prefer the tool's `--cwd` flag over `cd && …`, and **use a relative path** (`./server`, not the absolute path) so the permission matcher can pre-approve by prefix. The canonical form for `bun` is **always** `bun --cwd=./<dir> run <command>` with the equals sign and the leading `./` — e.g. `bun --cwd=./server run api:run`. Do not write the space form (`bun --cwd ./server …`) or omit the `./` prefix.
- `git` always operates on the current working tree — never prefix git commands with `cd`.
- **No compound commands.** Don't chain shell expressions with `&&`, `||`, or `;` — each Bash call should run exactly one logical command so the permission matcher can pre-approve it by prefix. The only exception is `git commit -m "$(cat <<'EOF' … EOF)"` heredoc for multi-line messages — that's still one logical command.
- **No `| tail` / `| head` / `2>&1` redirection.** The Bash tool already captures stdout + stderr in full. Trimming output in the shell triggers a fresh permission prompt for every distinct compound; if a result is too long for context, truncate it when summarizing rather than in the pipe.

## Running package.json scripts

- **Always invoke package.json scripts as `bun --cwd=./<dir> run <script>`** — never the bare `bun --cwd=./<dir> <script>` form. The bare form invokes Bun's own subcommands (e.g. `bun test` runs Bun's native test runner, not the `test` script).
- If a one-off command isn't already a script, **add it to the relevant `package.json` first** and then call it via `run`. Don't sprinkle ad-hoc `bun <command>` invocations across the codebase — each fresh shape triggers a permission prompt and erodes the allow-list discipline.

Current scripts:

| Subproject | Script | Purpose |
|---|---|---|
| `server/` | `api:run` | Run the Express API with `--watch` reload |
| `server/` | `mail:run` | Run the IMAP mail listener with `--watch` reload |
| `server/` | `database` | Open a `mongosh` shell against the running database container |
| `app/` | `start` | Launch the Expo dev client |
| `app/` | `build:dev` / `build:prod` | Local EAS builds for dev / prod APKs |
| `app/` | `build:dev:remote` / `build:prod:remote` | Cloud EAS builds |
| `app/` | `log` | Stream `react-native log-android` output |

## Testing

Test runners aren't wired up yet — there's no `test` or `type-check` script in either subproject. When tests are added, follow these conventions:

- **Every change to a code file requires matching test coverage** — new behavior gets new tests, modified behavior gets updated tests. A change isn't complete until the tests cover it.
- Tests are behavior-driven acceptance tests. Verify via observable behavior (return values, rendered output), not by inspecting internal state.
- For UI tests, query elements by visible text, placeholder, or label — never by test IDs.
- Don't mock first-party components when rendering them in tests. Mock at external boundaries (network, time, third-party SDKs).
- Place test files alongside the source they test, named `test.ts` or `test.tsx`.
- **Folder-per-tested-subject.** Anything that requires tests gets its own folder. The subject is `index.(ts|tsx)`; the test is `.test.(ts|tsx)` inside the same folder. Hook folder names drop the `use-` prefix (the export inside is still `useSystem`). Plain modules that have no tests (type declarations, trivial factory functions) stay as flat files.

## Tickets

Tickets are tracked in **Plane**, across two projects:

- `budget_tracker_api` (`BTAPI-XXX` keys) — back end work: API routes, mail listener, IMAP parsing, push notifications, MongoDB models, cron jobs, server config.
- `budget_tracker_app` (`BTAPP-XXX` keys) — front end work: React Native screens, UI components, app state, Expo configuration.

Categorization is via labels, not work-item types — every ticket gets exactly one of Epic / Feature / Bug.

If a ticket spans both subprojects, create two separate tickets — one per project — and link them with `mcp__plane__create_work_item_relation`.

**Don't create or update tickets unless explicitly asked**, except for state transitions tied to workflow actions (e.g., moving to `Done` after a PR merges).

## Git workflow

- **Main branch**: `main`
- **Branch naming**: `(feature|bug)/<short-description>` — e.g., `feature/imap-reconnect`, `bug/duplicate-transaction`. Keep descriptions lowercase, hyphenated. When tied to a ticket, the convention is `feature/<KEY-XXX>` or `bug/<KEY-XXX>` (e.g. `feature/BTAPI-12`, `bug/BTAPP-7`).
- **Commit messages**: short and direct. Include the ticket reference (`BTAPI-XXX` or `BTAPP-XXX`) when the work is tied to a ticket (e.g., `BTAPI-12: Retry IMAP connection after timeout`, `BTAPP-7: Fix splitting math for ignored transactions`).
- **PR title**: short and descriptive. Prefix with `[BTAPI-XXX]` or `[BTAPP-XXX]` when there's a ticket.
- **PR body**: link the ticket if there is one. Brief summary of the change. No template required.
- After a PR for a ticket merges, update the ticket's state to `Done` via `mcp__plane__update_work_item`.

## Working in subprojects

When per-subproject conventions diverge, they belong in nested `CLAUDE.md` files:

- `server/CLAUDE.md` — backend-specific conventions (Mongo schema patterns, mail-parsing rules, cron-job structure). Not present yet; add when conventions warrant it.
- `app/CLAUDE.md` — client-specific conventions (Expo / React Native patterns, screen layout, navigation). Not present yet; add when conventions warrant it.
