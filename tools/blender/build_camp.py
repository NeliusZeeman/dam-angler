# Builds the camp gear and jetty parts in Blender, in place of the game's
# boxes-and-spheres versions:
#   tent      a two-pole dome tent: inner, fly-sheet, porch, poles, guy ropes
#   tentBig   a bigger family dome with a front porch
#   gazebo    a 3 m pop-up gazebo: scissor frame, canopy with peak vent, valance
#   bakkie    a generic double-cab pickup with a canopy (no make: SA farm bakkie)
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
# doors, the bakkie's bonnet). Materials the game recolours are named
# "fly" (tent) and "paint" (bakkie).

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

def dome(rx, ry, h, material, rings=10, segs=24, thin=0.0):
    """A squashed half-ellipsoid tent body."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=segs, ring_count=rings * 2, location=(0, 0, 0))
    o = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    for v in bm.verts:
        v.co.x *= rx
        v.co.y *= ry
        v.co.z *= h
        # A little sag between the poles.
        a = math.atan2(v.co.y, v.co.x)
        v.co.z *= 1 - 0.04 * (1 - abs(math.cos(2 * a)))
    bm.to_mesh(o.data)
    bm.free()
    return finish(o, material, smooth=True)


def tent(big=False):
    rx, ry, h = (1.6, 1.3, 1.25) if not big else (2.2, 1.8, 1.7)
    fly = mat('fly', (0.25, 0.45, 0.3), 0.8)
    inner = mat('tent-inner', (0.82, 0.82, 0.76), 0.9)
    dark = mat('tent-dark', (0.08, 0.08, 0.08), 0.9)
    pole = mat('pole', (0.2, 0.2, 0.22), 0.4, 0.6)
    rope = mat('rope', (0.85, 0.8, 0.65), 0.9)
    parts = [dome(rx * 1.04, ry * 1.04, h, fly)]
    # Porch (vestibule) bulging out the front over the door.
    porch = dome(rx * 0.55, ry * 0.75, h * 0.82, fly, rings=6, segs=16)
    porch.location = (0, -ry * 0.75, 0)
    parts.append(porch)
    # The door: a dark rounded panel with a zip line.
    bpy.ops.mesh.primitive_circle_add(vertices=20, radius=h * 0.6, fill_type='NGON', location=(0, -ry * 1.32, h * 0.02), rotation=(math.pi / 2, 0, 0))
    door = finish(bpy.context.active_object, dark)
    door.scale = (0.75, 1, 1)
    parts.append(door)
    parts.append(rod((0, -ry * 1.33, 0.02), (0, -ry * 1.32, h * 0.62), 0.006, inner, 4))
    # Two crossing poles over the dome, sleeved on the outside.
    for s in (-1, 1):
        pts = []
        for i in range(17):
            t = i / 16 * math.pi
            x, y = math.cos(t) * rx * 1.07, 0
            z = math.sin(t) * h * 1.04
            c, sn = math.cos(s * 0.75), math.sin(s * 0.75)
            pts.append((x * c - y * sn, x * sn + y * c, z))
        parts.append(arc_tube(pts, 0.012, pole))
    # A strip of the inner tent showing under the fly at the back.
    band = cyl(1, 0.12, (0, 0, 0.06), inner, verts=24)
    band.scale = (rx * 0.98, ry * 0.98, 1)
    parts.append(band)
    # Guy ropes out to pegs.
    for a in (0.6, 2.5, 3.8, 5.6):
        top = Vector((math.cos(a) * rx * 0.8, math.sin(a) * ry * 0.8, h * 0.7))
        peg = Vector((math.cos(a) * (rx + 1.1), math.sin(a) * (ry + 1.1), 0.02))
        parts.append(rod(top, peg, 0.005, rope, 4))
        parts.append(rod(peg, peg + Vector((0, 0, 0.12)), 0.01, pole, 4))
    return parts


def gazebo():
    frame = mat('frame', (0.75, 0.76, 0.78), 0.35, 0.8)
    canvas = mat('canvas', (0.18, 0.38, 0.24), 0.85)
    parts = []
    w, h = 1.5, 2.15
    corners = [(-w, -w), (w, -w), (w, w), (-w, w)]
    for x, y in corners:
        parts.append(box((0.04, 0.04, h), (x, y, h / 2), frame, 0.004))
        parts.append(box((0.12, 0.12, 0.02), (x, y, 0.01), frame))
    # Scissor trusses along each side under the canopy.
    for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1]):
        for k in range(3):
            a = Vector((x0 + (x1 - x0) * k / 3, y0 + (y1 - y0) * k / 3, h - 0.25))
            b = Vector((x0 + (x1 - x0) * (k + 1) / 3, y0 + (y1 - y0) * (k + 1) / 3, h))
            parts.append(rod(a, b, 0.012, frame, 4))
            parts.append(rod(a + Vector((0, 0, 0.25)), b - Vector((0, 0, 0.25)), 0.012, frame, 4))
    # Canopy: a four-sided roof with a raised vent at the peak.
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=w * 1.48, radius2=0.25, depth=0.6, location=(0, 0, h + 0.3), rotation=(0, 0, math.pi / 4))
    parts.append(finish(bpy.context.active_object, canvas))
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.35, radius2=0.02, depth=0.22, location=(0, 0, h + 0.68), rotation=(0, 0, math.pi / 4))
    parts.append(finish(bpy.context.active_object, canvas))
    # Valance: a flap round the edge with a scalloped hem.
    for i, ((x0, y0), (x1, y1)) in enumerate(zip(corners, corners[1:] + corners[:1])):
        bm = bmesh.new()
        n = 12
        top, bot = [], []
        for k in range(n + 1):
            t = k / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            out = Vector((x, y, 0)).normalized() * 0.03
            top.append(bm.verts.new((x + out.x, y + out.y, h)))
            dip = 0.22 + 0.05 * abs(math.sin(t * n * math.pi / 2))
            bot.append(bm.verts.new((x + out.x, y + out.y, h - dip)))
        for k in range(n):
            bm.faces.new((top[k], top[k + 1], bot[k + 1], bot[k]))
        me = bpy.data.meshes.new('valance')
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new('valance', me)
        bpy.context.scene.collection.objects.link(o)
        parts.append(finish(o, canvas))
    # Fold-up table at the back with a gas bottle and a pot (as before).
    top = mat('table', (0.88, 0.87, 0.82), 0.6)
    parts.append(box((1.2, 0.6, 0.035), (0, 0.6, 0.75), top, 0.01))
    for x, y in ((-0.55, 0.35), (0.55, 0.35), (-0.55, 0.85), (0.55, 0.85)):
        parts.append(rod((x, y, 0), (x, y, 0.74), 0.012, frame, 4))
    gas = mat('gas', (0.12, 0.42, 0.72), 0.35, 0.3)
    parts.append(cyl(0.12, 0.32, (0.4, 0.6, 0.93), gas, verts=16))
    parts.append(cyl(0.05, 0.05, (0.4, 0.6, 1.11), frame, verts=10))
    pot = mat('pot', (0.15, 0.15, 0.15), 0.4, 0.7)
    parts.append(cyl(0.13, 0.13, (-0.3, 0.6, 0.835), pot, verts=16))
    return parts


def wheel(x, y, r, width, tyre, rim):
    parts = [cyl(r, width, (x, y, r), tyre, rot=(0, math.pi / 2, 0), verts=20)]
    parts.append(cyl(r * 0.58, width + 0.02, (x, y, r), rim, rot=(0, math.pi / 2, 0), verts=14))
    return parts


def bakkie():
    paint = mat('paint', (0.92, 0.92, 0.9), 0.3, 0.4)
    glass = mat('glass', (0.08, 0.12, 0.15), 0.1, 0.2)
    black = mat('trim', (0.07, 0.07, 0.07), 0.6)
    tyre = mat('tyre', (0.05, 0.05, 0.05), 0.9)
    rim = mat('rim', (0.6, 0.6, 0.62), 0.3, 0.9)
    lamp = mat('lamp', (0.95, 0.95, 0.85), 0.2)
    tail = mat('taillamp', (0.7, 0.08, 0.06), 0.3)
    canopy = mat('canopy', (0.85, 0.85, 0.83), 0.35, 0.3)
    p = []
    # Front is toward -Y in Blender (+Z in the game).
    p.append(box((1.84, 5.2, 0.62), (0, 0, 0.82), paint, 0.06))           # body
    p.append(box((1.84, 1.25, 0.18), (0, -1.95, 1.18), paint, 0.08))      # bonnet hump
    p.append(box((1.76, 2.0, 0.68), (0, -0.35, 1.45), paint, 0.1))        # double cab
    p.append(box((1.78, 1.9, 0.48), (0, -0.35, 1.5), glass, 0.06))        # side windows
    p.append(box((1.6, 0.06, 0.52), (0, -1.36, 1.45), glass, 0.02, rot=(-0.45, 0, 0)))  # windscreen
    p.append(box((1.8, 2.1, 0.66), (0, 1.55, 1.45), canopy, 0.08))        # canopy over the load bin
    p.append(box((1.82, 1.9, 0.3), (0, 1.55, 1.55), glass, 0.04))         # canopy windows
    p.append(box((1.9, 0.18, 0.22), (0, -2.62, 0.62), black, 0.03))       # bumper
    p.append(box((1.9, 0.14, 0.18), (0, 2.62, 0.6), black, 0.03))         # rear bumper
    p.append(box((1.5, 0.05, 0.3), (0, -2.6, 0.95), black, 0.02))         # grille
    for s in (-1, 1):
        p.append(box((0.32, 0.06, 0.14), (s * 0.68, -2.6, 0.98), lamp, 0.02))
        p.append(box((0.12, 0.06, 0.3), (s * 0.82, 2.6, 0.95), tail, 0.01))
        p.append(box((0.08, 0.2, 0.1), (s * 0.95, -1.15, 1.42), black, 0.01))  # mirrors
        for y in (-1.6, 1.6):
            p += wheel(s * 0.8, y, 0.38, 0.28, tyre, rim)
            p.append(box((0.2, 1.0, 0.08), (s * 0.85, y, 0.82), black, 0.02))  # wheel-arch flare
    return p


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


PIECES = {
    'tent': lambda: tent(False), 'tentBig': lambda: tent(True), 'gazebo': gazebo,
    'bakkie': bakkie, 'caravan': caravan, 'cooler': cooler,
}


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
