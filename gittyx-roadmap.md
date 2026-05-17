# gittyx-roadmap

# GittyX AI — Product Roadmap

> **Focus:** Git history intelligence — understanding how a codebase *changed over time and why.* **Goal:** Make GittyX the best tool in the world for querying, exploring, and understanding git history using AI
> 

---

## 📋 Table of Contents

1. [Phase 1 — Foundation & Setup UX](about:blank#phase-1--foundation--setup-ux)
2. [Phase 2 — Data Layer Rebuild](about:blank#phase-2--data-layer-rebuild)
3. [Phase 3 — Agent Intelligence](about:blank#phase-3--agent-intelligence)
4. [Phase 4 — UI Redesign](about:blank#phase-4--ui-redesign)
5. [Phase 5 — Entry Points & Distribution](about:blank#phase-5--entry-points--distribution)
6. [Tech Stack Decisions](about:blank#tech-stack-decisions)
7. [Killer Demo Queries](about:blank#killer-demo-queries)

---

## Phase 1 — Foundation & Setup UX

> **Timeline:** 2–3 weeks
**Goal:** A developer should go from `npm install -g gittyx-ai` to seeing results in under 60 seconds, with zero prior configuration required.
> 

### Context

The current flow interrogates users with 5+ prompts before showing any value. This is the biggest conversion killer. The fix is a smart config system that auto-detects the environment and asks nothing unless it has to.

---

### 1.1 — Zero-config startup

**Goal:** `gittyx analyze` just works on first run.

- [ ]  Create a `gittyx.config.json` schema with all options documented
- [ ]  On first run, auto-detect whether Ollama is running locally (`GET http://localhost:11434/api/tags`)
- [ ]  If Ollama detected → default to local mode, prompt only for model name (with a suggested default like `llama3.2`)
- [ ]  If `GEMINI_API_KEY` env var found → default to Gemini online mode, no prompts
- [ ]  If `OPENAI_API_KEY` env var found → default to OpenAI online mode, no prompts
- [ ]  If nothing detected → show a single clean prompt: “No AI provider found. Set GEMINI_API_KEY or OPENAI_API_KEY, or install Ollama.” with links
- [ ]  Write the resolved config to `gittyx.config.json` in the repo root (gitignored by default)
- [ ]  On subsequent runs, read from `gittyx.config.json` and skip all prompts entirely
- [ ]  Add a `gittyx config` command to edit the config interactively after initial setup
- [ ]  Add a `gittyx config --show` command to print the current resolved config

---

### 1.2 — CLI output polish

**Goal:** The terminal output should feel professional, not debug-y.

- [ ]  Remove all `[INFO]`, `[DEBUG]`, `[WARN]` prefixed log lines from default output — those should only appear with a `-verbose` flag
- [ ]  Replace the current progress bars with a clean single-line spinner during analysis: `⠸ Analysing 247 commits...`
- [ ]  Show a clean summary table when analysis completes:
    
    ```
    ✓ GittyX analysis complete
    
      Commits analysed   247
      Files indexed      1,842
      Time taken         43s
    
    → Dashboard: http://localhost:49251
    ```
    
- [ ]  Add a `-verbose` / `v` flag that restores the detailed logging for debugging
- [ ]  Add a `-quiet` / `q` flag that suppresses all output except the final URL
- [ ]  Show a warning (not an error) if the repo has no tags — explain that `compareEpochs` won’t work without them
- [ ]  Catch and display a clean error if the current directory is not a git repository

---

### 1.3 — Incremental analysis

**Goal:** Re-running `gittyx analyze` on an already-analysed repo should only process new commits, not start from scratch.

- [ ]  On startup, read the existing cache and find the hash of the most recently analysed commit
- [ ]  Run `git log` only from that hash onwards to get new commits
- [ ]  Append new commits to the existing SQLite database (see Phase 2) without touching old records
- [ ]  Update the overall summary and chart config only if new commits were found
- [ ]  Show the user how many new commits were found: `→ 12 new commits since last analysis`
- [ ]  Add a `-full` flag to force a complete re-analysis from scratch when needed
- [ ]  Add a `-since <date>` flag to analyse commits from a specific date onwards

---

### 1.4 — Error handling

**Goal:** Every possible failure should produce a helpful, human-readable message.

- [ ]  Wrap all AI provider calls in typed error classes (`GeminiError`, `OllamaError`, `OpenAIError`)
- [ ]  If an API call fails with an auth error → print the exact env var that is missing or invalid
- [ ]  If Ollama is unreachable → print `Ollama is not running. Start it with: ollama serve`
- [ ]  If a model is not found in Ollama → print the exact `ollama pull <model>` command needed
- [ ]  If the repo has fewer than 5 commits → warn the user that analysis quality will be limited
- [ ]  If rate limits are hit → implement exponential backoff (2s, 4s, 8s) with a visible countdown
- [ ]  Add a `-dry-run` flag that validates config and connectivity without running full analysis

---

## Phase 2 — Data Layer Rebuild

> **Timeline:** 2–3 weeks (can run in parallel with Phase 1)
**Goal:** Replace flat JSON files with a proper structured database that enables real analytical queries.
> 

### Context

The current `gittyx.json` flat file approach will break on repos with 1000+ commits (slow reads, no query capability, memory bloat). SQLite via `better-sqlite3` gives you a proper relational store with zero infrastructure overhead — it’s still a single file on disk, just queryable.

---

### 2.1 — SQLite database setup

- [ ]  Install `better-sqlite3` and `@types/better-sqlite3`
- [ ]  Create `cli/db/schema.ts` that defines and creates all tables on first run
- [ ]  Store the database at `.git/gittyx.db` (same location as current JSON, gitignored by default)
- [ ]  Write a migration system so schema changes can be applied to existing databases without data loss
- [ ]  Create a `cli/db/client.ts` that exports a singleton database connection
- [ ]  Add indexes on `commit_hash`, `author_email`, `committed_at`, and `file_path` columns
- [ ]  Write a `cli/db/migrate.ts` script that reads the old `gittyx.json` and imports existing data into the new schema
- [ ]  Keep the old JSON as a backup until the migration is confirmed successful

---

### 2.2 — Core schema: `commits` table

**Stores one row per commit — the envelope plus derived fields.**

- [ ]  Column: `hash TEXT PRIMARY KEY` — full 40-char SHA
- [ ]  Column: `short_hash TEXT` — first 7 chars (stored for display performance)
- [ ]  Column: `message TEXT` — full commit message including body
- [ ]  Column: `message_subject TEXT` — first line of commit message only
- [ ]  Column: `author_name TEXT`
- [ ]  Column: `author_email TEXT` — canonical identity field (use this for grouping, not name)
- [ ]  Column: `committed_at TEXT` — ISO 8601 format
- [ ]  Column: `authored_at TEXT` — may differ from committed_at on rebased commits
- [ ]  Column: `is_merge INTEGER` — 0 or 1 flag for merge commits
- [ ]  Column: `parent_hashes TEXT` — JSON array of parent SHAs (allows branch reconstruction)
- [ ]  Column: `raw_diff TEXT` — full diff output, stored for semantic search
- [ ]  Column: `ai_summary TEXT NULLABLE` — populated after LLM summarisation pass
- [ ]  Column: `issue_refs TEXT` — JSON array of extracted issue/PR references e.g. `[{"type":"issue","ref":"123"}]`
- [ ]  Column: `is_trivial INTEGER` — 0 or 1, pre-computed from trivial pattern matching
- [ ]  Column: `analysed_at TEXT NULLABLE` — timestamp of when AI summary was generated

---

### 2.3 — Core schema: `commit_files` table

**Stores one row per file per commit — the most important table for file-centric queries.**

- [ ]  Column: `id INTEGER PRIMARY KEY AUTOINCREMENT`
- [ ]  Column: `commit_hash TEXT REFERENCES commits(hash)`
- [ ]  Column: `file_path TEXT` — current path of the file in this commit
- [ ]  Column: `old_path TEXT NULLABLE` — previous path if this was a rename operation
- [ ]  Column: `change_type TEXT` — one of: `added`, `modified`, `deleted`, `renamed`, `copied`
- [ ]  Column: `lines_added INTEGER`
- [ ]  Column: `lines_deleted INTEGER`
- [ ]  Column: `file_extension TEXT` — derived from path, e.g. `ts`, `py`, `md`
- [ ]  Column: `is_test_file INTEGER` — 0 or 1, derived from path patterns (`.test.*`, `spec*`, `tests/`)
- [ ]  Column: `is_config_file INTEGER` — 0 or 1, derived from path patterns
- [ ]  Add composite index on `(file_path, commit_hash)` for fast file history lookups
- [ ]  Write parser that extracts this from raw git diff output at ingest time
- [ ]  Handle renamed files: follow the `rename from` / `rename to` diff headers

---

### 2.4 — Core schema: `dependency_events` table

**Stores one row per dependency change — enables “when did we add/remove X” queries.**

- [ ]  Column: `id INTEGER PRIMARY KEY AUTOINCREMENT`
- [ ]  Column: `commit_hash TEXT REFERENCES commits(hash)`
- [ ]  Column: `manifest_file TEXT` — e.g. `package.json`, `requirements.txt`, `Cargo.toml`
- [ ]  Column: `package_name TEXT` — e.g. `react`, `express`, `lodash`
- [ ]  Column: `old_version TEXT NULLABLE` — null if this was an add
- [ ]  Column: `new_version TEXT NULLABLE` — null if this was a removal
- [ ]  Column: `change_type TEXT` — one of: `added`, `removed`, `upgraded`, `downgraded`
- [ ]  Column: `is_dev_dependency INTEGER` — 0 or 1 (for package.json devDependencies)
- [ ]  Write parser for `package.json` diffs — handle both `dependencies` and `devDependencies` keys
- [ ]  Write parser for `requirements.txt` diffs — handle `==`, `>=`, `~=` version specifiers
- [ ]  Write parser for `Cargo.toml` diffs
- [ ]  Write parser for `go.mod` diffs
- [ ]  Write parser for `pom.xml` diffs (basic — look for `<version>` tag changes in `<dependency>` blocks)
- [ ]  Write parser for `Gemfile` diffs
- [ ]  Only run dependency parsing when the changed file path matches a known manifest filename

---

### 2.5 — Core schema: `tags` table

**Stores version anchors for epoch-based queries.**

- [ ]  Column: `name TEXT PRIMARY KEY` — e.g. `v1.0.0`
- [ ]  Column: `commit_hash TEXT REFERENCES commits(hash)`
- [ ]  Column: `tag_message TEXT NULLABLE` — body of annotated tags
- [ ]  Column: `tagger_name TEXT NULLABLE`
- [ ]  Column: `tagged_at TEXT NULLABLE`
- [ ]  Column: `is_annotated INTEGER` — 0 or 1
- [ ]  Run `git tag -l --format='%(refname:short)|%(objectname:short)|%(subject)|%(creatordate:iso)'` to collect tag data at ingest
- [ ]  Parse and insert all tags into this table on every analysis run
- [ ]  Add a `gittyx tags` CLI command that lists all tags with their commit and message

---

### 2.6 — Analytics index: `file_stats` table

**Pre-computed per-file analytics — rebuilt on each analysis run.**

- [ ]  Column: `file_path TEXT PRIMARY KEY`
- [ ]  Column: `total_commits INTEGER` — how many commits touched this file
- [ ]  Column: `total_lines_added INTEGER`
- [ ]  Column: `total_lines_deleted INTEGER`
- [ ]  Column: `churn_score REAL` — computed as `(lines_added + lines_deleted) / max(1, age_in_days)`
- [ ]  Column: `unique_authors INTEGER` — count of distinct author emails who touched this file
- [ ]  Column: `first_seen_at TEXT` — date of the commit where this file was added
- [ ]  Column: `last_changed_at TEXT` — date of the most recent commit touching this file
- [ ]  Column: `primary_author_email TEXT` — author with the most commits touching this file
- [ ]  Column: `is_high_risk INTEGER` — 0 or 1, computed from churn_score + unique_authors heuristic
- [ ]  Write a `computeFileStats()` function that runs after every ingestion pass and refreshes this table
- [ ]  Add a SQL view `high_risk_files` that joins `file_stats` with `commits` for easy querying

---

### 2.7 — Update vector store to use SQLite

- [ ]  Move vector embeddings from `gittyx_vectors.json` into a `vectors` table in the same SQLite database
- [ ]  Column: `id TEXT PRIMARY KEY` — e.g. `abc1234_chunk_0`
- [ ]  Column: `commit_hash TEXT`
- [ ]  Column: `chunk_index INTEGER`
- [ ]  Column: `content TEXT` — the text that was embedded
- [ ]  Column: `embedding BLOB` — store as binary (use `Float32Array` serialised to `Buffer`)
- [ ]  Column: `model TEXT` — which embedding model was used (so cached embeddings are invalidated if model changes)
- [ ]  Rewrite `LocalVectorStore` to use `better-sqlite3` for reads/writes
- [ ]  Add a `SELECT` query that loads all embeddings for a given model into memory on startup (cosine search still happens in-process)
- [ ]  Test performance on a repo with 1000 commits — should load in < 500ms

---

## Phase 3 — Agent Intelligence

> **Timeline:** 3–4 weeks
**Goal:** The agent should be able to answer complex historical questions by chaining tools intelligently, and every answer should cite the specific commits that support it.
> 

---

### 3.1 — Structured tool calling

**Goal:** Replace prompt-based JSON extraction with native tool/function calling APIs.

- [ ]  Rewrite `AgentRouter` to use OpenAI function calling format for all providers
- [ ]  Define each tool as a JSON Schema object with strict input/output types
- [ ]  Implement tool calling for `GeminiProvider` using Gemini’s function declarations API
- [ ]  Implement tool calling for `OpenAIProvider` using OpenAI’s `tools` parameter
- [ ]  Implement tool calling for `OllamaProvider` — use prompt-based JSON as fallback since Ollama model support varies
- [ ]  Add input validation for every tool — reject malformed inputs with a clear error before calling the tool
- [ ]  Add output validation — verify every tool returns the expected shape before passing to the LLM
- [ ]  Write unit tests for each tool using a small fixture git repo

---

### 3.2 — New tool: `whenDidXChange`

**Answers:** “When did we switch from X to Y?” / “When was X introduced?”

- [ ]  Accept a natural language `query` string (e.g. “Redis”, “authentication middleware”, “TypeScript”)
- [ ]  Run semantic search over `commits.raw_diff` and `commits.ai_summary` using the existing vector store
- [ ]  Also run a SQL query on `dependency_events` if the query looks like a package name
- [ ]  Also run a SQL query on `commit_files.file_path` if the query looks like a filename
- [ ]  Return: array of matching commits ordered by relevance, each with `hash`, `date`, `author`, `summary`, `relevant_excerpt`
- [ ]  Test with: “when did we add TypeScript”, “when was Redis removed”, “when did we switch to Postgres”

---

### 3.3 — New tool: `getFileEvolution`

**Answers:** “How has this file changed over time?” / “Walk me through the history of auth.ts”

- [ ]  Accept a `filepath` string
- [ ]  Resolve renamed file paths using the `commit_files.old_path` column chain — follow renames backwards
- [ ]  Query `commit_files` joined with `commits` to get all commits that touched this file, ordered by date
- [ ]  Group commits into “epochs” — periods of related activity separated by gaps of > 30 days
- [ ]  For each epoch, generate an AI summary of what changed and why (use the commit messages + diffs)
- [ ]  Return: array of epochs, each with `start_date`, `end_date`, `commit_count`, `primary_author`, `summary`, `commits[]`
- [ ]  Cache the epoch summaries in a new `file_epoch_summaries` table to avoid re-generating on every query

---

### 3.4 — New tool: `getHotspots`

**Answers:** “Which files are the most dangerous to touch?” / “What are the most unstable parts of the codebase?”

- [ ]  Query the `file_stats` table ordered by `churn_score DESC`
- [ ]  Filter to only include files that still exist (not deleted)
- [ ]  Filter out test files and config files by default (add a `include_tests` parameter)
- [ ]  For the top N files (default 10), join with `commits` to get the last 3 commit summaries for context
- [ ]  Return: array of files with `path`, `churn_score`, `total_commits`, `unique_authors`, `last_changed`, `recent_activity_summary`
- [ ]  Add a `since` date parameter to compute hotspots for a specific time window

---

### 3.5 — New tool: `getRiskScore`

**Answers:** “Is it safe to touch X?” / “How risky is changing the payment module?”

- [ ]  Accept a `filepath` string (or directory path — aggregate across all files under it)
- [ ]  Pull `churn_score`, `unique_authors`, `total_commits` from `file_stats`
- [ ]  Add test coverage signal: check if there’s a corresponding test file, and if so, whether it was updated alongside the source file in recent commits
- [ ]  Add recency signal: if the file has been touched in the last 14 days, boost the risk score
- [ ]  Compute a composite risk score from 0–100 using a weighted formula (document the weights)
- [ ]  Return: `score` (0–100), `risk_level` (`low`/`medium`/`high`/`critical`), `explanation` (plain English), `top_contributors`, `recent_commits[]`

---

### 3.6 — New tool: `compareEpochs`

**Answers:** “What fundamentally changed between v1 and v2?” / “What happened in Q1 vs Q2?”

- [ ]  Accept `from` and `to` — each can be a tag name, a commit hash, or an ISO date string
- [ ]  Resolve tags to commit hashes using the `tags` table
- [ ]  Query all commits between the two anchors ordered by date
- [ ]  Compute aggregate stats for the range: total commits, unique authors, files changed, lines added/deleted
- [ ]  Find top 5 most-changed files in this range from `commit_files`
- [ ]  Find all dependency changes in this range from `dependency_events`
- [ ]  Generate an AI narrative summary of the period using the commit summaries as input
- [ ]  Return: structured diff of the two periods with stats, file changes, dependency changes, and narrative

---

### 3.7 — New tool: `getContributorGraph`

**Answers:** “Who knows this codebase best?” / “Which parts of the repo does each person own?”

- [ ]  Query `commit_files` grouped by `author_email` and `file_path` to build an ownership matrix
- [ ]  Normalise author identities: group all emails belonging to the same person (heuristic: same name + different email domain → ask the LLM to merge)
- [ ]  For each author, compute: total commits, files owned (>50% of commits on that file), specialisation areas (top directories by commit count), activity timeline
- [ ]  Return: array of contributors with their ownership profile and activity timeline
- [ ]  Add a `file` parameter to get all contributors who have worked on a specific file, ordered by commit count

---

### 3.8 — Multi-step planner

**Goal:** Complex questions should trigger a chain of tool calls, not just one.

- [ ]  Add a `PlannerAgent` class in `cli/agent/planner.ts`
- [ ]  On receiving a query, first call the LLM with a planning prompt: “Given this question, what sequence of tools should I call to answer it? Return a JSON plan.”
- [ ]  Parse the plan and execute tool calls in sequence, passing the output of each as context to the next
- [ ]  After all tools have run, call the LLM once more with all context to synthesise a final answer
- [ ]  Limit plan length to 4 tool calls maximum to prevent runaway chains
- [ ]  Add a `-debug` flag that prints the full plan and each tool’s output to stderr before the final answer
- [ ]  Test with complex queries: “Why did performance get worse after v2.0?”, “Who should review changes to the auth module?”, “What’s the most dangerous thing to change right now?”

---

### 3.9 — Commit citations in answers

**Goal:** Every AI answer must cite the specific commits that support each claim.

- [ ]  Define a citation format: `[abc1234]` inline in the LLM response
- [ ]  Update all system prompts to instruct the LLM to always cite commits in this format when making historical claims
- [ ]  Write a `parseCitations(text: string): Citation[]` function that extracts `[hash]` references
- [ ]  In the server response, replace citation tokens with structured `<cite>` objects containing the full commit metadata
- [ ]  In the dashboard chat UI, render citations as clickable chips that open the commit diff in a side panel
- [ ]  Add a `gittyx verify` CLI command that checks whether the cited commits actually support the claims made

---

## Phase 4 — UI Redesign

> **Timeline:** 3–4 weeks
**Goal:** The dashboard should feel like a purpose-built git history explorer, not a generic analytics page.
> 

---

### 4.1 — Interactive timeline (replace Chart.js)

**Goal:** A zoomable, filterable timeline where every dot is a real commit with AI context on hover.

- [ ]  Install `d3` (already in package.json — confirm version compatibility)
- [ ]  Remove the Chart.js timeline and the `getTimelineChartConfig()` function
- [ ]  Build `src/components/timeline/Timeline.tsx` using D3 for rendering, React for state
- [ ]  Render each commit as a circle on a horizontal time axis, sized by `1 + log(files_changed)`
- [ ]  Cluster commits that fall on the same day into a vertical stack to avoid overplotting
- [ ]  Add a zoom/pan interaction using `d3-zoom` — scroll to zoom, drag to pan
- [ ]  On hover over a commit dot: show a tooltip with the AI summary, author, date, and files changed count
- [ ]  On click: open a right-side detail panel (see 4.2)
- [ ]  Render version tags as vertical dashed lines with the tag name label above the axis
- [ ]  Add a filter bar above the timeline with:
    - [ ]  Author dropdown (populated from unique authors in the repo)
    - [ ]  File path search (text input, filters commits that touched paths matching the input)
    - [ ]  Date range picker (from/to)
    - [ ]  “High risk only” toggle (filters to commits touching high-risk files)
- [ ]  Make the timeline responsive — use a ResizeObserver to redraw when the container width changes
- [ ]  Add a minimap below the main timeline showing the full history, with a brush to select the visible window

---

### 4.2 — Commit detail panel

**Goal:** Clicking a commit shows everything GittyX knows about it.**

- [ ]  Build `src/components/timeline/CommitPanel.tsx` as a slide-in right panel
- [ ]  Show: full commit message, author with avatar (use Gravatar hash from author email), date, files changed count
- [ ]  Show the AI summary in a highlighted block at the top
- [ ]  Show the list of files changed with their change type icons (+ added, ~ modified, - deleted, → renamed)
- [ ]  For each file changed: show lines added/deleted as a mini bar chart (green/red)
- [ ]  Show extracted issue references as clickable links (link to GitHub if remote is a GitHub URL)
- [ ]  Show the raw diff in a syntax-highlighted collapsible section (use `react-syntax-highlighter`)
- [ ]  Show “Related commits” — 3 most similar commits by AI summary (cosine similarity from the vector store)
- [ ]  Add a “Ask about this commit” button that pre-seeds the chat panel with context about this commit

---

### 4.3 — AI chat panel redesign

**Goal:** Citations, references, and a history sidebar that actually works.**

- [ ]  Redesign the chat input as a sticky bar at the bottom of the chat panel
- [ ]  Add suggested questions as chips above the input on first load (e.g. “What’s the riskiest file?”, “When was Redux added?”, “Who owns the auth module?”)
- [ ]  Render AI responses with inline citation chips `[abc1234]` styled as clickable pills
- [ ]  Clicking a citation chip highlights that commit on the timeline and opens the commit detail panel
- [ ]  Add a “thinking” state that shows which tools the agent is calling: `→ Searching commit history... → Analysing file evolution...`
- [ ]  Add a session sidebar that shows past conversations with their first message as the title
- [ ]  Add the ability to share a session as a permalink (encode the session ID in the URL hash)
- [ ]  Make the chat panel resizable — drag the left edge to make it wider or narrower

---

### 4.4 — File heatmap view (new page)

**Goal:** A treemap of the codebase where size = file size and colour = churn score.**

- [ ]  Add a “Files” tab to the dashboard navigation
- [ ]  Build `src/components/heatmap/FileHeatmap.tsx` using D3’s `treemap` layout
- [ ]  Fetch file stats from a new `/api/files` endpoint that returns `file_stats` data
- [ ]  Map `churn_score` to a colour ramp: low (green) → medium (amber) → high (red)
- [ ]  Size each rectangle by the number of commits touching the file (not file size — this is more meaningful)
- [ ]  Group files by directory with nested rectangles for the treemap structure
- [ ]  On hover: show a tooltip with filename, churn score, last author, last changed date
- [ ]  On click: open the file’s evolution in the commit detail panel (trigger `getFileEvolution` for this path)
- [ ]  Add a time range filter to see which files were hottest in the last 30/90/365 days

---

### 4.5 — Risk dashboard view (new page)

**Goal:** A prioritised list of high-risk files and areas with actionable context.**

- [ ]  Add a “Risk” tab to the dashboard navigation
- [ ]  Build `src/components/risk/RiskDashboard.tsx`
- [ ]  Show a summary row at the top: `X high-risk files · Y critical files · last updated Z`
- [ ]  Main table columns: File path, Risk score (0–100 with colour bar), Churn score, Unique authors, Last changed, Primary owner
- [ ]  Make each row expandable to show the last 3 commits that touched that file
- [ ]  Add a “Who should review this?” column that shows the top 2 contributors by commit count
- [ ]  Add filtering: by directory, by minimum risk score, by author
- [ ]  Add sorting on every column
- [ ]  Add a “Download risk report” button that exports the table as a CSV

---

### 4.6 — Contributor view (new page)

**Goal:** Understand who knows what in the codebase.**

- [ ]  Add a “Contributors” tab to the dashboard navigation
- [ ]  Show contributor cards with: avatar (Gravatar), name, total commits, primary files owned, active date range
- [ ]  Clicking a contributor shows their activity timeline and file ownership breakdown
- [ ]  Add a “Knowledge risk” indicator: contributors who are the sole owner of high-risk files are flagged
- [ ]  Add a “Bus factor” calculation: how many contributors could leave before key parts of the codebase have no owners

---

## Phase 5 — Entry Points & Distribution

> **Timeline:** 2 weeks
**Goal:** Get GittyX in front of developers in their existing workflows.
> 

---

### 5.1 — GitHub Action

**Goal:** A workflow that runs on PRs and posts a comment analysing what the changes touch historically.**

- [ ]  Create a `gittyx-action` directory with `action.yml`
- [ ]  The action should: check out the repo, run a lightweight `gittyx analyze --ci` mode, post a PR comment
- [ ]  The PR comment should include:
    - [ ]  List of files changed in this PR
    - [ ]  Risk score for each changed file
    - [ ]  Who last worked on these files (and when)
    - [ ]  AI summary of the historical context: “These files were last heavily modified during the v2.1 payment refactor”
    - [ ]  Flag if any changed file has no test coverage history
- [ ]  Make the action configurable via `with:` parameters: `ai_provider`, `risk_threshold`, `max_files_to_analyse`
- [ ]  Write the action in Node.js using `@actions/core` and `@actions/github`
- [ ]  Publish to the GitHub Actions Marketplace
- [ ]  Write a one-page setup guide: `GITHUB_ACTION_SETUP.md`

---

### 5.2 — VS Code extension

**Goal:** Inline git history intelligence while editing code.**

- [ ]  Scaffold the extension with `yo code` using the TypeScript template
- [ ]  Add a right-click context menu item: “Ask GittyX about this file’s history”
- [ ]  Implement a WebView panel that loads the GittyX dashboard filtered to the current file
- [ ]  Check if the GittyX server is already running locally; if not, start it as a child process
- [ ]  Add a GittyX sidebar panel with:
    - [ ]  File history summary for the currently open file (auto-updates on file switch)
    - [ ]  Last 5 commits touching this file with AI summaries
    - [ ]  Risk score badge for the current file
    - [ ]  “Ask a question” input that sends to the local GittyX server
- [ ]  Add CodeLens annotations above functions that show “Last changed by X — 23 days ago”
- [ ]  Publish to the VS Code Marketplace
- [ ]  Write the extension setup guide in the main `README.md`

---

### 5.3 — README and docs overhaul

- [ ]  Rewrite the README with a single hook sentence at the top: “GittyX answers questions about your git history using AI.”
- [ ]  Add a GIF or screenshot showing a real query and answer with commit citations
- [ ]  Add a “Killer queries” section with 10 example questions GittyX can answer
- [ ]  Write a `QUICKSTART.md` that gets a developer to their first useful answer in 5 minutes
- [ ]  Write a `TOOLS.md` that documents every agent tool with its inputs, outputs, and example questions
- [ ]  Add a `CONTRIBUTING.md` guide for adding new tools to the agent
- [ ]  Set up a documentation site (use Mintlify or Docusaurus) at `docs.gittyx-ai.com`

---

## Tech Stack Decisions

### Additions

| Package | Purpose | Install |
| --- | --- | --- |
| `better-sqlite3` | Structured local storage replacing flat JSON | `npm install better-sqlite3 @types/better-sqlite3` |
| `d3` | Interactive timeline, heatmap, treemap | Already in `package.json` — verify |
| `react-syntax-highlighter` | Diff rendering in commit detail panel | `npm install react-syntax-highlighter` |
| `tsx` | Run TypeScript directly during development | `npm install -D tsx` |

### Removals

| Package | Reason |
| --- | --- |
| `chart.js` | Replaced by D3 for the timeline |
| `fs` (npm package) | Use the Node.js built-in — this package is a no-op shim |
| `path` (npm package) | Same — use the built-in |
| `url` (npm package) | Same — use the built-in |

### Config changes

- [ ]  Enable `strict: true` in both `tsconfig.app.json` and `tsconfig.node.json` and fix all resulting errors
- [ ]  Add `"noImplicitAny": true` and `"strictNullChecks": true` explicitly
- [ ]  Switch CLI dev workflow to `tsx watch cli/index.ts` to eliminate the compile step
- [ ]  Add `"type": "module"` to `package.json` and convert CLI to ESM (or stay CommonJS — pick one consistently)

---

## Killer Demo Queries

> These are the queries that should be on the README. Every one of these should work perfectly before v2.0 ships.
> 
- [ ]  “When did we migrate from JavaScript to TypeScript?”
- [ ]  “Why was Redis removed from this project?”
- [ ]  “Which files are the most dangerous to touch right now?”
- [ ]  “Who is the best person to review changes to the payment module?”
- [ ]  “What changed between v1.0 and v2.0?”
- [ ]  “When did we first add authentication?”
- [ ]  “Which parts of the codebase have no clear owner?”
- [ ]  “What did this team spend most of last quarter working on?”
- [ ]  “Show me the history of how our database layer evolved”
- [ ]  “What is the bus factor of this codebase?”

---

*Generated by GittyX AI planning session — update this doc as phases complete.*