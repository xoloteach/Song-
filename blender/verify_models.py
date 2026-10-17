"""Re-import the exported GLBs in a fresh session, print names/bounds/tri counts,
and render quick preview PNGs into the scratchpad.

Usage: python verify_models.py
"""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, "assets", "models")
SCRATCH = "/tmp/claude-0/-home-user-Song-/bc48a2b6-a562-5aa7-b825-0827b564ca4c/scratchpad/blender_tmp"


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = sorted([o for o in bpy.context.scene.objects if o.type == "MESH"], key=lambda o: o.name)
    print(f"== {os.path.basename(path)} ({os.path.getsize(path)} bytes)")
    for o in objs:
        vs = [o.matrix_world @ v.co for v in o.data.vertices]
        mn = [min(v[i] for v in vs) for i in range(3)]
        mx = [max(v[i] for v in vs) for i in range(3)]
        # back to glTF Y-up for printing: (x, z, -y)
        gmn = (mn[0], mn[2], -mx[1]); gmx = (mx[0], mx[2], -mn[1])
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        print(f"  {o.name:12s} tris={tris:6d} min=({gmn[0]:.3f},{gmn[1]:.3f},{gmn[2]:.3f}) "
              f"max=({gmx[0]:.3f},{gmx[1]:.3f},{gmx[2]:.3f}) loc_gltf=({o.location.x:.3f},{o.location.z:.3f},{-o.location.y:.3f})")
    return objs


def stage(target, dist, ortho, res, out, view=(-0.35, -1.0, 0.35)):
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.samples = 24
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = res
    s.view_settings.view_transform = "Standard"
    m = bpy.data.materials.new("preview")
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.8, 0.55, 0.2, 1)
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.3
    for o in s.objects:
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(m)
    cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = ortho
    co = bpy.data.objects.new("c", cam); s.collection.objects.link(co); s.camera = co
    # camera on glTF +Z side (= Blender -Y), slightly above and to the left, looking at target
    co.location = Vector(target) + Vector(view).normalized() * dist
    co.rotation_euler = (Vector(target) - co.location).to_track_quat("-Z", "Y").to_euler()
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4.0; sun.angle = math.radians(5)
    so = bpy.data.objects.new("sun", sun); s.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), math.radians(-25), math.radians(-30))
    w = bpy.data.worlds.new("w"); s.world = w
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.25, 0.27, 0.32, 1)
    s.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print("  preview ->", out)


os.makedirs(SCRATCH, exist_ok=True)
objs = load(os.path.join(MODELS, "digits.glb"))
order = [f"digit_{i}" for i in range(10)] + ["ten"]
x = 0.0
for n in order:
    o = bpy.data.objects[n]
    w = o.dimensions.x
    o.location.x = x + w / 2
    x += w + 0.12
for o in objs:
    o.location.x -= x / 2
stage((0, 0, 0), 20, x * 1.04, (1600, 240), os.path.join(SCRATCH, "preview_digits.png"), view=(-0.12, -1.0, 0.12))

load(os.path.join(MODELS, "ten_monument.glb"))
stage((0, 0, 4.5), 60, 19, (900, 900), os.path.join(SCRATCH, "preview_monument.png"))
