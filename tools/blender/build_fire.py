# A real fire for the braai: a Mantaflow fire simulation over a bed of
# coals, rendered in Cycles (blackbody flame) frame by frame and packed into
# a looping flipbook, assets/scenery/textures/fire-flipbook.webp (8 x 4
# frames on black: the game draws it additively, so black is see-through).
#
#   blender --background --python tools/blender/build_fire.py -- <repo root>

import bpy
import os
import sys
import tempfile

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = os.path.abspath(argv[0] if argv else os.getcwd())
OUT = os.path.join(ROOT, 'assets', 'scenery', 'textures', 'fire-flipbook.webp')
WORK = os.path.join(tempfile.gettempdir(), 'dam-angler-fire')

COLS, ROWS = 8, 4
FRAMES = COLS * ROWS           # in the loop
BLEND = 12                      # frames cross-faded to hide the loop's seam
FW, FH = 160, 240               # one frame, pixels
WARMUP = 60                     # let the fire get going first
STEP = 2                        # simulate at 2x the frames shown (smoother)


def use_gpu(scene):
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('ONEAPI', 'OPTIX', 'CUDA', 'HIP', 'METAL'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            if any(d.type == backend for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == backend
                scene.cycles.device = 'GPU'
                return backend
        except TypeError:
            continue
    return 'CPU'


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    # The coals: a scatter of lumps, each feeding its own tongue of flame.
    import random
    random.seed(7)
    lumps = []
    for i in range(9):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.035 + random.random() * 0.03,
                                              location=(random.uniform(-0.16, 0.16), random.uniform(-0.1, 0.1), 0.03))
        lumps.append(bpy.context.object)
    bpy.ops.object.select_all(action='DESELECT')
    for o in lumps:
        o.select_set(True)
    bpy.context.view_layer.objects.active = lumps[0]
    bpy.ops.object.join()
    coals = bpy.context.object
    # The domain the fire lives in.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.42))
    domain = bpy.context.object
    domain.scale = (0.8, 0.5, 0.9)
    bpy.ops.object.transform_apply(scale=True)
    mod = domain.modifiers.new('Fluid', 'FLUID')
    mod.fluid_type = 'DOMAIN'
    ds = mod.domain_settings
    ds.domain_type = 'GAS'
    ds.resolution_max = 96
    ds.use_noise = True
    ds.noise_scale = 2
    ds.noise_strength = 2.5
    ds.vorticity = 0.9
    ds.flame_vorticity = 1.3
    ds.burning_rate = 0.95
    ds.flame_smoke = 0.15
    ds.flame_max_temp = 3
    ds.use_dissolve_smoke = True
    ds.dissolve_speed = 8
    # Open sides: hot gas leaves the box instead of piling up on its walls.
    for side in ('x', 'y'):
        for end in ('back', 'front') if side == 'y' else ('left', 'right'):
            setattr(ds, f'use_collision_border_{end}', False)
    ds.use_collision_border_top = False
    ds.cache_type = 'ALL'
    ds.cache_directory = os.path.join(WORK, 'cache')
    ds.cache_frame_start = 1
    ds.cache_frame_end = WARMUP + (FRAMES + BLEND) * STEP
    ds.timesteps_max = 4
    fmod = coals.modifiers.new('Fluid', 'FLUID')
    fmod.fluid_type = 'FLOW'
    fs = fmod.flow_settings
    fs.flow_type = 'FIRE'
    fs.flow_behavior = 'INFLOW'
    fs.flow_source = 'MESH'
    fs.fuel_amount = 0.8
    fs.temperature = 1.1
    fs.surface_distance = 0.8
    fs.use_initial_velocity = True
    fs.velocity_coord = (0, 0, 0.25)
    # Flicker the fuel so the flames lick up unevenly.
    tex = bpy.data.textures.new('fuel-noise', 'CLOUDS')
    tex.noise_scale = 0.06
    fs.use_texture = True
    fs.noise_texture = tex
    fs.texture_map_type = 'AUTO'
    coals.hide_render = True
    # Flame shader: blackbody colour from the simulation's temperature.
    mat = bpy.data.materials.new('Fire')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = 0.0
    vol.inputs['Blackbody Intensity'].default_value = 1.6
    vol.inputs['Temperature Attribute'].default_value = 'temperature'
    flame = nt.nodes.new('ShaderNodeAttribute')
    flame.attribute_name = 'flame'
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = 0.0
    ramp.inputs['From Max'].default_value = 1.0
    ramp.inputs['To Min'].default_value = 0.0
    ramp.inputs['To Max'].default_value = 45.0
    nt.links.new(flame.outputs['Fac'], ramp.inputs['Value'])
    nt.links.new(ramp.outputs['Result'], vol.inputs['Blackbody Intensity'])
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    domain.data.materials.append(mat)
    # Camera square on, framing the flames.
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.05
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -4, 0.48)
    cam.rotation_euler = (1.5708, 0, 0)
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    print('rendering on', use_gpu(scene), flush=True)
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.cycles.volume_step_rate = 0.5
    scene.render.resolution_x = FW
    scene.render.resolution_y = FH
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('black')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[1].default_value = 0
    scene.world = world
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.view_settings.exposure = 1.2
    scene.render.image_settings.file_format = 'PNG'
    return scene, domain


def main():
    os.makedirs(WORK, exist_ok=True)
    scene, domain = build()
    scene.frame_start = 1
    scene.frame_end = WARMUP + (FRAMES + BLEND) * STEP
    bpy.context.view_layer.objects.active = domain
    with bpy.context.temp_override(object=domain, active_object=domain):
        bpy.ops.fluid.bake_all()
    print('simulated', flush=True)
    paths = []
    for i in range(FRAMES + BLEND):
        f = WARMUP + i * STEP
        scene.frame_set(f)
        p = os.path.join(WORK, f'f{i:03d}.png')
        scene.render.filepath = p
        bpy.ops.render.render(write_still=True)
        paths.append(p)
    print('rendered', len(paths), flush=True)
    # Pack into the flipbook, cross-fading the tail into the head so it
    # loops without a jump.
    sheet = bpy.data.images.new('sheet', COLS * FW, ROWS * FH, alpha=True)
    import array
    px = array.array('f', [0.0]) * (COLS * FW * ROWS * FH * 4)
    frames = []
    for p in paths:
        img = bpy.data.images.load(p)
        frames.append(array.array('f', img.pixels[:]))
    for i in range(FRAMES):
        src = frames[i]
        if i < BLEND:
            t = i / BLEND
            tail = frames[FRAMES + i]
            src = array.array('f', (a * t + b * (1 - t) for a, b in zip(src, tail)))
        col, row = i % COLS, ROWS - 1 - i // COLS
        for y in range(FH):
            o = ((row * FH + y) * COLS * FW + col * FW) * 4
            s = y * FW * 4
            # Soft edges: the flames fade out before the frame's sides and
            # top, so no hard line shows in the game.
            top = min(1.0, (FH - 1 - y) / (FH * 0.2))
            rowpx = src[s:s + FW * 4]
            for x in range(FW):
                k = min(1.0, x / (FW * 0.18), (FW - 1 - x) / (FW * 0.18)) * top
                if k < 1:
                    for c in range(3):
                        rowpx[x * 4 + c] *= k * k * (3 - 2 * k)
            px[o:o + FW * 4] = rowpx
    sheet.pixels[:] = px
    # Black stays black (drawn additively), but keep alpha = brightness for
    # anyone drawing it blended.
    # Saved as is: the frames already went through the view transform.
    sheet.filepath_raw = OUT
    sheet.file_format = 'WEBP'
    sheet.save(quality=85)
    print('fire flipbook', OUT, os.path.getsize(OUT) // 1024, 'KB', flush=True)


main()
