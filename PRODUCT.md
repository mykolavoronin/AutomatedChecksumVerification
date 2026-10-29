# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Automate checksum discovery and local integrity verification for Chrome downloads. Explain verified, mismatched, conflicting, weak, unknown, permission-limited, paused, and blocked states without presenting a checksum match as a malware verdict.

## Operating Context

Chrome Manifest V3 extension. The user chose a compact popup with a separate full report tab, and direct implementation followed by tests. Basic and Advanced views must remain available. Automatic discovery, download controls, and persisted settings are existing requirements.

## Capabilities and Constraints

Hash actual local downloads; never execute installers or upload file bytes. Discover publisher expectations in website text, HTML, structured data, checksum links, and supported release catalogs. Chrome requires local-file permission for automatic reads. Browser policy can prevent automatic popup opening. Cross-origin frame contents and browser-internal pages may be inaccessible. Unknown integrity is distinct from a mismatch.

## Brand Commitments

Keep the extension name, local-verification purpose, and plain English. A redesign is authorized; no new external brand assets or marketing claims are required.

## Product Principles

- Keep the current file, stage, and next action visible.
- Match a digest to its artifact, algorithm, and source.
- Make detailed evidence available without filling the compact popup with controls.
- Preserve user settings and require explicit user intent for downloading discovered installers.
