"""Procedural 3D music visual: metallic torus, dark backdrop, warm studio lighting."""
import bpy,sys,math,argparse
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--frame',type=int,default=1);o=p.parse_args(args)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.world.color=(.02,.025,.045)
mat=bpy.data.materials.new('Copper');mat.diffuse_color=(.77,.31,.22,1);mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.68,.24,.14,1);bs.inputs['Metallic'].default_value=.72;bs.inputs['Roughness'].default_value=.2
bpy.ops.mesh.primitive_torus_add(major_radius=1.45,minor_radius=.32,location=(0,0,0));obj=bpy.context.object;obj.data.materials.append(mat)
obj.rotation_euler=(.36,.14,o.frame*.025)
for name,pos,color,power in [('Key',(0,-3,5),(.6,.85,1),1000),('Rim',(-3,2,2),(1,.28,.18),1400)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=4
 light=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(light);light.location=pos
bpy.ops.object.camera_add(location=(0,-7,2.7));cam=bpy.context.object
direction=Vector((0,0,0))-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7
scene.camera=cam;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=o.output
bpy.ops.render.render(write_still=True)
