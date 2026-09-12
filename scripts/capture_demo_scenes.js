/**
 * scripts/capture_demo_scenes.js
 * Drives the real frontend (vite preview) in headless Edge and captures PNG scenes for the demo video.
 * Requires: `cd frontend && npm run build` first. Writes into demo-assets/scenes.
 *
 * Usage: node scripts/capture_demo_scenes.js
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = path.join(__dirname, "..", "demo-assets", "scenes");
const BASE = "http://127.0.0.1:4173";

const BLOCKSCOUT_ANCHOR =
  "https://creditcoin-testnet.blockscout.com/tx/0xd0b88f9e7b596e1f23b5d99db9f72261c0d45ab208cd5381c623bca1a8befd69";
const ORACLE_BLOCKSCOUT =
  "https://creditcoin-testnet.blockscout.com/address/0x4d11b60809724b0B67B28DA2f38438aE97f1C671";

fs.mkdirSync(OUT, { recursive: true });

async function waitForServer(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(BASE + "/");
      if (res.ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("preview server did not start");
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), type: "png" });
  console.log("captured", name);
}

async function setHash(page, hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await new Promise((r) => setTimeout(r, 600));
}

async function waitText(page, text, timeout = 25000) {
  await page.waitForFunction((t) => document.body && document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout }, text);
}

async function main() {
  await waitForServer();

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--hide-scrollbars", "--font-render-hinting=none"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    /* S1 — Overview (terminal home) */
    await page.goto(BASE + "/#/overview", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4000));
    await screenshot(page, "s1-overview");

    /* S2 — Proofs & Attest: LIVE USC panel (real 0x0FD3 reads) */
    console.log("S2: opening #/lending");
    await page.goto(BASE + "/#/lending", { waitUntil: "domcontentloaded", timeout: 40000 });
    await waitText(page, "Proofs & Attest", 40000);
    console.log("S2: clicking Proofs & Attest");
    const btn = await page.evaluateHandle(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("Proofs & Attest"));
      if (b) b.click();
      return b ? true : false;
    });
    if (!(await btn.jsonValue())) throw new Error("Proofs & Attest button not found");
    await waitText(page, "LIVE — USC ATTESTCOIN PROTOCOL", 40000);
    console.log("S2: waiting for oracle info load");
    await waitText(page, "Anchored Proofs (on-chain)", 30000);
    try {
      await waitText(page, "attested height", 25000);
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 3500));
    // scroll LIVE panel into view
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("h3")).find((h) => h.innerText.includes("BlockProverAttestationOracle"));
      if (el) el.scrollIntoView({ block: "center" });
    });
    await new Promise((r) => setTimeout(r, 1200));
    await screenshot(page, "s2-proofs-live-usc");
    console.log("S2: captured");

    /* S3 — Verify & Anchor button (scroll to it) */
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.includes("Verify & Anchor on 0x0FD2"));
      if (b) b.scrollIntoView({ block: "center" });
    });
    await new Promise((r) => setTimeout(r, 1000));
    await screenshot(page, "s3-proofs-verify-button");

    /* S4 — DeFi hub */
    await page.goto(BASE + "/#/defi", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s4-defi");

    /* S5 — RWA */
    await page.goto(BASE + "/#/rwa", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4000));
    await screenshot(page, "s5-rwa");

    /* S6 — Gaming */
    await page.goto(BASE + "/#/gaming", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4000));
    await screenshot(page, "s6-gaming");

    /* S7 — DePIN */
    await page.goto(BASE + "/#/depin", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s7-depin");

    /* S8 — AI */
    await page.goto(BASE + "/#/ai", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4000));
    await screenshot(page, "s8-ai");

    /* S9-S12 — Enterprise policy layer panes (RiskGuard, Covenant Ops, Purpose-Bound RWA, Usage Meters) */
    await page.goto(BASE + "/#/lending", { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitText(page, "Proofs & Attest", 40000);
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("Proofs & Attest"));
      if (b) b.click();
    });
    await waitText(page, "Credit & Proofs", 30000);

    /* S9 — RiskGuard Gate */
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("RiskGuard Gate"));
      if (b) b.click();
    });
    await waitText(page, "RiskGuard", 30000);
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s11-riskguard");

    /* S10 — Covenant Ops */
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("Covenant Ops"));
      if (b) b.click();
    });
    await waitText(page, "Covenant Ops", 30000);
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s12-covenant-ops");

    /* S11 — Purpose-Bound RWA */
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("Purpose-Bound RWA"));
      if (b) b.click();
    });
    await waitText(page, "Purpose-Bound RWA Vault", 30000);
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s13-purpose-bound");

    /* S12 — Usage Meters */
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("Usage Meters"));
      if (b) b.click();
    });
    await waitText(page, "Metered Usage & Accountability", 30000);
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s14-usage-meters");

    /* S15 — Verified Escrow */
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("Verified Escrow"));
      if (b) b.click();
    });
    await waitText(page, "escrow jobs — read live from the deployed vault", 30000);
    try { await waitText(page, "RELEASED", 15000); } catch (_) {}
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s15-verified-escrow");

    /* S16 — Evidence Registry */
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.innerText.includes("Evidence Registry"));
      if (b) b.click();
    });
    await waitText(page, "Evidence Registry", 30000);
    await new Promise((r) => setTimeout(r, 4500));
    await screenshot(page, "s16-evidence-registry");

    /* S13 — Blockscout: on-chain anchor tx (real proof of 0x0FD2) */
    const bs = await browser.newPage();
    bs.setDefaultTimeout(40000);
    bs.setViewport({ width: 1600, height: 900 });
    try {
      await bs.goto(BLOCKSCOUT_ANCHOR, { waitUntil: "domcontentloaded", timeout: 40000 });
      await new Promise((r) => setTimeout(r, 9000));
      await screenshot(bs, "s9-blockscout-anchor");
    } catch (e) {
      console.log("blockscout anchor capture failed:", e.message);
    }

    /* S10 — Blockscout: oracle contract */
    try {
      await bs.goto(ORACLE_BLOCKSCOUT, { waitUntil: "domcontentloaded", timeout: 40000 });
      await new Promise((r) => setTimeout(r, 8000));
      await screenshot(bs, "s10-blockscout-oracle");
    } catch (e) {
      console.log("blockscout oracle capture failed:", e.message);
    }

    await browser.close();
    console.log("done: scenes in", OUT);
  } finally {
    if (browser.connected) await browser.close();
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("CAPTURE FAILED:", e.message);
  console.error(e.stack);
  process.exit(1);
});