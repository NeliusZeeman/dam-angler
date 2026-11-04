# Grows the game's reeds in Blender -- the two that line South African dams:
#   typha       bulrush ("papkuil"): fans of long strap leaves arching out,
#               stems carrying a velvety brown seed head and a thin spike
#   phragmites  common reed: tall canes with a leaf off every node and a
#               feathery purple-brown plume on top, standing in dense beds
# Two clumps of each, every clump at three levels of detail like the trees
# (tools/blender/build_trees.py, whose helpers this uses):
#   lod0  near: every leaf and stem, smoothly curved
#   lod1  middle: half of them, fewer bends
#   lod2  far: three crossed cards with pictures of the clump
#
#   blender --background --python tools/blender/build_reeds.py -- <repo root>
#
# Run by tools/build-reeds.mjs. Writes assets/scenery/models/reeds.glb: nodes
# <kind><n>_lod<l>_<part> (part = plant or far), 1 unit tall, Y up, with the
# real height in the "height" property and the wind's _SWAY values.

import bpy
import bmesh
import math
import os
import random
import sys
import zlib
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_trees as T  # noqa: E402

ROOT = T.ROOT
OUT = T.OUT
TMP = os.path.join(ROOT, 'art-source', 'reeds')
ATLAS = 1024
VARIANTS = 2

# Where each picture sits in the atlas (u0, v0, u1, v1).
BLADE = (0.0, 0.0, 0.25, 1.0)      # typha leaf: pale base, green, dry tip
HEAD = (0.25, 0.0, 0.5, 1.0)       # typha seed head: brown velvet
CANE_LEAF = (0.5, 0.0, 1.0, 0.5)   # phragmites leaf and cane
PLUME = (0.5, 0.5, 1.0, 1.0)       # phragmites plume, see-through


# ─── The atlas ───────────────────────────────────────────────────────────────

def paint_strip(h, w, rng, base, mid, tip, veins=0.12):
    """A lengthwise leaf strip: pale at the base, green, drying at the tip."""
    v = np.linspace(0, 1, h)[:, None]
    col = np.zeros((h, w, 3), np.float32)
    for c in range(3):
        lower = base[c] + (mid[c] - base[c]) * np.clip(v / 0.25, 0, 1)
        upper = mid[c] + (tip[c] - mid[c]) * np.clip((v - 0.82) / 0.18, 0, 1)
        col[..., c] = np.where(v < 0.82, lower, upper)
    # Fine parallel veins and a little mottling.
    u = np.linspace(0, 1, w)[None, :]
    vein = 1 - veins * (np.sin(u * math.pi * 14) ** 8)
    noise = 1 + (rng.random((h, w)) - 0.5) * 0.08
    col *= (vein * noise)[..., None]
    return col


def paint_atlas(rng):
    px = np.ones((ATLAS, ATLAS, 4), np.float32)

    def region(r):
        u0, v0, u1, v1 = r
        return slice(int(v0 * ATLAS), int(v1 * ATLAS)), slice(int(u0 * ATLAS), int(u1 * ATLAS))

    ys, xs = region(BLADE)
    px[ys, xs, :3] = paint_strip(ys.stop - ys.start, xs.stop - xs.start, rng,
                                 (0.66, 0.68, 0.48), (0.36, 0.48, 0.22), (0.62, 0.55, 0.32))
    ys, xs = region(HEAD)
    h, w = ys.stop - ys.start, xs.stop - xs.start
    speck = rng.random((h, w))
    head = np.stack([0.30 + speck * 0.06, 0.19 + speck * 0.04, 0.11 + speck * 0.03], -1)
    # Lower part of the strip: the green stem; the spike at the very top.
    vv = np.linspace(0, 1, h)[:, None, None]
    stem = np.array([0.40, 0.50, 0.24])
    head = np.where(vv < 0.3, stem, np.where(vv > 0.92, np.array([0.55, 0.47, 0.33]), head))
    px[ys, xs, :3] = head
    ys, xs = region(CANE_LEAF)
    px[ys, xs, :3] = paint_strip(ys.stop - ys.start, xs.stop - xs.start, rng,
                                 (0.55, 0.58, 0.42), (0.38, 0.47, 0.30), (0.58, 0.54, 0.38), 0.08)
    ys, xs = region(PLUME)
    px[ys, xs] = plume_picture(ys.stop - ys.start)
    return px


def plume_picture(size):
    """Render a reed plume: a fan of fine drooping hairs, purple-brown."""
    T.clear()
    T.render_setup(size, size)
    rng = random.Random(7)
    bm = bmesh.new()
    faces = []
    stalk_top = Vector((0, 0.45, 0))
    stalk_bottom = Vector((0, -0.5, 0))
    faces.append((T.twig_poly(bm, stalk_bottom, stalk_top, 0.012), (0.52, 0.48, 0.32)))
    for k in range(70):
        t = rng.uniform(0.0, 1.0)
        p = stalk_bottom.lerp(stalk_top, 0.45 + t * 0.55)
        for _ in range(4):
            ang = math.pi / 2 + rng.uniform(-0.9, 0.9) - (1 - t) * 0.3 * (1 if rng.random() < 0.5 else -1)
            d = Vector((math.cos(ang), math.sin(ang), 0))
            length = rng.uniform(0.08, 0.2) * (0.6 + 0.4 * t)
            col = (rng.uniform(0.45, 0.6), rng.uniform(0.36, 0.44), rng.uniform(0.32, 0.4))
            faces.append((T.leaf_poly(bm, p, d, length, 0.008, 4, rng.uniform(-0.15, 0.15)), col))
    me = bpy.data.meshes.new('plume')
    mats, index = [], {}
    for f, col in faces:
        if col not in index:
            index[col] = len(mats)
            mats.append(T.flat_material(f'p{len(mats)}', col, emission=True))
        f.material_index = index[col]
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new('plume', me)
    bpy.context.scene.collection.objects.link(obj)
    T.ortho_camera(Vector((0, 0, 5)), Vector((0, 0, 0)), 1.0)
    os.makedirs(TMP, exist_ok=True)
    return T.bleed(T.render_to(os.path.join(TMP, 'plume.png')))


# ─── Clumps ──────────────────────────────────────────────────────────────────

def ribbon(bm, uv, sway, points, widths, region, twist=0.0, flat=None):
    """A flat leaf along `points`, `widths` wide, mapped onto an atlas strip."""
    u0, v0, u1, v1 = region
    n = len(points)
    rows = []
    for i, p in enumerate(points):
        t = (points[min(i + 1, n - 1)] - points[max(i - 1, 0)]).normalized()
        side = (flat or Vector((0, 0, 1))).cross(t)
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        a = twist * i / max(1, n - 1)
        side = side * math.cos(a) + t.cross(side) * math.sin(a)
        w = widths[i] * 0.5
        rows.append([(bm.verts.new(p - side * w), (u0, v0 + (v1 - v0) * i / (n - 1))),
                     (bm.verts.new(p + side * w), (u1, v0 + (v1 - v0) * i / (n - 1)))])
    for i in range(n - 1):
        quad = (rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0])
        f = bm.faces.new([q[0] for q in quad])
        for loop, q in zip(f.loops, quad):
            loop[uv].uv = q[1]
            loop[sway] = 0.0  # set from height later


def tube(bm, uv, sway, points, radius, region, sides=4):
    u0, v0, u1, v1 = region
    n = len(points)
    rings = []
    for i, p in enumerate(points):
        t = (points[min(i + 1, n - 1)] - points[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a)
        r = radius[i] if isinstance(radius, (list, tuple)) else radius
        rings.append([(bm.verts.new(p + (a * math.cos(s / sides * math.tau) + b * math.sin(s / sides * math.tau)) * r),
                       (u0 + (u1 - u0) * s / sides, v0 + (v1 - v0) * i / (n - 1))) for s in range(sides + 1)])
    for i in range(n - 1):
        for s in range(sides):
            quad = (rings[i][s], rings[i][s + 1], rings[i + 1][s + 1], rings[i + 1][s])
            f = bm.faces.new([q[0] for q in quad])
            for loop, q in zip(f.loops, quad):
                loop[uv].uv = q[1]
                loop[sway] = 0.0


def arc(base, direction, length, lean, segs, droop=0.0):
    """Points rising from `base`, bending over toward `direction`."""
    pts = []
    for i in range(segs + 1):
        t = i / segs
        out = math.sin(t * lean) * length * 0.6
        up = (1 - (1 - math.cos(t * lean)) * 0.5) * t * length
        p = base + direction * out + Vector((0, 0, up - droop * t * t * length))
        pts.append(p)
    return pts


def typha(rng, lod):
    bm, uv, sway = T.new_bm()
    segs = 7 if lod == 0 else 3
    leaves = rng.randint(20, 28)
    for i in range(leaves):
        if lod == 1 and i % 2:
            continue
        ang = rng.uniform(0, math.tau)
        d = Vector((math.cos(ang), math.sin(ang), 0))
        base = d * rng.uniform(0, 0.12)
        length = rng.uniform(1.3, 2.3)
        pts = arc(base, d, length, rng.uniform(0.15, 0.6) if rng.random() < 0.8 else rng.uniform(0.6, 1.0), segs, droop=rng.uniform(0.0, 0.08))
        w0 = rng.uniform(0.016, 0.024)
        widths = [w0 * (1 - (k / segs) ** 2.5) + 0.002 for k in range(segs + 1)]
        ribbon(bm, uv, sway, pts, widths, BLADE, twist=rng.uniform(-1.2, 1.2), flat=d.cross(Vector((0, 0, 1))))
    for i in range(rng.randint(2, 5) if lod == 0 else rng.randint(1, 3)):
        ang = rng.uniform(0, math.tau)
        base = Vector((math.cos(ang), math.sin(ang), 0)) * rng.uniform(0, 0.1)
        h = rng.uniform(1.5, 2.1)
        lean = Vector((rng.uniform(-.08, .08), rng.uniform(-.08, .08), 1)).normalized()
        n = 6 if lod == 0 else 3
        pts = [base + lean * (h * k / n) for k in range(n + 1)]
        # Stem (bottom of the HEAD strip), then the head and spike above it.
        head_lo, head_hi = h * 0.72, h * 0.86
        stem_pts = [p for p in pts if p.z < head_lo] + [base + lean * head_lo]
        tube(bm, uv, sway, stem_pts, 0.006, (HEAD[0], 0.0, HEAD[2], 0.29), sides=4 if lod == 0 else 3)
        head_pts = [base + lean * (head_lo + (head_hi - head_lo) * k / 3) for k in range(4)]
        r = rng.uniform(0.013, 0.018)
        tube(bm, uv, sway, head_pts, [r * 0.8, r, r, r * 0.8], (HEAD[0], 0.32, HEAD[2], 0.9), sides=7 if lod == 0 else 4)
        if lod == 0:
            spike = [base + lean * (head_hi + 0.03 * k) for k in range(5)]
            tube(bm, uv, sway, spike, [0.004, 0.0035, 0.003, 0.002, 0.0005], (HEAD[0], 0.93, HEAD[2], 1.0), sides=3)
    return bm, uv, sway


def phragmites(rng, lod):
    bm, uv, sway = T.new_bm()
    canes = rng.randint(14, 20)
    for i in range(canes):
        if lod == 1 and i % 2:
            continue
        base = Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0))
        h = rng.uniform(2.0, 3.0)
        lean = Vector((rng.uniform(-.1, .1), rng.uniform(-.1, .1), 1)).normalized()
        n = 6 if lod == 0 else 3
        top = h * 0.86
        pts = [base + lean * (top * k / n) for k in range(n + 1)]
        tube(bm, uv, sway, pts, [0.007 * (1 - 0.5 * k / n) for k in range(n + 1)],
             (CANE_LEAF[0], 0.0, CANE_LEAF[0] + 0.05, 0.25), sides=4 if lod == 0 else 3)
        # A leaf off each node, alternating, standing out then drooping.
        nodes = rng.randint(6, 9)
        for k in range(nodes):
            if lod == 1 and k % 2:
                continue
            z = top * (0.25 + 0.7 * k / nodes)
            ang = (k * math.pi) + rng.uniform(-0.6, 0.6)
            d = Vector((math.cos(ang), math.sin(ang), 0))
            start = base + lean * z
            length = rng.uniform(0.3, 0.5)
            segs = 4 if lod == 0 else 2
            leaf = [start + d * (length * t / segs) + Vector((0, 0, length * (0.5 * t / segs - 0.55 * (t / segs) ** 2)))
                    for t in range(segs + 1)]
            widths = [0.04 * math.sin(math.pi * (t / segs) * 0.9 + 0.15) + 0.002 for t in range(segs + 1)]
            ribbon(bm, uv, sway, leaf, widths, (CANE_LEAF[0] + 0.06, 0.02, CANE_LEAF[2], 0.48), flat=None)
        # The plume: two crossed cards on top of the cane.
        p = base + lean * top
        ph = (h - top) * 1.4 + 0.1
        for c in range(2 if lod == 0 else 1):
            a = rng.uniform(0, math.pi) + c * math.pi / 2
            right = Vector((math.cos(a), math.sin(a), 0)) * ph * 0.22
            corners = [(p - right, (PLUME[0], PLUME[1])), (p + right, (PLUME[2], PLUME[1])),
                       (p + right + Vector((0, 0, ph)), (PLUME[2], PLUME[3])), (p - right + Vector((0, 0, ph)), (PLUME[0], PLUME[3]))]
            verts = [bm.verts.new(q[0]) for q in corners]
            f = bm.faces.new(verts)
            for loop, q in zip(f.loops, corners):
                loop[uv].uv = q[1]
                loop[sway] = 0.0
    return bm, uv, sway


GROW = {'typha': typha, 'phragmites': phragmites}


def set_height_sway(bm, sway, top):
    """Sway by height: rooted at the bottom, free at the tips."""
    for f in bm.faces:
        for loop in f.loops:
            loop[sway] = min(1.0, max(0.0, loop.vert.co.z / top)) ** 0.8


def clump_object(name, kind, v, lod, material):
    rng = random.Random(zlib.crc32(f'{kind}-{v}'.encode()))
    bm, uv, sway = GROW[kind](rng, lod)
    top = max(vt.co.z for vt in bm.verts)
    set_height_sway(bm, sway, top)
    obj = T.mesh_object(name, bm, material, top)
    return obj, top


def build():
    os.makedirs(TMP, exist_ok=True)
    atlas_px = paint_atlas(np.random.default_rng(3))
    atlas_path = os.path.join(TMP, 'reeds-atlas.png')
    clumps = []
    for kind in GROW:
        for v in range(VARIANTS):
            # Far pictures: render the full clump from each side.
            T.clear()
            T.render_setup(256, 256)
            img = T.save_pixels('atlas', atlas_px, atlas_path)
            render_mat = T.image_material('r', img, emission=True)
            obj, top = clump_object('r', kind, v, 0, render_mat)
            width = 2 * max(math.hypot(vt.co.x, vt.co.y) for vt in obj.data.vertices) + 0.05
            s = bpy.context.scene
            s.render.resolution_x = 256 if top < width else max(64, int(256 * width / top))
            s.render.resolution_y = int(256 * top / width) if top < width else 256
            sides = []
            for deg in T.IMPOSTOR_ANGLES:
                a = math.radians(deg)
                facing = Vector((-math.sin(a), math.cos(a), 0))
                cam = T.ortho_camera(Vector((0, 0, top / 2)) + facing * 20, Vector((0, 0, top / 2)), max(width, top))
                sides.append(T.render_to(os.path.join(TMP, f'{kind}{v}-side{deg}.png')))
                bpy.data.objects.remove(cam)
            clumps.append((kind, v, top, width, T.bleed(np.concatenate(sides, axis=1))))

    T.clear()
    atlas = T.save_pixels('reeds', atlas_px, atlas_path)
    atlas.pack()
    mat = T.image_material('reeds', atlas)
    pot = lambda n: 1 << max(6, min(10, round(math.log2(n))))
    for kind, v, top, width, far_px in clumps:
        far = T.save_pixels(f'{kind}{v}-far', far_px, os.path.join(TMP, f'{kind}{v}-far.png'))
        far.scale(pot(far.size[0]), pot(far.size[1]))
        far.save()
        far.pack()
        far_mat = T.image_material(f'far-{kind}{v}', far)
        objs = [clump_object(f'{kind}{v}_lod0_plant', kind, v, 0, mat)[0],
                clump_object(f'{kind}{v}_lod1_plant', kind, v, 1, mat)[0],
                T.build_impostor(f'{kind}{v}_lod2_far', top, width, far_mat)]
        for o in objs:
            T.finish_sway(o)
            o.scale = (1 / top,) * 3
            o['height'] = round(top, 3)
            o['width'] = round(width / top, 3)
        print(kind, v, f'h={top:.2f}m', {o.name: len(o.data.polygons) for o in objs})
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    path = os.path.join(OUT, 'reeds.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True,
                              export_attributes=True, export_extras=True, export_image_format='AUTO',
                              export_materials='EXPORT')
    print('wrote', path)


build()
