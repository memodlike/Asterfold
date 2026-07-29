import fs from 'node:fs';

const file = 'tests/workspaceAppOrchestration.test.ts';
const source = fs.readFileSync(file, 'utf8');
const oldValue = '    act(() => { mocks.launcher?.onTrash(); });\n    expect(mocks.trash?.open).toBe(true);';
const newValue = '    act(() => { mocks.launcher?.onTrash(); });\n    await waitFor(() => expect(mocks.trash?.open).toBe(true));';
const count = source.split(oldValue).length - 1;
if (count !== 1) {
  throw new Error(`Expected one trash timing assertion, found ${count}`);
}
fs.writeFileSync(file, source.replace(oldValue, newValue));
