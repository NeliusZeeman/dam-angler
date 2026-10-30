# Renders the Tackle Box pictures in Blender (Cycles): each gear model the
# game exported (art-source/gear/<kind>-<id>.glb, with the camera framing it
# the way the game does) lit like a product shot -- a big soft key light,
# a fill and a rim, a soft studio world for reflections -- on a clear
# background, saved as assets/gear/<kind>-<id>.webp.
#
#   blender --background --python tools/blender/render_gear.py -- <repo root> [names]

import bpy
import math
import os
import re
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = argv[0] if argv else os.getcwd()
ONLY = set(argv[1].split(',')) if len(argv) > 1 and argv[1] else None
SRC = os.path.join(ROOT, 'art-source', 'gear')
OUT = os.path.join(ROOT, 'assets', 'gear')
SIZE = 320


def use_gpu(scene):
    """Cycles on the graphics card when Blender can find one (Intel Arc via
    oneAPI, NVIDIA, AMD), else the processor."""
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('ONEAPI', 'OPTIX', 'CUDA', 'HIP', 'METAL'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            devices = [d for d in prefs.devices if d.type == backend]
            if devices:
                for d in prefs.devices:
                    d.use = d.type == backend
                scene.cycles.device = 'GPU'
                return backend
        except TypeError:
            continue
    scene.cycles.device = 'CPU'
    return 'CPU'


def studio():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    backend = use_gpu(scene)
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.quality = 88
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    # A soft grey studio for reflections (invisible: the film is clear).
    world = bpy.data.worlds.new('Studio')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.55, 0.58, 0.62, 1)
    bg.inputs[1].default_value = 0.6
    scene.world = world
    return scene, backend


def area(name, energy, size, color=(1, 1, 1)):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = energy
    light.size = size
    light.color = color
    obj = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def aim(obj, at):
    d = (at - obj.location).normalized()
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def render_one(path, name):
    scene, _ = studio()
    bpy.ops.import_scene.gltf(filepath=path)
    cam = next((o for o in scene.objects if o.type == 'CAMERA'), None)
    if cam is None:
        print('no camera in', name)
        return
    scene.camera = cam
    cam.data.clip_start, cam.data.clip_end = 0.001, 100
    # The game's framing: half-width in metres, from the camera's name.
    found = re.search(r'PictureCamera_([0-9.]+)', cam.name + ' ' + cam.data.name)
    if found:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = 2 * float(found.group(1))
    # Lights placed around the camera's view: key up-left-front, fill
    # right, rim behind -- scaled to the picture's width.
    m = cam.matrix_world
    fwd = (m.to_3x3() @ Vector((0, 0, -1))).normalized()
    up = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
    right = fwd.cross(up).normalized()
    span = cam.data.ortho_scale if cam.data.type == 'ORTHO' else 1.0
    target = m.translation + fwd * 10
    k = span
    key = area('Key', 900 * k * k, 3 * k)
    key.location = target - fwd * 4 * k + up * 3 * k - right * 3 * k
    aim(key, target)
    fill = area('Fill', 300 * k * k, 4 * k, (0.85, 0.92, 1.0))
    fill.location = target - fwd * 4 * k + right * 4 * k
    aim(fill, target)
    rim = area('Rim', 700 * k * k, 2 * k, (1.0, 0.95, 0.88))
    rim.location = target + fwd * 3 * k + up * 2.5 * k
    aim(rim, target)
    # Metal and plastic read better a touch glossier than the game's
    # real-time look.
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf and not bsdf.inputs['Roughness'].is_linked:
            bsdf.inputs['Roughness'].default_value = min(bsdf.inputs['Roughness'].default_value, 0.6)
    scene.render.filepath = os.path.join(OUT, f'{name}.webp')
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    _, backend = studio()
    print('rendering on', backend)
    files = sorted(f for f in os.listdir(SRC) if f.endswith('.glb'))
    for f in files:
        name = f[:-4]
        if ONLY and name not in ONLY:
            continue
        render_one(os.path.join(SRC, f), name)
        print('rendered', name)


main()
