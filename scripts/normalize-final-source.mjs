import fs from 'node:fs';

const files = [
  'README.md',
  'package.json',
  'package-lock.json',
  'tests/appearanceDialogs.test.ts',
  'tests/boardCanvasBehavior.test.ts',
  'tests/boardColumnBehavior.test.ts',
  'tests/importWorkerBehavior.test.ts',
  'tests/runtimeCoverage.test.ts',
  'tests/workspaceAppOrchestration.test.ts',
  'tests/workspaceIntegrationCoverage.test.ts',
  'tests/manifestPolicy.test.ts',
  'e2e/upgrade.spec.ts',
  'src/db/migrations.ts',
  'docs/store/privacy.html',
  'docs/store/privacy-practices.md',
  'docs/store/submission-checklist.md',
  'store-assets/listing/store-listing-en.md',
  'store-assets/listing/store-listing-ru.md',
  'store-assets/listing/submission-values.md',
  'docs/release/release-notes.md',
  'docs/release/versioning.md',
  'docs/release/install.md',
  'docs/audit/FINDINGS_STATUS.md',
  'docs/audit/EVIDENCE.md',
  'docs/audit/QA_REPORT.md',
  'docs/audit/3.0.1/VERSION_TRANSITION.md',
  'docs/security/review.md',
  'docs/security/permissions.md',
  'docs/security/threat-model.md',
  'docs/security/privacy.md',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const normalized = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.replace(/[\t ]+$/u, ''))
    .join('\n')
    .replace(/\n*$/u, '\n');
  fs.writeFileSync(file, normalized);
}
