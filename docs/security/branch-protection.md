# Recommended `main` branch protection

The release workflow independently verifies successful `CI` and `CodeQL` push runs for the exact tag SHA. Repository administrators should additionally configure a ruleset or branch protection rule for `main` without overwriting existing controls:

- require a pull request before merging;
- require the `validate`, `windows-release`, `cross-platform-reproducibility`, `dependency-review` (for PRs), and CodeQL analysis checks used by this repository;
- require branches to be up to date before merging;
- require conversation resolution;
- block force pushes and branch deletion;
- restrict bypass permissions to emergency administrators;
- require signed commits only if the maintainer workflow supports it consistently.

This document is a recommendation. Protection is not claimed as enabled unless verified through repository settings/API evidence.
