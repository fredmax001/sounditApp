#!/usr/bin/env python3
"""Security review agent.

Performs automated security scans (bandit, safety) if available and a lightweight
secrets and risky-call search. Optionally redact obvious hard-coded secrets.
Generates a markdown report with findings and suggested remediations.
"""
import argparse
import datetime
import json
import re
import shutil
import subprocess
from pathlib import Path


def run(cmd, cwd=None):
    try:
        p = subprocess.run(cmd, cwd=cwd, shell=True, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


SUSPICIOUS_PATTERNS = [
    re.compile(r"(?i)secret[_-]?key"),
    re.compile(r"(?i)aws[_-]?secret"),
    re.compile(r"(?i)api[_-]?key"),
    re.compile(r"(?i)token"),
    re.compile(r"(?i)password"),
    re.compile(r"(?i)[A-Za-z0-9_\-]{32,}"),
]


def scan_files(root: Path, exts=None):
    findings = []
    if exts is None:
        exts = {".py", ".env", ".yml", ".yaml", ".json", ".cfg", ".ini", ".js", ".ts"}
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue
        try:
            text = p.read_text(errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(text.splitlines(), start=1):
            for pat in SUSPICIOUS_PATTERNS:
                if pat.search(line):
                    findings.append({"file": str(p.relative_to(root)), "line": i, "snippet": line.strip()})
                    break
    return findings


def main():
    parser = argparse.ArgumentParser(description="Run security scans and simple secrets detection")
    parser.add_argument("--fix", action="store_true", help="Redact obvious secrets by replacing with <REDACTED_SECRET> (creates .bak files)")
    parser.add_argument("--report", default="security_review_report.md", help="Report output path")
    args = parser.parse_args()

    root = Path.cwd()
    report_lines = []
    report_lines.append(f"# Security Review Report\nGenerated: {datetime.datetime.utcnow().isoformat()}Z\n")
    report_lines.append(f"**Repository root**: {root}\n")

    # Bandit
    if shutil.which("bandit"):
        report_lines.append("## Bandit scan\n")
        rc, out, err = run("bandit -r . -f json || true")
        if out:
            try:
                data = json.loads(out)
                issues = data.get("results", [])
                report_lines.append(f"Bandit found {len(issues)} issues\n")
            except Exception:
                report_lines.append(out or err or f"bandit exit {rc}")
        else:
            report_lines.append(err or f"bandit exit {rc}")
    else:
        report_lines.append("## Bandit: not installed\n")

    # Safety
    if shutil.which("safety") and (root / "requirements.txt").exists():
        report_lines.append("## Safety check (requirements.txt)\n")
        rc, out, err = run("safety check -r requirements.txt --json || true")
        report_lines.append(out or err or f"safety exit {rc}")
    else:
        report_lines.append("## Safety: not installed or requirements.txt missing\n")

    # Lightweight secrets scan
    report_lines.append("## Lightweight secrets and risky-call scan\n")
    findings = scan_files(root)
    report_lines.append(f"Potential findings: {len(findings)}\n")
    for f in findings[:200]:
        report_lines.append(f"- {f['file']}:{f['line']} -> {f['snippet']}")

    # Optional fix: redact obvious long tokens
    if args.fix and findings:
        report_lines.append("\n## Remediation: redacting obvious secrets (backups saved as .bak)\n")
        for f in findings:
            file_path = root / f["file"]
            try:
                text = file_path.read_text()
                new_text = text
                replaced = False
                for pat in SUSPICIOUS_PATTERNS:
                    new, n = re.subn(pat, "REDACTED_PLACEHOLDER", new_text)
                    if n:
                        new_text = new
                        replaced = True
                if replaced:
                    bak = file_path.with_suffix(file_path.suffix + ".bak")
                    file_path.rename(bak)
                    bak.write_text(text)
                    file_path.write_text(new_text)
                    report_lines.append(f"Redacted in {f['file']} (backup: {bak.name})")
            except Exception as e:
                report_lines.append(f"Failed to redact {f['file']}: {e}")

    # Risky calls: eval/exec/subprocess with shell=True
    report_lines.append("\n## Risky-call search\n")
    risky_matches = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        try:
            text = p.read_text(errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(text.splitlines(), start=1):
            if "eval(" in line or "exec(" in line or ("subprocess" in line and "shell=True" in line):
                risky_matches.append(f"{p.relative_to(root)}:{i}: {line.strip()}")
    if risky_matches:
        report_lines.extend(risky_matches[:200])
    else:
        report_lines.append("No matches found")

    # Write report
    report_path = root / args.report
    report_path.write_text("\n".join(report_lines))
    print(f"Security report written to: {report_path}")


if __name__ == "__main__":
    main()
