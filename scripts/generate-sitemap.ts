// Generates public/sitemap.xml before dev and build.
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://hokim-bot.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
}

// Public, indexable routes only. Admin, mahalla, and auth surfaces excluded.
const entries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/submit", changefreq: "monthly", priority: "0.9" },
  { path: "/track", changefreq: "monthly", priority: "0.8" },
  { path: "/chat", changefreq: "monthly", priority: "0.7" },
  { path: "/services-guide", changefreq: "monthly", priority: "0.8" },
];

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
