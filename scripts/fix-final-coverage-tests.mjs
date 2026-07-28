import fs from 'node:fs';

function replaceOnce(file, oldValue, newValue) {
  const source = fs.readFileSync(file, 'utf8');
  const count = source.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(`${file}: expected exactly one match, found ${count}`);
  }
  fs.writeFileSync(file, source.replace(oldValue, newValue));
}

replaceOnce(
  'tests/workspaceAppOrchestration.test.ts',
  '    act(() => { mocks.canvas?.onImport(); });\n    expect(mocks.settings?.initialSection).toBe("data-privacy");',
  '    act(() => { mocks.canvas?.onImport(); });\n    await waitFor(() => expect(mocks.settings?.initialSection).toBe("data-privacy"));',
);

replaceOnce(
  'tests/workspaceIntegrationCoverage.test.ts',
  '    fireEvent.click(screen.getByRole("button", { name: "Open hidden bookmark" }));',
  '    fireEvent.click(screen.getAllByRole("button", { name: "Open hidden bookmark" })[0]!);',
);
