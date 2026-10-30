# One picture of every scenery model in assets/scenery/models, side by side,
# to check them after build_scenery.py.
#
#   blender --background --python tools/blender/preview_scenery.py -- <repo root> out.png

import bpy
import math
import os
import sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
ROOT, OUT = argv[0], argv[1]
folder = os.path.join(ROOT, 'assets', 'scenery', 'models')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys() else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1600, 900
world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.65, 0.8, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
scene.world = world
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(sun)

files = sorted(f for f in os.listdir(folder) if f.endswith('.glb'))
cols = 6
for i, f in enumerate(files):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(folder, f))
    new = [o for o in set(scene.objects) - before]
    # Fit each into a 1.6 m cell.
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = max((hi - lo).x, (hi - lo).y, (hi - lo).z) or 1
    k = 1.4 / size
    centre = (lo + hi) / 2
    for o in new:
        if o.parent is None:
            o.location = (o.location - Vector((centre.x, centre.y, lo.z))) * k
            o.scale *= k
            o.location.x += (i % cols - (cols - 1) / 2) * 1.7
            o.location.z += -(i // cols) * 1.8 + 1.8
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 10.5
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0, -12, 2.6)
forward = (Vector((0, 0, 0.9)) - cam.location).normalized()
right = forward.cross(Vector((0, 0, 1))).normalized()
up = right.cross(forward)
cam.rotation_euler = Matrix((right, up, -forward)).transposed().to_euler()
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
