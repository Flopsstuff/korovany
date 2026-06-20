#!/usr/bin/env python3
"""
meshy.py — reusable wrapper around the Meshy AI 3D-generation API.

Wraps the full async lifecycle (create -> poll -> fetch -> export) for the
modes FlopBut needs, producing a web-ready GLB by default.

Auth: reads MESHY_API_KEY from the environment. Never logs or prints the key.

Usage:
  # Auth / account check
  python meshy.py balance

  # Text -> 3D (preview is cheap; refine adds PBR textures)
  python meshy.py text "a low-poly treasure chest" --art-style realistic \
      --out ./assets/chest --download

  # Refine an existing preview task into a textured model
  python meshy.py refine <PREVIEW_TASK_ID> --out ./assets/chest --download

  # Image -> 3D
  python meshy.py image https://example.com/ref.png --out ./assets/thing --download

  # Poll/inspect any task
  python meshy.py status <TASK_ID> --kind text-to-3d

Exit code is non-zero on failure so it can be scripted in CI / other skills.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

API_BASE = "https://api.meshy.ai/openapi"


def _key():
    k = os.environ.get("MESHY_API_KEY")
    if not k:
        sys.exit("ERROR: MESHY_API_KEY not set in environment.")
    return k


def _req(method, path, body=None):
    url = path if path.startswith("http") else f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {_key()}")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw}


def balance():
    st, d = _req("GET", "/v1/balance")
    print(json.dumps(d, indent=2))
    return 0 if st == 200 else 1


def _create(path, payload):
    st, d = _req("POST", path, payload)
    if st not in (200, 202):
        print(f"create failed HTTP {st}: {json.dumps(d)}", file=sys.stderr)
        return None
    return d.get("result")


def _poll(get_path, interval, timeout):
    """Poll until SUCCEEDED/FAILED/CANCELED. Returns final task dict."""
    deadline = time.time() + timeout
    last = -1
    while time.time() < deadline:
        st, d = _req("GET", get_path)
        if st != 200:
            print(f"poll HTTP {st}: {json.dumps(d)}", file=sys.stderr)
            time.sleep(interval)
            continue
        status, prog = d.get("status"), d.get("progress", 0)
        if prog != last:
            print(f"  {status} {prog}%", file=sys.stderr)
            last = prog
        if status in ("SUCCEEDED", "FAILED", "CANCELED"):
            return d
        time.sleep(interval)
    print("poll timed out", file=sys.stderr)
    return None


def _download(url, dest):
    req = urllib.request.Request(url)  # signed URL; no auth header needed
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    return os.path.getsize(dest)


def _finish(task, out, download, fmt):
    if not task:
        return 1
    if task.get("status") != "SUCCEEDED":
        print(f"task ended {task.get('status')}: {task.get('task_error')}", file=sys.stderr)
        print(json.dumps({k: task.get(k) for k in ("id", "status", "task_error")}, indent=2))
        return 1
    summary = {
        "task_id": task.get("id"),
        "status": task.get("status"),
        "consumed_credits": task.get("consumed_credits"),
        "art_style": task.get("art_style"),
        "model_urls": task.get("model_urls"),
        "thumbnail_url": task.get("thumbnail_url"),
        "video_url": task.get("video_url"),
        "texture_urls": task.get("texture_urls"),
    }
    print(json.dumps(summary, indent=2))
    if download and out:
        os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
        url = (task.get("model_urls") or {}).get(fmt)
        if not url:
            print(f"no {fmt} url in result", file=sys.stderr)
            return 1
        dest = f"{out}.{fmt}"
        size = _download(url, dest)
        print(f"saved {dest} ({size/1024:.1f} KiB)", file=sys.stderr)
        if task.get("thumbnail_url"):
            try:
                _download(task["thumbnail_url"], f"{out}.thumb.png")
                print(f"saved {out}.thumb.png", file=sys.stderr)
            except Exception as e:
                print(f"thumbnail download skipped: {e}", file=sys.stderr)
    return 0


def cmd_text(a):
    payload = {
        "mode": "preview",
        "prompt": a.prompt,
        "art_style": a.art_style,
        "should_remesh": not a.no_remesh,
    }
    if a.negative_prompt:
        payload["negative_prompt"] = a.negative_prompt
    tid = _create("/v2/text-to-3d", payload)
    if not tid:
        return 1
    print(f"preview task: {tid}", file=sys.stderr)
    task = _poll(f"/v2/text-to-3d/{tid}", a.interval, a.timeout)
    return _finish(task, a.out, a.download, a.format)


def cmd_refine(a):
    tid = _create("/v2/text-to-3d", {"mode": "refine", "preview_task_id": a.preview_task_id})
    if not tid:
        return 1
    print(f"refine task: {tid}", file=sys.stderr)
    task = _poll(f"/v2/text-to-3d/{tid}", a.interval, a.timeout)
    return _finish(task, a.out, a.download, a.format)


def cmd_image(a):
    payload = {"image_url": a.image_url, "should_remesh": not a.no_remesh}
    tid = _create("/v1/image-to-3d", payload)
    if not tid:
        return 1
    print(f"image-to-3d task: {tid}", file=sys.stderr)
    task = _poll(f"/v1/image-to-3d/{tid}", a.interval, a.timeout)
    return _finish(task, a.out, a.download, a.format)


def cmd_status(a):
    base = {"text-to-3d": "/v2/text-to-3d", "image-to-3d": "/v1/image-to-3d"}[a.kind]
    st, d = _req("GET", f"{base}/{a.task_id}")
    if st != 200:
        print(f"HTTP {st}: {json.dumps(d)}", file=sys.stderr)
        return 1
    print(json.dumps(d, indent=2))
    return 0


def main():
    p = argparse.ArgumentParser(description="Meshy 3D-generation wrapper")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--out", help="output path prefix (no extension)")
        sp.add_argument("--download", action="store_true", help="download model + thumbnail")
        sp.add_argument("--format", default="glb", choices=["glb", "fbx", "obj", "usdz", "mtl"])
        sp.add_argument("--interval", type=float, default=5.0)
        sp.add_argument("--timeout", type=float, default=900.0)

    sub.add_parser("balance")

    t = sub.add_parser("text", help="text-to-3D preview")
    t.add_argument("prompt")
    t.add_argument("--art-style", default="realistic")
    t.add_argument("--negative-prompt", default="")
    t.add_argument("--no-remesh", action="store_true")
    common(t)

    r = sub.add_parser("refine", help="refine a preview task into a textured model")
    r.add_argument("preview_task_id")
    common(r)

    im = sub.add_parser("image", help="image-to-3D")
    im.add_argument("image_url")
    im.add_argument("--no-remesh", action="store_true")
    common(im)

    s = sub.add_parser("status")
    s.add_argument("task_id")
    s.add_argument("--kind", default="text-to-3d", choices=["text-to-3d", "image-to-3d"])

    a = p.parse_args()
    if a.cmd == "balance":
        return balance()
    return {"text": cmd_text, "refine": cmd_refine, "image": cmd_image, "status": cmd_status}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
