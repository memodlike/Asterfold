import { describe, expect, it } from "vitest";
import { releaseNotesSection } from "../scripts/release-notes-section.mjs";

const NOTES = `# Asterfold 3.7.0

## Glass that works without a GPU

- First change.
- Second change.

# Asterfold 3.6.4

## Older

- Old change.
`;

describe("GitHub Release description", () => {
  it("contains only the released version's bullets, not the whole history", () => {
    const body = releaseNotesSection(NOTES, "3.7.0");
    expect(body).toBe("## Glass that works without a GPU\n\n- First change.\n- Second change.");
    expect(body).not.toContain("3.6.4");
    expect(body).not.toContain("# Asterfold");
  });

  it("refuses to publish when the version has no notes", () => {
    expect(() => releaseNotesSection(NOTES, "3.7.1")).toThrow(/No release notes for Asterfold 3\.7\.1/u);
  });
});
