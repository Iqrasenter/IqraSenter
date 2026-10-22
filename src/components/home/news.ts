import { NEWS } from "@/lib/constants";

type NewsItem = (typeof NEWS)[number];

// The homepage shows the three newest items from the same list as /sistenytt,
// so a new entry in NEWS appears here without touching this page.
// Layout: one photo story as the lead, then two smaller stories.
export function homeNews() {
  const latest = [...NEWS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const lead = latest.find((item) => "gallery" in item) ?? latest[0];
  const [deskTop, deskBottom] = latest.filter((item) => item !== lead);
  return { lead, deskTop, deskBottom };
}

export function newsDate(item: NewsItem) {
  return new Date(item.date).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Short headline for a card: the hand-written card title if there is one.
export function newsTitle(item: NewsItem) {
  const titles: { title: string; cardTitle?: string } = item;
  return titles.cardTitle ?? titles.title;
}

// Short text for a card: the hand-written card text if there is one,
// otherwise the excerpt cut at a word boundary.
export function newsBlurb(item: NewsItem, max = 150) {
  if ("cardExcerpt" in item) return item.cardExcerpt;
  if (item.excerpt.length <= max) return item.excerpt;
  const cut = item.excerpt.slice(0, max).replace(/\s+\S*$/, "");
  return `${cut} …`;
}

// Edited versions of the photos, used where a story's own picture has one.
const EDITED_PHOTO: Record<string, { src: string; alt: string }> = {
  "/images/home/stage-editorial.webp": {
    src: "/images/home/summer-editorial.webp",
    alt: "Barn og familier samlet ute under Iqras sommerfest",
  },
};

export function newsLeadPhoto(item: NewsItem) {
  return (
    EDITED_PHOTO[item.image] ?? {
      src: item.image,
      alt: "gallery" in item ? item.gallery[0].alt : item.title,
    }
  );
}
