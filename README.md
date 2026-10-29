# Automated Checksum Verification

A Manifest V3 Chrome extension that discovers publisher checksums, hashes the **actual downloaded file locally**, and separates integrity results from security warnings. Requires Chrome 120 or newer. Runtime code is bundled; no account, remote executable code, or file uploads are used.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository, or unzip the release package and select its folder.
3. In the extension's **Details**, enable **Allow access to file URLs** for automatic verification. Without it, use the local file picker. Chrome requires this one-time permission; the extension cannot grant it.
4. Reload download pages that were already open. Pin the extension to see its badge and open the popup.

Discovery and verification then run automatically without keeping the popup open. First installation opens setup instructions if file access is missing. Finished checks, blocked downloads, and downloads awaiting approval can trigger desktop notifications, subject to your operating system's settings.

The checked-in `scripts/core.js` is ready to load. Node.js is needed only for development. The manifest follows Chrome's [Manifest V3 service-worker requirements](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers), with an [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen) for local file reads and a Web Worker for hashing.

## Interface and persistent settings

The compact white popup puts the current file, checking stage, result, and recent checks first. Pill controls, soft status badges, and accessible SVG icons keep it compact. The report fills the tab, with a sidebar on wide screens and navigation above the content on narrow screens. Settings use open groups and soft-filled fields, without nested frames or divider borders. Actual viewport scrolling remains available by wheel, touch, and keyboard. Panels enter and dismiss with short transitions; progress updates preserve keyboard focus and scroll position. Reduced-motion preferences have dedicated fallbacks. **View file report** opens detailed sources and download controls in a full tab. Optional controls sit under **More options** in the popup and report sidebar. Light is the default appearance; this update applies the requested white appearance once for older versions while preserving protection rules. Later appearance choices persist, including optional dark and system modes. Basic and Advanced share the same automatic checking and protection; changing the view does not change protection rules.

The extension shows a live loader during downloading, checksum discovery, and local hashing. It does not announce a result while additional checksum lookup or a recheck is pending. Report summaries appear in Downloads or manual verification, keeping Settings and Page files focused on their task. Completion shows **YES — Checksum matches**, **NO — Checksum mismatch**, or **Couldn’t verify** when no supported expectation exists. Conflicts and weak legacy matches have separate explanations. Manual file verification uses the same loader and result summary.

A small grayscale panel stays on the initiating download page through downloading, discovery, hashing, and the final result. Closing it keeps checking active and does not reopen the same panel. After three distinct dismissals, it offers **Turn off panels** or **Keep showing**; Settings can restore panels later. Each file has a separate card, with a scrollable stack for concurrent downloads. Panels restore on reloading the same initiating page and expose report navigation and display preferences. File deletion and download decisions stay in the extension report. If the initiating page cannot be identified uniquely, results remain in the extension. Panels do not appear on browser-internal pages.

Finished checks are saved as dismissible result summaries. Automatic toolbar result popups and desktop notifications are off by default on new installations; they have independent opt-in settings. Existing saved preferences are preserved. Chrome's [action popup API](https://developer.chrome.com/docs/extensions/reference/api/action#method-openPopup) permits automatic opening in Chrome 127+; older versions and browser policies may refuse. The stored result, toolbar badge, and enabled desktop notification remain available. Identical rechecks do not repeatedly reopen the same result.

- **Downloads**: automatic results, search, filters, pause/resume/cancel controls, expandable sources and security notes, digest copying, and confirmed deletion of mismatched files.
- **Page files**: discovered file URLs and their origin, including hidden links and page data. **Download & verify** downloads only the artifact you choose and retains publisher attribution. Discovering a file never downloads the installer automatically.
- **Verify a file**: local file picker, expected digest/list, algorithm selection, and loading a checksum URL such as a publisher's `.exe.sha256` link.
- **Settings**: blocking mode, exact-host blocklist, discovery controls, notifications, history limit, and light/dark/system appearance.

Settings persist in local extension storage across browser restarts. The master toggle controls new monitoring, discovery, and blocking. Existing paused downloads still require an explicit decision. Tabs support arrow-key navigation, and controls have visible keyboard focus. The verification interface is currently in English; setup instructions and extension metadata also retain French resources.

## Automatic discovery

The extension reads visible text, download rows, algorithm-labeled HTML tables, nested JSON, filename-bearing checksum records in inline scripts, checksum data attributes, and SRI values. Supported formats include GNU/BSD lists, GNU escaped filenames and NUL-separated records, SFV, tagged/labeled base64, wrapped/grouped hex, and SHA-256/384/512 SRI. JSON digest strings, filename maps, and nested digest objects retain explicit download URLs so identically named files remain separate. Reports preserve format and explicit/inferred algorithm provenance. Script text is data and is never evaluated.

Scanning includes open shadow roots, accessible same-origin frames, dynamic content, and single-page-app navigation. Closed shadow roots, cross-origin frame contents, and browser-internal pages remain inaccessible. Table rows bind checksums to exact URLs, including different downloads sharing a basename. Ambiguous evidence is not silently treated as a verified match.

File discovery also reads hidden anchors, `data-download-url` / `data-url` / `data-href` attributes, and installer/archive URL strings in HTML and inline code, including escaped JSON URLs. “Hidden files” means URLs exposed in website data; it does not search your computer or bypass website authentication. External script bundles are not exhaustively crawled, and server-only URLs cannot be inferred reliably.

Clearly labeled checksum links are followed automatically. Text lists and per-file sidecars on public HTTPS CDNs are supported when the CDN setting is enabled. Requests omit cookies and referrers, time out after 8 seconds, and limit text to 2 MiB. Direct cross-origin private-network URLs are rejected; responses ending at private-network URLs or HTTPS downgrades are not used. Up to four network lookups run concurrently. Turning off CDN discovery also disables redirects for text lookups.

Same-origin HTML checksum subpages can be parsed and, when interactive, opened in inactive tabs. The extension can open two such tabs per source page and four globally, use the site's normal session, collect revealed values, and close the tabs. Inactive tabs cannot spawn further tabs. A fetched checksum index can follow up to four recognized checksum-list URLs at one additional depth; arbitrary page crawling is excluded. Cache identities include traversal depth to avoid circular index links blocking discovery. Failed probes are reclaimed by the recovery alarm.

Clearly labeled checksum controls such as **Show SHA-256**, **Reveal checksums**, or **Show BLAKE3** are clicked automatically, with an eight-click limit per document. Expanded, disabled, hidden, form, and unrelated controls are excluded. CAPTCHAs, trusted-physical-click requirements, and site-specific workflows may need manual interaction.

When a download starts, the extension can try original and final URLs plus `.sha256` and `.sha512`, an extension-replaced SHA-256 sidecar, and adjacent `SHA256SUMS`, `SHA512SUMS`, `checksums.txt`, `checksums.sha256`, `SHA256SUMS.txt`, and `checksums.json` lists, within a ten-source limit. Only entries belonging to the requested file are retained. Directory-qualified manifest paths resolve against the final checksum source URL after redirects. Aggregate lists are distinguished from file-specific sidecars. Same-origin checksum subpages may resolve redirects in bounded background tabs. A sidecar like `https://download.jetbrains.com/toolbox/jetbrains-toolbox-3.9.0.88839.exe.sha256` identifies the executable URL and exact filename. On actual JetBrains Toolbox product pages, a bounded adapter reads JetBrains' [public release catalog](https://data.services.jetbrains.com/products/releases?code=TBA&latest=true&type=release), exposing current platform installers and checksum links before downloading. The adapter validates the publisher page, download host, and file/checksum pairing.

On GitHub release pages and direct release downloads, the extension first checks the public release API for published asset digests. The repository, release tag, asset filename, uploaded state, and exact download URL are checked before accepting SHA-256 metadata. Public API requests omit cookies and do not download release binaries. Rate limits, private releases, missing digests, and network failures fall back to normal discovery. See the [official asset digest schema](https://docs.github.com/en/rest/releases/assets) and [GitHub announcement](https://github.blog/changelog/2025-06-03-releases-now-expose-digests-for-release-assets/). GNU list parsing follows the [documented output formats](https://www.gnu.org/software/coreutils/manual/html_node/cksum-output-modes.html).

## Download blocking

Chrome's [downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads) provides the actual pause, resume, and cancel operations used here:

- **Block Chrome-flagged threats** (default): cancel downloads Chrome identifies as malicious or harmful. An uncommon file or executable extension alone does not trigger cancellation.
- **Pause until a strong checksum is found**: pause files with no strong expected digest or with conflicting digest values. Automatically paused files resume when nonconflicting strong expectations are discovered, or when you choose **Allow once**. A digest's presence does not prove the file is safe.
- **Ask before every download**: pause each file until you choose **Allow once** or **Cancel download**.
- **Monitor only**: report integrity without automatic threat cancellation. Your explicit blocked-host list still applies while protection is on.

**Block host** adds the actual download hostname to the persistent blocklist and cancels an active download from it. Hosts match exactly. Manually paused downloads are never resumed by discovery. Notification and discovery controls are independent.

These controls act **after Chrome starts a download**; some bytes can arrive first. Very small downloads can finish before cancellation, which is reported rather than labeled as successfully blocked. Integrity verification requires the complete saved file. The extension cannot quarantine files, prevent automatic opening configured elsewhere, or block execution of an already saved file. Browser/device policy, server resume support, or file permissions can deny an operation.

## Supported algorithms

30 fixed-output algorithm variants:

- SHA-1; SHA-224/256/384/512; SHA-512/224 and SHA-512/256.
- SHA3-224/256/384/512 and Keccak-256.
- BLAKE2b-128/160/224/256/384/512; BLAKE2s-128/160/224/256; BLAKE3-256.
- SHAKE128 with 128- or 256-bit output; SHAKE256 with 256- or 512-bit output. SHAKE labels must state the output length, such as SHAKE128-256.
- MD5, RIPEMD-160, and CRC32 (IEEE).

Explicit names take priority. Conventional unlabeled hex lengths default to MD5, SHA-1, SHA-224, SHA-256, SHA-384, or SHA-512, with an inference warning. Equal-length alternatives such as SHA3-256 and BLAKE3 require a name or recognized sidecar suffix. Unspecified SHAKE output lengths, keyed MACs, unlisted BLAKE2 sizes, digital signatures, and other algorithms are not claimed to be supported.

## Integrity, security, and privacy

Checksums are associated with a download URL, initiating page, filename, and algorithm. Every associated value must match. Conflicting expectations produce **conflict**; absent expectations produce **unverified**. Legacy-only and short-output-only matches are labeled as limited assurance. BLAKE2 outputs below 224 bits and SHAKE128-128 do not satisfy the strong-checksum download policy. Late-discovered expectations cause a recheck. Explicit UI downloads retain attribution, and conventional sidecars can supply expectations even when Chrome omits a publisher referrer; unrelated page-wide hashes cannot satisfy verification.

Security notes use Chrome's danger verdict and local indicators: insecure HTTP, executable formats, misleading double extensions, bidirectional filename characters, weak hashes, and inferred algorithms. A match **does not authenticate the publisher or prove a file is malware-free**. There is no antivirus engine, archive inspection, or signature verification.

Files are read in 1 MiB chunks using locally bundled, pinned `@noble/hashes` implementations and a local CRC32 implementation. No second copy is downloaded for hashing. Files are never opened or executed. Deletion requires confirmation in extension-owned UI and is restricted to tracked mismatches/conflicts; no privileged actions appear in webpage overlays.

History is kept in trusted extension session storage, limited to 25, 50, or 100 completed downloads; active and paused jobs remain until resolved. Page registrations expire after 30 minutes and are limited to the 20 most recent pages, with bounded per-page metadata. Session state survives worker restarts but clears when the browser session ends. Settings persist independently. Closing the report tab cancels manual hashing, and manual file bytes are not persisted. Inaccessible files, network paths, ambiguous attribution, and unsupported discovery flows may require the file picker.

Permissions are `downloads`, `storage`, `offscreen`, `alarms`, and `notifications`, plus HTTP/HTTPS and file host access. File access reads Chrome-reported completed local downloads. There is no `downloads.open` permission, remote executable code, unrestricted web-accessible resources, or `tabs` permission.

## Development and verification

```powershell
npm ci --ignore-scripts
npm run check
npx playwright install chromium
npm run test:browser
```

Set `CHROMIUM_EXECUTABLE` to use an existing Chromium binary. Chrome-branded builds may restrict command-line extension loading; use Playwright Chromium. Profiles, fixtures, and screenshots stay under ignored `test-results/`.

`npm run check` rebuilds the bundle and runs independent hash vectors, parsing/discovery/policy tests, and privileged-message regressions. Browser tests exercise persistent page panels and dismissal preferences, same-name table rows, shadows, frames, SPA navigation, actual local verification, hidden sidecars, page code, interactive subpages, manual checks, settings persistence, real pause/resume/cancel, host blocking, conventional sidecar discovery, worker restart, and stale-job recovery. Run `node tests/github.live.mjs` for an optional public GitHub integration check that validates live release digests without downloading binaries. Set `LIVE_JETBRAINS=1` to additionally test the public checksum, release catalog, and live Toolbox page without downloading its installers.

Run `npm run build` then `./tools/package.ps1` in PowerShell for `release/AutomatedChecksumVerification-1.4.0.zip`. The package excludes dependencies, tests, browser profiles, and obsolete runtime assets.

## Research origin

Originally developed for Cherubini et al., [Towards Usable Checksums: Automating the Integrity Verification of Web Downloads for the Masses](https://doi.org/10.1145/3243734.3243746), ACM CCS 2018. The 1.x runtime replaces Manifest V2. Third-party license: `scripts/vendor/noble-hashes-LICENSE.txt`.
