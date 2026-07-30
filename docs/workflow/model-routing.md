# Model Routing

The subagent files in `.claude/agents/` deliberately omit a `model` field. The
orchestrator selects a model per phase — through the Agent tool's `model`
parameter — so deep reasoning is spent on decisions and a smaller capable model
performs well-specified execution.

| Role and phase | Model | Rationale |
| --- | --- | --- |
| Developer plan/fix plan | `fable` | Architecture, ambiguity, complete issue-to-task mapping |
| Developer build | `fable` | Per user decision (2026-07-30): builds run on the deep-reasoning model |
| Developer self-test | `sonnet` | Run checks, inspect evidence, report defects |
| QA plan | `fable` | Build complete risk and acceptance coverage |
| QA test build | `sonnet` | Implement explicit tests and fixtures |
| QA run/triage/repair | `sonnet` | Execute and classify from concrete evidence |
| Design review | `fable` | Multi-source visual judgment and responsive review |

## Phase handoff

Use fresh phase agents when the model changes. Pass:

- current delivery iteration;
- exact phase;
- source and report paths;
- issue IDs;
- feedback addressed to that role;
- required output path.

Do not paste large logs or all source material into the prompt. The role reads
the files it needs and returns a concise path-based summary.

## Escalation

A `sonnet` phase may be retried with `fable` only when its report records:

1. the concrete unresolved ambiguity;
2. evidence already gathered;
3. why the existing plan cannot resolve it;
4. the narrow question for the stronger model.

Failures, long logs, or ordinary implementation difficulty alone do not justify
escalation.
