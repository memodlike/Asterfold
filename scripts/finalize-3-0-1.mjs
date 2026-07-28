import fs from 'node:fs';
import path from 'node:path';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function replaceCount(file, oldValue, newValue, expected = 1) {
  const source = read(file);
  const count = source.split(oldValue).length - 1;
  if (count !== expected) {
    throw new Error(`${file}: expected ${expected} matches, found ${count}: ${JSON.stringify(oldValue.slice(0, 100))}`);
  }
  write(file, source.split(oldValue).join(newValue));
}

replaceCount(
  'tests/appearanceDialogs.test.ts',
  `    act(() => {\n      view.rerender(withI18n(createElement(MoveDialog, { ...props, open: false })));\n      view.rerender(withI18n(createElement(MoveDialog, { ...props, open: true })));\n    });\n    expect(screen.queryByRole("alert")).toBeNull();`,
  `    view.rerender(withI18n(createElement(MoveDialog, { ...props, open: false })));\n    expect(screen.queryByRole("dialog")).toBeNull();\n    view.rerender(withI18n(createElement(MoveDialog, { ...props, open: true })));\n    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());`,
);
replaceCount(
  'tests/boardCanvasBehavior.test.ts',
  'expect(screen.getByText(board.title)).toBeVisible();',
  'expect(screen.getByText(board.title, { selector: ".drag-overlay span" })).toBeVisible();',
);
for (const [oldValue, newValue] of [
  ['name: "Add bookmark to Inbox"', 'name: "Add a bookmark to Inbox"'],
  ['name: "Add your first bookmark"', 'name: "Drop a link here or press +"'],
  ['screen.getByRole("button", { name: /Rename/ })', 'screen.getByRole("menuitem", { name: "Rename" })'],
  ['screen.getByRole("button", { name: /Two columns/ })', 'screen.getByRole("menuitem", { name: "Two columns" })'],
  ['screen.getByRole("button", { name: /Medium/ })', 'screen.getByRole("menuitem", { name: "Medium" })'],
  ['screen.getByRole("button", { name: /Move to page/ })', 'screen.getByRole("menuitem", { name: "Move to page" })'],
  ['screen.getByRole("button", { name: /Duplicate/ })', 'screen.getByRole("menuitem", { name: "Duplicate" })'],
  ['screen.getByRole("button", { name: /Move to trash/ })', 'screen.getByRole("menuitem", { name: "Move to trash" })'],
]) {
  replaceCount('tests/boardColumnBehavior.test.ts', oldValue, newValue);
}
replaceCount(
  'tests/importWorkerBehavior.test.ts',
  `    const worker = FakeWorker.instances[0]!;\n    await vi.advanceTimersByTimeAsync(30_001);\n    await expect(pending).rejects.toThrow("Import worker timed out");`,
  `    const worker = FakeWorker.instances[0]!;\n    const timeoutRejection = expect(pending).rejects.toThrow("Import worker timed out");\n    await vi.advanceTimersByTimeAsync(30_001);\n    await timeoutRejection;`,
);
replaceCount(
  'tests/runtimeCoverage.test.ts',
  `    const timedOut = parseHtmlOffThread("timeout");\n    await vi.advanceTimersByTimeAsync(30_001);\n    await expect(timedOut).rejects.toThrow("Import worker timed out");`,
  `    const timedOut = parseHtmlOffThread("timeout");\n    const timeoutRejection = expect(timedOut).rejects.toThrow("Import worker timed out");\n    await vi.advanceTimersByTimeAsync(30_001);\n    await timeoutRejection;`,
);
replaceCount('tests/runtimeCoverage.test.ts', 'The action could not be completed.', 'Unable to complete the action', 2);
replaceCount(
  'tests/workspaceAppOrchestration.test.ts',
  `    act(() => { mocks.canvas?.onAddBookmark(board); });\n    expect(mocks.editor?.initialBoardId).toBe(board.id);\n    mocks.canvas?.onEditBookmark(bookmark);\n    expect(mocks.editor?.bookmark).toEqual(bookmark);`,
  `    act(() => { mocks.canvas?.onAddBookmark(board); });\n    await waitFor(() => expect(mocks.editor?.initialBoardId).toBe(board.id));\n    act(() => { mocks.canvas?.onEditBookmark(bookmark); });\n    await waitFor(() => expect(mocks.editor?.bookmark).toEqual(bookmark));`,
);
replaceCount(
  'tests/workspaceAppOrchestration.test.ts',
  `    act(() => { mocks.launcher?.onSearch(); });\n    expect(mocks.search?.open).toBe(true);`,
  `    act(() => { mocks.launcher?.onSearch(); });\n    await waitFor(() => expect(mocks.search?.open).toBe(true));`,
);
replaceCount(
  'tests/workspaceAppOrchestration.test.ts',
  `    fireEvent.keyDown(window, { key: "k", ctrlKey: true });\n    expect(mocks.search?.open).toBe(true);`,
  `    fireEvent.keyDown(window, { key: "k", ctrlKey: true });\n    await waitFor(() => expect(mocks.search?.open).toBe(true));`,
);
for (const [oldValue, newValue, expected] of [
  ['Opening your workspace…', 'Opening your new tab…', 1],
  ['screen.getByRole("menuitem", { name: "New page" })', 'await screen.findByRole("menuitem", { name: "Create page" })', 1],
  ['screen.getByRole("button", { name: "Rename" })', 'screen.getByRole("menuitem", { name: "Rename" })', 1],
  ['screen.getByRole("button", { name: "Two columns" })', 'screen.getByRole("menuitem", { name: "Two columns" })', 1],
  ['screen.getByRole("button", { name: "Copy URL" })', 'screen.getByRole("menuitem", { name: "Copy URL" })', 2],
  ['screen.getByRole("button", { name: "Move to Trash" })', 'screen.getByRole("menuitem", { name: "Move to trash" })', 1],
  ['screen.getByRole("button", { name: "Move to page" })', 'screen.getByRole("menuitem", { name: "Move to page" })', 1],
  ['screen.getByRole("button", { name: "Duplicate" })', 'screen.getByRole("menuitem", { name: "Duplicate" })', 2],
  ['screen.getByRole("button", { name: "Move" })', 'screen.getByRole("menuitem", { name: "Move" })', 1],
  ['name: "Add bookmark to Inbox"', 'name: "Add a bookmark to Inbox"', 1],
  ['The action could not be completed.', 'Unable to complete the action', 1],
]) {
  replaceCount('tests/workspaceIntegrationCoverage.test.ts', oldValue, newValue, expected);
}

const oldVersion = '3.0.0';
const newVersion = '3.0.1';
const packageJson = JSON.parse(read('package.json'));
if (![oldVersion, newVersion].includes(packageJson.version)) {
  throw new Error(`Unexpected package version: ${packageJson.version}`);
}
packageJson.version = newVersion;
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

const lock = JSON.parse(read('package-lock.json'));
if (![oldVersion, newVersion].includes(lock.version) || ![oldVersion, newVersion].includes(lock.packages[''].version)) {
  throw new Error('Unexpected package-lock root version');
}
lock.version = newVersion;
lock.packages[''].version = newVersion;
write('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);

const currentPaths = [
  'README.md',
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
  'docs/security/review.md',
  'docs/security/permissions.md',
  'docs/security/threat-model.md',
  'docs/security/privacy.md',
];
for (const file of currentPaths) {
  write(file, read(file).replaceAll('v3.0.0', 'v3.0.1').replaceAll(oldVersion, newVersion));
}

const note = '> Version 3.0.0 was an internal unreleased release candidate and was superseded by 3.0.1 before publication.\n\n';
for (const [file, marker] of [
  ['README.md', '## Release status\n\n'],
  ['docs/release/versioning.md', '# Release versioning\n\n'],
  ['docs/release/release-notes.md', '# Asterfold 3.0.1\n\n'],
]) {
  let source = read(file);
  if (!source.includes(note)) {
    source = source.includes(marker) ? source.replace(marker, `${marker}${note}`) : `${source}\n\n${note}`;
  }
  write(file, source);
}
write(
  'docs/audit/3.0.1/VERSION_TRANSITION.md',
  '# Version transition\n\n- Published predecessor: `2.2.3`.\n- `3.0.0` was an internal unreleased release candidate.\n- Final release target: `3.0.1` / `v3.0.1`.\n- No `v3.0.0` tag or GitHub Release may be created.\n',
);
