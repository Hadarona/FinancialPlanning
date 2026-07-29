# Course Project Rules

These instructions apply to the entire repository. They translate the course requirements into enforceable working rules for human contributors and AI coding agents.

## 1. Operating priorities

Use this priority order for all decisions:

1. Preserve user data, secrets, and existing work.
2. Satisfy mandatory course requirements.
3. Keep the application correct, secure, and testable.
4. Deliver work in small, reviewable increments.
5. Complete bonus requirements only after related mandatory work is complete.

If a request conflicts with a mandatory requirement, explain the conflict and propose a compliant alternative. Do not silently weaken tests, security, logging, or required evidence.

## 2. Required workflow for every change

Before editing:

1. Read this file and any more specific nested `AGENTS.md`.
2. Read the relevant `README.md`, user story, code, tests, and dependency manifest.
3. Inspect the Git working tree and preserve unrelated user changes.
4. Confirm the acceptance criteria and identify which course requirements the change affects.
5. Keep the change limited to one feature, bug fix, refactor, or documentation task.

While editing:

1. Follow the repository's existing architecture, naming, formatting, and error conventions.
2. Prefer the smallest complete solution.
3. Update tests, logging, security controls, documentation, and license records together with the implementation.
4. Avoid unrelated cleanup or broad refactoring.
5. Never expose, overwrite, or delete user work without explicit authorization.

Before handoff:

1. Compare the result with every acceptance criterion.
2. Run the relevant test and quality commands.
3. Review the diff for unrelated files, secrets, generated output, and missing documentation.
4. Report exactly what changed, what was tested, command results, and any remaining limitation.
5. Never claim that a test, review, branch, board item, license check, or requirement is complete without evidence.

Do not create branches, commit, push, open pull requests, modify a remote board, or publish anything unless the user requests that action.

## 3. Development environment and repository

- Develop and verify the project on Linux or macOS.
- Keep all project source within one clearly named project directory.
- Maintain a root `README.md`.
- Use Git for version control.
- Name the primary branch `main`.
- Develop every feature and bug fix on its own branch.
- Upload only necessary project files to GitHub.

Use lowercase hyphenated branch names:

- `feature/<short-name>`
- `bugfix/<short-name>`
- `refactor/<short-name>`
- `test/<short-name>`
- `docs/<short-name>`

Never implement a feature or bug fix directly on `main`.

## 4. Files that must exist

Maintain these files when applicable:

- `README.md`: project purpose, features, architecture summary, prerequisites, setup, run, test, coverage, build, and environment-variable names
- The ecosystem's dependency manifest, such as `package.json`, `pyproject.toml`, or `requirements.txt`
- `ALL_LICENSES`: third-party libraries and their licenses
- `.gitignore`: local, generated, sensitive, and operating-system artifacts
- A generated lockfile, such as `package-lock.json`, when supported
- A progress record containing completed work, decisions, tools, methods, and lessons learned
- A requirements traceability record mapping each requirement to evidence

Never commit:

- Real `.env` files or secrets
- Tokens, passwords, private keys, connection strings, or credentials
- Dependency directories such as `node_modules`
- Virtual environments
- Build output, caches, coverage output, or temporary files unless explicitly required
- Runtime log files
- Local databases or uploaded test data
- Editor-specific or operating-system files
- Debug dumps or unrelated generated artifacts

Provide a sanitized `.env.example` when environment variables are required. Include names and safe examples or descriptions, never real values.

## 5. README standard

The root `README.md` must allow a new reviewer to run the project without guessing. Include:

1. Project name and concise purpose
2. User-facing capabilities
3. Technology stack
4. Prerequisites for Linux or macOS
5. Installation command
6. Environment-variable setup
7. Database setup or migration command when applicable
8. Development and production run commands
9. Unit-test command
10. API integration-test command when present
11. Coverage command and current measured result when present
12. Lint, type-check, and build commands when configured
13. API overview or a link to API documentation
14. Project structure
15. Security and logging notes
16. License information

Only document commands that exist and have been verified against repository configuration.

## 6. Agile and progress evidence

Divide work into small tasks that can be implemented, tested, and reviewed independently.

Each task must contain:

- Short title
- Type: feature, bug, refactor, documentation, test, or bonus
- User story: `As a <user>, I want <capability>, so that <value>.`
- Observable acceptance criteria
- Explicit out-of-scope items
- Validation plan
- Required evidence

Use a Kanban or Agile board with at least:

- Backlog
- Ready
- In Progress
- In Review
- Done

Keep only one substantial task in progress per contributor unless parallel work is intentionally planned. Record status changes over time. When marking a task done, attach test, pull-request, documentation, or screenshot evidence as appropriate.

Record important:

- Design decisions and tradeoffs
- Tools and methods used
- Problems encountered and their resolution
- New concepts learned
- Requirement or bonus item satisfied

## 7. Dependencies and third-party code

- Use the repository's package manager.
- Prefer a maintained external library when it clearly reduces custom code, risk, or complexity.
- Do not add a dependency for trivial behavior that is clearer in a few local lines.
- Before adding a package, check compatibility, maintenance status, security posture, transitive impact, and license.
- Install dependencies through the package manager; do not edit a generated lockfile manually.
- Commit the dependency manifest.
- Commit the generated lockfile when supported.
- Pin or constrain versions according to ecosystem conventions.
- Remove unused dependencies.

Update `ALL_LICENSES` in the same change whenever dependencies change. For each direct third-party package, record:

- Package name
- Installed or constrained version
- License name
- Official package or source URL

List transitive licenses when the selected license-reporting tool supports it. Do not list the operating system, runtime, or programming language as a package dependency.

## 8. Testing rules

Meaningful unit tests are mandatory.

Unit tests must cover:

- Typical success behavior
- Boundary values
- Invalid or missing input
- Expected error behavior
- A regression case for each bug fix

Test behavior and public contracts rather than private implementation details. Keep tests deterministic, isolated, independent of execution order, and safe to run repeatedly.

For API changes, add a real HTTP integration test whenever the bonus integration-test requirement is being pursued. The request must pass through routing, middleware, validation, controller or handler, persistence boundaries, and error handling. Calling the endpoint function directly does not count.

API integration tests should cover, when relevant:

- Success status and response schema
- Validation failure
- Missing resource
- Duplicate or conflict behavior
- Authentication failure
- Authorization failure
- Persistence side effects
- Safe error response

Use an isolated test database or reversible fixtures. Never run destructive tests against development or production data.

Run validation in this order:

1. New or changed tests
2. Related test group
3. API integration tests
4. Full test suite
5. Coverage
6. Lint
7. Type-check
8. Build

Use the repository's configured commands. Do not invent script names.

### Coverage bonus

- Configure a coverage tool appropriate to the stack.
- Target at least 70% aggregate line or statement coverage.
- Record the exact command and current result.
- Inspect uncovered critical paths even when the numeric target passes.
- Do not inflate coverage with empty assertions, irrelevant tests, or unjustified exclusions.

## 9. Logging rules

Use the project's logging library rather than scattered debug prints.

Every server request must generate at least one useful log entry. For API requests, include when available:

- Timestamp
- Severity
- HTTP method
- Route or normalized path
- Response status
- Duration
- Request or correlation ID

Log errors with enough context to diagnose them. Configure API logs to be persisted to an external log file, and exclude generated log files from Git. If the instructor approves a different external logging destination, document that decision and its evidence.

Never log:

- Passwords
- Authentication or session tokens
- Authorization headers
- Session cookies
- Private keys or connection strings
- Full sensitive request or response bodies
- Unnecessary personal data

Prefer structured logs. Avoid duplicate request logs, misleading success messages, and excessive noise.

## 10. Security rules

Treat all external input as untrusted, including request bodies, query parameters, route parameters, headers, uploaded files, environment variables, and database content rendered in a browser.

- Validate type, format, length, allowed values, and required fields at the system boundary.
- Normalize only after validation rules are understood.
- Use parameterized queries or the configured ORM.
- Never concatenate untrusted input into database, shell, path, or template commands.
- Prevent mass assignment by selecting allowed fields explicitly.
- Enforce authorization on the server for protected resources.
- Keep authentication and authorization separate.
- Use least privilege for database and service credentials.
- Store secrets in environment variables or an approved secret store.
- Do not expose stack traces, query details, internal paths, or secrets in client errors.
- Apply secure CORS, cookie, session, upload, and rate-limit settings when relevant.
- Review new dependencies for known vulnerabilities using an ecosystem-appropriate audit tool.
- Never weaken a security control merely to make a test pass.

### Basic authentication bonus

If username/password authentication is implemented:

- Hash passwords on the server with a password-hashing algorithm intended for passwords.
- Never store, return, or log plaintext passwords.
- Validate unique identities and enforce reasonable password rules.
- Return generic authentication failures that do not reveal whether an account exists.
- Protect authenticated routes with server-side middleware.
- Test successful login, failed login, invalid input, protected access, and authorization boundaries.
- Do not use Basic HTTP Authentication unless the project explicitly requires that protocol; "basic authentication mechanism" normally means a simple username/password login flow.

## 11. Code review and pull requests

- Use a pull request for every substantial feature or bug fix.
- At least three major changes must have documented code reviews.
- Keep each pull request focused on one user story.
- Include the reason, behavior change, test evidence, security impact, logging impact, dependency and license changes, screenshots or API examples when useful, and known limitations.
- Review every changed line for correctness, maintainability, tests, security, logging, secrets, dependencies, licenses, and unnecessary files.
- Address review comments with code changes or a clear technical explanation.
- Do not silently ignore unresolved review feedback.
- Do not merge while mandatory checks or blocking review findings remain unresolved.

Prioritize review findings as:

1. Blocking: data loss, security vulnerability, broken required behavior, failing required tests, leaked secret
2. Major: incorrect edge behavior, missing validation, unreliable test, missing required logging or evidence
3. Minor: maintainability, naming, documentation, or low-risk improvement

## 12. Definition of done

A task is done only when all applicable items are true:

- Acceptance criteria are satisfied.
- The change is small and focused.
- Input and error behavior are safe.
- Unit tests were added or updated and pass.
- Real HTTP integration tests were added when applicable to the selected bonus scope.
- Coverage was measured when the coverage bonus is pursued.
- Required request and error logging is present.
- Logs persist to the configured file and exclude sensitive data.
- Dependency files and `ALL_LICENSES` are current.
- README and project-tracking evidence are current.
- No secrets, logs, caches, dependencies, coverage output, or system files are tracked.
- Lint, type-check, and build pass when configured.
- Pull-request and review requirements are satisfied for substantial work.
- Review comments are addressed.
- Exact verification evidence is recorded.

## 13. Requirement status vocabulary

Use only:

- `PASS`: direct evidence fully satisfies the requirement
- `PARTIAL`: some evidence exists, but a material part is missing
- `FAIL`: evidence shows the requirement is not satisfied
- `NOT VERIFIED`: required evidence is unavailable or the check was not run
- `NOT APPLICABLE`: the requirement genuinely does not apply, with a written reason

Track mandatory and bonus requirements separately. A missing bonus must not turn a mandatory requirement into a failure.

## 14. Project skills

Use these focused skills when their workflow applies:

- `$course-project-plan-work`: convert a requirement, feature, or bug into a small user story, branch plan, validation plan, and progress evidence
- `$course-project-implement-change`: implement a secure, logged, tested, documented, and reviewable project change
- `$course-project-test-api`: design and run unit tests, real HTTP API integration tests, and coverage checks
- `$course-project-audit-readiness`: audit every mandatory and bonus requirement and produce an evidence-backed remediation plan

Use the minimum set needed for the current task. For a new feature, the normal sequence is planning, implementation, testing, then readiness audit.

## 15. Mandatory and bonus summary

Mandatory:

- Linux or macOS development
- Project directory and descriptive `README.md`
- Git with `main` as the primary branch
- Separate branch for every feature or bug fix
- Only necessary files uploaded to GitHub
- Unit tests
- Appropriate third-party library use
- `ALL_LICENSES`
- Package manager and dependency manifest
- Small Agile tasks, user stories, board, and progress evidence
- Pull requests, at least three major code reviews, and addressed comments
- Useful request and error logs, with API logs saved externally
- Secure code, especially for user input

Bonus:

- At least 70% measured code coverage
- Real HTTP API integration tests
- Generated lockfile or reproducible frozen Python dependencies
- Open-source contribution
- Basic username/password authentication

Complete mandatory work before investing in bonus work.
