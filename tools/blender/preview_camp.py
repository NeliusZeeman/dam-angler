# Pictures of the Blender camp gear (camp.glb, near detail) to check them
# after build_camp.py: one of the vehicles, one of the tents and campsite gear.
#
#   blender --background --python tools/blender/preview_camp.py -- <repo root> <out folder>

import bpy
import math
import os
import re
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
ROOT, OUT = argv[0], argv[1]
ANGLE = float(argv[2]) if len(argv) > 2 else -38  # turn about Z; -90 shows the left side
CAM_Z = float(argv[3]) if len(argv) > 3 else 18  # camera height (low = side-on)
folder = os.path.join(ROOT, 'assets', 'scenery', 'models')
SHEETS = {
    'vehicles': re.compile(r'^(bakkie|cruiser|suv|trailer|caravan)'),
    'camp': re.compile(r'^(tent|bowTent|gazebo|braai|potjie|campChair|campTable|powerPost|cooler)'),
}


def render(name, pattern):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.render.resolution_x, scene.render.resolution_y = 1800, 800
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.65, 0.8, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    scene.world = world
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(-40))
    scene.collection.objects.link(sun)
    bpy.ops.import_scene.gltf(filepath=os.path.join(folder, 'camp.glb'))
    keep = []
    for o in list(scene.objects):
        if o.type != 'MESH':
            continue
        base = o.name.split('_lod')[0]
        if '_lod0' not in o.name or not pattern.match(base):
            bpy.data.objects.remove(o)
        else:
            keep.append(o)
    x = 0
    for o in sorted(keep, key=lambda o: o.name):
        # Unparent (the importer's node objects carry the glTF axis turn),
        # then turn the front (-Y) three-quarters to the camera.
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        o.select_set(False)
        o.rotation_mode = 'XYZ'  # (the importer leaves quaternion mode on)
        o.rotation_euler = (0, 0, math.radians(ANGLE))
        bpy.context.view_layer.update()
        w = max(o.dimensions.x, o.dimensions.y) * 0.85
        o.location = (x + w / 2, 0, 0)
        x += w + 0.6
    bpy.ops.mesh.primitive_plane_add(size=300, location=(x / 2, 0, 0))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = x + 1
    cam.location = (x / 2, -40, CAM_Z)
    cam.rotation_euler = (Vector((x / 2, 0, 1.2)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, f'camp-{name}.png')
    bpy.ops.render.render(write_still=True)


for name, pattern in SHEETS.items():
    render(name, pattern)
