/**
 * scripts/render_demo_video.js
 * Assembles demo-assets/scenes/*.png into CredX_Demo.mp4 with ffmpeg:
 * slow Ken Burns motion per scene + bottom caption, title/end cards, hard cuts.
 *
 * Usage: node scripts/render_demo_video.js <path-to-ffmpeg.exe>
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const FFMPEG = process.argv[2] || "ffmpeg";
const SCENES = path.join(__dirname, "..", "demo-assets", "scenes");
const CLIPS = path.join(__dirname, "..", "demo-assets", "clips");
const OUT = path.join(__dirname, "..", "CredX_Demo.mp4");
const W = 1920, H = 1080, FPS = 30;

const BG = "0x070b14";
const FONT = "C\\:/Windows/Fonts/segoeuib.ttf"; // Segoe UI Bold
const FONT_REG = "C\\:/Windows/Fonts/segoeui.ttf";
const FONT_ARIAL = "C\\:/Windows/Fonts/arialbd.ttf";

fs.mkdirSync(CLIPS, { recursive: true });

function run(args) {
  const r = spawnSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
  if (r.status !== 0) {
    console.error("ffmpeg failed:", args.join(" "));
    console.error(r.stderr ? r.stderr.toString().split("\n").slice(-6).join("\n") : "no stderr");
    process.exit(1);
  }
}

// scene list: [file, caption, durationSec, zoomIn]
const sceneSpecs = [
  ["s1-overview.png", "CredX Protocol Terminal - overview, live credit profile", 9, true],
  ["s2-proofs-live-usc.png", "LIVE: USC ATTESTCOIN BLOCKPROVER (0x0FD2/0x0FD3) - real on-chain reads", 12, false],
  ["s3-proofs-verify-button.png", "Verify & Anchor on 0x0FD2 - in-browser Merkle + continuity proof pipeline", 10, true],
  ["s4-defi.png", "Track 1 Advanced DeFi - under-collateralized lending, flash loans, yield vaults", 9, false],
  ["s5-rwa.png", "Track 2 RWA - invoice financing + treasury yield fund", 9, true],
  ["s6-gaming.png", "Track 3 Gaming - anti-sybil PoH, lootboxes, guild scholarships", 9, false],
  ["s7-depin.png", "Track 4 DePIN - staking delegation, hardware financing, virtual node", 9, true],
  ["s8-ai.png", "Track 5 AI - AgentFi credit lines + verifiable compute escrow", 9, false],
  ["s9-blockscout-anchor.png", "On-chain: proof anchored on 0x0FD2 - Blockscout Creditcoin testnet", 12, true],
  ["s10-blockscout-oracle.png", "BlockProverAttestationOracle 0x4d11...C671 wraps the Creditcoin precompiles", 10, false],
];

function captionFilter(text) {
  return (
    "drawtext=fontfile='" + FONT + "':text='" + escText(text) +
    "':x=70:y=h-90:fontsize=38:fontcolor=white:box=1:boxcolor=black@0.35:boxborderw=16"
  );
}

function escText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

function centeredText(text, x, y, size, color) {
  return "drawtext=fontfile='" + FONT_REG + "':text='" + escText(text) +
    "':fontsize=" + size + ":fontcolor=" + color + ":x=" + x + ":y=" + y;
}

const clipFiles = [];

// Title card (8s)
{
  const f = path.join(CLIPS, "000-title.mp4");
  run([
    "-y", "-f", "lavfi", "-i", "color=c=" + BG + ":s=" + W + "x" + H + ":r=" + FPS, "-t", "8",
    "-vf",
    "drawtext=fontfile='" + FONT_ARIAL + "':text='CredX Protocol':fontsize=96:fontcolor=0x10b981:x=(w-text_w)/2:y=(h-text_h)/2-140," +
    centeredText("Cross-Chain Trustless Credit Bureau", "(w-text_w)/2", "(h-text_h)/2", 40, "white") + "," +
    centeredText("LIVE Attestcoin (0x0FD2) Integration Demo", "(w-text_w)/2", "(h-text_h)/2+90", 30, "0x22d3ee") + "," +
    centeredText("Creditcoin BUIDL 2026 Fall", "(w-text_w)/2", "(h-text_h)/2+150", 24, "0x94a3b8") + "," +
    centeredText("99/99 passing tests - 16 contracts on Creditcoin testnet", "(w-text_w)/2", "(h-text_h)/2+230", 20, "0x94a3b8"),
    "-c:v", "libx264", "-crf", "19", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", String(FPS), f,
  ]);
  clipFiles.push(f);
}

// End card (8s)
{
  const f = path.join(CLIPS, "999-end.mp4");
  run([
    "-y", "-f", "lavfi", "-i", "color=c=" + BG + ":s=" + W + "x" + H + ":r=" + FPS, "-t", "8",
    "-vf",
    "drawtext=fontfile='" + FONT_ARIAL + "':text='CredX Protocol':fontsize=72:fontcolor=0x10b981:x=(w-text_w)/2:y=120," +
    centeredText("Reproduce the live proof", "(w-text_w)/2", "260", 30, "white") + "," +
    centeredText("npm run usc:verify - Sepolia -> 0x0FD2 on Creditcoin testnet", "(w-text_w)/2", "330", 24, "0x22d3ee") + "," +
    centeredText("npx hardhat test  (99/99)", "(w-text_w)/2", "400", 24, "0x94a3b8") + "," +
    centeredText("github.com/tondays52/CredX  -  MIT License", "(w-text_w)/2", "520", 26, "white") + "," +
    centeredText("Thank you", "(w-text_w)/2", "640", 34, "0xf59e0b"),
    "-c:v", "libx264", "-crf", "19", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", String(FPS), f,
  ]);
  clipFiles.push(f);
}

for (let i = 0; i < sceneSpecs.length; i++) {
  const [file, caption, dur, zoomIn] = sceneSpecs[i];
  const png = path.join(SCENES, file);
  if (!fs.existsSync(png)) {
    console.error("missing scene:", png);
    process.exit(1);
  }
  const frames = FPS * dur;
  const zoom = zoomIn
    ? "min(1.25,1+0.0011*on)"
    : "max(1.0,1.25-0.0011*on)";
  const clip = path.join(CLIPS, String(i + 1).padStart(3, "0") + ".mp4");
  run([
    "-y", "-loop", "1", "-framerate", String(FPS), "-i", png,
    "-vf",
    "scale=" + W * 1.25 + ":" + H * 1.25 + ":force_original_aspect_ratio=increase,crop=" + W * 1.25 + ":" + H * 1.25 + "," +
    "zoompan=z='" + zoom + "':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=" + frames + ":s=" + W + "x" + H + ":fps=" + FPS + "," +
    captionFilter(caption),
    "-t", String(dur),
    "-c:v", "libx264", "-crf", "19", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", String(FPS), clip,
  ]);
  clipFiles.push(clip);
  console.log("clip", i + 1, "done");
}

// assemble
{
  const list = path.join(CLIPS, "list.txt");
  fs.writeFileSync(list, clipFiles.map((f) => "file '" + f.replace(/\\/g, "/") + "'").join("\n"));
  run([
    "-y", "-f", "concat", "-safe", "0", "-i", list,
    "-c:v", "libx264", "-crf", "19", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-movflags", "+faststart", "-an", OUT,
  ]);
  console.log("WROTE", OUT);
}

// tidy clips unless kept
if (process.env.KEEP_CLIPS !== "1") {
  fs.rmSync(CLIPS, { recursive: true, force: true });
}