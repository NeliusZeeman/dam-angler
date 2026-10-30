# Renders a quick look at built fish models (side and three-quarter views)
# so their shapes can be checked without starting the game.
#
#   blender --background --python tools/blender/preview_fish.py -- out_dir model.glb [model.glb ...]

import bpy
import math
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
MODELS = argv[1:]


def setup_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX'
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.display.shading.show_specular_highlight = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 520
    scene.render.film_transparent = False
    scene.world = scene.world or bpy.data.worlds.new('World')
    return scene


def render(model):
    scene = setup_scene()
    bpy.ops.import_scene.gltf(filepath=model)
    for obj in list(scene.objects):
        if obj.name.startswith('BodyLow'):
            obj.hide_render = True
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 0.62
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    name = os.path.splitext(os.path.basename(model))[0]
    # Views in the game's frame (x snout, y up, z right flank); the glTF
    # importer turns that into Blender's (x, -z, y).
    from mathutils import Vector, Matrix
    views = {'side': (0.0, 0.0, 1.0), 'three_quarter': (0.55, 0.3, 0.75), 'front': (1.0, 0.05, 0.0), 'top': (0.0, 1.0, 0.02)}
    for view, g in views.items():
        d = Vector((g[0], -g[2], g[1])).normalized()
        cam.location = d * 2.0 + Vector((0.02, 0, 0))
        forward = (Vector((0.02, 0, 0)) - cam.location).normalized()
        up = Vector((0, 0, 1)) if view != 'top' else Vector((1, 0, 0))
        right = forward.cross(up).normalized()
        up = right.cross(forward)
        cam.rotation_euler = Matrix((right, up, -forward)).transposed().to_euler()
        cam_data.ortho_scale = 0.32 if view == 'front' else 0.62
        scene.render.filepath = os.path.join(OUT, f'{name}_{view}.png')
        bpy.ops.render.render(write_still=True)


def render_sheet(path, view=(0.0, 0.0, 1.0)):
    """Every model on one picture, four to a row, all from the same side."""
    from mathutils import Vector, Matrix
    scene = setup_scene()
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    cols, gap_x, gap_y = 4, 0.62, 0.36
    rows = (len(MODELS) + cols - 1) // cols
    for i, model in enumerate(MODELS):
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=model)
        for obj in set(scene.objects) - before:
            if obj.name.startswith('BodyLow'):
                obj.hide_render = True
            if obj.parent is None:
                # Game x -> Blender x, game y (up) -> Blender z.
                obj.location.x += (i % cols - (cols - 1) / 2) * gap_x
                obj.location.z -= (i // cols - (rows - 1) / 2) * gap_y
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = gap_x * cols * 1.02
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    d = Vector((view[0], -view[2], view[1])).normalized()
    cam.location = d * 4.0
    forward = (-cam.location).normalized()
    up = Vector((0, 0, 1))
    right = forward.cross(up).normalized()
    up = right.cross(forward)
    cam.rotation_euler = Matrix((right, up, -forward)).transposed().to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if OUT.endswith('.png'):
    render_sheet(OUT)
    render_sheet(OUT.replace('.png', '_3q.png'), (0.5, 0.3, 0.8))
else:
    for m in MODELS:
        render(m)
