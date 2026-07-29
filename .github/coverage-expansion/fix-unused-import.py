from pathlib import Path

path = Path("tests/componentLifecycleCoverage.test.ts")
source = path.read_text()
old = 'import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";'
new = 'import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";'
if source.count(old) != 1:
    raise SystemExit("Expected one component lifecycle Testing Library import")
path.write_text(source.replace(old, new, 1))
