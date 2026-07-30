# Budgeting App

This repository starts with the product/design sources and the Claude Code
multi-agent workflow needed to build the complete app in a single delivery
cycle, shipped as one pull request. The application stack is React,
Node.js/Express, and PostgreSQL (hosted on Neon).

## Start the agent workflow

Requirements: Linux or macOS, Node.js 20+, npm, Git, and Claude Code.

```bash
npm run workflow:validate
npm run workflow:status
```

Open Claude Code at the repository root and use:

```text
Run the budgeting-app roadmap from the current workflow state. Use the
configured developer, qa-engineer, and design-reviewer subagents, follow
CLAUDE.md, and stop only at a user-feedback checkpoint or project completion.
```

The orchestrator will:

1. build the entire roadmap scope in one delivery cycle on the
   `feature/budgeting-app` branch;
2. route high-reasoning planning and design review to Fable;
3. route implementation and test execution to Sonnet;
4. require independent functional QA and design review;
5. stop after five unsuccessful delivery iterations for user feedback;
6. open exactly one pull request to `main` when the delivery gate closes.

## Workflow commands

```bash
npm run workflow:init       # only if workflow state is absent
npm run workflow:start      # create the next iteration workspace
npm run workflow:evaluate   # evaluate final role reports
npm run workflow:status     # show current state and next action
npm run workflow:validate   # validate sources, config, state, and reports
npm run test:workflow       # test the state controller
```

See `docs/workflow/orchestration.md` for the lifecycle and
`docs/workflow/artifact-contract.md` for role report formats.

The delivery build expands this README with the actual frontend, backend,
PostgreSQL/Neon, environment, test, and clean-install commands.
