import { NEWS } from "@/lib/constants";

export type NewsItem = (typeof NEWS)[number];

// The news page, in order: the newest story with photographs opens the page as a photo strip,
// the next two stories get a large block each, and everything older goes in the archive grid.
// A new entry in NEWS lands in the right place without touching the page.
export function newsSections() {
  const sorted = [...NEWS].sort((a, b) => b.date.localeCompare(a.date));
  const lead = sorted.find((item) => "gallery" in item) ?? sorted[0];
  const rest = sorted.filter((item) => item !== lead);
  return { lead, blocks: rest.slice(0, 2), archive: rest.slice(2) };
}

export function itemDetails(item: NewsItem): readonly { icon: string; text: string }[] {
  return "details" in item ? item.details : [];
}

export function itemFit(item: NewsItem): "contain" | "cover" {
  return "imageFit" in item && item.imageFit === "contain" ? "contain" : "cover";
}

export function itemPosition(item: NewsItem): string | undefined {
  return "imagePosition" in item ? item.imagePosition : undefined;
}

export function itemLink(item: NewsItem): { label: string; href: string } | undefined {
  return "link" in item ? item.link : undefined;
}
