#!/usr/bin/env python3
"""
inject-intent-filters.py

Injects PaceRead file-association intent filters into the Capacitor-generated
AndroidManifest.xml.  Run this in CI after "npx cap sync android".

This script is IDEMPOTENT: if the intent filters are already present (identified
by the sentinel comment "<!-- PaceRead file-open intent filters -->") the script
exits without modifying the file.

Usage:
    python3 release-package/android/inject-intent-filters.py
"""

import sys
import os
import xml.etree.ElementTree as ET

MANIFEST_PATH = os.path.join("android", "app", "src", "main", "AndroidManifest.xml")
FILTERS_PATH  = os.path.join("release-package", "android", "intent-filters.xml")
SENTINEL      = "PaceRead file-open intent filters"


def main() -> None:
    if not os.path.exists(MANIFEST_PATH):
        print(f"[inject-intent-filters] ERROR: {MANIFEST_PATH} not found. "
              "Run 'npx cap sync android' first.", file=sys.stderr)
        sys.exit(1)

    with open(MANIFEST_PATH, "r", encoding="utf-8") as fh:
        manifest_text = fh.read()

    # Idempotency check — if sentinel already present, skip.
    if SENTINEL in manifest_text:
        print("[inject-intent-filters] Intent filters already present — nothing to do.")
        return

    # Read the intent-filter fragment.
    with open(FILTERS_PATH, "r", encoding="utf-8") as fh:
        filters_text = fh.read().strip()

    # Validate the existing manifest is well-formed XML before we touch it.
    try:
        ET.fromstring(manifest_text)
    except ET.ParseError as exc:
        print(f"[inject-intent-filters] ERROR: AndroidManifest.xml is not valid XML: {exc}",
              file=sys.stderr)
        sys.exit(1)

    # Find the closing </activity> tag and insert the filters + sentinel before it.
    # We look for the first </activity> occurrence — Capacitor generates exactly one
    # main activity element.
    close_tag = "</activity>"
    idx = manifest_text.find(close_tag)
    if idx == -1:
        print("[inject-intent-filters] ERROR: Could not find </activity> in AndroidManifest.xml.",
              file=sys.stderr)
        sys.exit(1)

    injection = f"\n        <!-- {SENTINEL} -->\n"
    # Indent each line of the filters block by 8 spaces to match the manifest style.
    for line in filters_text.splitlines():
        injection += ("        " + line).rstrip() + "\n"

    new_manifest = manifest_text[:idx] + injection + manifest_text[idx:]

    # Validate the result is still well-formed XML before writing.
    try:
        ET.fromstring(new_manifest)
    except ET.ParseError as exc:
        print(f"[inject-intent-filters] ERROR: Modified manifest is not valid XML: {exc}",
              file=sys.stderr)
        sys.exit(1)

    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        fh.write(new_manifest)

    print(f"[inject-intent-filters] ✓ Successfully injected file-open intent filters into {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
