# Turns the Poly Haven scans in art-source/ into the game's scenery files:
#   assets/scenery/textures/<key>_diff.jpg, _nor.jpg, _rough.jpg  (tiling ground,
#     bark, rock and plank textures, sized for the browser)
#   assets/scenery/models/<key>.glb  (boulders, bushes, stumps, camp gear --
#     detail reduced to what a browser game can draw many of, textures shrunk)
#
#   blender --background --python tools/blender/build_scenery.py -- <repo root> [keys]
#
# Run by tools/build-scenery.mjs. Models stay in real-world metres, Y up.

import bpy
import json
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = argv[0] if argv else os.getcwd()
ONLY = set(argv[1].split(',')) if len(argv) > 1 and argv[1] else None
SRC = os.path.join(ROOT, 'art-source')
OUT = os.path.join(ROOT, 'assets', 'scenery')

# Triangle budget per model (None: keep as it is) and texture size.
MODEL_BUDGET = {
    'boulderA': (2500, 512), 'boulderB': (2500, 512), 'boulderC': (2500, 512),
    'rockSmall': (900, 512), 'stones': (1500, 512),
    'bushRooibos': (4000, 512), 'shrubA': (2600, 512), 'shrubB': (2000, 512), 'weed': (2000, 512),
    'stump': (3000, 512), 'deadTrunk': (5000, 512), 'branches': (3000, 512),
    'chair': (None, 512), 'picnicTable': (None, 512), 'braaiDrum': (None, 512), 'crate': (None, 512),
    'bucket': (None, 512), 'lantern': (None, 512),
}
# Texture sizes: colour sharper than the bumps and roughness.
TEX_SIZE = {'diff': 1024, 'nor': 512, 'rough': 256}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def shrink_and_save(src, dst, size, quality=82):
    img = bpy.data.images.load(src)
    if img.size[0] > size:
        img.scale(size, size)
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = quality
    if 'nor' in os.path.basename(dst) or 'rough' in os.path.basename(dst):
        img.colorspace_settings.name = 'Non-Color'
    img.save_render(dst, scene=scene)
    bpy.data.images.remove(img)


def build_textures(cfg):
    out = os.path.join(OUT, 'textures')
    os.makedirs(out, exist_ok=True)
    for key, asset in cfg['textures'].items():
        if ONLY and key not in ONLY:
            continue
        clear()
        for short, size in TEX_SIZE.items():
            shrink_and_save(os.path.join(SRC, 'textures', asset, f'{short}.jpg'),
                            os.path.join(out, f'{key}_{short}.jpg'), size)
        print('texture', key)


def tri_count(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs if o.type == 'MESH')


def build_model(key, asset):
    clear()
    folder = os.path.join(SRC, 'models', asset)
    gltf = next(f for f in os.listdir(folder) if f.endswith('.gltf'))
    bpy.ops.import_scene.gltf(filepath=os.path.join(folder, gltf))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    budget, tex = MODEL_BUDGET.get(key, (None, 512))
    before = tri_count(meshes)
    if budget and before > budget:
        ratio = budget / before
        for o in meshes:
            mod = o.modifiers.new('Decimate', 'DECIMATE')
            mod.decimate_type = 'COLLAPSE'
            mod.ratio = ratio
            # Leaves are separate little cards: keep their outline.
            mod.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for img in bpy.data.images:
        # Load the pixels first: an untouched image is copied into the file
        # as it was, full size.
        if not img.has_data:
            img.reload()
        _ = img.pixels[0]
        w, h = img.size
        if w > tex or h > tex:
            k = tex / max(w, h)
            img.scale(max(1, int(w * k)), max(1, int(h * k)))
    after = tri_count([o for o in bpy.context.scene.objects if o.type == 'MESH'])
    os.makedirs(os.path.join(OUT, 'models'), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, 'models', f'{key}.glb'), export_format='GLB',
        export_image_format='JPEG', export_jpeg_quality=80, export_apply=True,
    )
    print(f'model {key}: {before} -> {after} triangles')


def main():
    cfg = json.load(open(os.path.join(ROOT, 'tools', 'scans.json'), encoding='utf-8'))
    build_textures(cfg)
    for key, asset in cfg['models'].items():
        if ONLY and key not in ONLY:
            continue
        build_model(key, asset)


main()
