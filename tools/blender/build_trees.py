# Grows the game's trees in Blender: umbrella thorn (acacia), blue gum and
# weeping willow -- the trees of a South African dam bank -- two shapes each,
# every shape at three levels of detail:
#   lod0  near: full branching, a few hundred leaf sprays
#   lod1  middle: main limbs only, fewer and bigger sprays
#   lod2  far: three crossed cards showing pictures of the tree itself,
#         rendered here from three sides
# The leaf sprays are pictures too, rendered here from modelled leaves
# (fine bipinnate acacia leaflets, sickle gum leaves, hanging willow strands).
#
#   blender --background --python tools/blender/build_trees.py -- <repo root> [kinds]
#
# Run by tools/build-trees.mjs. Writes assets/scenery/models/tree-<kind>.glb.
# Each tree is scaled to 1 unit tall (the game plants it at its real height,
# kept in the object's "height" property) with Y up. A per-vertex _SWAY
# attribute says how freely each point moves in the wind (0 rooted .. 1 free)
# for the game's wind shader. Bark has UVs in metres (0.35 a metre up the
# trunk) for the game's scanned bark; its material is named "bark-<kind>".

import bpy
import bmesh
import math
import os
import random
import zlib
import sys
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = argv[0] if argv else os.getcwd()
ONLY = set(argv[1].split(',')) if len(argv) > 1 and argv[1] else None
OUT = os.path.join(ROOT, 'assets', 'scenery', 'models')
TMP = os.path.join(ROOT, 'art-source', 'trees')
BARK_TEX = os.path.join(ROOT, 'assets', 'scenery', 'textures')

VARIANTS = 2
LEAF_CELL = {'willow': 1024}  # one leaf spray picture (default 512); four make the atlas
IMPOSTOR_CELL = 512  # one side of the far-off card picture
IMPOSTOR_ANGLES = (0, 60, 120)


def srgb(c):
    return tuple(pow(v, 2.2) for v in c) + (1.0,)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ─── Branch skeletons ────────────────────────────────────────────────────────

class Limb:
    def __init__(self, points, radii, depth):
        self.points = points  # [Vector]
        self.radii = radii
        self.depth = depth
        self.children = []
        self.tips = []  # (position, direction) for leaf sprays
        self.strands = []  # willow: (top position, length)


def bend(a, b, lift, rng, n=4, wobble=0.15):
    """Points from a to b, bowed upward by `lift` and a little crooked."""
    pts = []
    side = Vector((rng.uniform(-1, 1), 0, rng.uniform(-1, 1))) * wobble * (b - a).length
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t)
        p.z += math.sin(t * math.pi) * lift
        p += side * math.sin(t * math.pi)
        pts.append(p)
    return pts


def from_dir(start, direction, length, rng, lift=0.0, n=4, wobble=0.15):
    return bend(start, start + direction.normalized() * length, lift, rng, n, wobble)


def spread(direction, out_angle, around):
    """A direction `out_angle` radians off `direction`, turned `around` it."""
    d = direction.normalized()
    perp = d.cross(Vector((0, 0, 1)))
    if perp.length < 1e-3:
        perp = Vector((1, 0, 0))
    perp.normalize()
    perp = Matrix.Rotation(around, 3, d) @ perp
    return (d * math.cos(out_angle) + perp * math.sin(out_angle)).normalized()


def acacia(rng):
    """Umbrella thorn: short trunk forking into spreading limbs, flat crown."""
    h = rng.uniform(5.5, 7.5)
    crown_r = h * rng.uniform(0.7, 0.9)
    trunk_h = rng.uniform(1.4, 2.4)
    r0 = 0.12 + h * 0.01
    trunk = Limb(bend(Vector((0, 0, 0)), Vector((rng.uniform(-.3, .3), rng.uniform(-.3, .3), trunk_h)), 0, rng, 3, 0.1),
                 [r0, r0 * 0.9, r0 * 0.82, r0 * 0.75], 0)
    top = trunk.points[-1]
    canopy = h * rng.uniform(0.8, 0.86)  # the flat underside of the crown
    n_main = rng.randint(3, 5)
    for i in range(n_main):
        ang = i / n_main * math.tau + rng.uniform(-.4, .4)
        out = Vector((math.cos(ang), math.sin(ang), 0))
        reach = crown_r * rng.uniform(0.3, 0.45)
        end = top + out * reach + Vector((0, 0, (canopy - trunk_h) * rng.uniform(0.55, 0.75)))
        limb = Limb(bend(top, end, 0.3, rng, 4, 0.12), list(np.linspace(r0 * 0.62, r0 * 0.3, 5)), 1)
        trunk.children.append(limb)
        for j in range(rng.randint(3, 4)):
            a2 = ang + rng.uniform(-1.0, 1.0)
            o2 = Vector((math.cos(a2), math.sin(a2), 0))
            start = limb.points[rng.randint(3, 4)]
            end2 = start + o2 * crown_r * rng.uniform(0.25, 0.42)
            end2.z = canopy - rng.uniform(0.1, 0.5)
            twig = Limb(bend(start, end2, 0.25, rng, 3, 0.2), list(np.linspace(r0 * 0.28, r0 * 0.1, 4)), 2)
            limb.children.append(twig)
            for k in range(rng.randint(5, 7)):
                a3 = a2 + rng.uniform(-1.4, 1.4)
                o3 = Vector((math.cos(a3), math.sin(a3), 0.15))
                s3 = twig.points[-1].lerp(twig.points[1], rng.uniform(0, 0.7))
                e3 = s3 + o3.normalized() * crown_r * rng.uniform(0.12, 0.22)
                e3.z = canopy + rng.uniform(0.0, 0.35)
                fine = Limb(bend(s3, e3, 0.05, rng, 2, 0.25), [r0 * 0.08, r0 * 0.05, r0 * 0.03], 3)
                twig.children.append(fine)
                # The crown is a thick flat layer: sprays all round each fine branch.
                for _ in range(5):
                    off = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * crown_r * 0.12
                    off.z = rng.uniform(0.0, h - canopy) * 0.8
                    fine.tips.append((e3 + off, Vector((0, 0, 1))))
    return trunk, h, {'flat': True, 'spray': 1.5, 'sprayTilt': 0.25}


def gum(rng):
    """Blue gum: tall straight trunk, branches high up, a loose clumpy crown."""
    h = rng.uniform(15, 21)
    r0 = 0.28 + h * 0.012
    lean = Vector((rng.uniform(-.6, .6), rng.uniform(-.6, .6), h * 0.92))
    trunk_pts = bend(Vector((0, 0, 0)), lean, 0, rng, 6, 0.04)
    trunk = Limb(trunk_pts, list(np.linspace(r0, r0 * 0.25, 7)), 0)
    n = rng.randint(11, 15)
    for i in range(n):
        t = rng.uniform(0.45, 0.9)
        idx = t * 6
        a, b = trunk_pts[int(idx)], trunk_pts[min(6, int(idx) + 1)]
        start = a.lerp(b, idx - int(idx))
        ang = i * 2.4 + rng.uniform(-.3, .3)
        direction = Vector((math.cos(ang), math.sin(ang), rng.uniform(0.7, 1.4)))
        length = h * rng.uniform(0.18, 0.3) * (1.15 - t)
        limb = Limb(from_dir(start, direction, length, rng, -0.3, 4, 0.18),
                    list(np.linspace(r0 * 0.38 * (1.1 - t), r0 * 0.06, 5)), 1)
        trunk.children.append(limb)
        for k in range(rng.randint(5, 8)):
            s = limb.points[rng.randint(1, 4)]
            d = spread(direction, rng.uniform(0.5, 1.0), rng.uniform(0, math.tau))
            twig = Limb(from_dir(s, d, length * rng.uniform(0.35, 0.55), rng, -0.15, 2, 0.2),
                        [r0 * 0.07, r0 * 0.04, r0 * 0.02], 2)
            limb.children.append(twig)
            for q in twig.points:
                twig.tips.append((q, Vector((0, 0, -1))))
        limb.tips.append((limb.points[-1], Vector((0, 0, -1))))
    trunk.tips.append((trunk_pts[-1], Vector((0, 0, -1))))
    return trunk, h, {'flat': False, 'spray': 2.8, 'sprayTilt': 1.2}


def willow(rng):
    """Weeping willow: a stout trunk, arching limbs, curtains of hanging strands."""
    h = rng.uniform(7.5, 9.5)
    r0 = 0.22 + h * 0.015
    trunk_h = rng.uniform(1.8, 2.8)
    trunk = Limb(bend(Vector((0, 0, 0)), Vector((rng.uniform(-.4, .4), rng.uniform(-.4, .4), trunk_h)), 0, rng, 3, 0.1),
                 [r0, r0 * 0.92, r0 * 0.85, r0 * 0.8], 0)
    top = trunk.points[-1]
    n = rng.randint(4, 6)
    for i in range(n):
        ang = i / n * math.tau + rng.uniform(-.35, .35)
        out = Vector((math.cos(ang), math.sin(ang), 0))
        end = top + out * h * rng.uniform(0.25, 0.4) + Vector((0, 0, (h - trunk_h) * rng.uniform(0.75, 0.95)))
        limb = Limb(bend(top, end, 0.6, rng, 5, 0.12), list(np.linspace(r0 * 0.6, r0 * 0.15, 6)), 1)
        trunk.children.append(limb)
        for k in range(rng.randint(4, 6)):
            s = limb.points[rng.randint(2, 5)]
            d = spread(Vector((out.x, out.y, 0.6)), rng.uniform(0.3, 0.9), rng.uniform(0, math.tau))
            arch = Limb(from_dir(s, d, h * rng.uniform(0.12, 0.22), rng, 0.4, 3, 0.15),
                        [r0 * 0.12, r0 * 0.07, r0 * 0.04, r0 * 0.02], 2)
            limb.children.append(arch)
            # Strands hang from along each arching twig, down to near the ground.
            for p in arch.points[1:]:
                for _ in range(3):
                    jitter = Vector((rng.uniform(-.6, .6), rng.uniform(-.6, .6), 0))
                    arch.strands.append((p + jitter, p.z * rng.uniform(0.35, 0.85)))
    return trunk, h, {'flat': False, 'spray': 1.4, 'sprayTilt': 0.8, 'strandWidth': 0.8}


GROW = {'acacia': acacia, 'gum': gum, 'willow': willow}


def all_limbs(limb):
    yield limb
    for c in limb.children:
        yield from all_limbs(c)


# ─── Meshes ──────────────────────────────────────────────────────────────────

def add_tube(bm, uv, sway, limb, sides, h, sway_scale):
    pts, radii = limb.points, limb.radii
    if len(radii) != len(pts):
        radii = list(np.interp(np.linspace(0, 1, len(pts)), np.linspace(0, 1, len(radii)), radii))
    rings = []
    along = 0.0
    prev_n = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = prev_n if prev_n is not None else t.orthogonal().normalized()
        n = (n - t * n.dot(t)).normalized()
        prev_n = n
        b = t.cross(n)
        if i:
            along += (p - pts[i - 1]).length
        ring = []
        for s in range(sides + 1):
            a = s / sides * math.tau
            v = bm.verts.new(p + (n * math.cos(a) + b * math.sin(a)) * radii[i])
            ring.append((v, s / sides, along * 0.35, min(1.0, sway_scale * max(0.0, p.z / h))))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for s in range(sides):
            quad = (r0[s], r0[s + 1], r1[s + 1], r1[s])
            f = bm.faces.new([q[0] for q in quad])
            for loop, q in zip(f.loops, quad):
                loop[uv].uv = (q[1], q[2])
                loop[sway] = q[3]


def add_card(bm, uv, sway, center, right, up, cell, sway_bottom, sway_top):
    """A quad showing one cell of the 2x2 leaf atlas."""
    cu, cv = (cell % 2) * 0.5, (cell // 2) * 0.5
    corners = [(center - right - up, (cu, cv), sway_bottom), (center + right - up, (cu + 0.5, cv), sway_bottom),
               (center + right + up, (cu + 0.5, cv + 0.5), sway_top), (center - right + up, (cu, cv + 0.5), sway_top)]
    verts = [bm.verts.new(c[0]) for c in corners]
    f = bm.faces.new(verts)
    for loop, c in zip(f.loops, corners):
        loop[uv].uv = c[1]
        loop[sway] = c[2]


def mesh_object(name, bm, material, height):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    me.materials.append(material)
    obj['height'] = round(height, 3)
    return obj


def new_bm():
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    sway = bm.loops.layers.float.new('sway')
    return bm, uv, sway


def finish_sway(obj):
    """Loop sway (set while building) -> a per-point _SWAY attribute."""
    me = obj.data
    src = me.attributes.get('sway')
    vals = [0.0] * len(me.vertices)
    if src:
        for loop in me.loops:
            vals[loop.vertex_index] = src.data[loop.index].value
        me.attributes.remove(src)
    attr = me.attributes.new('_SWAY', 'FLOAT', 'POINT')
    attr.data.foreach_set('value', vals)


def build_bark(name, skel, h, lod, material):
    bm, uv, sway = new_bm()
    for limb in all_limbs(skel):
        if lod == 1 and limb.depth >= 3:
            continue
        sides = (10, 7, 5, 4)[limb.depth] if lod == 0 else (6, 4, 3, 3)[limb.depth]
        add_tube(bm, uv, sway, limb, sides, h, 0.45)
    return mesh_object(name, bm, material, h)


def build_leaves(name, kind, skel, h, style, lod, material, rng):
    bm, uv, sway = new_bm()
    size = style['spray'] * (1.0 if lod == 0 else 1.75)
    keep = 1 if lod == 0 else 3
    i = 0
    for limb in all_limbs(skel):
        for (p, d) in limb.tips:
            i += 1
            if i % keep:
                continue
            for c in range(3 if lod == 0 else 2):
                yaw = rng.uniform(0, math.tau)
                tilt = rng.uniform(-style['sprayTilt'], style['sprayTilt'])
                if style['flat']:
                    # Flat sprays lying across the crown, tipped a little.
                    right = Vector((math.cos(yaw), math.sin(yaw), 0)) * size * 0.5
                    up = Vector((-math.sin(yaw), math.cos(yaw), math.sin(tilt))) * size * 0.5
                else:
                    right = Vector((math.cos(yaw), math.sin(yaw), 0)) * size * 0.5
                    up = Vector((math.sin(tilt) * -math.sin(yaw), math.sin(tilt) * math.cos(yaw), math.cos(tilt))) * size * 0.5
                offset = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-.4, .4))) * size * 0.3
                if d.z < 0:
                    offset.z -= size * 0.25  # gum sprays droop below the twig
                hz = max(0.0, (p.z + offset.z) / h)
                add_card(bm, uv, sway, p + offset, right, up, rng.randrange(4), min(1, hz * 0.9), min(1, hz * 0.9 + 0.15))
        # Willow curtains: long hanging cards, freer the lower they hang.
        for n, (top, length) in enumerate(limb.strands):
            if n % (1 if lod == 0 else 3):
                continue
            yaw = rng.uniform(0, math.tau)
            w = style['strandWidth'] * (0.5 if lod == 0 else 0.85)
            right = Vector((math.cos(yaw), math.sin(yaw), 0)) * w
            up = Vector((0, 0, length * 0.5))
            hz = top.z / h
            add_card(bm, uv, sway, top - up, right, up, rng.randrange(4), min(1.2, hz + 0.45), hz * 0.8)
    return mesh_object(name, bm, material, h)


def build_impostor(name, h, width, material):
    """Three crossed upright cards, each showing one rendered side."""
    bm, uv, sway = new_bm()
    n = len(IMPOSTOR_ANGLES)
    for i, deg in enumerate(IMPOSTOR_ANGLES):
        a = math.radians(deg)
        right = Vector((math.cos(a), math.sin(a), 0)) * width * 0.5
        corners = [(-right, (i / n, 0.0), 0.0), (right, ((i + 1) / n, 0.0), 0.0),
                   (right + Vector((0, 0, h)), ((i + 1) / n, 1.0), 0.6), (-right + Vector((0, 0, h)), (i / n, 1.0), 0.6)]
        verts = [bm.verts.new(c[0]) for c in corners]
        f = bm.faces.new(verts)
        for loop, c in zip(f.loops, corners):
            loop[uv].uv = c[1]
            loop[sway] = c[2]
    return mesh_object(name, bm, material, h)


# ─── Materials ───────────────────────────────────────────────────────────────

def image_material(name, image, emission=False, alpha=True):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    if emission:
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
        if alpha:
            mix = nt.nodes.new('ShaderNodeMixShader')
            tr = nt.nodes.new('ShaderNodeBsdfTransparent')
            nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
            nt.links.new(tr.outputs[0], mix.inputs[1])
            nt.links.new(em.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs['Surface'])
        else:
            nt.links.new(em.outputs[0], out.inputs['Surface'])
    else:
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Roughness'].default_value = 0.8
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha:
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    return m


def flat_material(name, rgb, emission=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    if emission:
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = srgb(rgb)
        nt.links.new(em.outputs[0], out.inputs['Surface'])
    else:
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = srgb(rgb)
        bsdf.inputs['Roughness'].default_value = 0.9
        nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    return m


# ─── Rendering ───────────────────────────────────────────────────────────────

def render_setup(w, h):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.samples = 16
    s.cycles.use_denoising = False
    s.cycles.max_bounces = 0
    # Many leaf cards overlap: see through all of them, not just the first 8.
    s.cycles.transparent_max_bounces = 256
    s.render.film_transparent = True
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.view_settings.view_transform = 'Standard'
    s.view_settings.look = 'None'
    if not s.world:
        s.world = bpy.data.worlds.new('World')
    s.world.use_nodes = True
    bg = s.world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Strength'].default_value = 0.0


def ortho_camera(location, look_at, scale):
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = scale
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    cam.rotation_euler = (look_at - location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return px


def save_pixels(name, px, path):
    h, w, _ = px.shape
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    return img


def bleed(px, passes=48):
    """Spread leaf colour into the see-through pixels around it, so mipmaps
    and filtering don't fringe the leaves with black."""
    rgb, a = px[..., :3].copy(), px[..., 3:4]
    filled = (a > 0.01).astype(np.float32)
    for _ in range(passes):
        acc = np.zeros_like(rgb)
        cnt = np.zeros_like(filled)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc += np.roll(np.roll(rgb * filled, dy, 0), dx, 1)
            cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        grow = (filled == 0) & (cnt > 0)
        rgb = np.where(grow, acc / np.maximum(cnt, 1), rgb)
        filled = np.maximum(filled, grow.astype(np.float32))
    out = px.copy()
    out[..., :3] = rgb
    return out


# ─── Leaf spray pictures ─────────────────────────────────────────────────────

def leaf_poly(bm, base, direction, length, width, n=6, curve=0.0):
    """A pointed leaf outline in the XY plane."""
    d = direction.normalized()
    side = Vector((-d.y, d.x, 0))
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        w = math.sin(t * math.pi) ** 0.8 * width * 0.5
        c = base + d * (t * length) + side * (math.sin(t * math.pi) * curve * length)
        left.append(c + side * w)
        right.append(c - side * w)
    pts = left + right[::-1][1:-1]
    return bm.faces.new([bm.verts.new(p) for p in pts])


def twig_poly(bm, a, b, width):
    d = (b - a).normalized()
    side = Vector((-d.y, d.x, 0)) * width * 0.5
    return bm.faces.new([bm.verts.new(p) for p in (a + side, b + side * 0.4, b - side * 0.4, a - side)])


def spray_cell(kind, seed):
    rng = random.Random(seed)
    bm = bmesh.new()
    greens = {
        'acacia': [(0.24, 0.32, 0.13), (0.29, 0.37, 0.16), (0.20, 0.28, 0.11), (0.33, 0.40, 0.19)],
        'gum': [(0.48, 0.55, 0.47), (0.42, 0.50, 0.44), (0.55, 0.60, 0.50), (0.40, 0.46, 0.38)],
        'willow': [(0.56, 0.66, 0.30), (0.62, 0.70, 0.34), (0.48, 0.60, 0.26), (0.66, 0.72, 0.40)],
    }[kind]
    stem = (0.36, 0.28, 0.20) if kind != 'gum' else (0.55, 0.40, 0.32)
    faces = []  # (face, colour)
    if kind == 'acacia':
        # Bipinnate: a zigzag twig with pinnae pairs, each a row of tiny leaflets.
        for sprig in range(8):
            a = Vector((rng.uniform(-.3, .3), -0.48, 0))
            ang = math.pi / 2 + rng.uniform(-.6, .6)
            b = a + Vector((math.cos(ang), math.sin(ang), 0)) * rng.uniform(0.6, 0.9)
            faces.append((twig_poly(bm, a, b, 0.012), stem))
            for k in range(rng.randint(5, 8)):
                p = a.lerp(b, 0.15 + k * 0.11)
                for sgn in (-1, 1):
                    pa = ang + sgn * rng.uniform(0.9, 1.3)
                    pd = Vector((math.cos(pa), math.sin(pa), 0))
                    plen = rng.uniform(0.08, 0.13)
                    col = greens[rng.randrange(4)]
                    for m in range(10):
                        q = p + pd * (plen * m / 10)
                        for s2 in (-1, 1):
                            la = pa + s2 * 1.2
                            faces.append((leaf_poly(bm, q, Vector((math.cos(la), math.sin(la), 0)), 0.017, 0.007, 4), col))
                # White thorn pairs at the nodes.
                for sgn in (-1, 1):
                    ta = ang + sgn * 0.9
                    faces.append((leaf_poly(bm, p, Vector((math.cos(ta), math.sin(ta), 0)), 0.05, 0.006, 3), (0.86, 0.84, 0.78)))
    elif kind == 'gum':
        # A drooping twig of long sickle-shaped leaves.
        a = Vector((rng.uniform(-.1, .1), 0.48, 0))
        b = Vector((rng.uniform(-.15, .15), -0.2, 0))
        faces.append((twig_poly(bm, a, b, 0.014), stem))
        for k in range(rng.randint(11, 15)):
            p = a.lerp(b, rng.uniform(0.05, 1.0))
            ang = -math.pi / 2 + rng.uniform(-1.0, 1.0)
            faces.append((leaf_poly(bm, p, Vector((math.cos(ang), math.sin(ang), 0)), rng.uniform(0.22, 0.32), rng.uniform(0.04, 0.06), 8,
                                    rng.uniform(-0.12, 0.12)), greens[rng.randrange(4)]))
    else:
        # Willow: several hanging strands, narrow leaves all the way down.
        for s in range(rng.randint(3, 5)):
            x = rng.uniform(-0.36, 0.36)
            a = Vector((x, 0.5, 0))
            b = Vector((x + rng.uniform(-.08, .08), rng.uniform(-0.5, -0.1), 0))
            faces.append((twig_poly(bm, a, b, 0.006), stem))
            for k in range(26):
                p = a.lerp(b, k / 26 + rng.uniform(0, 0.02))
                if rng.random() < k / 60:
                    continue  # thinner toward the tip
                sgn = 1 if k % 2 else -1
                ang = -math.pi / 2 + sgn * rng.uniform(0.25, 0.6)
                faces.append((leaf_poly(bm, p, Vector((math.cos(ang), math.sin(ang), 0)), rng.uniform(0.07, 0.1), 0.012, 5),
                              greens[rng.randrange(4)]))
    me = bpy.data.meshes.new('spray')
    colours = {}
    mats = []
    for f, col in faces:
        if col not in colours:
            colours[col] = len(mats)
            mats.append(flat_material(f'c{len(mats)}', col, emission=True))
        f.material_index = colours[col]
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new('spray', me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def leaf_atlas(kind):
    cells = []
    for c in range(4):
        clear()
        render_setup(LEAF_CELL.get(kind, 512), LEAF_CELL.get(kind, 512))
        spray_cell(kind, zlib.crc32(f'{kind}-{c}'.encode()) & 0xffff)
        ortho_camera(Vector((0, 0, 5)), Vector((0, 0, 0)), 1.0)
        cells.append(render_to(os.path.join(TMP, f'{kind}-spray-{c}.png')))
    top = np.concatenate([cells[2], cells[3]], axis=1)
    bottom = np.concatenate([cells[0], cells[1]], axis=1)
    return bleed(np.concatenate([bottom, top], axis=0))


# ─── Whole trees ─────────────────────────────────────────────────────────────

def build_kind(kind):
    os.makedirs(TMP, exist_ok=True)
    atlas_px = leaf_atlas(kind)
    atlas_path = os.path.join(TMP, f'{kind}-leaves.png')
    variants = []
    for v in range(VARIANTS):
        rng = random.Random(zlib.crc32(f'{kind}-{v}-tree'.encode()))
        skel, h, style = GROW[kind](rng)
        # Far-off pictures: render the full tree from each side.
        clear()
        render_setup(IMPOSTOR_CELL, IMPOSTOR_CELL)
        leaves_img = save_pixels('leaves', atlas_px, atlas_path)
        bark_img = bpy.data.images.load(os.path.join(BARK_TEX, f'bark{kind.capitalize()}_diff.jpg'))
        bark_r = image_material('bark-r', bark_img, emission=True, alpha=False)
        leaf_r = image_material('leaf-r', leaves_img, emission=True)
        built = [build_bark('r-bark', skel, h, 0, bark_r),
                 build_leaves('r-leaves', kind, skel, h, style, 0, leaf_r, random.Random(v * 7 + 1))]
        # The whole tree's size, leaves and all, sets the cards and the scale.
        top = max(vt.co.z for o in built for vt in o.data.vertices) + 0.1
        width = 2 * max(math.hypot(vt.co.x, vt.co.y) for o in built for vt in o.data.vertices) + 0.2
        bpy.context.scene.render.resolution_x = IMPOSTOR_CELL if top < width else int(IMPOSTOR_CELL * width / top)
        bpy.context.scene.render.resolution_y = int(IMPOSTOR_CELL * top / width) if top < width else IMPOSTOR_CELL
        sides = []
        for deg in IMPOSTOR_ANGLES:
            a = math.radians(deg)
            facing = Vector((-math.sin(a), math.cos(a), 0))
            cam = ortho_camera(Vector((0, 0, top / 2)) + facing * 60, Vector((0, 0, top / 2)), max(width, top))
            sides.append(render_to(os.path.join(TMP, f'{kind}{v}-side{deg}.png')))
            bpy.data.objects.remove(cam)
        variants.append((skel, h, top, style, width, bleed(np.concatenate(sides, axis=1))))

    # The file itself: every variant and level, scaled to 1 unit tall.
    clear()
    leaves_img = save_pixels(f'{kind}-leaves', atlas_px, atlas_path)
    leaves_img.pack()
    bark = flat_material(f'bark-{kind}', (0.4, 0.33, 0.27))
    leaf_mat = image_material(f'leaves-{kind}', leaves_img)
    for v, (skel, h, top, style, width, imp_px) in enumerate(variants):
        imp_img = save_pixels(f'{kind}{v}-far', imp_px, os.path.join(TMP, f'{kind}{v}-far.png'))
        # Power-of-two sides: GPU texture compression needs them (odd sizes
        # came out as black boxes once squashed).
        pot = lambda n: 1 << max(7, min(11, round(math.log2(n))))
        imp_img.scale(pot(imp_img.size[0]), pot(imp_img.size[1]))
        imp_img.save()
        imp_img.pack()
        imp_mat = image_material(f'far-{kind}{v}', imp_img)
        objs = [
            build_bark(f'{kind}{v}_lod0_bark', skel, h, 0, bark),
            build_leaves(f'{kind}{v}_lod0_leaves', kind, skel, h, style, 0, leaf_mat, random.Random(v * 7 + 1)),
            build_bark(f'{kind}{v}_lod1_bark', skel, h, 1, bark),
            build_leaves(f'{kind}{v}_lod1_leaves', kind, skel, h, style, 1, leaf_mat, random.Random(v * 7 + 1)),
            build_impostor(f'{kind}{v}_lod2_far', top, width, imp_mat),
        ]
        for o in objs:
            finish_sway(o)
            o.scale = (1 / top,) * 3
            o['height'] = round(top, 3)
            o['width'] = round(width / top, 3)
        tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs}
        print(kind, v, f'h={top:.1f}m w={width:.1f}m', tris)
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    path = os.path.join(OUT, f'tree-{kind}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True,
                              export_attributes=True, export_extras=True, export_image_format='AUTO',
                              export_materials='EXPORT')
    print('wrote', path)


for kind in GROW:
    if ONLY and kind not in ONLY:
        continue
    build_kind(kind)
