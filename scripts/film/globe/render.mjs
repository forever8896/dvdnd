// Renders globe.html to frames in headless Chrome, then encodes them with ffmpeg.
//
//   node render.mjs              full render: frames/, out/globe.mp4, out/k3.png, out/k4.png, out/labels.json
//   node render.mjs --stills     only the first, middle and last frames (fast look)
//
// Needs Google Chrome installed, ffmpeg on PATH, and the cache/ textures (see README).
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const ROOT = new URL(".", import.meta.url).pathname;
const STILLS = process.argv.includes("--stills");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "");
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`http://localhost:${port}/globe.html`);
await page.waitForFunction(() => typeof window.setup === "function");
const info = await page.evaluate(() => window.setup());
console.log(`setup: ${info.frames} frames @ ${info.fps}fps`);
console.log("country activation (s):", info.activation.map(([c, s]) => `${c} ${s}`).join(", "));

const outDir = join(ROOT, "out"), frameDir = join(ROOT, "frames");
await mkdir(outDir, { recursive: true });
if (!STILLS) { await rm(frameDir, { recursive: true, force: true }); await mkdir(frameDir, { recursive: true }); }

const toPng = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");
const want = STILLS ? [0, Math.floor(info.frames / 2), info.frames - 1] : [...Array(info.frames).keys()];
const labels = [];
for (const f of want) {
  const { png, labels: l } = await page.evaluate((i) => window.renderFrame(i), f);
  labels[f] = l;
  const file = STILLS ? join(outDir, `still-${String(f).padStart(4, "0")}.png`) : join(frameDir, `f${String(f).padStart(4, "0")}.png`);
  await writeFile(file, toPng(png));
  if (!STILLS && f % 24 === 0) console.log(`frame ${f}/${info.frames}`);
}
await browser.close();
server.close();

const scale = `scale=${info.width}:${info.height}:flags=lanczos`;
if (STILLS) {
  for (const f of want) {
    const src = join(outDir, `still-${String(f).padStart(4, "0")}.png`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", scale, src.replace(".png", "-1x.png")]);
  }
  console.log("stills written to out/");
} else {
  await writeFile(join(outDir, "labels.json"), JSON.stringify({ fps: info.fps, width: info.width, height: info.height, frames: labels }));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(info.fps), "-i", join(frameDir, "f%04d.png"),
    "-vf", `${scale},setsar=1`, "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", join(outDir, "globe.mp4")]);
  const last = String(info.frames - 1).padStart(4, "0");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(frameDir, "f0000.png"), "-vf", scale, join(outDir, "k3.png")]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(frameDir, `f${last}.png`), "-vf", scale, join(outDir, "k4.png")]);
  console.log("wrote out/globe.mp4, out/k3.png, out/k4.png, out/labels.json");
}
