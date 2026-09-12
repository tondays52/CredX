const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://dorahacks.io";
const SLUG = "buidl-ctc-2026-fall";
const OUT = path.join(__dirname, "..", "dorahacks_buidls_raw.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

async function scrapePage(pageNum) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const browser = await puppeteer.launch({
      executablePath: EDGE,
      headless: "new",
      args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,1600"],
    });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(UA);
      // warm up on the homepage outside the WAF scope, then go to the list
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1500));
      await page.goto(`${BASE}/hackathon/${SLUG}/buidl?page=${pageNum}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await new Promise((r) => setTimeout(r, 6000));
      const title = await page.title();
      if (/captcha|verification/i.test(title)) {
        console.log(`page ${pageNum}: WAF blocked (attempt ${attempt})`);
        await browser.close();
        continue;
      }
      // keep clicking "View More" until it stops returning new links
      const seen = new Map();
      for (let i = 0; i < 30; i++) {
        const found = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll('a[href*="/buidl/"]').forEach((a) => {
            const m = (a.getAttribute("href") || "").match(/\/buidl\/(\d+)/);
            if (m) out.push({ id: m[1], href: m[0], text: (a.innerText || "").trim() });
          });
          return out;
        });
        found.forEach((f) => seen.set(f.id, f));
        const clicked = await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")].find((b) => /view more/i.test(b.innerText));
          if (btn && typeof btn.click === "function") {
            btn.click();
            return true;
          }
          return false;
        });
        if (!clicked) break;
        await new Promise((r) => setTimeout(r, 1800));
      }
      await browser.close();
      return [...seen.values()];
    } catch (e) {
      await browser.close();
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return [];
}

(async () => {
  const all = new Map();
  for (let page = 1; page <= 8; page++) {
    const got = await scrapePage(page);
    got.forEach((f) => all.set(f.id, f));
    console.log(`page ${page}: ${got.length} -> total ${all.size}`);
    if (got.length === 0 && page > 1) break;
    if (all.size >= 107) break;
  }
  fs.writeFileSync(OUT, JSON.stringify([...all.values()], null, 2));
  console.log("SAVED", all.size, "->", OUT);
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});