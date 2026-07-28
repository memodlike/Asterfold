# Version transition evidence

## Decision

Version `3.0.0` was an internal unreleased release candidate. It was never tagged or published and is superseded by `3.0.1` before publication.

## Current release identity

- Published predecessor: `2.2.3`
- Final package version: `3.0.1`
- Final Manifest V3 version: `3.0.1`
- Permitted Git tag: `v3.0.1`
- GitHub Release title: `Asterfold 3.0.1`

## Historical retention

The versioned directory `docs/audit/3.0.0/` remains unchanged as evidence for the internal release candidate. Dependency versions containing `3.0.0` in `package-lock.json` are unrelated third-party package metadata and are not Asterfold release identifiers.

## Release prohibition

The release pipeline must reject `v3.0.0`. No tag, GitHub Release or Chrome Web Store package may be created with Asterfold version `3.0.0`.
