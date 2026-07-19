import { Bookmark, Columns3, Download, FolderKanban, Palette } from "lucide-react";
import type { ThemePresetId } from "../domain/models";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";

interface OnboardingProps {
  open: boolean;
  onClose: () => void;
  onChooseTheme: (preset: ThemePresetId) => void;
  onImport: () => void;
}

export function Onboarding(props: OnboardingProps) {
  return (
    <Modal open={props.open} size="medium" title="Your links, folded into place" description="Asterfold works locally from the first tab. No account is required." onClose={props.onClose} footer={<><Button variant="ghost" onClick={props.onImport} icon={<Download size={16} />}>Import bookmarks</Button><Button variant="primary" onClick={props.onClose}>Start with Inbox</Button></>}>
      <div className="onboarding-steps"><div><FolderKanban /><strong>Pages</strong><span>Separate work, life, and projects.</span></div><div><Columns3 /><strong>Boards</strong><span>Group each Page into clear contexts.</span></div><div><Bookmark /><strong>Bookmarks</strong><span>Save, search, move, and restore.</span></div></div>
      <div className="onboarding-theme"><Palette size={18} /><div><strong>Choose a starting theme</strong><span>You can change every detail later.</span></div><div className="segmented"><button onClick={() => props.onChooseTheme("frost-light")}>Frost</button><button onClick={() => props.onChooseTheme("graphite-dark")}>Graphite</button><button onClick={() => props.onChooseTheme("aurora")}>Aurora</button></div></div>
    </Modal>
  );
}
