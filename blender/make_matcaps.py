"""Procedural matcaps for the Three.js renderer (MeshMatcapMaterial).

Each matcap = a perfect sphere (radius 1) rendered with an orthographic camera
(ortho_scale = 2 * radius) at 512x512, Cycles CPU, view transform Standard.
Lighting comes only from emissive planes and a procedural world gradient
(no image files). Camera looks along Blender +Y, image up = +Z, image right = +X.
Background seen by camera rays is black (light path trick), so outside the
sphere is black.

Usage:  python make_matcaps.py [name ...]     (no args = all)
"""
import bpy, math, os, sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "matcaps")
RES = 512
SAMPLES = int(os.environ.get("MATCAP_SAMPLES", "128"))


# ---------------------------------------------------------------- helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = SAMPLES
    s.cycles.use_adaptive_sampling = False
    s.cycles.seed = 7
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 8
    s.cycles.glossy_bounces = 4
    s.cycles.sample_clamp_indirect = 20.0
    s.render.threads_mode = "FIXED"
    s.render.threads = 4
    s.render.resolution_x = s.render.resolution_y = RES
    s.render.resolution_percentage = 100
    s.render.film_transparent = False
    s.render.filter_size = 1.2
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    s.view_settings.exposure = 0.0
    s.view_settings.gamma = 1.0
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGB"
    s.render.image_settings.color_depth = "8"
    s.render.image_settings.compression = 90
    # camera
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = 2.0  # = 2 * radius -> sphere touches frame edges
    cam.clip_start = 0.1
    cam.clip_end = 100
    co = bpy.data.objects.new("cam", cam)
    s.collection.objects.link(co)
    co.location = (0, -10, 0)
    co.rotation_euler = (math.pi / 2, 0, 0)
    s.camera = co
    return s


def sphere(mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1.0, location=(0, 0, 0))
    ob = bpy.context.object
    ob.name = "matcap_sphere"
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    return ob


def direction(az, el):
    """az: 0 = toward the viewer (-Y), +90 = right (+X), 180 = behind sphere (+Y); el: up."""
    a, e = math.radians(az), math.radians(el)
    return Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e)))


def emit_plane(name, az, el, w, h, color, strength, dist=12.0, roll=0.0, glossy_only=False):
    d = direction(az, el)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=d * dist)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (w, h, 1)
    q = (-d).to_track_quat("Z", "Y")  # plane normal (+Z) faces the sphere
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = q
    if roll:
        ob.rotation_mode = "XYZ"
        ob.rotation_euler.rotate_axis("Z", math.radians(roll))
    m = bpy.data.materials.new(name + "_mat")
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(m)
    ob.visible_camera = False
    ob.visible_shadow = False
    if glossy_only:
        ob.visible_diffuse = False
    return ob


def world_gradient(stops, extra=None, strength=1.0):
    """Procedural environment: colour ramp over ray direction Z (-1..1 mapped 0..1).
    `extra` = list of (dir_vector, color, power, gain) directional glows added on top.
    Camera rays see black."""
    s = bpy.context.scene
    w = bpy.data.worlds.new("env")
    s.world = w
    nt = w.node_tree
    N, L = nt.nodes, nt.links
    bg = N["Background"]
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Generated"], sep.inputs[0])
    mr = N.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1.0
    mr.inputs["From Max"].default_value = 1.0
    L.new(sep.outputs["Z"], mr.inputs["Value"])
    ramp = N.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "B_SPLINE" if len(stops) > 2 else "LINEAR"
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = stops[1][0], (*stops[1][1], 1)
    for pos, col in stops[2:]:
        el = cr.elements.new(pos)
        el.color = (*col, 1)
    L.new(mr.outputs["Result"], ramp.inputs["Fac"])
    col = ramp.outputs["Color"]
    for (dvec, ecol, power, gain) in (extra or []):
        dvec = Vector(dvec).normalized()
        dot = N.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
        L.new(tc.outputs["Generated"], dot.inputs[0]); dot.inputs[1].default_value = dvec
        cl = N.new("ShaderNodeMath"); cl.operation = "MAXIMUM"; cl.inputs[1].default_value = 0.0
        L.new(dot.outputs["Value"], cl.inputs[0])
        pw = N.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = power
        L.new(cl.outputs[0], pw.inputs[0])
        g = N.new("ShaderNodeMath"); g.operation = "MULTIPLY"; g.inputs[1].default_value = gain
        L.new(pw.outputs[0], g.inputs[0])
        mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "ADD"; mix.clamp_result = False
        mix.inputs["Factor"].default_value = 1.0
        L.new(col, mix.inputs["A"])
        sc = N.new("ShaderNodeVectorMath"); sc.operation = "SCALE"
        sc.inputs[0].default_value = ecol
        L.new(g.outputs[0], sc.inputs["Scale"])
        L.new(sc.outputs[0], mix.inputs["B"])
        col = mix.outputs["Result"]
    L.new(col, bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    # camera rays -> black background
    lp = N.new("ShaderNodeLightPath")
    blk = N.new("ShaderNodeBackground"); blk.inputs["Color"].default_value = (0, 0, 0, 1)
    mixs = N.new("ShaderNodeMixShader")
    L.new(lp.outputs["Is Camera Ray"], mixs.inputs["Fac"])
    L.new(bg.outputs[0], mixs.inputs[1])
    L.new(blk.outputs[0], mixs.inputs[2])
    L.new(mixs.outputs[0], N["World Output"].inputs["Surface"])
    return w


def principled(name, **kw):
    m = bpy.data.materials.new(name)
    p = m.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items():
        if isinstance(v, tuple) and len(v) == 3:
            v = (*v, 1.0)
        p.inputs[k].default_value = v
    return m


def render(name):
    s = bpy.context.scene
    path = os.path.join(OUT, f"{name}.png")
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"[matcap] wrote {path}")


# ---------------------------------------------------------------- looks
def chrome_night():
    s = reset()
    sphere(principled("chrome", **{"Base Color": (0.92, 0.93, 0.96), "Metallic": 1.0, "Roughness": 0.03}))
    # z-gradient: floor (dark) | horizon violet-blue band | navy -> indigo zenith
    world_gradient([
        (0.00, (0.002, 0.002, 0.004)),
        (0.40, (0.006, 0.006, 0.014)),
        (0.49, (0.020, 0.018, 0.050)),
        (0.515, (0.20, 0.13, 0.55)),   # violet-blue horizon band
        (0.56, (0.06, 0.05, 0.22)),
        (0.70, (0.018, 0.022, 0.095)),
        (1.00, (0.006, 0.008, 0.040)),
    ])
    amber, sodium, cyan, ice = (1.0, 0.50, 0.12), (1.0, 0.36, 0.06), (0.10, 0.85, 1.0), (0.55, 0.85, 1.0)
    magenta = (0.85, 0.25, 1.0)
    strips = [
        # az, el, w, h, colour, strength   (distance 12; w/h in units)
        (-35, 8, 4.4, 0.7, amber, 14), (-62, 16, 0.6, 3.4, cyan, 12), (20, 5, 6.0, 0.55, sodium, 16),
        (48, 20, 0.5, 4.0, amber, 12), (75, 4, 4.0, 0.6, cyan, 14), (-95, 6, 3.0, 0.4, sodium, 14),
        (110, 12, 0.45, 3.0, ice, 10), (-140, 9, 2.6, 0.35, cyan, 12), (150, 6, 3.0, 0.4, amber, 10),
        (8, 26, 0.9, 0.9, ice, 6), (-10, 1.5, 7.0, 0.22, amber, 8),   # far street glow on the horizon
        (32, 40, 3.0, 0.25, cyan, 7), (-55, 46, 0.3, 2.6, amber, 6), (-20, 18, 1.4, 0.3, magenta, 8),
        (88, 30, 0.35, 1.8, sodium, 9), (-78, 32, 1.8, 0.25, ice, 7), (165, 22, 0.35, 2.2, cyan, 9),
        (-165, 20, 0.4, 2.0, amber, 9),
        # blurred street reflections below the horizon (dimmer, on the "wet floor")
        (-35, -10, 4.0, 0.5, amber, 2.0), (20, -8, 5.5, 0.4, sodium, 2.2), (75, -9, 3.6, 0.4, cyan, 1.8),
        (-62, -14, 0.6, 2.4, cyan, 1.4),
    ]
    for i, (az, el, w, h, c, k) in enumerate(strips):
        emit_plane(f"strip{i}", az, el, w, h, c, k)
    render("chrome_night")


def gold():
    s = reset()
    sphere(principled("gold", **{"Base Color": (1.0, 0.66, 0.25), "Metallic": 1.0, "Roughness": 0.18,
                                 "Specular Tint": (1.0, 0.85, 0.6)}))
    world_gradient([
        (0.00, (0.004, 0.002, 0.001)),
        (0.42, (0.010, 0.006, 0.003)),
        (0.52, (0.07, 0.042, 0.020)),
        (0.75, (0.035, 0.022, 0.012)),
        (1.00, (0.020, 0.013, 0.008)),
    ])
    emit_plane("key", -42, 40, 10, 8, (1.0, 0.93, 0.82), 10.0, dist=10, roll=-20)  # big soft key, top-left
    emit_plane("rim", 118, 12, 1.2, 9, (1.0, 0.86, 0.66), 12.0, dist=10)       # rim strip right
    emit_plane("fill", 60, 10, 6, 3, (0.9, 0.7, 0.45), 1.2, dist=10)            # gentle warm fill right
    emit_plane("top", 20, 80, 14, 14, (1.0, 0.9, 0.75), 0.8, dist=10)
    emit_plane("floor_bounce", 0, -40, 24, 3, (0.40, 0.20, 0.08), 0.5, dist=10)
    render("gold")


def obsidian():
    s = reset()
    sphere(principled("obsidian", **{"Base Color": (0.02, 0.02, 0.022), "Metallic": 0.0, "Roughness": 0.25,
                                     "IOR": 1.5}))
    world_gradient([
        (0.00, (0.000, 0.000, 0.000)),
        (0.50, (0.002, 0.002, 0.003)),
        (1.00, (0.006, 0.007, 0.010)),
    ])
    emit_plane("rim_cool", -150, 20, 8, 10, (0.45, 0.70, 1.0), 14.0, dist=10)   # behind-left, cool
    emit_plane("rim_cool2", -120, 35, 2, 6, (0.6, 0.8, 1.0), 6.0, dist=10)
    emit_plane("kicker_warm", 120, -5, 2.5, 7, (1.0, 0.55, 0.25), 3.0, dist=10)  # subtle warm kicker right
    emit_plane("top_soft", -20, 60, 6, 4, (0.7, 0.75, 0.85), 0.6, dist=10)      # faint top spec
    render("obsidian")


def glass_echo():
    s = reset()
    m = bpy.data.materials.new("glass_echo")
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    lw = N.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    ramp = N.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "B_SPLINE"
    pts = [(0.00, (0.002, 0.006, 0.012)), (0.30, (0.004, 0.018, 0.035)),
           (0.42, (0.010, 0.07, 0.11)),   # faint inner "echo" ring
           (0.50, (0.004, 0.022, 0.040)),
           (0.70, (0.02, 0.20, 0.32)), (0.86, (0.10, 0.75, 1.0)), (0.95, (0.55, 0.95, 1.0)),
           (1.00, (1.0, 1.0, 1.0))]
    cr.elements[0].position, cr.elements[0].color = pts[0][0], (*pts[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = pts[-1][0], (*pts[-1][1], 1)
    for p, c in pts[1:-1]:
        e = cr.elements.new(p); e.color = (*c, 1)
    L.new(lw.outputs["Facing"], ramp.inputs["Fac"])
    em = N.new("ShaderNodeEmission")
    L.new(ramp.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    gl = N.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.06
    gl.inputs["Color"].default_value = (0.6, 0.9, 1.0, 1)
    fr = N.new("ShaderNodeFresnel"); fr.inputs["IOR"].default_value = 1.45
    # glossy weighted by ~0.25 + fresnel so central highlights stay faint
    mx = N.new("ShaderNodeMath"); mx.operation = "MULTIPLY_ADD"
    L.new(fr.outputs[0], mx.inputs[0]); mx.inputs[1].default_value = 0.6; mx.inputs[2].default_value = 0.12
    tr = N.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (0, 0, 0, 1)
    mixg = N.new("ShaderNodeMixShader")
    L.new(mx.outputs[0], mixg.inputs["Fac"])
    L.new(tr.outputs[0], mixg.inputs[1])   # black "nothing"
    L.new(gl.outputs[0], mixg.inputs[2])
    add = N.new("ShaderNodeAddShader")
    L.new(em.outputs[0], add.inputs[0])
    L.new(mixg.outputs[0], add.inputs[1])
    L.new(add.outputs[0], out.inputs["Surface"])
    sphere(m)
    world_gradient([(0.0, (0, 0, 0)), (1.0, (0.002, 0.004, 0.008))])
    emit_plane("hl_a", -30, 35, 1.6, 0.9, (0.8, 0.95, 1.0), 5.0, dist=10)
    emit_plane("hl_b", 35, -20, 0.7, 0.7, (0.4, 0.9, 1.0), 3.0, dist=10)
    emit_plane("hl_strip", 70, 40, 0.25, 3.5, (0.6, 0.95, 1.0), 4.0, dist=10, roll=25)
    # transparent BSDF over black world would reveal world; world is ~black anyway
    s.cycles.transparent_max_bounces = 2
    render("glass_echo")


def pearl_dawn():
    s = reset()
    sphere(principled("pearl", **{"Base Color": (0.86, 0.78, 0.74), "Metallic": 0.0, "Roughness": 0.38,
                                  "Sheen Weight": 0.6, "Sheen Tint": (1.0, 0.85, 0.80), "Sheen Roughness": 0.4,
                                  "Coat Weight": 0.35, "Coat Roughness": 0.22,
                                  "Subsurface Weight": 0.0}))
    tl = direction(-60, 50)
    world_gradient([
        (0.00, (0.020, 0.014, 0.014)),
        (0.45, (0.06, 0.045, 0.045)),
        (0.52, (0.16, 0.11, 0.12)),
        (0.75, (0.12, 0.10, 0.20)),
        (1.00, (0.10, 0.09, 0.20)),
    ], extra=[(tuple(tl), (0.42, 0.36, 0.78), 2.5, 0.9)])   # lavender sky fill from top-left
    emit_plane("dawn_sun", 72, 6, 4.0, 3.0, (1.0, 0.56, 0.30), 24.0, dist=10)    # warm low sun, right
    emit_plane("dawn_glow", 85, 2, 12, 2.5, (1.0, 0.50, 0.30), 2.0, dist=10)     # horizon glow band
    emit_plane("front_fill", 0, 10, 10, 8, (1.0, 0.85, 0.80), 0.5, dist=10)    # soft frontal fill, blends the two
    render("pearl_dawn")


def clay_dark():
    s = reset()
    sphere(principled("clay", **{"Base Color": (0.028, 0.028, 0.031), "Metallic": 0.0, "Roughness": 0.9,
                                 "Sheen Weight": 0.25, "Sheen Tint": (0.8, 0.82, 0.9), "Sheen Roughness": 0.5,
                                 "IOR": 1.4}))
    world_gradient([
        (0.00, (0.004, 0.004, 0.005)),
        (0.50, (0.015, 0.015, 0.017)),
        (1.00, (0.05, 0.05, 0.055)),
    ])
    emit_plane("top_soft", -15, 68, 12, 10, (1.0, 0.98, 0.95), 2.6, dist=10)
    emit_plane("rim_l", -150, 15, 6, 9, (0.75, 0.8, 0.9), 3.5, dist=10)
    emit_plane("rim_r", 150, 15, 6, 9, (0.9, 0.85, 0.8), 2.2, dist=10)
    render("clay_dark")


LOOKS = {f.__name__: f for f in (chrome_night, gold, obsidian, glass_echo, pearl_dawn, clay_dark)}


def contact_sheet():
    from PIL import Image, ImageDraw, ImageFont
    names = list(LOOKS)
    pad, lab = 0, 36
    sheet = Image.new("RGB", (RES * len(names), RES + lab), (12, 12, 14))
    font_path = os.path.join(ROOT, "assets", "fonts", "JetBrainsMono-Regular.ttf")
    try:
        font = ImageFont.truetype(font_path, 20)
    except Exception:
        font = ImageFont.load_default()
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        p = os.path.join(OUT, f"{n}.png")
        if os.path.exists(p):
            sheet.paste(Image.open(p).convert("RGB"), (i * RES, 0))
        d.text((i * RES + 12, RES + 7), n, fill=(210, 210, 215), font=font)
    out = os.path.join(OUT, "_contact_sheet.png")
    sheet.save(out)
    print("[matcap] wrote", out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    args = [a for a in sys.argv[1:] if a in LOOKS]
    for n in (args or LOOKS):
        LOOKS[n]()
    contact_sheet()
