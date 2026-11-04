# Builds the camp gear and jetty parts in Blender:
#   the South African campsite pieces in sa_camp_pieces.py (family dome and
#   canvas bow tent, canvas gazebo, bakkies, a Land Cruiser-type, an SUV, an
#   off-road trailer, braai stand, potjie, camp chairs and table, power post),
#   caravan   a classic white SA caravan: rounded shell, stripe, A-frame, awning rail
#   cooler    a big cooler box with lid and handles
# each at three levels of detail (lod0 full, lod1 and lod2 reduced), and
#   jetty     planks (three worn shapes), a post with a cap, a cross brace and
#             a mooring cleat, for the game to set out along each stand.
#
#   blender --background --python tools/blender/build_camp.py -- <repo root>
#
# Run by tools/build-camp.mjs. Writes assets/scenery/models/camp.glb (nodes
# <piece>_lod<n>) and jetty.glb (nodes plank0..2, post, brace, cleat). Real
# metres, Y up, standing on the origin, fronts toward +Z in the game (tent
# doors, vehicle bonnets). Materials the game recolours are named "fly"
# (dome tent), "paint" (vehicles) and "chair" (camp chairs).

import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake_light import bake_ao, gltf_colour_options  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = argv[0] if argv else os.getcwd()
OUT = os.path.join(ROOT, 'assets', 'scenery', 'models')
LOD_RATIOS = (1.0, 0.35, 0.1)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


_mats = {}


def mat(name, rgb, rough=0.7, metal=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = tuple(pow(c, 2.2) for c in rgb) + (1,)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    _mats[name] = m
    return m


def finish(obj, material, bevel=0.0, segments=2, smooth=False):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def box(size, loc, material, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, material, bevel)


def cyl(r, depth, loc, material, rot=(0, 0, 0), verts=12, r2=None, smooth=True):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=verts)
    return finish(bpy.context.active_object, material, smooth=smooth)


def rod(a, b, r, material, verts=6):
    """A thin cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=verts)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return finish(o, material, smooth=True)


def arc_tube(points, r, material, verts=6):
    """A pole bent along `points`."""
    curve = bpy.data.curves.new('pole', 'CURVE')
    curve.dimensions = '3D'
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, q in zip(spline.points, points):
        p.co = (q[0], q[1], q[2], 1)
    curve.bevel_depth = r
    curve.bevel_resolution = 1
    o = bpy.data.objects.new('pole', curve)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.active_object, material, smooth=True)


def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


def apply_mods(objs):
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)


# ─── Pieces ──────────────────────────────────────────────────────────────────

def wheel(x, y, r, width, tyre, rim):
    parts = [cyl(r, width, (x, y, r), tyre, rot=(0, math.pi / 2, 0), verts=20)]
    parts.append(cyl(r * 0.58, width + 0.02, (x, y, r), rim, rot=(0, math.pi / 2, 0), verts=14))
    return parts


def caravan():
    shell = mat('shell', (0.95, 0.94, 0.9), 0.4, 0.1)
    stripe = mat('stripe', (0.18, 0.42, 0.6), 0.4)
    glass = mat('glass', (0.08, 0.12, 0.15), 0.1, 0.2)
    black = mat('trim', (0.07, 0.07, 0.07), 0.6)
    tyre = mat('tyre', (0.05, 0.05, 0.05), 0.9)
    rim = mat('rim', (0.6, 0.6, 0.62), 0.3, 0.9)
    metal = mat('frame', (0.75, 0.76, 0.78), 0.35, 0.8)
    p = []
    # Long axis along Y; door and awning on +X.
    p.append(box((2.2, 5.0, 2.05), (0, 0, 1.45), shell, 0.22))
    p.append(box((2.22, 5.02, 0.16), (0, 0, 1.1), stripe, 0.05))
    p.append(box((2.24, 1.1, 0.5), (0, 1.2, 1.85), glass, 0.08))
    p.append(box((2.24, 1.0, 0.5), (0, -1.0, 1.85), glass, 0.08))
    p.append(box((1.6, 0.06, 0.45), (0, -2.52, 1.75), glass, 0.06))      # front window
    p.append(box((0.06, 0.7, 1.75), (1.12, 0.3, 1.32), mat('door', (0.9, 0.89, 0.85), 0.45), 0.03))
    p.append(box((0.5, 0.6, 0.12), (0, 0.6, 2.53), shell, 0.04))          # roof vent
    p.append(box((0.05, 4.4, 0.05), (1.12, 0, 2.42), metal))              # awning rail
    p.append(box((2.0, 4.8, 0.12), (0, 0, 0.42), black))                  # chassis
    p += wheel(-1.0, 0.2, 0.33, 0.22, tyre, rim)
    p += wheel(1.0, 0.2, 0.33, 0.22, tyre, rim)
    # A-frame drawbar and jockey wheel at the front (-Y).
    p.append(rod((-0.9, -2.4, 0.42), (0, -3.6, 0.42), 0.04, metal))
    p.append(rod((0.9, -2.4, 0.42), (0, -3.6, 0.42), 0.04, metal))
    p.append(box((0.14, 0.3, 0.12), (0, -3.65, 0.45), metal, 0.02))
    p.append(rod((0, -3.2, 0.42), (0, -3.2, 0.08), 0.03, metal))
    p.append(cyl(0.08, 0.05, (0, -3.2, 0.08), tyre, rot=(0, math.pi / 2, 0), verts=12))
    p.append(box((0.6, 0.4, 0.4), (0, -2.75, 0.62), shell, 0.06))         # gas box
    return p


def cooler():
    body = mat('cooler', (0.15, 0.4, 0.68), 0.45)
    lid = mat('coolerlid', (0.93, 0.93, 0.9), 0.45)
    black = mat('trim', (0.07, 0.07, 0.07), 0.6)
    p = [box((0.7, 0.42, 0.4), (0, 0, 0.2), body, 0.04),
         box((0.72, 0.44, 0.08), (0, 0, 0.44), lid, 0.03)]
    for s in (-1, 1):
        p.append(box((0.04, 0.16, 0.05), (s * 0.37, 0, 0.33), black, 0.01))
    p.append(box((0.3, 0.04, 0.03), (0, -0.22, 0.44), black, 0.01))
    return p


import sa_camp_pieces as SA  # noqa: E402
SA.build_with(dict(mat=mat, box=box, cyl=cyl, rod=rod, arc_tube=arc_tube, finish=finish))
PIECES = {**SA.PIECES, 'caravan': caravan, 'cooler': cooler}


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def build_camp():
    clear()
    out = []
    for name, make in PIECES.items():
        parts = make()
        apply_mods(parts)
        lod0 = join(f'{name}_lod0', parts)
        # Merge touching vertices so decimation keeps the shapes closed.
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=0.001)
        bpy.ops.object.mode_set(mode='OBJECT')
        # Soft shade under the roofs, in folds and wheel arches, baked before
        # the lighter copies are made so they keep it (bake_light.py).
        bake_ao([lod0], 0.6, floor=0.5)
        lods = [lod0]
        for level, ratio in enumerate(LOD_RATIOS[1:], start=1):
            copy = lod0.copy()
            copy.data = lod0.data.copy()
            copy.name = f'{name}_lod{level}'
            bpy.context.scene.collection.objects.link(copy)
            mod = copy.modifiers.new('decimate', 'DECIMATE')
            mod.ratio = ratio
            bpy.context.view_layer.objects.active = copy
            bpy.ops.object.modifier_apply(modifier='decimate')
            lods.append(copy)
        # Side by side in Blender so they don't overlap (the game re-centres).
        for o in lods:
            o.location.x += len(out) * 10
        out.append(name)
        print(name, [tri_count(o) for o in lods])
    path = os.path.join(OUT, 'camp.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT', **gltf_colour_options())
    print('wrote', path)


# ─── Jetty parts ─────────────────────────────────────────────────────────────

def worn_plank(name, rng, length=1.0, width=0.2, thick=0.045):
    """One deck board: bevelled, slightly cupped and twisted, a knot or two."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (length, width, thick)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.subdivide(number_cuts=3)
    bpy.ops.object.mode_set(mode='OBJECT')
    twist = rng.uniform(-0.01, 0.01)
    for v in o.data.vertices:
        x, y, z = v.co
        # Cupping across the board and a gentle twist along it.
        v.co.z += (y / (width / 2)) ** 2 * 0.004 * (1 if z > 0 else 0.5)
        v.co.z += x / (length / 2) * y / (width / 2) * twist
        # Worn, rounded ends.
        if abs(x) > length / 2 - 0.01 and z > 0:
            v.co.z -= 0.006
    bev = o.modifiers.new('bevel', 'BEVEL')
    bev.width = 0.006
    bev.segments = 2
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='bevel')
    # UVs along the grain: u runs the board's length (scanned planks texture).
    me = o.data
    uv = me.uv_layers.active or me.uv_layers.new()
    off = rng.random()
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.x * 0.6 + off, co.y * 0.6 + co.z)
    for p in me.polygons:
        p.use_smooth = False
    return o


def build_jetty():
    clear()
    wood = mat('wood', (0.62, 0.52, 0.4), 0.85)
    iron = mat('iron', (0.25, 0.24, 0.23), 0.5, 0.8)
    rng = random.Random(11)
    objs = []
    for i in range(3):
        o = worn_plank(f'plank{i}', rng)
        o.data.materials.append(wood)
        o.location.y = i * 0.5
        objs.append(o)
    # A round pile 1 m tall (the game stretches it), top chamfered.
    post = cyl(0.08, 1.0, (2, 0, 0.5), wood, verts=10)
    bev = post.modifiers.new('bevel', 'BEVEL')
    bev.width = 0.02
    bev.limit_method = 'ANGLE'
    apply_mods([post])
    post.name = 'post'
    objs.append(post)
    brace = box((0.05, 0.1, 1.0), (3, 0, 0.5), wood, 0.008)
    apply_mods([brace])
    brace.name = 'brace'
    objs.append(brace)
    # Mooring cleat: a base and two horns.
    parts = [box((0.08, 0.05, 0.03), (4, 0, 0.015), iron, 0.008),
             box((0.24, 0.035, 0.03), (4, 0, 0.05), iron, 0.012)]
    apply_mods(parts)
    cleat = join('cleat', parts)
    objs.append(cleat)
    for o in objs:
        print(o.name, tri_count(o))
    path = os.path.join(OUT, 'jetty.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT')
    print('wrote', path)


build_camp()
build_jetty()
