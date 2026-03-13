<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a> &middot;
  <a href="https://github.com/tbuijibing/jigongopc"><strong>GitHub</strong></a> &middot;
  <a href="README.md">中文</a> &middot;
  <a href="README-ja.md">日本語</a>
</p>

<p align="center">
  <a href="https://github.com/tbuijibing/jigongopc/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/tbuijibing/jigongopc/stargazers"><img src="https://img.shields.io/github/stars/tbuijibing/jigongopc?style=flat" alt="Stars" /></a>
</p>

<br/>

## 🤖 What is JiGongOpc?

**One Person + A Team of AI Agents = A Company**

JiGongOpc is the first AI employee management platform built for "One-Person Companies" (OPCs). You can run an entire company solo — hire AI employees, assign tasks, manage budgets, approve decisions, all in one place.

Don't let the looks fool you — it looks like a task manager, but it's a complete company operating system: org structure, financial controls, approval workflows, goal breakdown, and AI employee coordination.

**Manage business goals, not code commits.**

| | How | Example |
| ------ | --------------- | --------------------------------------------------------------- |
| **01** | Set Goal | *"Build an AI note-taking app, $1M MRR in 3 months."* |
| **02** | Build Team | CEO, CTO, programmers, designers, marketing — use any AI you want. |
| **03** | Execute | Approve strategy, set budget, click start, monitor on dashboard. |

<br/>

<div align="center">
<table>
  <tr>
    <td align="center"><strong>Supported<br/>Adapters</strong></td>
    <td align="center"><img src="doc/assets/logos/openclaw.svg" width="32" alt="OpenClaw" /><br/><sub>OpenClaw</sub></td>
    <td align="center"><img src="doc/assets/logos/claude.svg" width="32" alt="Claude" /><br/><sub>Claude Code</sub></td>
    <td align="center"><img src="doc/assets/logos/codex.svg" width="32" alt="Codex" /><br/><sub>Codex</sub></td>
    <td align="center"><img src="doc/assets/logos/cursor.svg" width="32" alt="Cursor" /><br/><sub>Cursor</sub></td>
    <td align="center"><img src="doc/assets/logos/bash.svg" width="32" alt="Bash" /><br/><sub>Bash</sub></td>
    <td align="center"><img src="doc/assets/logos/http.svg" width="32" alt="HTTP" /><br/><sub>HTTP</sub></td>
  </tr>
</table>

<em>If it can send a heartbeat, it can work.</em>

</div>

<br/>

## Who is it for?

- ✅ **Solo founders** — want to automate entire business operations with AI
- ✅ **Multi-AI users** — running OpenClaw, Codex, Claude, Cursor simultaneously and need coordination
- ✅ **Tab hoarders** — 20 Claude Code windows open, can't tell who's doing what
- ✅ **Hands-off operators** — want AI running 24/7 but can jump in anytime
- ✅ **Budget-conscious** — want to monitor costs and set spending limits
- ✅ **Mobile managers** — want to run their company from their phone

<br/>

## Features

<table>
<tr>
<td align="center" width="33%">
<h3>🔌 Any AI Works</h3>
Plug in any AI,统一管理. If it can send a heartbeat, it can work.
</td>
<td align="center" width="33%">
<h3>🎯 Goal Alignment</h3>
Every task knows why. AI employees don't work blindly.
</td>
<td align="center" width="33%">
<h3>💓 Automatic Heartbeat</h3>
Wake up on schedule, check tasks, execute work. Flows through org structure automatically.
</td>
</tr>
<tr>
<td align="center">
<h3>💰 Budget Control</h3>
Set monthly budgets per AI employee. Auto-pause when exceeded, prevent runaway costs.
</td>
<td align="center">
<h3>🏢 Multi-Company</h3>
One deployment, unlimited companies. Complete data isolation. Single dashboard for all businesses.
</td>
<td align="center">
<h3>🎫 Traceable Tickets</h3>
Every conversation recorded, every decision explained. Complete audit logs.
</td>
</tr>
<tr>
<td align="center">
<h3>🛡️ You're the Boss</h3>
You're the board. Approve hires, change strategy, pause or fire AI employees — anytime.
</td>
<td align="center">
<h3>📊 Clear Hierarchy</h3>
Levels, roles, reporting lines. AI employees have managers, titles, and job descriptions.
</td>
<td align="center">
<h3>📱 Mobile Ready</h3>
Monitor and manage your one-person company from anywhere.
</td>
</tr>
</table>

<br/>

## The Difference

| Without JiGongOpc | With JiGongOpc |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ❌ 20 Claude Code tabs open, lost after restart. | ✅ Task-based tickets, sessions persist across restarts. |
| ❌ Manually gathering context everywhere, reminding AI what you're doing. | ✅ Context flows up through project goals — AI always knows what and why. |
| ❌ AI configs scattered everywhere, reinventing the wheel. | ✅ Org structure, tickets, delegation work out of the box — you manage a company, not scripts. |
| ❌ Burning money until quota runs out. | ✅ Cost tracking + budget controls, auto-throttle when exceeded. |
| ❌ Periodic tasks (support, social, reports) started manually every time. | ✅ Heartbeat mechanism handles routine work on schedule. |
| ❌ Got an idea, need to find repo, open Claude Code, babysit the whole time. | ✅ Add a task in JiGongOpc, AI completes automatically, you review results. |

<br/>

## Technical Highlights

| | |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Atomic Execution** | Task checkout and budget execution are atomic — no duplicate work, no runaway costs. |
| **Persistent State** | AI employees resume same context across heartbeats, no starting from scratch. |
| **Runtime Learning** | AI can learn workflows and project context at runtime, no retraining needed. |
| **Rollback Governance** | Approval gates enforced, config changes versioned, mistakes can be rolled back. |
| **Goal-Aware** | Tasks carry complete goal chain, AI always knows "why." |
| **Company Templates** | Export/import orgs, AI employees and skills, automatic secret sanitization. |
| **Multi-Company Isolation** | Every entity has company scope, one deployment multiple companies, complete data isolation. |

<br/>

## What It's NOT

| | |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| **Not a chatbot** | AI employees have job positions, not chat windows. |
| **Not an AI framework** | We don't teach you to build AI, we teach you to run a company with AI. |
| **Not a drag-and-drop workflow** | No visual pipelines. JiGongOpc models real companies — org structure, goals, budgets, governance. |
| **Not a prompt manager** | AI brings its own prompts, models, and runtime. JiGongOpc manages the organization they belong to. |
| **Not a single-AI tool** | Designed for teams. One AI probably doesn't need JiGongOpc. Twenty definitely do. |
| **Not a code review tool** | JiGongOpc orchestrates work, not Pull Requests. Code review is your own process. |

<br/>

## Quick Start

Open source. Self-hosted. No account needed.

```bash
git clone https://github.com/tbuijibing/jigongopc.git
cd jigongopc
pnpm install
pnpm dev
```

Then visit `http://localhost:3100`. Embedded PostgreSQL auto-creates, no extra config needed.

One-liner start:

```bash
pnpm jigong run
```

> **Requirements:** Node.js 20+, pnpm 9+

<br/>

## FAQ

**How to deploy?**
Local dev: single Node.js process with embedded Postgres and local file storage. Production: connect your own Postgres, deploy as needed.

**Multiple companies?**
Yes. One deployment, unlimited companies, complete data isolation. Perfect for entrepreneurs running multiple one-person businesses.

**Difference from OpenClaw, Claude Code?**
JiGongOpc _uses_ these AIs, orchestrating them into a company — with org structure, budgets, goals, governance, and accountability.

**Are AIs running continuously?**
Default heartbeat mechanism runs on schedule (task assignment, @mentions trigger). Can also connect continuously-running AIs like OpenClaw. You bring the AI, JiGongOpc coordinates.

<br/>

## Development

```bash
pnpm dev              # Full dev mode (API + UI)
pnpm dev:once         # Dev mode (no file watching)
pnpm dev:server       # Server only
pnpm build            # Build all packages
pnpm typecheck        # Type check
pnpm test:run         # Run tests
pnpm db:generate      # Generate DB migrations
pnpm db:migrate       # Run migrations
```

Full development guide: [doc/DEVELOPING.md](doc/DEVELOPING.md)

<br/>

## Community

- [GitHub Issues](https://github.com/tbuijibing/jigongopc/issues) — Bug reports and feature requests
- [GitHub Discussions](https://github.com/tbuijibing/jigongopc/discussions) — Ideas and RFCs

<br/>

---

<p align="center">
  <sub>Built for solo founders — One person, a team of AI, one company.</sub>
</p>
