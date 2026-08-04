import { applyStartupThemeSnapshot, readStartupThemeSnapshot } from "../../src/features/appearance/startupSnapshot";

const root = document.documentElement;
root.dataset.asterfoldBoot = "pending";

const snapshot = readStartupThemeSnapshot();
if (snapshot) applyStartupThemeSnapshot(root, snapshot);

const revealFailureState = (): void => {
  if (document.querySelector(".app-loading button")) root.dataset.asterfoldReady = "true";
};

const observer = new MutationObserver(revealFailureState);
observer.observe(document, { childList: true, subtree: true });
window.addEventListener("asterfold:ready", () => observer.disconnect(), { once: true });
window.setTimeout(() => {
  if (root.dataset.asterfoldReady !== "true") root.dataset.asterfoldReady = "true";
  observer.disconnect();
}, 5_000);
