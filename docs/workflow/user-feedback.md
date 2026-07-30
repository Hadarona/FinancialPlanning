# User Feedback Protocol

Use this protocol only when workflow state is `awaiting_user_feedback`.

## Good enough

If the user says the result is good enough:

1. preserve the user's exact message;
2. snapshot the final developer, QA, and design reports;
3. record every unresolved product/design deviation as an accepted exception;
4. mark the delivery `accepted_with_exceptions`;
5. treat the current behavior and UI as the baseline for later regression;
6. close the delivery and hand off to the orchestrator's single-PR step.

Do not delete or rewrite the issue history.

## Continue

If the user asks to continue:

1. preserve the user's exact message;
2. require at least one addressed role: `developer`, `qa`, or `design`;
3. add exactly five to the delivery iteration limit;
4. expose the feedback only to the roles addressed;
5. resume with a new outer iteration.

Each delivery iteration still begins with the developer loop. If feedback is
addressed only to QA or design, the developer may produce a justified no-op
plan/build/test handoff before those roles apply the new context.

## Ambiguous routing

If a message materially changes behavior but does not identify which role
should apply it, ask one concise routing question. Do not broadcast ambiguous
feedback to all agents.

## Reopening an accepted baseline

Later feedback can reopen a previously accepted exception. Record the new
decision; never silently erase the earlier acceptance record.
