#!/usr/bin/env python3
"""fal.ai helper for the landing film (stills + first/last-frame transitions).

  fal.py image "<prompt>" out.jpg [aspect]       Flux 1.1 Pro Ultra still ($0.06)
  fal.py edit IN.jpg "<instruction>" out.jpg      Nano Banana image edit, keeps the reference geometry ($0.04)
  fal.py flf START.jpg END.jpg "<prompt>" out.mp4 Kling 2.5 Turbo Pro, 5s, lands exactly on END ($0.35)

The key is read from $FAL_KEY or a .env file in this directory or a parent.
"""
import base64, json, os, sys, time, urllib.request

def _key():
    if os.environ.get("FAL_KEY"):
        return os.environ["FAL_KEY"]
    d = os.getcwd()
    while True:
        p = os.path.join(d, ".env")
        if os.path.exists(p):
            for line in open(p):
                if line.startswith("FAL_KEY="):
                    return line.split("=", 1)[1].strip()
        if os.path.dirname(d) == d:
            sys.exit("No FAL_KEY found ($FAL_KEY or .env in cwd/parents)")
        d = os.path.dirname(d)

KEY = _key()
HEADERS = {"Authorization": f"Key {KEY}", "Content-Type": "application/json"}

def request(url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data, HEADERS, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)

def run(endpoint, payload, timeout_s=900):
    q = request(f"https://queue.fal.run/{endpoint}", payload)
    print("queued", q["request_id"], file=sys.stderr)
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        time.sleep(4)
        s = request(q["status_url"])
        if s["status"] == "COMPLETED":
            return request(q["response_url"])
        if s["status"] not in ("IN_QUEUE", "IN_PROGRESS"):
            sys.exit(f"fal status {s}")
    sys.exit("timed out")

def data_url(path):
    mime = "image/png" if path.endswith(".png") else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()

def download(url, out):
    with urllib.request.urlopen(url, timeout=300) as r, open(out, "wb") as f:
        f.write(r.read())
    print(out)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "image":
        prompt, out = sys.argv[2], sys.argv[3]
        aspect = sys.argv[4] if len(sys.argv) > 4 else "16:9"
        res = run("fal-ai/flux-pro/v1.1-ultra", {
            "prompt": prompt, "aspect_ratio": aspect, "num_images": 1,
            "output_format": "jpeg", "enable_safety_checker": True, "raw": True,
        })
        download(res["images"][0]["url"], out)
    elif cmd == "edit":
        src, instruction, out = sys.argv[2:5]
        res = run("fal-ai/nano-banana/edit", {
            "prompt": instruction, "image_urls": [data_url(src)], "num_images": 1, "output_format": "jpeg",
        })
        download(res["images"][0]["url"], out)
    elif cmd == "flf":
        start, end, prompt, out = sys.argv[2:6]
        res = run("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
            "prompt": prompt, "image_url": data_url(start), "tail_image_url": data_url(end),
            "duration": "5", "negative_prompt": "cut, scene change, text, letters, watermark, blur, distortion",
            "cfg_scale": 0.5,
        })
        download(res["video"]["url"], out)
    else:
        sys.exit(__doc__)
