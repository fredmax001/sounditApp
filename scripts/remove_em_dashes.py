"""One-off sweep: remove every em dash (U+2014, incl. runs like ----)
from locale files and source code.

UI strings (JSON values, quoted code strings): em dash runs surrounded by
optional whitespace become ", " (or "，" for the Chinese locale).
Code comments: em dash becomes "-".
"""
import json
import os
import re
import sys
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCALES_DIR = os.path.join(ROOT, "app", "src", "i18n", "locales")
LOCALE_REPL = {"zh": "，", "en": ", ", "fr": ", "}

CODE_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".html"}
EXCLUDE_DIRS = {"node_modules", "dist", "build", ".git", "__pycache__", "venv",
                ".venv", "android", "ios", ".playwright-mcp", "electron"}


def fix_text(s: str, repl: str) -> str:
    # em dash runs with surrounding whitespace -> punctuation
    s = re.sub(r"\s*, +\s*", repl, s)
    # any remaining stray em dash char
    s = s.replace(", ", repl.strip() if repl.strip() in ",.:" else repl)
    # collapse doubled punctuation produced by the swap
    s = re.sub(r",\s*,", ", ", s)
    s = re.sub(r"，\s*，", "，", s)
    s = re.sub(r"\s+,", ",", s) if repl == "，" else s
    return s


def sweep_locale(path: str) -> int:
    lang = os.path.splitext(os.path.basename(path))[0]
    repl = LOCALE_REPL.get(lang, ", ")
    with open(path, encoding="utf-8") as f:
        data = json.load(f, object_pairs_hook=collections.OrderedDict)

    changed = [0]

    def walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                obj[k] = walk(v)
            return obj
        if isinstance(obj, list):
            return [walk(v) for v in obj]
        if isinstance(obj, str) and ", " in obj:
            changed[0] += 1
            return fix_text(obj, repl)
        return obj

    walk(data)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return changed[0]


def is_comment_context(line: str, idx: int, ext: str) -> bool:
    prefix = line[:idx]
    if ext == ".py":
        return "#" in prefix
    # ts/tsx/js/jsx/html: // comment (avoid '://' in URLs), block comments, jsdoc stars
    if re.match(r"^\s*(//|\*|/\*)", line):
        return True
    if "{/*" in prefix:
        return True
    return bool(re.search(r"(?<!:)//", prefix))


def sweep_code(path: str) -> int:
    ext = os.path.splitext(path)[1]
    with open(path, encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    changed = 0
    out = []
    for line in lines:
        if ", " in line:
            first = line.index(", ")
            if is_comment_context(line, first, ext):
                new = re.sub(r", +", "-", line)
            else:
                new = re.sub(r"\s*, +\s*", ", ", line)
                new = re.sub(r",\s*,", ", ", new)
            if new != line:
                changed += 1
            line = new
        out.append(line)
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.writelines(out)
    return changed


def main():
    total_locale = 0
    for name in sorted(os.listdir(LOCALES_DIR)):
        if name.endswith(".json"):
            n = sweep_locale(os.path.join(LOCALES_DIR, name))
            print(f"locale {name}: {n} strings fixed")
            total_locale += n

    total_code = 0
    files_changed = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1]
            if ext not in CODE_EXTS:
                continue
            full = os.path.join(dirpath, fn)
            try:
                with open(full, encoding="utf-8", errors="ignore") as f:
                    if ", " not in f.read():
                        continue
            except OSError:
                continue
            n = sweep_code(full)
            if n:
                files_changed += 1
                total_code += n
                print(f"code {os.path.relpath(full, ROOT)}: {n} lines")

    print(f"\nTOTAL: {total_locale} locale strings, {total_code} code lines across {files_changed} files")


if __name__ == "__main__":
    main()
