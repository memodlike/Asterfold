# Asterfold 3.0.1

> Version 3.0.0 was an internal unreleased release candidate and was superseded by 3.0.1 before publication.

## Highlights

- CI-gated, tag-only GitHub Release publishing from the exact verified `main` commit.
- Deterministic Linux and Windows runtime, source, Store-assets, and SPDX SBOM packaging.
- Source-to-artifact linkage through `provenance.json`, SHA-256 checksums, and GitHub artifact attestations.
- Audit closure evidence for release, documentation, dependency, package-hygiene, validation, coverage, and UX findings.
- A non-modal, localized first-use launcher hint for new installations; existing 2.2.3 workspaces are migrated without showing it.
- A runtime-only Chrome Web Store ZIP; installation guidance remains only in the unpacked distribution.

## Security and privacy

- No host permissions.
- No content scripts.
- No remote executable code.
- The optional `bookmarks` permission remains user-invoked from the Chrome-bookmark import flow.
- Workspace records remain local-first in the user's Chrome profile.
- The single purpose remains: a visual bookmark workspace for the Chrome New Tab page.
- Privacy Mode remains visual shoulder-surfing protection, not encryption.

## Reliability

- Database schema 6 preserves data from 2.2.3 and marks legacy installations as already onboarded.
- Release archives use stable file ordering, timestamps, permissions, separators, and uncompressed deterministic ZIP entries.
- CI compares Linux and Windows release subjects byte-for-byte.
- Development dependency advisories are checked against an explicit expiring baseline; production high/critical vulnerabilities remain a hard failure.

## Chrome Web Store package

Upload **`Asterfold-Chrome.zip`**. It contains `manifest.json` at the root and only runtime-required extension files.

`chrome-unpacked.zip` is for Developer mode installation. GitHub-generated source archives are not extension upload packages.

## Upgrade notes

Updating from 2.2.3 does not reset Pages, Boards, bookmarks, opening modes, Trash, theme, language, wallpaper, Quick Save settings, or Privacy settings. The schema-6 migration changes only the schema marker and legacy onboarding state.

## Verification

Use `checksums.txt` and `provenance.json` to verify the attached assets. GitHub artifact attestations provide an additional cryptographic statement linking the release subjects to the GitHub Actions workflow and source commit.
