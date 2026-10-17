"""Procedural sky panoramas (Blender 5.2 Sky Texture, MULTIPLE_SCATTERING model).

Renders the world only through an equirectangular Cycles camera and writes
sRGB 8-bit PNGs + sky_manifest.json into assets/sky/.

Mapping convention (verified empirically with marker objects, see report):
  * camera rotation (90deg, 0, 0) -> image centre column looks along Blender world +Y,
    right side of image (u=0.75) is Blender +X, left (u=0.25) is Blender -X, top row = zenith.
  * Sky Texture sun_rotation = 0 puts the sun on Blender +Y, i.e. the CENTRE column.
  * Blender +Y == glTF/three.js -Z; Blender +X == three.js +X.

Usage:
  python make_skies.py                 # full 4096x2048
  SKY_PREVIEW=1 python make_skies.py   # 1024x512 into scratchpad for quick look
  SKY_ONLY=sky_sunrise python make_skies.py
"""
import bpy, math, os, json, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sky")
SCRATCH = "/tmp/claude-0/-home-user-Song-/bc48a2b6-a562-5aa7-b825-0827b564ca4c/scratchpad/blender_tmp"
PREVIEW = os.environ.get("SKY_PREVIEW") == "1"
ONLY = os.environ.get("SKY_ONLY")

W, H = (1024, 512) if PREVIEW else (4096, 2048)

# name: sun elevation (deg) + Sky Texture params;
# target = display value (sRGB) for the median upper-hemisphere luminance after the shoulder;
# white = tonemap white point; sat = optional saturation grade (HSV) before the shoulder
SKIES = {
    "sky_predawn": dict(elev=-3.5, air=1.0, aerosol=1.0, ozone=3.0, sun_intensity=1.0,
                        sun_size=0.545, target=0.20, pct=50.0, white=6.0),
    "sky_sunrise": dict(elev=2.2, air=1.0, aerosol=1.2, ozone=1.2, sun_intensity=1.0,
                        sun_size=0.545, target=0.42, pct=50.0, white=10.0, sat=1.15),
    "sky_golden":  dict(elev=9.0, air=1.8, aerosol=2.0, ozone=1.0, sun_intensity=1.0,
                        sun_size=0.545, target=0.55, pct=50.0, white=10.0, sat=1.1),
}
AZIMUTH_DEG = 0.0  # sun_rotation; 0 => image centre


def add_tonemap(nt, src, ev, white):
    """Exposure + hue-preserving extended-Reinhard shoulder on luminance, in the world shader:
    c' = c*k ; L = lum(c') ; Ld = L*(1+L/white^2)/(1+L) ; out = c' * Ld/L.
    Keeps the bright aureole around the sun coloured instead of clipping to a white blob."""
    N, L = nt.nodes, nt.links
    k = 2.0 ** ev
    sc = N.new("ShaderNodeVectorMath"); sc.operation = "SCALE"
    L.new(src, sc.inputs[0]); sc.inputs["Scale"].default_value = k
    dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    L.new(sc.outputs[0], dot.inputs[0]); dot.inputs[1].default_value = (0.2126, 0.7152, 0.0722)
    lum = dot.outputs["Value"]
    def m(op, a, b):
        n = N.new("ShaderNodeMath"); n.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]
    num = m("MULTIPLY", lum, m("ADD", 1.0, m("DIVIDE", lum, white * white)))
    ld = m("DIVIDE", num, m("ADD", 1.0, lum))
    ratio = m("DIVIDE", ld, m("MAXIMUM", lum, 1e-8))
    out = N.new("ShaderNodeVectorMath"); out.operation = "SCALE"
    L.new(sc.outputs[0], out.inputs[0]); L.new(ratio, out.inputs["Scale"])
    return soft_clip(nt, out.outputs[0])


def soft_clip(nt, src, t=0.75):
    """Per-channel exponential shoulder above `t` (linear) so saturated highlights roll
    smoothly toward white instead of hard-clipping at 1.0:
    x<=t: x ; x>t: t + (1-t)*(1-exp(-(x-t)/(1-t)))."""
    N, L = nt.nodes, nt.links
    sep = N.new("ShaderNodeSeparateColor"); L.new(src, sep.inputs[0])
    comb = N.new("ShaderNodeCombineColor")
    def m(op, a, b=None):
        n = N.new("ShaderNodeMath"); n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]
    for i in range(3):
        x = sep.outputs[i]
        over = m("MAXIMUM", m("SUBTRACT", x, t), 0.0)
        sh = m("ADD", t, m("MULTIPLY", 1.0 - t, m("SUBTRACT", 1.0, m("EXPONENT", m("DIVIDE", over, -(1.0 - t))))))
        y = m("MINIMUM", x, sh)  # identical below t, shoulder above
        L.new(y, comb.inputs[i])
    return comb.outputs[0]


def tonemapped(Lin, white):
    return Lin * (1 + Lin / white ** 2) / (1 + Lin)


def build_scene(cfg, w, h, samples, ev=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_denoising = False
    s.cycles.use_adaptive_sampling = False
    s.cycles.seed = 0
    s.render.threads_mode = "FIXED"
    s.render.threads = 4
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.resolution_percentage = 100
    s.render.film_transparent = False
    cam = bpy.data.cameras.new("pano")
    cam.type = "PANO"
    cam.panorama_type = "EQUIRECTANGULAR"
    co = bpy.data.objects.new("pano", cam)
    s.collection.objects.link(co)
    co.rotation_euler = (math.pi / 2, 0, 0)
    s.camera = co
    wd = bpy.data.worlds.new("sky")
    s.world = wd
    nt = wd.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = True
    sky.sun_size = math.radians(cfg["sun_size"])
    sky.sun_intensity = cfg["sun_intensity"]
    sky.sun_elevation = math.radians(cfg["elev"])
    sky.sun_rotation = math.radians(AZIMUTH_DEG)
    sky.altitude = 100.0
    sky.air_density = cfg["air"]
    sky.aerosol_density = cfg["aerosol"]
    sky.ozone_density = cfg["ozone"]
    bg = nt.nodes["Background"]
    if ev is None:
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    else:
        src = sky.outputs["Color"]
        if cfg.get("sat", 1.0) != 1.0:  # mild grade: saturation in HSV, before the shoulder
            hsv = nt.nodes.new("ShaderNodeHueSaturation")
            hsv.inputs["Saturation"].default_value = cfg["sat"]
            nt.links.new(src, hsv.inputs["Color"])
            src = hsv.outputs["Color"]
        nt.links.new(add_tonemap(nt, src, ev, cfg["white"]), bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    s.view_settings.gamma = 1.0
    s.sequencer_colorspace_settings.name = "sRGB"
    return s


def probe_exposure(name, cfg):
    """Render a small linear EXR and choose exposure so the pct-percentile luminance of
    the upper hemisphere (sun disc excluded) maps to `target` display value."""
    s = build_scene(cfg, 512, 256, 4)
    s.render.image_settings.file_format = "OPEN_EXR"
    s.render.image_settings.color_depth = "32"
    p = os.path.join(SCRATCH, f"_probe_{name}.exr")
    s.render.filepath = p
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(p)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(256, 512, 4)[..., :3]
    up = a[128:]  # rows bottom->top; upper hemisphere
    lum = up @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    # exclude sun disc neighbourhood (very bright outliers)
    lum = lum[lum < np.percentile(lum, 99.9)]
    ref = float(np.percentile(lum, cfg["pct"]))
    # display value of sRGB-encoded linear v is v^(1/2.4)-ish; target display -> linear
    target_lin = ((cfg["target"] + 0.055) / 1.055) ** 2.4
    # invert the tonemap shoulder numerically: find exposed luminance x with tonemapped(x) = target
    lo, hi = 1e-6, 1e3
    for _ in range(200):
        mid = math.sqrt(lo * hi)
        if tonemapped(mid, cfg["white"]) < target_lin:
            lo = mid
        else:
            hi = mid
    ev = math.log2(mid / ref)
    return round(ev, 3), ref


def render_final(name, cfg, ev):
    s = build_scene(cfg, W, H, 8, ev=ev)
    s.view_settings.exposure = 0.0
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGB"
    s.render.image_settings.color_depth = "8"
    s.render.image_settings.compression = 90
    out = os.path.join(SCRATCH if PREVIEW else OUT, f"{name}{'_preview' if PREVIEW else ''}.png")
    s.render.filepath = out
    bpy.ops.render.render(write_still=True)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SCRATCH, exist_ok=True)
    man_path = os.path.join(OUT, "sky_manifest.json")
    manifest = {}
    if os.path.exists(man_path):
        try:
            manifest = json.load(open(man_path))
        except Exception:
            manifest = {}
    manifest["generator"] = "blender/make_skies.py (Blender %s, Cycles CPU)" % bpy.app.version_string
    manifest["sky_model"] = "ShaderNodeTexSky sky_type=MULTIPLE_SCATTERING, altitude 100 m"
    manifest["resolution"] = [4096, 2048]
    manifest["projection"] = "equirectangular, full 360x180, top row = zenith, bottom row = nadir"
    manifest["color"] = "8-bit sRGB PNG, view transform Standard, look None"
    manifest["mapping"] = {
        "sun_column": "x = 2048 (u = 0.5, horizontal centre of the image)",
        "sun_row": "y = 1024 - elevation_deg * 2048/180 (row 0 = top); elevation 0 = row 1024",
        "blender_world": "image centre = Blender +Y, u=0.75 (right) = Blender +X, u=0.25 (left) = Blender -X, u=0/1 = Blender -Y",
        "gltf_threejs_world": "Blender +Y == three.js -Z, Blender +X == three.js +X. three.js equirectUv() (u = atan(dir.z, dir.x)/2pi + 0.5) samples u=0.5 for dir +X, so with an unrotated scene.background/environment the sun appears toward three.js +X; rotate backgroundRotation/environmentRotation .y to aim it elsewhere (verify visually).",
        "how": "panoramic camera rotation_euler = (90deg, 0, 0); Sky Texture sun_rotation = 0 (sun azimuth on Blender +Y).",
    }
    skies = manifest.setdefault("skies", {})
    for name, cfg in SKIES.items():
        if ONLY and name != ONLY:
            continue
        ev, ref = probe_exposure(name, cfg)
        out = render_final(name, cfg, ev)
        print(f"[sky] {name}: elev={cfg['elev']} ev={ev} ref_lum={ref:.4g} -> {out}")
        if not PREVIEW:
            skies[name] = {
                "file": f"{name}.png",
                "sun_elevation_deg": cfg["elev"],
                "sun_azimuth_deg_blender_sun_rotation": AZIMUTH_DEG,
                "sun_pixel": [2048, round(1024 - cfg["elev"] * 2048 / 180, 1)],
                "sun_disc_visible": cfg["elev"] > -cfg["sun_size"] / 2,
                "exposure_ev": ev,
                "exposure_applied": "in the world shader (colour * 2^ev) followed by a hue-preserving extended-Reinhard luminance shoulder (white point = tonemap_white) and a per-channel exponential soft-clip above 0.75 linear; scene view exposure = 0",
                "tonemap_white": cfg["white"],
                "saturation_grade": cfg.get("sat", 1.0),
                "exposure_method": f"auto: {cfg['pct']}th percentile luminance of upper hemisphere (sun excluded) -> display {cfg['target']}",
                "air_density": cfg["air"],
                "aerosol_density": cfg["aerosol"],
                "ozone_density": cfg["ozone"],
                "sun_size_deg": cfg["sun_size"],
                "sun_intensity": cfg["sun_intensity"],
                "samples": 8,
            }
    if not PREVIEW:
        with open(man_path, "w") as f:
            json.dump(manifest, f, indent=2)
        print("[sky] wrote", man_path)


if __name__ == "__main__":
    main()
