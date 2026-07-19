const CHANNEL_NAME = "asterfold-data-v1";

export type ChangeArea = "page" | "board" | "bookmark" | "settings" | "trash" | "all";

export class ChangeBus {
  private readonly channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

  public publish(area: ChangeArea): void {
    this.channel?.postMessage({ area, at: Date.now() });
  }

  public subscribe(listener: (area: ChangeArea) => void): () => void {
    if (!this.channel) return () => undefined;
    const handler = (event: MessageEvent<unknown>): void => {
      const area = typeof event.data === "object" && event.data !== null && "area" in event.data ? String(event.data.area) : "all";
      if (["page", "board", "bookmark", "settings", "trash", "all"].includes(area)) listener(area as ChangeArea);
    };
    this.channel.addEventListener("message", handler);
    return () => this.channel?.removeEventListener("message", handler);
  }

  public close(): void {
    this.channel?.close();
  }
}

export const changeBus = new ChangeBus();
