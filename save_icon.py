#!/usr/bin/env python3
"""
Save the user-provided Sound It logo as the Electron app icon.
Run this script from the project root directory.

Usage: python3 save_icon.py <path-to-icon.png>

The icon should be at least 512x512 pixels (1024x1024 preferred).
"""
import sys
import shutil
import os
from pathlib import Path

def main():
    project_root = Path(__file__).parent
    dest = project_root / "electron" / "build" / "icon.png"

    if len(sys.argv) < 2:
        print("Usage: python3 save_icon.py <path-to-your-icon.png>")
        print(f"\nDestination: {dest}")
        print("\nAfter running this script, generate all icon formats with:")
        print("  cd electron && npm run build:icons")
        sys.exit(1)

    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.exists():
        print(f"Error: File not found: {src}")
        sys.exit(1)

    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    print(f"✅ Icon saved to: {dest}")
    print("\nNext step — generate all icon formats:")
    print("  cd electron && npm run build:icons")

if __name__ == "__main__":
    main()
