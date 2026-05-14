import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type NewsItem = {
  title: string;
  date: string;
  excerpt: string;
  image: string;
  imagePosition?: string;
  body?: string;
};

const NEWS_DIR = path.join(process.cwd(), "content", "news");

function loadNews(): NewsItem[] {
  return readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(NEWS_DIR, f), "utf-8")) as NewsItem)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const NEWS = loadNews();
