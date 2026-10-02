import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

mkdirSync("artifacts/slides", { recursive: true });
const cachedBrowser =
  "/Users/pomelo/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync(cachedBrowser) ? cachedBrowser : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({
    viewport: { width: 2020, height: 1200 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    pathToFileURL(resolve("artifacts/ProcureMate-pitch.html")).href,
  );
  await page.evaluate(() => document.fonts.ready);
  const slides = page.locator(".slide");
  const count = await slides.count();
  for (let i = 0; i < count; i++) {
    await slides
      .nth(i)
      .screenshot({ path: `artifacts/slides/slide-${i + 1}.png` });
  }
  const issues = await slides.evaluateAll((nodes) =>
    nodes.flatMap((slide, index) => {
      const sr = slide.getBoundingClientRect();
      const failures = [];
      for (const image of slide.querySelectorAll("img")) {
        if (!image.complete || !image.naturalWidth)
          failures.push({
            slide: index + 1,
            text: image.alt,
            error: "Image failed to load",
          });
      }
      const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (
            r.left < sr.left ||
            r.right > sr.right ||
            r.top < sr.top ||
            r.bottom > sr.bottom
          ) {
            failures.push({
              slide: index + 1,
              text: node.textContent,
              error: "Text outside slide",
            });
          }
        }
      }
      return failures;
    }),
  );
  writeFileSync(
    "artifacts/deck-layout-check.json",
    JSON.stringify({ slides: count, issues }, null, 2),
  );
  if (issues.length) throw new Error(JSON.stringify(issues));
  await page.pdf({
    path: "artifacts/ProcureMate-pitch.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  console.log(
    `Exported ${count} slides and PDF; no text outside slide boundaries.`,
  );
} finally {
  await browser.close();
}
