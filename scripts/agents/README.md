# Agents: Code Review and Security Review

Two small Python scripts are provided to help automate repository reviews:

- `code_review_agent.py` — runs formatters (`black`, `isort`), linter (`flake8`), type checks (`pyright`) and tests (`pytest`) if those tools are installed. Use `--fix` to auto-apply safe fixes (formatters).
- `security_review_agent.py` — runs security scanners (`bandit`, `safety`) if available and performs a lightweight secrets and risky-call scan. Use `--fix` to redact obvious findings (backups are saved with `.bak`).

Usage examples (from repository root):

```bash
python3 scripts/agents/code_review_agent.py --fix --report=code_review_report.md
python3 scripts/agents/security_review_agent.py --report=security_review_report.md
python3 scripts/agents/security_review_agent.py --fix --report=security_review_report.md
```

Notes:
- The scripts try to be conservative. They will not commit changes to git; formatters will modify files in-place when `--fix` is used.
- Install the optional tools to get full results: `pip install black isort flake8 pyright pytest bandit safety`.
- For security fixes, the `--fix` mode performs simple redactions and creates `.bak` backups; review backups before deletion.

If you want, I can run these agents now and produce the reports. Say "Run agents" to proceed.
