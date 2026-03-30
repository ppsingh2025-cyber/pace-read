#!/usr/bin/env python3
"""
info-plist-additions.py

Merges PaceRead document-type registrations into the Capacitor-generated
ios/App/App/Info.plist.  Run this in CI after "npx cap sync ios".

This script is IDEMPOTENT: existing CFBundleDocumentTypes entries and the
LSSupportsOpeningDocumentsInPlace key are preserved if already present.

Usage:
    python3 release-package/ios/info-plist-additions.py
"""

import sys
import os
import plistlib

PLIST_PATH = os.path.join("ios", "App", "App", "Info.plist")

# Document type entries to register.
DOCUMENT_TYPES = [
    {
        "CFBundleTypeName": "PDF Document",
        "CFBundleTypeRole": "Viewer",
        "LSItemContentTypes": ["com.adobe.pdf"],
    },
    {
        "CFBundleTypeName": "EPUB Document",
        "CFBundleTypeRole": "Viewer",
        "LSItemContentTypes": ["org.idpf.epub-container"],
    },
    {
        "CFBundleTypeName": "Word Document",
        "CFBundleTypeRole": "Viewer",
        "LSItemContentTypes": [
            "org.openxmlformats.wordprocessingml.document",
        ],
    },
    {
        "CFBundleTypeName": "Text Document",
        "CFBundleTypeRole": "Viewer",
        "LSItemContentTypes": [
            "public.plain-text",
            "net.daringfireball.markdown",
            "public.data",
        ],
    },
    {
        "CFBundleTypeName": "HTML Document",
        "CFBundleTypeRole": "Viewer",
        "LSItemContentTypes": ["public.html"],
    },
    {
        "CFBundleTypeName": "RTF Document",
        "CFBundleTypeRole": "Viewer",
        "LSItemContentTypes": ["public.rtf"],
    },
]


def main() -> None:
    if not os.path.exists(PLIST_PATH):
        print(
            f"[info-plist-additions] ERROR: {PLIST_PATH} not found. "
            "Run 'npx cap sync ios' first.",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(PLIST_PATH, "rb") as fh:
        plist = plistlib.load(fh)

    changed = False

    # --- CFBundleDocumentTypes ---
    existing_types: list = plist.get("CFBundleDocumentTypes", [])
    existing_names = {entry.get("CFBundleTypeName") for entry in existing_types}

    added_count = 0
    for doc_type in DOCUMENT_TYPES:
        if doc_type["CFBundleTypeName"] not in existing_names:
            existing_types.append(doc_type)
            added_count += 1
            changed = True

    plist["CFBundleDocumentTypes"] = existing_types

    # --- LSSupportsOpeningDocumentsInPlace ---
    # Set to False so iOS copies the file into the app's sandbox (always readable).
    if plist.get("LSSupportsOpeningDocumentsInPlace") is not False:
        plist["LSSupportsOpeningDocumentsInPlace"] = False
        changed = True

    if not changed:
        print("[info-plist-additions] Document types already registered — nothing to do.")
        return

    with open(PLIST_PATH, "wb") as fh:
        plistlib.dump(plist, fh, fmt=plistlib.FMT_XML, sort_keys=True)

    print(
        f"[info-plist-additions] ✓ Registered {added_count} new document type(s) "
        f"({len(existing_types)} total) and set LSSupportsOpeningDocumentsInPlace=false "
        f"in {PLIST_PATH}"
    )


if __name__ == "__main__":
    main()
