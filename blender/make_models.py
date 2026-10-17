"""Beveled 3D digit meshes + "10" monument, exported as GLB for Three.js.

Outputs (assets/models/):
  digits.glb          digit_0 .. digit_9 and `ten` ("10"): glyph height 1.0, thickness 0.18,
                      bevel 0.025 (round, 2 resolution steps -> 3 segments), origin = bbox centre,
                      readable from +Z (glTF), transforms applied.
  ten_monument.glb    mono_one, mono_zero (~10 tall, 2.2 deep, origin at bottom centre,
                      laid out as the string "10") + mono_plinth (3-tier stepped plinth, top at y=0).
  models_manifest.json

Coordinates: built in Blender Z-up with glyphs facing -Y; the glTF exporter (+Y up) maps
Blender (x, y, z) -> glTF (x, z, -y), so glyphs face glTF +Z and stand along glTF +Y.

Usage: python make_models.py
"""
import bpy, bmesh, math, os, json
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets", "fonts", "BigShoulders-Bold.ttf")
OUT = os.path.join(ROOT, "assets", "models")

RES_U = 7
SMOOTH_ANGLE = math.radians(30)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def font():
    return bpy.data.fonts.load(FONT, check_existing=True)


def text_curve(body, size=1.0, extrude=0.0, bevel=0.0, bevel_res=2, res_u=RES_U):
    cu = bpy.data.curves.new("txt_" + body, type="FONT")
    cu.body = body
    cu.font = font()
    cu.size = size
    cu.align_x = "LEFT"
    cu.align_y = "BOTTOM_BASELINE"
    cu.resolution_u = res_u
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = bevel_res
    cu.bevel_mode = "ROUND"
    cu.offset = -bevel  # keep the glyph outline at its true size (bevel eats inward)
    cu.fill_mode = "BOTH"
    ob = bpy.data.objects.new("txt_" + body, cu)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def to_mesh(ob, name):
    """Convert a text object to a clean mesh object (evaluated geometry)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    me.name = name
    new = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(new)
    new.matrix_world = ob.matrix_world.copy()
    bpy.data.objects.remove(ob)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # merge coplanar cap triangles into n-gons (glTF exporter re-triangulates cleanly)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.5), verts=bm.verts, edges=bm.edges,
                             delimit={"NORMAL"})
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return new


def raw_bbox(body):
    """Glyph bbox at size 1 (flat, no bevel) in text space."""
    ob = text_curve(body, 1.0)
    m = to_mesh(ob, "_probe")
    xs = [v.co.x for v in m.data.vertices]
    ys = [v.co.y for v in m.data.vertices]
    bb = (min(xs), max(xs), min(ys), max(ys))
    me = m.data
    bpy.data.objects.remove(m)
    bpy.data.meshes.remove(me)
    return bb


def bounds(ob):
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return mn, mx


def finish(ob, origin_mode):
    """Rotate glyph to stand up facing -Y (=glTF +Z), apply transforms, set origin, smooth by angle."""
    ob.rotation_euler = (math.pi / 2, 0, 0)
    bpy.context.view_layer.update()
    ob.data.transform(ob.matrix_world)
    ob.matrix_world = Matrix.Identity(4)
    mn, mx = bounds(ob)
    c = (mn + mx) / 2
    if origin_mode == "bottom":
        c.z = mn.z
    ob.data.transform(Matrix.Translation(-c))
    ob.data.update()
    shade_by_angle(ob)
    return ob


def shade_by_angle(ob):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=SMOOTH_ANGLE, keep_sharp_edges=True)
    ob.select_set(False)


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def gltf_bounds(ob):
    mn, mx = bounds(ob)
    # Blender (x,y,z) -> glTF (x, z, -y)
    return {"min": [round(mn.x, 4), round(mn.z, 4), round(-mx.y, 4)],
            "max": [round(mx.x, 4), round(mx.z, 4), round(-mn.y, 4)]}


def export(objs, path):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True,
        export_apply=True, export_normals=True, export_texcoords=False,
        export_materials="NONE", export_cameras=False, export_lights=False,
        export_animations=False, export_extras=False)
    print("[models] wrote", path, os.path.getsize(path), "bytes")


# ----------------------------------------------------------------- digits
def build_digits():
    reset()
    H = 1.0
    thick, bev = 0.18 * H, 0.025 * H
    objs = []
    for name, body in [(f"digit_{i}", str(i)) for i in range(10)] + [("ten", "10")]:
        x0, x1, y0, y1 = raw_bbox(body)
        size = H / (y1 - y0)  # normalise this glyph's height to 1.0
        ob = text_curve(body, size=size, extrude=thick / 2 - bev, bevel=bev, bevel_res=2)
        m = to_mesh(ob, name)
        finish(m, "centre")
        objs.append(m)
    return objs


# ----------------------------------------------------------------- monument
def bevel_box(bm, cx, cy, z0, sx, sy, sz):
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r["verts"]
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=vs)
    bmesh.ops.translate(bm, vec=(cx, cy, z0 + sz / 2), verts=vs)
    return vs


def build_monument():
    reset()
    H = 10.0
    depth, bev = 2.2, 0.32
    # font scale from the "1" so the pair keeps natural relative proportions
    b1 = raw_bbox("1")
    b0 = raw_bbox("0")
    b10 = raw_bbox("10")
    size = H / (b1[3] - b1[2])
    # in "10": the "1" starts where it does alone; the "0" is shifted by (advance+kerning)
    shift0 = b10[1] - b0[1]
    c1 = (b1[0] + b1[1]) / 2 * size
    c0 = ((b0[0] + b0[1]) / 2 + shift0) * size
    pair_c = (b10[0] + b10[1]) / 2 * size
    x_one, x_zero = c1 - pair_c, c0 - pair_c
    objs = []
    for name, body, x in [("mono_one", "1", x_one), ("mono_zero", "0", x_zero)]:
        ob = text_curve(body, size=size, extrude=depth / 2 - bev, bevel=bev, bevel_res=3, res_u=10)
        m = to_mesh(ob, name)
        finish(m, "bottom")
        m.location = (x, 0, 0)
        objs.append(m)
    # plinth: 3 stepped tiers, top surface at z=0 (glTF y=0)
    pair_w = (b10[1] - b10[0]) * size
    me = bpy.data.meshes.new("mono_plinth")
    bm = bmesh.new()
    tiers = [  # (width, depth, height) top -> bottom
        (pair_w + 2.4, depth + 2.4, 0.55),
        (pair_w + 4.6, depth + 4.6, 0.55),
        (pair_w + 7.0, depth + 7.0, 0.6),
    ]
    z = 0.0
    for w, d, h in tiers:
        z -= h
        bevel_box(bm, 0, 0, z, w, d, h)
    bm.to_mesh(me)
    bm.free()
    pl = bpy.data.objects.new("mono_plinth", me)
    bpy.context.scene.collection.objects.link(pl)
    bv = pl.modifiers.new("bevel", "BEVEL")
    bv.width = 0.08
    bv.segments = 3
    bv.limit_method = "ANGLE"
    bv.harden_normals = False
    bpy.context.view_layer.objects.active = pl
    for o in bpy.context.selected_objects:
        o.select_set(False)
    pl.select_set(True)
    bpy.ops.object.modifier_apply(modifier="bevel")
    shade_by_angle(pl)
    objs.append(pl)
    return objs, {"mono_one_x": round(x_one, 4), "mono_zero_x": round(x_zero, 4),
                  "pair_width": round(pair_w, 4), "font_size": round(size, 5)}


def describe(objs):
    d = {}
    for o in objs:
        d[o.name] = {"bounds_gltf": gltf_bounds(o), "triangles": tri_count(o),
                     "origin_gltf": [round(o.location.x, 4), round(o.location.z, 4), round(-o.location.y, 4)]}
    return d


def main():
    os.makedirs(OUT, exist_ok=True)
    man = {"generator": "blender/make_models.py (Blender %s)" % bpy.app.version_string,
           "font": "assets/fonts/BigShoulders-Bold.ttf",
           "coordinates": "glTF Y-up; glyphs readable from +Z looking toward -Z; units arbitrary (glyph height 1.0 for digits)"}
    digits = build_digits()
    man["digits.glb"] = {
        "objects": describe(digits),
        "spec": {"glyph_height": 1.0, "thickness": 0.18, "bevel_depth": 0.025, "bevel": "round, resolution 2 (3 segments)",
                 "resolution_u": RES_U, "origin": "bbox centre (x, y, z)", "smooth_by_angle_deg": 30},
    }
    export(digits, os.path.join(OUT, "digits.glb"))
    mono, offs = build_monument()
    man["ten_monument.glb"] = {
        "objects": describe(mono),
        "x_offsets": offs,
        "spec": {"glyph_height_of_1": 10.0, "depth": 2.2, "bevel_depth": 0.32, "bevel": "round, resolution 3",
                 "origin": "bottom centre of each glyph (y=0 at glyph base); node translation = (x_offset, 0, 0)",
                 "plinth": "3 stepped tiers (0.55, 0.55, 0.6 tall), bevel 0.08x3, top surface at y=0, origin at top centre"},
    }
    export(mono, os.path.join(OUT, "ten_monument.glb"))
    with open(os.path.join(OUT, "models_manifest.json"), "w") as f:
        json.dump(man, f, indent=2)
    print(json.dumps(man, indent=1))


if __name__ == "__main__":
    main()
