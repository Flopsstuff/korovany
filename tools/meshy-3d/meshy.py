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


def _finish(task, out, download, fmt, url_keys=None):
    """Print a result summary and optionally download the model.

    url_keys: ordered list of top-level task fields to try as the direct model
    URL (used by rigging/animation, whose result is a flat *_glb_url field
    rather than the model_urls dict that text-to-3d / retexture return).
    """
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
        # rigging / animation result fields (present only for those modes):
        "rigged_character_glb_url": task.get("rigged_character_glb_url"),
        "rigged_character_fbx_url": task.get("rigged_character_fbx_url"),
        "basic_animations": task.get("basic_animations"),
        "animation_glb_url": task.get("animation_glb_url"),
        "animation_fbx_url": task.get("animation_fbx_url"),
    }
    summary = {k: v for k, v in summary.items() if v is not None}
    print(json.dumps(summary, indent=2))
    if download and out:
        os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
        url = None
        for k in (url_keys or []):
            url = task.get(k)
            if url:
                break
        if not url:
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
    if not a.no_remesh:
        # target_polycount / topology only apply when remesh is on. Keeps the
        # mesh inside the web/game poly budget instead of Meshy's 30k default.
        payload["target_polycount"] = a.target_polycount
        payload["topology"] = a.topology
    if a.negative_prompt:
        payload["negative_prompt"] = a.negative_prompt
    tid = _create("/v2/text-to-3d", payload)
    if not tid:
        return 1
    print(f"preview task: {tid}", file=sys.stderr)
    task = _poll(f"/v2/text-to-3d/{tid}", a.interval, a.timeout)
    return _finish(task, a.out, a.download, a.format)


def cmd_refine(a):
    payload = {"mode": "refine", "preview_task_id": a.preview_task_id}
    if a.enable_pbr:
        payload["enable_pbr"] = True  # albedo/normal/roughness/metallic maps
    if a.hd_texture:
        payload["hd_texture"] = True  # 4K base color — heavier web payload
    tid = _create("/v2/text-to-3d", payload)
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


def cmd_retexture(a):
    """UV-unwrap + texture an existing (possibly untextured) mesh, geometry-preserving.

    This is the right tool for v1.2 low-poly: it paints albedo onto the exact
    input mesh without remeshing, so the faceted silhouette is untouched (unlike
    text-to-3d `refine`, whose PBR pass drifts the surface into a realistic band).
    `--remove-lighting` (on by default) bakes a flat unlit albedo for flat shading.
    """
    payload = {}
    if a.input_task_id:
        payload["input_task_id"] = a.input_task_id
    elif a.model_url:
        payload["model_url"] = a.model_url
    else:
        sys.exit("retexture needs --input-task-id or --model-url")
    if a.text_style_prompt:
        payload["text_style_prompt"] = a.text_style_prompt
    elif a.image_style_url:
        payload["image_style_url"] = a.image_style_url
    else:
        sys.exit("retexture needs --text-style-prompt or --image-style-url")
    payload["enable_pbr"] = a.enable_pbr
    payload["remove_lighting"] = not a.keep_lighting
    if a.original_uv:
        payload["enable_original_uv"] = True  # reuse input UVs instead of unwrapping fresh
    if a.hd_texture:
        payload["hd_texture"] = True
    if a.ai_model:
        payload["ai_model"] = a.ai_model
    tid = _create("/v1/retexture", payload)
    if not tid:
        return 1
    print(f"retexture task: {tid}", file=sys.stderr)
    task = _poll(f"/v1/retexture/{tid}", a.interval, a.timeout)
    return _finish(task, a.out, a.download, a.format)


def cmd_rig(a):
    """Auto-rig a TEXTURED humanoid (must face +Z, <=300k faces). 5 credits.

    Returns a rigged GLB/FBX plus basic walk/run clips. Texture the mesh first
    (retexture/refine) — rigging rejects untextured input.
    """
    payload = {"height_meters": a.height_meters}
    if a.input_task_id:
        payload["input_task_id"] = a.input_task_id
    elif a.model_url:
        payload["model_url"] = a.model_url
    else:
        sys.exit("rig needs --input-task-id or --model-url")
    if a.texture_image_url:
        payload["texture_image_url"] = a.texture_image_url
    tid = _create("/v1/rigging", payload)
    if not tid:
        return 1
    print(f"rigging task: {tid}", file=sys.stderr)
    task = _poll(f"/v1/rigging/{tid}", a.interval, a.timeout)
    return _finish(task, a.out, a.download, a.format,
                   url_keys=["rigged_character_glb_url", "rigged_character_fbx_url"])


def cmd_animate(a):
    """Apply an animation (action_id) to a rigged character. ~3 credits.

    rig_task_id is the id of a SUCCEEDED rigging task. action_id selects the clip
    from Meshy's animation library (see docs Animation Library Reference).
    """
    payload = {"rig_task_id": a.rig_task_id, "action_id": a.action_id}
    if a.fps:
        payload["post_process"] = {"operation_type": "change_fps", "fps": a.fps}
    tid = _create("/v1/animations", payload)
    if not tid:
        return 1
    print(f"animation task: {tid}", file=sys.stderr)
    task = _poll(f"/v1/animations/{tid}", a.interval, a.timeout)
    return _finish(task, a.out, a.download, a.format,
                   url_keys=["animation_glb_url", "animation_fbx_url"])


def cmd_status(a):
    base = {
        "text-to-3d": "/v2/text-to-3d",
        "image-to-3d": "/v1/image-to-3d",
        "retexture": "/v1/retexture",
        "rigging": "/v1/rigging",
        "animations": "/v1/animations",
    }[a.kind]
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
    t.add_argument("--target-polycount", type=int, default=30000,
                   help="remesh target poly count (100-300000); web/game budget is low")
    t.add_argument("--topology", default="triangle", choices=["triangle", "quad"])
    common(t)

    r = sub.add_parser("refine", help="refine a preview task into a textured model")
    r.add_argument("preview_task_id")
    r.add_argument("--enable-pbr", action="store_true",
                   help="generate PBR maps (albedo/normal/roughness/metallic)")
    r.add_argument("--hd-texture", action="store_true",
                   help="4K base-color texture (heavier payload; off for web)")
    common(r)

    im = sub.add_parser("image", help="image-to-3D")
    im.add_argument("image_url")
    im.add_argument("--no-remesh", action="store_true")
    common(im)

    rt = sub.add_parser("retexture",
                        help="UV-unwrap + texture an existing mesh (geometry-preserving)")
    rt_src = rt.add_mutually_exclusive_group(required=True)
    rt_src.add_argument("--input-task-id", help="id of a prior Meshy task to texture")
    rt_src.add_argument("--model-url", help="GLB URL or data URI to texture")
    rt_style = rt.add_mutually_exclusive_group(required=True)
    rt_style.add_argument("--text-style-prompt", help="describe the look (e.g. 'flat low-poly muted palette')")
    rt_style.add_argument("--image-style-url", help="reference image for the texture style")
    rt.add_argument("--enable-pbr", action="store_true", help="also emit metallic/roughness/normal maps")
    rt.add_argument("--keep-lighting", action="store_true",
                    help="keep baked lighting (default removes it for flat shading)")
    rt.add_argument("--original-uv", action="store_true", help="reuse input UVs instead of unwrapping fresh")
    rt.add_argument("--hd-texture", action="store_true", help="4K texture (heavier payload; off for web)")
    rt.add_argument("--ai-model", default="", help="meshy-5 / meshy-6 / latest")
    common(rt)

    rg = sub.add_parser("rig", help="auto-rig a TEXTURED humanoid (faces +Z)")
    rg_src = rg.add_mutually_exclusive_group(required=True)
    rg_src.add_argument("--input-task-id", help="id of a prior SUCCEEDED textured-model task")
    rg_src.add_argument("--model-url", help="textured GLB URL or data URI")
    rg.add_argument("--height-meters", type=float, default=1.8, help="character height in meters")
    rg.add_argument("--texture-image-url", default="", help="optional external texture")
    common(rg)

    an = sub.add_parser("animate", help="apply an animation clip to a rigged character")
    an.add_argument("rig_task_id", help="id of a SUCCEEDED rigging task")
    an.add_argument("--action-id", type=int, required=True, help="animation library clip id")
    an.add_argument("--fps", type=int, default=0, choices=[0, 24, 25, 30, 60],
                    help="output fps (0 = Meshy default 30; change_fps post-process)")
    common(an)

    s = sub.add_parser("status")
    s.add_argument("task_id")
    s.add_argument("--kind", default="text-to-3d",
                   choices=["text-to-3d", "image-to-3d", "retexture", "rigging", "animations"])

    a = p.parse_args()
    if a.cmd == "balance":
        return balance()
    return {
        "text": cmd_text, "refine": cmd_refine, "image": cmd_image,
        "retexture": cmd_retexture, "rig": cmd_rig, "animate": cmd_animate,
        "status": cmd_status,
    }[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
