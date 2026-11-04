# One picture of the Blender camp gear (camp.glb, near detail) and jetty
# parts, to check them after build_camp.py.
#
#   blender --background --python tools/blender/preview_camp.py -- <repo root> out.png

import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
ROOT, OUT = argv[0], argv[1]
folder = os.path.join(ROOT, 'assets', 'scenery', 'models')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x, scene.render.resolution_y = 1800, 700
world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.65, 0.8, 1)
scene.world = world
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 4
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(sun)

bpy.ops.import_scene.gltf(filepath=os.path.join(folder, 'camp.glb'))
for o in list(scene.objects):
    if '_lod1' in o.name or '_lod2' in o.name:
        bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=os.path.join(folder, 'jetty.glb'))
x = 0
for o in sorted([o for o in scene.objects if o.type == 'MESH'], key=lambda o: o.name):
    w = max(o.dimensions.x, o.dimensions.y)
    o.location = (x + w / 2, 0, 0)
    o.rotation_euler = (0, 0, math.radians(-35))
    x += w + 0.8
bpy.ops.mesh.primitive_plane_add(size=200, location=(x / 2, 0, 0))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = x + 1
cam.location = (x / 2, -30, 14)
cam.rotation_euler = (Vector((x / 2, 0, 1)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
