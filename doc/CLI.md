# CLI Reference

JiGong CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm Jigongai --help
```

First-time local bootstrap + run:

```sh
pnpm Jigongai run
```

Choose local instance:

```sh
pnpm Jigongai run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `Jigongai onboard` and `Jigongai configure --section server` set deployment mode in config
- runtime can override mode with `Jigong_DEPLOYMENT_MODE`
- `Jigongai run` and `Jigongai doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm Jigongai allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.Jigong`:

```sh
pnpm Jigongai run --data-dir ./tmp/Jigong-dev
pnpm Jigongai issue list --data-dir ./tmp/Jigong-dev
```

## Context Profiles

Store local defaults in `~/.Jigong/context.json`:

```sh
pnpm Jigongai context set --api-base http://localhost:3100 --company-id <company-id>
pnpm Jigongai context show
pnpm Jigongai context list
pnpm Jigongai context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm Jigongai context set --api-key-env-var-name Jigong_API_KEY
export Jigong_API_KEY=...
```

## Company Commands

```sh
pnpm Jigongai company list
pnpm Jigongai company get <company-id>
pnpm Jigongai company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm Jigongai company delete PAP --yes --confirm PAP
pnpm Jigongai company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `Jigong_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `Jigong_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm Jigongai issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm Jigongai issue get <issue-id-or-identifier>
pnpm Jigongai issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm Jigongai issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm Jigongai issue comment <issue-id> --body "..." [--reopen]
pnpm Jigongai issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm Jigongai issue release <issue-id>
```

## Agent Commands

```sh
pnpm Jigongai agent list --company-id <company-id>
pnpm Jigongai agent get <agent-id>
pnpm Jigongai agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a JiGong agent:

- creates a new long-lived agent API key
- installs missing JiGong skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `Jigong_API_URL`, `Jigong_COMPANY_ID`, `Jigong_AGENT_ID`, and `Jigong_API_KEY`

Example for shortname-based local setup:

```sh
pnpm Jigongai agent local-cli codexcoder --company-id <company-id>
pnpm Jigongai agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm Jigongai approval list --company-id <company-id> [--status pending]
pnpm Jigongai approval get <approval-id>
pnpm Jigongai approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm Jigongai approval approve <approval-id> [--decision-note "..."]
pnpm Jigongai approval reject <approval-id> [--decision-note "..."]
pnpm Jigongai approval request-revision <approval-id> [--decision-note "..."]
pnpm Jigongai approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm Jigongai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm Jigongai activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm Jigongai dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm Jigongai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.Jigong/instances/default`:

- config: `~/.Jigong/instances/default/config.json`
- embedded db: `~/.Jigong/instances/default/db`
- logs: `~/.Jigong/instances/default/logs`
- storage: `~/.Jigong/instances/default/data/storage`
- secrets key: `~/.Jigong/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
Jigong_HOME=/custom/home Jigong_INSTANCE_ID=dev pnpm Jigongai run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm Jigongai configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
