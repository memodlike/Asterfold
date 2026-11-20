/*
 * Builds the neutral demo workspace used for the Chrome Web Store screenshots, with Asterfold's own
 * repository functions, and writes it as an Asterfold backup. Skipped unless STORE_SEED_OUT is set:
 *   STORE_SEED_OUT=/tmp/seed.json npx vitest run tests/storeDemoSeed.test.ts
 * scripts/capture-store-screenshots.mjs runs it for you.
 */
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { createBoard, createBookmarksBulk, createPage, ensureStarterWorkspace, updateSettings } from "../src/db/repository";
import { createBackup, serializeBackup } from "../src/services/exportImport";
import { THEME_PRESETS } from "../src/domain/themes";

const output = process.env.STORE_SEED_OUT;

type Links = ReadonlyArray<readonly [title: string, url: string]>;

const WORKSPACE: ReadonlyArray<{ title: string; icon: string; boards: ReadonlyArray<{ title: string; links: Links }> }> = [
  {
    title: "Work",
    icon: "briefcase",
    boards: [
      { title: "Every day", links: [["Gmail", "https://mail.google.com/"], ["Calendar", "https://calendar.google.com/"], ["Slack", "https://slack.com/"], ["Notion", "https://www.notion.so/"], ["Zoom", "https://zoom.us/"], ["Google Meet", "https://meet.google.com/"], ["Dropbox", "https://www.dropbox.com/"]] },
      { title: "Build", links: [["GitHub", "https://github.com/"], ["Vercel", "https://vercel.com/"], ["Stack Overflow", "https://stackoverflow.com/"], ["MDN Web Docs", "https://developer.mozilla.org/"], ["Can I use", "https://caniuse.com/"], ["npm", "https://www.npmjs.com/"], ["Chrome for Developers", "https://developer.chrome.com/"]] },
      { title: "Design", links: [["Figma", "https://www.figma.com/"], ["Dribbble", "https://dribbble.com/"], ["Unsplash", "https://unsplash.com/"], ["Google Fonts", "https://fonts.google.com/"], ["Behance", "https://www.behance.net/"], ["Coolors", "https://coolors.co/"], ["Pinterest", "https://www.pinterest.com/"]] },
      { title: "Plan", links: [["Linear", "https://linear.app/"], ["Trello", "https://trello.com/"], ["Google Docs", "https://docs.google.com/"], ["Google Drive", "https://drive.google.com/"], ["Google Sheets", "https://sheets.google.com/"], ["Miro", "https://miro.com/"], ["Asana", "https://app.asana.com/"]] },
      { title: "Read later", links: [["Hacker News", "https://news.ycombinator.com/"], ["The Verge", "https://www.theverge.com/"], ["Smashing Magazine", "https://www.smashingmagazine.com/"], ["Product Hunt", "https://www.producthunt.com/"], ["Medium", "https://medium.com/"], ["Reddit", "https://www.reddit.com/"]] },
      { title: "Learn", links: [["Coursera", "https://www.coursera.org/"], ["Khan Academy", "https://www.khanacademy.org/"], ["Duolingo", "https://www.duolingo.com/"], ["Wikipedia", "https://www.wikipedia.org/"], ["YouTube Learning", "https://www.youtube.com/learning"], ["TED", "https://www.ted.com/"], ["Udemy", "https://www.udemy.com/"]] },
    ],
  },
  {
    title: "Home",
    icon: "home",
    boards: [
      { title: "Watch & listen", links: [["YouTube", "https://www.youtube.com/"], ["Netflix", "https://www.netflix.com/"], ["Spotify", "https://open.spotify.com/"], ["Twitch", "https://www.twitch.tv/"]] },
      { title: "Trips", links: [["Google Maps", "https://maps.google.com/"], ["Booking.com", "https://www.booking.com/"], ["Airbnb", "https://www.airbnb.com/"]] },
      { title: "Cooking", links: [["BBC Good Food", "https://www.bbcgoodfood.com/"], ["Serious Eats", "https://www.seriouseats.com/"], ["Allrecipes", "https://www.allrecipes.com/"]] },
    ],
  },
  {
    title: "Study",
    icon: "book",
    boards: [
      { title: "Courses", links: [["Coursera", "https://www.coursera.org/"], ["edX", "https://www.edx.org/"], ["MIT OpenCourseWare", "https://ocw.mit.edu/"]] },
      { title: "Tools", links: [["Google Scholar", "https://scholar.google.com/"], ["Zotero", "https://www.zotero.org/"], ["Desmos", "https://www.desmos.com/"]] },
    ],
  },
];

describe.runIf(Boolean(output))("store demo workspace", () => {
  it("writes the demo backup", async () => {
    const database = new AsterfoldDatabase(`store-seed-${crypto.randomUUID()}`);
    const starter = await ensureStarterWorkspace(database);
    const starterPage = starter.pages[0]!;
    let firstPageId: string | null = null;
    for (const [index, page] of WORKSPACE.entries()) {
      // The first demo page reuses the starter page, so the backup has no empty "Workspace" page.
      const pageId = index === 0 ? starterPage.id : (await createPage(page.title, { icon: page.icon }, database)).id;
      if (index === 0) {
        await database.pages.update(pageId, { title: page.title, icon: page.icon });
        await database.boards.where("pageId").equals(pageId).delete();
        firstPageId = pageId;
      }
      for (const board of page.boards) {
        const created = await createBoard(pageId, board.title, database);
        await createBookmarksBulk(created.id, board.links.map(([title, url]) => ({ title, url })), database);
      }
    }
    const aurora = THEME_PRESETS.find((preset) => preset.id === "aurora")!;
    await updateSettings({ activePageId: firstPageId, onboardingComplete: true, theme: aurora.config }, database);
    const backup = await createBackup({}, database);
    expect(backup.entities.bookmarks.length).toBeGreaterThan(30);
    await writeFile(output!, serializeBackup(backup), "utf8");
    database.close();
  });
});
