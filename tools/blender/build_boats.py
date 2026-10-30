# The boats on the dam, modelled from scratch: a real planing hull lofted
# from cross-sections (V bottom, chines, spray rails, flared topsides, a
# sheer that rises to the bow), carpeted decks with hatches, consoles,
# bucket seats, outboards with a spinning prop, trolling motor and fish
# finder, rub rails, cleats, rods in holders -- and ambient occlusion baked
# into the vertex colours in Cycles, so the corners and seats sit in their
# own shade. One file per kind: assets/scenery/models/boat-<kind>.glb.
#
#   blender --background --python tools/blender/build_boats.py -- <repo root> [kinds] [preview dir]
#
# Built in game coordinates (x across, y up, z toward the bow, origin on the
# waterline at mid-length) and turned to Blender's Z-up at the end. Each
# file holds: 'body' (everything fixed), 'prop' / 'paddle' (moving parts,
# origin at their pivot) and 'spot-<rod|sit|paddle>-<n>' empties where the
# crew stand or sit (gfx/boats.js).

import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Matrix, Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = os.path.abspath(argv[0] if argv else os.getcwd())
ONLY = set(argv[1].split(',')) if len(argv) > 1 and argv[1] else None
PREVIEW = argv[2] if len(argv) > 2 else None
OUT = os.path.join(ROOT, 'assets', 'scenery', 'models')
TO_BLENDER = Matrix.Rotation(math.pi / 2, 4, 'X')  # game (x, y up, z bow) -> Blender (x, -z, y)

# --------------------------------------------------------------- materials

MATS = {}


def srgb(c):
    return tuple(((v / 255) ** 2.2) for v in c)


def carpet_image(name, col):
    """A tiling carpet: fine fibre noise over a soft mottle."""
    n = 128
    rnd = random.Random(name)
    low = [[rnd.random() for _ in range(9)] for _ in range(9)]
    px = []
    for y in range(n):
        for x in range(n):
            fx, fy = x / n * 8, y / n * 8
            ix, iy = int(fx), int(fy)
            tx, ty = fx - ix, fy - iy
            a = low[iy % 8][ix % 8] * (1 - tx) + low[iy % 8][(ix + 1) % 8] * tx
            b = low[(iy + 1) % 8][ix % 8] * (1 - tx) + low[(iy + 1) % 8][(ix + 1) % 8] * tx
            m = 0.9 + 0.1 * (a * (1 - ty) + b * ty)
            f = m * (0.82 + 0.18 * rnd.random())
            px += [col[0] * f, col[1] * f, col[2] * f, 1.0]
    img = bpy.data.images.new(name, n, n)
    img.pixels[:] = px
    img.pack()
    return img


def mat(name, col, rough=0.5, metal=0.0, coat=0.0, alpha=1.0, emit=0.0, carpet=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    lin = srgb(col) + (1.0,)
    p.inputs['Base Color'].default_value = lin
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if coat:
        p.inputs['Coat Weight'].default_value = coat
        p.inputs['Coat Roughness'].default_value = 0.05
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if emit:
        p.inputs['Emission Color'].default_value = lin
        p.inputs['Emission Strength'].default_value = emit
    if carpet:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = carpet_image(name, lin)
        m.node_tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    MATS[name] = m
    return m


PAINT = {'bass': (150, 18, 22), 'tiger': (28, 70, 40), 'ski': (20, 60, 140), 'pontoon': (20, 60, 140),
         'houseboat': (30, 90, 70), 'yacht': (20, 40, 90), 'kayak': (230, 120, 20)}


def make_materials(kind):
    MATS.clear()
    # 'paint' is the boat's own colour: the game tints a copy per boat.
    # Metal-flake gelcoat on a bass boat, painted aluminium on a tiger boat,
    # moulded plastic on a kayak, glossy gelcoat on the rest.
    looks = {'bass': (0.22, 0.45, 1.0), 'tiger': (0.4, 0.1, 0.0), 'kayak': (0.35, 0.0, 0.25)}
    rough, metal, coat = looks.get(kind, (0.22, 0.1, 1.0))
    mat('paint', PAINT[kind], rough, metal, coat=coat)
    mat('gelWhite', (236, 236, 230), 0.18, 0.0, coat=1.0)
    mat('stripeSilver', (190, 192, 196), 0.25, 0.8, coat=1.0)
    mat('stripeBlack', (18, 18, 20), 0.2, 0.2, coat=1.0)
    mat('bottom', (40, 42, 46), 0.3, 0.3, coat=0.6)
    mat('alu', (196, 200, 204), 0.38, 1.0)
    mat('aluDull', (150, 154, 158), 0.5, 1.0)
    mat('chrome', (235, 235, 235), 0.08, 1.0)
    mat('rubber', (22, 22, 24), 0.6)
    mat('plastic', (30, 31, 34), 0.4)
    mat('cowl', (14, 14, 16), 0.15, 0.1, coat=1.0)
    mat('cowlGrey', (120, 124, 128), 0.35, 0.6)
    mat('carpet', (88, 90, 94), 0.95, carpet=True)
    mat('carpetDark', (62, 64, 68), 0.95, carpet=True)
    mat('vinyl', (232, 230, 222), 0.42, coat=0.3)
    mat('vinylAccent', (60, 62, 70), 0.45, coat=0.3)
    mat('glass', (60, 70, 76), 0.05, 0.0, alpha=0.38)
    mat('screen', (40, 90, 110), 0.1, emit=0.6)
    mat('lightRed', (220, 20, 20), 0.2, emit=1.5)
    mat('lightGreen', (20, 200, 60), 0.2, emit=1.5)
    mat('lightWhite', (255, 250, 235), 0.2, emit=1.5)
    mat('canvas', (28, 38, 62), 0.9)
    mat('teak', (150, 98, 58), 0.7)
    mat('sail', (246, 246, 240), 0.75)
    mat('cabin', (238, 232, 214), 0.5)
    mat('rod', (20, 22, 26), 0.25, 0.3, coat=1.0)
    mat('cork', (176, 138, 96), 0.8)


# ------------------------------------------------------------------ meshes

def xform(rot=(0, 0, 0), at=(0, 0, 0), scale=None):
    m = Matrix.Translation(Vector(at)) @ Euler(rot, 'YXZ').to_matrix().to_4x4()
    if scale:
        m = m @ Matrix.Diagonal(Vector(scale + (1,)))
    return m


def planar_uv(bm, k=2.0):
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            co = l.vert.co
            if abs(n.y) > 0.6:
                l[uv].uv = (co.x * k, co.z * k)
            elif abs(n.x) > abs(n.z):
                l[uv].uv = (co.z * k, co.y * k)
            else:
                l[uv].uv = (co.x * k, co.y * k)


class Boat:
    def __init__(self, kind):
        self.kind = kind
        self.parts = []      # fixed parts, joined into 'body'
        self.movers = []     # (name, object, pivot)
        self.spots = []      # (kind, x, y, z, turn)
        self.mats = []

    def _obj(self, bm, mats, name='part'):
        planar_uv(bm)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for m in mats:
            me.materials.append(MATS[m])
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        return o

    def add(self, bm, mats, smooth=False, mover=None, pivot=(0, 0, 0)):
        if isinstance(mats, str):
            mats = [mats]
        o = self._obj(bm, mats, mover or 'part')
        if smooth:
            for p in o.data.polygons:
                p.use_smooth = True
        if mover:
            self.movers.append((mover, o, pivot))
        else:
            self.parts.append(o)
        return o

    # A box with softly rounded edges. size = (x, y, z) in metres.
    def box(self, m, size, at=(0, 0, 0), rot=(0, 0, 0), bevel=0.012, mover=None):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=size, verts=bm.verts)
        if bevel:
            bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(bevel, min(size) * 0.45), segments=2,
                            affect='EDGES', profile=0.5)
        big = max(size)
        if big > 0.35:
            cuts = min(5, int(big / 0.3))
            long_edges = [e for e in bm.edges if e.calc_length() > 0.3]
            bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=cuts, use_grid_fill=True)
        bm.transform(xform(rot, at))
        return self.add(bm, m, smooth=bool(bevel), mover=mover)

    # A cylinder (axis 'y' up, 'x' across or 'z' along); r2 for a cone.
    def cyl(self, m, r, h, at=(0, 0, 0), axis='y', r2=None, seg=16, rot=(0, 0, 0), mover=None, smooth=True):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
        base = {'y': Matrix.Rotation(-math.pi / 2, 4, 'X'), 'x': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'z': Matrix()}[axis]
        bm.transform(xform(rot, at) @ base)
        o = self.add(bm, m, smooth=False, mover=mover)
        if smooth:
            for p in o.data.polygons:
                p.use_smooth = abs(p.normal.dot(axis_vec(axis, rot))) < 0.9  # sides, not the end caps
        return o

    def sphere(self, m, r, at=(0, 0, 0), scale=(1, 1, 1), seg=12):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        bm.transform(Matrix.Translation(Vector(at)) @ Matrix.Diagonal(Vector(scale + (1,))))
        return self.add(bm, m, smooth=True)

    # A tube swept along points (closed for a ring).
    def tube(self, m, pts, r, seg=8, closed=False, cap=True, mover=None):
        bm = bmesh.new()
        pts = [Vector(p) for p in pts]
        rings = []
        n = len(pts)
        prev_side = None
        for i, p in enumerate(pts):
            a = pts[(i - 1) % n] if (closed or i > 0) else p
            b = pts[(i + 1) % n] if (closed or i < n - 1) else p
            t = (b - a).normalized()
            if prev_side is None:
                up = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
                side = t.cross(up).normalized()
            else:
                side = (prev_side - t * prev_side.dot(t)).normalized()
            prev_side = side
            up2 = side.cross(t).normalized()
            rings.append([bm.verts.new(p + (side * math.cos(k / seg * 2 * math.pi) + up2 * math.sin(k / seg * 2 * math.pi)) * r)
                          for k in range(seg)])
        for i in range(n if closed else n - 1):
            r0, r1 = rings[i], rings[(i + 1) % n]
            for k in range(seg):
                bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
        if cap and not closed:
            bm.faces.new(rings[0][::-1])
            bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        return self.add(bm, m, smooth=True, mover=mover)

    # A prism: a profile in the (z, y) plane pushed across x.
    def prism(self, m, profile, x0, x1, bevel=0.01):
        bm = bmesh.new()
        a = [bm.verts.new((x0, y, z)) for z, y in profile]
        b = [bm.verts.new((x1, y, z)) for z, y in profile]
        n = len(profile)
        bm.faces.new(a[::-1])
        bm.faces.new(b)
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        if bevel:
            bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
        return self.add(bm, m, smooth=True)

    # A surface over a grid: f(u, v) -> (x, y, z), u and v 0..1.
    def surface(self, m, f, nu, nv, both=False, mover=None):
        bm = bmesh.new()
        vs = [[bm.verts.new(f(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
        for i in range(nu):
            for j in range(nv):
                bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0005)
        return self.add(bm, m, smooth=True, mover=mover)

    def spot(self, kind, x, y, z, turn=0.0):
        self.spots.append((kind, x, y, z, turn))


def axis_vec(axis, rot):
    v = {'y': Vector((0, 1, 0)), 'x': Vector((1, 0, 0)), 'z': Vector((0, 0, 1))}[axis]
    return Euler(rot, 'YXZ').to_matrix() @ v


# ------------------------------------------------------------------- hulls

class Hull:
    """A planing hull lofted from cross-sections. t runs 0 (stern) .. 1 (bow)."""

    def __init__(self, L, W, sheer=(0.55, 0.62), keel=-0.22, dead=18, chine=0.86, bow=0.42,
                 stern=None, bowp=0.7, rail=True, forefoot=0.55, side_pts=7):
        self.L, self.W = L, W
        self.sheer, self.keel, self.dead = sheer, keel, math.radians(dead)
        self.chine, self.bow, self.stern, self.bowp = chine, bow, stern, bowp
        self.rail, self.forefoot, self.side_pts = rail, forefoot, side_pts

    def t(self, z):
        return min(1.0, max(0.0, (z + self.L / 2) / self.L))

    def taper(self, t):
        f = 1.0
        if t > self.bow:
            u = (t - self.bow) / (1 - self.bow)
            f *= max(0.0, math.cos(u * math.pi / 2)) ** self.bowp
        if self.stern is not None and t < self.stern:
            u = (self.stern - t) / self.stern
            f *= max(0.0, math.cos(u * math.pi / 2)) ** self.bowp
        return f

    def half(self, z):
        return self.W / 2 * self.taper(self.t(z))

    def sheer_y(self, z):
        t = self.t(z)
        a, b = self.sheer
        if self.stern is not None:
            return a + (b - a) * (2 * t - 1) ** 2
        return a + (b - a) * t ** 2

    def keel_y(self, t):
        y = self.keel
        top = self.sheer_y(-self.L / 2 + t * self.L)
        if t > self.forefoot:
            u = (t - self.forefoot) / (1 - self.forefoot)
            y += (top - self.keel) * u ** 2.2
        if self.stern is not None and t < 1 - self.forefoot:
            u = ((1 - self.forefoot) - t) / (1 - self.forefoot)
            y += (top - self.keel) * u ** 2.2
        return y

    def section(self, z):
        """Points from the keel out to the sheer, one side (x >= 0)."""
        t = self.t(z)
        f = self.taper(t)
        hb = self.W / 2 * f
        hc = hb * self.chine
        ys = self.sheer_y(z)
        yk = self.keel_y(t)
        yc = min(yk + hc * math.tan(self.dead), ys - 0.06 * f - 0.005)
        pts = []
        for i in range(4):
            u = i / 4
            pts.append((hc * u, yk + (yc - yk) * u ** 0.85))
        pts.append((hc, yc))
        x0, y0 = hc, yc
        if self.rail:
            x0, y0 = hc + 0.04 * f, yc + 0.012 * f
            pts.append((x0, y0))
        n = self.side_pts
        for i in range(1, n + 1):
            u = i / n
            bulge = math.sin(u * math.pi) * 0.02 * f
            pts.append((x0 + (hb - x0) * u + bulge, y0 + (ys - y0) * u))
        return pts

    def stations(self, n=44):
        out = []
        for i in range(n + 1):
            u = i / n
            if self.stern is None:
                t = 1 - (1 - u) ** 1.25
            else:
                t = 0.5 - 0.5 * math.cos(u * math.pi)
            out.append(-self.L / 2 + t * self.L * 0.9995)
        return out


def build_hull(b, h, paints, transom='paint'):
    """The shell. paints: material per face column, keel out to sheer."""
    bm = bmesh.new()
    zs = h.stations()
    rings = []
    for z in zs:
        side = h.section(z)
        ring = [(-x, y) for x, y in reversed(side[1:])] + side
        rings.append([bm.verts.new((x, y, z)) for x, y in ring])
    ncol = len(rings[0]) - 1
    half = ncol // 2
    for i in range(len(zs) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for k in range(ncol):
            try:
                f = bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
            except ValueError:
                continue
            col = k - half if k >= half else half - 1 - k
            f.material_index = paints[min(col, len(paints) - 1)]
    if h.stern is None:
        f = bm.faces.new(rings[0])
        f.material_index = 999  # the transom: hull() points it at its material
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.002)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return bm


def hull(b, h, columns, transom='paint'):
    """columns: material name per column, keel to sheer."""
    names = []
    for c in columns + [transom]:
        if c not in names:
            names.append(c)
    idx = [names.index(c) for c in columns]
    bm = build_hull(b, h, idx)
    # Transom face got index len(set(idx)); point it at the transom material.
    ti = names.index(transom)
    for f in bm.faces:
        if f.material_index >= len(names):
            f.material_index = ti
    o = b.add(bm, names, smooth=True)
    o.data.shade_smooth()
    return o


def deck(b, h, regions, cap=0.08, cap_mat='paint', liner='gelWhite', floor='carpet', wall_cols=6):
    """Gunwale cap, inner liner and decks. regions: [(z0, z1, deck height)] stern to bow."""
    bm = bmesh.new()

    def inner(z):
        return max(0.0, h.half(z) - cap)

    def strip(zs, f, mat_i):
        rows = [[bm.verts.new(p) for p in f(z)] for z in zs]
        for i in range(len(rows) - 1):
            for k in range(len(rows[i]) - 1):
                try:
                    bm.faces.new((rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k])).material_index = mat_i
                except ValueError:
                    pass

    zs_all = [z for z in h.stations(60) if z >= regions[0][0]]
    for s in (-1, 1):
        # Cap: from the sheer to the inner edge, slightly crowned.
        strip(zs_all, lambda z: [(s * h.half(z), h.sheer_y(z), z), (s * (h.half(z) - cap * 0.5), h.sheer_y(z) + 0.012, z),
                                 (s * inner(z), h.sheer_y(z), z)], 0)
    for z0, z1, yd in regions:
        zs = [z0 + (z1 - z0) * i / 24 for i in range(25)]
        for s in (-1, 1):
            strip(zs, lambda z: [(s * inner(z), h.sheer_y(z) - (h.sheer_y(z) - yd) * j / wall_cols, z) for j in range(wall_cols + 1)], 1)
        strip(zs, lambda z: [(inner(z) * (-1 + 2 * j / 10), yd, z) for j in range(11)], 2)
    # Steps between decks of different heights, and the wall at the stern.
    for (z0, z1, ya), nxt in zip(regions, regions[1:] + [None]):
        if nxt and abs(nxt[2] - ya) > 0.01:
            w = inner(z1)
            lo, hi = min(ya, nxt[2]), max(ya, nxt[2])
            strip([lo, hi], lambda y: [(w * (-1 + 2 * j / 8), y, z1) for j in range(9)], 2)
    z0, _, ya = regions[0]
    w = inner(z0)
    strip([ya, h.sheer_y(z0)], lambda y: [(w * (-1 + 2 * j / 8), y, z0) for j in range(9)], 1)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return b.add(bm, [cap_mat, liner, floor], smooth=False)


def rub_rail(b, h, m='rubber', r=0.022, drop=0.03):
    zs = [z for z in h.stations(50)]
    pts = [(-h.half(z) - 0.005, h.sheer_y(z) - drop, z) for z in zs]
    pts += [(h.half(z) + 0.005, h.sheer_y(z) - drop, z) for z in reversed(zs[:-1])]
    b.tube(m, pts, r, seg=6, cap=True)


# ----------------------------------------------------------------- fittings

def outboard(b, z, top, s=1.0, cowl='cowl', tiller=False):
    """An outboard on the transom at z (motor behind, toward -z)."""
    b.box('aluDull', (0.2 * s, 0.26 * s, 0.14 * s), (0, top - 0.06, z - 0.06 * s), bevel=0.02)
    cz = z - 0.36 * s
    b.box(cowl, (0.44 * s, 0.22 * s, 0.66 * s), (0, top + 0.12 * s, cz), bevel=0.06 * s)        # lower pan
    b.box(cowl, (0.42 * s, 0.34 * s, 0.62 * s), (0, top + 0.38 * s, cz - 0.01), bevel=0.13 * s)  # cowling
    b.box('stripeSilver', (0.445 * s, 0.025 * s, 0.665 * s), (0, top + 0.235 * s, cz), bevel=0.01)
    b.box('cowlGrey', (0.2 * s, 0.75 * s, 0.32 * s), (0, top - 0.42 * s, cz + 0.02), bevel=0.05 * s)   # midsection
    plate = top - 0.82 * s
    b.box('cowlGrey', (0.34 * s, 0.022, 0.44 * s), (0, plate, cz - 0.03), bevel=0.008)
    gy = plate - 0.13 * s
    b.cyl('cowlGrey', 0.075 * s, 0.42 * s, (0, gy, cz - 0.02), axis='z')
    b.cyl('cowlGrey', 0.075 * s, 0.14 * s, (0, gy, cz + 0.25 * s), axis='z', r2=0.02)
    b.box('cowlGrey', (0.1 * s, 0.24 * s, 0.24 * s), (0, gy - 0.02, cz + 0.02), bevel=0.02)       # strut
    b.box('cowlGrey', (0.018, 0.16 * s, 0.18 * s), (0, gy - 0.15 * s, cz - 0.02), bevel=0.005)  # skeg
    if tiller:
        b.tube('rubber', [(0, top + 0.22 * s, cz + 0.2 * s), (0.02, top + 0.26 * s, cz + 0.55 * s), (0.04, top + 0.3 * s, cz + 0.85 * s)], 0.025)
    # The prop: hub and three cupped blades, its own node so it can spin.
    pz = cz - 0.25 * s
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.045 * s, radius2=0.03 * s, depth=0.14 * s)
    for k in range(3):
        a = k / 3 * 2 * math.pi
        blade = bmesh.new()
        bmesh.ops.create_cube(blade, size=1)
        bmesh.ops.scale(blade, vec=(0.13 * s, 0.012, 0.09 * s), verts=blade.verts)
        blade.transform(Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((0.1 * s, 0, 0)) @ Matrix.Rotation(0.6, 4, 'X'))
        me = bpy.data.meshes.new('tmp')
        blade.to_mesh(me)
        blade.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    b.add(bm, 'aluDull', mover='prop', pivot=(0, gy, pz))


def bucket_seat(b, x, y, z, turn=0.0, post=0.3, accent='vinylAccent'):
    rot = (0, turn, 0)
    m = xform(rot, (x, y, z))

    def at(px, py, pz):
        return tuple(m @ Vector((px, py, pz)))
    b.cyl('chrome', 0.035, post, at(0, post / 2, 0), seg=10)
    b.box('vinyl', (0.46, 0.11, 0.44), at(0, post + 0.05, 0), rot, bevel=0.04)
    b.box(accent, (0.47, 0.03, 0.45), at(0, post, 0), rot, bevel=0.012)
    b.box('vinyl', (0.46, 0.44, 0.1), at(0, post + 0.3, -0.24), (-0.22, turn, 0), bevel=0.04)
    return post + 0.11  # cushion top


def cleat(b, x, y, z, turn=0.0):
    b.box('chrome', (0.03, 0.03, 0.03), (x, y + 0.015, z), bevel=0.008)
    b.box('chrome', (0.025, 0.022, 0.16), (x, y + 0.04, z), (0, turn, 0), bevel=0.01)


def rod(b, base, lean, length=2.1, reel=True):
    """A rod standing in a holder: butt at base, leaning (dx, dz) per metre up."""
    dx, dz = lean
    d = Vector((dx, 1, dz)).normalized()
    p0 = Vector(base)
    b.cyl('chrome', 0.022, 0.2, tuple(p0 + d * 0.05), axis='y', rot=(math.atan2(dz, 1), 0, -math.atan2(dx, 1)), seg=8)
    pts = [p0 + d * (length * u) + Vector((0, -0.05 * u * u, 0)) for u in (0, 0.33, 0.66, 1.0)]
    b.tube('cork', [tuple(pts[0]), tuple(p0 + d * 0.35)], 0.014, seg=6)
    b.tube('rod', [tuple(p) for p in pts], 0.007, seg=5)
    if reel:
        r = p0 + d * 0.42
        b.sphere('plastic', 0.035, tuple(r + Vector((0, 0, 0.0)) + d.cross(Vector((1, 0, 0))).normalized() * -0.05), (1, 1, 1.3), seg=8)


def windscreen(b, x0, x1, y, z, h=0.32, lean=0.55):
    b.box('glass', (x1 - x0, h, 0.012), ((x0 + x1) / 2, y + h / 2 * math.cos(lean), z - h / 2 * math.sin(lean)), (-lean, 0, 0), bevel=0)
    b.tube('chrome', [(x0, y, z), (x0, y + h * math.cos(lean), z - h * math.sin(lean)),
                      (x1, y + h * math.cos(lean), z - h * math.sin(lean)), (x1, y, z)], 0.008, seg=5)


def console(b, x, floor, z, w=0.58, h=0.55, d=0.5, wheel=True, screen=True):
    prof = [(d / 2, 0), (d / 2, h * 0.75), (d * 0.1, h), (-d / 2, h), (-d / 2, 0)]
    prof = [(z + pz, floor + py) for pz, py in prof]
    b.prism('gelWhite', prof, x - w / 2, x + w / 2, bevel=0.025)
    top = floor + h
    # Dash: black panel with gauges and the wheel, facing aft.
    b.box('plastic', (w * 0.9, 0.2, 0.02), (x, top - 0.13, z - d / 2 - 0.005), (0.25, 0, 0), bevel=0.005)
    for gx in (-0.14, 0, 0.14):
        b.cyl('chrome', 0.04, 0.02, (x + gx * w / 0.6, top - 0.1, z - d / 2 - 0.02), axis='z', seg=12)
    if screen:
        b.box('plastic', (0.26, 0.17, 0.05), (x, top + 0.09, z - 0.05), (-0.35, 0, 0), bevel=0.01)
        b.box('screen', (0.22, 0.13, 0.005), (x, top + 0.095, z - 0.078), (-0.35, 0, 0), bevel=0)
    if wheel:
        c = Vector((x - w * 0.15, top - 0.12, z - d / 2 - 0.14))
        ring = [tuple(c + Vector((math.cos(a) * 0.17, math.sin(a) * 0.17 * math.cos(0.5), math.sin(a) * 0.17 * math.sin(0.5))))
                for a in [k / 20 * 2 * math.pi for k in range(20)]]
        b.tube('rubber', ring, 0.014, seg=6, closed=True)
        b.cyl('chrome', 0.03, 0.14, tuple(c + Vector((0, 0.03, 0.06))), axis='z', rot=(-0.5, 0, 0))
        for k in range(3):
            a = k / 3 * 2 * math.pi + 0.5
            e = c + Vector((math.cos(a) * 0.16, math.sin(a) * 0.16 * math.cos(0.5), math.sin(a) * 0.16 * math.sin(0.5)))
            b.tube('chrome', [tuple(c), tuple(e)], 0.007, seg=5)
    windscreen(b, x - w / 2, x + w / 2, top, z + d * 0.1)


def hatch(b, x, y, z, w, d, latch=True):
    b.box('carpetDark', (w, 0.008, d), (x, y + 0.004, z), bevel=0.003)
    b.box('carpet', (w - 0.03, 0.01, d - 0.03), (x, y + 0.006, z), bevel=0.003)
    if latch:
        b.box('chrome', (0.06, 0.012, 0.03), (x, y + 0.012, z - d / 2 + 0.03), bevel=0.004)


def nav_lights(b, h, z_bow, y):
    b.box('lightRed', (0.04, 0.03, 0.06), (-0.05, y + 0.02, z_bow), bevel=0.01)
    b.box('lightGreen', (0.04, 0.03, 0.06), (0.05, y + 0.02, z_bow), bevel=0.01)


def stern_light(b, x, y, z, h=0.9):
    b.cyl('chrome', 0.012, h, (x, y + h / 2, z), seg=8)
    b.sphere('lightWhite', 0.03, (x, y + h + 0.02, z), seg=10)


def bimini(b, z0, z1, y, half, sag=0.06):
    for zz in (z0, z1):
        b.tube('alu', [(-half, y - 1.0, zz), (-half, y - 0.1, zz), (-half * 0.6, y, zz), (half * 0.6, y, zz), (half, y - 0.1, zz), (half, y - 1.0, zz)], 0.014, seg=6)
    b.surface('canvas', lambda u, v: ((-half + 2 * half * u) * 0.98, y + 0.01 - (abs(2 * u - 1) ** 3) * 0.1 - math.sin(v * math.pi) * sag * 0.3,
                                      z0 + (z1 - z0) * v), 12, 8)


def railing(b, pts, h=0.75, m='chrome', r=0.014):
    top = [(x, y + h, z) for x, y, z in pts]
    b.tube(m, top, r, seg=6)
    for x, y, z in pts[::2]:
        b.tube(m, [(x, y, z), (x, y + h, z)], r * 0.8, seg=5, cap=False)


# ------------------------------------------------------------------- boats

def bass_boat(b):
    h = Hull(5.6, 2.2, sheer=(0.55, 0.62), keel=-0.22, dead=20, chine=0.85, bow=0.45, bowp=0.75, forefoot=0.5)
    cols = ['bottom'] * 4 + ['stripeBlack', 'stripeBlack', 'paint', 'paint', 'stripeSilver', 'paint', 'paint', 'paint', 'paint']
    hull(b, h, cols, transom='paint')
    regions = [(-2.72, -1.5, 0.45), (-1.5, 0.55, 0.28), (0.55, 2.79, 0.45)]
    deck(b, h, regions, cap=0.09, cap_mat='paint', liner='gelWhite')
    rub_rail(b, h, 'chrome', 0.018, 0.04)
    # Front casting deck: rod lockers, a pedestal base, the trolling motor
    # and the fish finder at the bow.
    hatch(b, -0.45, 0.45, 1.3, 0.55, 1.2)
    hatch(b, 0.45, 0.45, 1.3, 0.55, 1.2)
    hatch(b, 0, 0.45, 2.15, 0.5, 0.5)
    b.cyl('aluDull', 0.05, 0.02, (0, 0.46, 1.9), seg=12)
    b.box('plastic', (0.2, 0.06, 0.3), (0.3, 0.48, 1.65), (0.1, 0, 0), bevel=0.02)         # trolling foot pedal
    tz = 2.55
    b.box('plastic', (0.22, 0.06, 0.4), (0.22, 0.52, tz), bevel=0.02)                       # mount
    b.cyl('plastic', 0.018, 1.15, (0.32, 0.35, tz + 0.18), seg=8)                          # shaft
    b.box('plastic', (0.16, 0.14, 0.22), (0.32, 0.98, tz + 0.18), bevel=0.04)              # head
    b.cyl('plastic', 0.065, 0.36, (0.32, -0.22, tz + 0.18), axis='z', seg=12)              # motor pod
    b.cyl('plastic', 0.065, 0.06, (0.32, -0.22, tz + 0.38), axis='z', r2=0.01, seg=12)
    b.box('plastic', (0.2, 0.15, 0.06), (-0.25, 0.62, 2.35), (-0.35, math.pi, 0), bevel=0.012)  # fish finder
    b.box('screen', (0.17, 0.11, 0.005), (-0.25, 0.625, 2.32), (-0.35, math.pi, 0), bevel=0)
    b.cyl('plastic', 0.02, 0.12, (-0.25, 0.5, 2.37), seg=8)
    nav_lights(b, h, 2.78, 0.62)
    # Cockpit: driver's console (starboard) and passenger's, two bucket seats.
    console(b, 0.55, 0.28, 0.1, wheel=True, screen=True)
    console(b, -0.55, 0.28, 0.1, wheel=False, screen=False)
    bucket_seat(b, 0.5, 0.28, -0.75, post=0.22)
    bucket_seat(b, -0.5, 0.28, -0.75, post=0.22)
    # Rear deck: livewell lids, a pedestal seat, the stern light, rods in holders.
    hatch(b, -0.45, 0.45, -2.2, 0.6, 0.6)
    hatch(b, 0.45, 0.45, -2.2, 0.6, 0.6)
    stern_light(b, -0.8, 0.45, -2.55)
    for x, lean in ((0.95, (0.25, -0.35)), (-0.95, (-0.25, -0.35)), (0.92, (0.3, -0.15))):
        rod(b, (x, 0.5, -1.9 if lean[1] < -0.2 else -1.6), lean, 2.0)
    cleat(b, 0.9, 0.56, -2.65)
    cleat(b, -0.9, 0.56, -2.65)
    cleat(b, 0, 0.64, 2.68, 0)
    outboard(b, -2.8, 0.5, 1.0)
    b.spot('rod', 0, 0.45, 1.5)
    b.spot('sit', 0.5, 0.28 + 0.33 - 0.44, -0.75)


def tiger_boat(b):
    h = Hull(4.6, 1.85, sheer=(0.6, 0.68), keel=-0.16, dead=11, chine=0.9, bow=0.5, bowp=0.65, forefoot=0.55)
    cols = ['alu'] * 4 + ['alu', 'alu', 'paint', 'paint', 'paint', 'paint', 'paint', 'paint', 'stripeBlack']
    hull(b, h, cols, transom='paint')
    deck(b, h, [(-2.22, 2.28, 0.4)], cap=0.06, cap_mat='alu', liner='paint', floor='carpet')
    rub_rail(b, h, 'aluDull', 0.02, 0.02)
    # Thwart seats, a front casting deck hatch, shade over the middle.
    for z in (-1.25, 0.2):
        b.box('alu', (1.55, 0.05, 0.36), (0, 0.78, z), bevel=0.012)
        b.box('aluDull', (1.5, 0.36, 0.04), (0, 0.6, z - 0.15), bevel=0.008)
    b.box('vinylAccent', (0.4, 0.06, 0.34), (0.35, 0.83, -1.25), bevel=0.025)
    hatch(b, 0, 0.4, 1.4, 0.7, 0.6)
    nav_lights(b, h, 2.27, 0.68)
    bimini(b, -0.9, 0.55, 1.95, 0.88)
    for x, z, lean in ((0.86, -1.7, (0.35, -0.3)), (-0.86, -1.7, (-0.35, -0.3)), (0.86, -0.4, (0.4, -0.1)), (-0.86, -0.4, (-0.4, -0.1))):
        rod(b, (x, 0.62, z), lean, 2.1)
    cleat(b, 0.75, 0.62, -2.15)
    cleat(b, -0.75, 0.62, -2.15)
    outboard(b, -2.3, 0.56, 0.72, cowl='cowlGrey', tiller=True)
    b.spot('rod', 0, 0.4, 1.1)
    b.spot('sit', 0.35, 0.86 - 0.44, -1.25, math.pi * 0.5)


def kayak(b):
    h = Hull(4.0, 0.78, sheer=(0.2, 0.32), keel=-0.11, dead=6, chine=0.97, bow=0.6, stern=0.25, bowp=0.8,
             rail=False, forefoot=0.7, side_pts=5)
    hull(b, h, ['paint'] * 12)

    # Moulded top deck: crowned, with a seat well and a rear tank well.
    def top(u, v):
        z = -h.L / 2 + 0.003 + u * (h.L - 0.006)
        hb = h.half(z)
        x = hb * (-1 + 2 * v)
        ys = h.sheer_y(z)
        crown = 0.09 * (1 - (2 * v - 1) ** 2) * min(1, hb / 0.3)
        well = 0.0
        for z0, z1, d in ((-0.95, 0.75, 0.13), (-1.65, -1.1, 0.08)):
            k = max(0.0, min(1.0, (z - z0) / 0.12, (z1 - z) / 0.12))
            side = max(0.0, min(1.0, (hb * 0.78 - abs(x)) / 0.06))
            well = max(well, d * k * side)
        return (x, ys + crown - well, z)
    b.surface('paint', top, 80, 14)
    # Frame seat with mesh fabric, foot braces, hatch, bungee over the tank well.
    sy = 0.2
    b.tube('alu', [(-0.22, sy, -0.55), (-0.22, sy + 0.12, -0.15), (0.22, sy + 0.12, -0.15), (0.22, sy, -0.55)], 0.014, seg=6)
    b.box('vinylAccent', (0.42, 0.04, 0.42), (0, sy + 0.12, -0.33), bevel=0.015)
    b.box('vinylAccent', (0.42, 0.4, 0.04), (0, sy + 0.32, -0.55), (-0.3, 0, 0), bevel=0.015)
    b.cyl('rubber', 0.11, 0.03, (0, h.sheer_y(1.3) + 0.08, 1.3), seg=16)
    for z in (-1.2, -1.4, -1.6):
        b.tube('rubber', [(-0.26, 0.31, z), (0.26, 0.31, z)], 0.006, seg=4)
    for x in (-0.2, 0.2):
        rod(b, (x, 0.28, -0.85), (x * 1.2, -0.5), 1.8)
    b.spot('paddle', 0, sy + 0.16 - 0.44, -0.3)
    # The paddle, across the boat at the paddler's hands.
    pb = bmesh.new()
    me = bpy.data.meshes.new('tmp')
    sh = bmesh.new()
    bmesh.ops.create_cone(sh, cap_ends=True, segments=8, radius1=0.016, radius2=0.016, depth=2.2)
    sh.transform(Matrix.Rotation(math.pi / 2, 4, 'Y'))
    for s in (-1, 1):
        bl = bmesh.new()
        bmesh.ops.create_cube(bl, size=1)
        bmesh.ops.scale(bl, vec=(0.42, 0.16, 0.012), verts=bl.verts)
        bmesh.ops.bevel(bl, geom=bl.edges[:], offset=0.005, segments=2, affect='EDGES')
        bl.transform(Matrix.Translation((s * 1.05, 0, 0)) @ Matrix.Rotation(s * 0.5, 4, 'X'))
        bl.to_mesh(me)
        bl.free()
        sh.from_mesh(me)
    sh.to_mesh(me)
    sh.free()
    pb.from_mesh(me)
    bpy.data.meshes.remove(me)
    b.add(pb, 'plastic', mover='paddle', pivot=(0, 0.86, 0.12))


def ski_boat(b):
    h = Hull(6.2, 2.35, sheer=(0.72, 0.85), keel=-0.25, dead=21, chine=0.86, bow=0.4, bowp=0.6, forefoot=0.48)
    cols = ['gelWhite'] * 4 + ['gelWhite', 'gelWhite', 'paint', 'paint', 'paint', 'gelWhite', 'stripeBlack', 'gelWhite', 'gelWhite']
    hull(b, h, cols, transom='gelWhite')
    deck(b, h, [(-3.02, -2.2, 0.62), (-2.2, 2.3, 0.35), (2.3, 3.09, 0.62)], cap=0.1, cap_mat='gelWhite', liner='vinyl', floor='carpet')
    rub_rail(b, h, 'chrome', 0.02, 0.04)
    # Wrap-round windscreen with a walk-through, bow seats, cockpit seats,
    # rear bench, the engine hatch and a wakeboard tower.
    windscreen(b, -1.05, -0.12, 0.82, 0.75, 0.38)
    windscreen(b, 0.12, 1.05, 0.82, 0.75, 0.38)
    b.box('gelWhite', (0.9, 0.5, 0.6), (0.62, 0.6, 0.45), bevel=0.04)
    b.box('gelWhite', (0.9, 0.5, 0.6), (-0.62, 0.6, 0.45), bevel=0.04)
    b.box('plastic', (0.5, 0.1, 0.25), (0.62, 0.86, 0.3), (0.4, 0, 0), bevel=0.01)
    b.box('screen', (0.2, 0.1, 0.005), (0.62, 0.88, 0.27), (0.4, 0, 0), bevel=0)
    for s in (-1, 1):
        b.box('vinyl', (0.4, 0.14, 1.1), (s * 0.78, 0.45, 1.9), (0, -s * 0.15, 0), bevel=0.05)
    bucket_seat(b, 0.62, 0.35, -0.25, post=0.18)
    bucket_seat(b, -0.62, 0.35, -0.25, post=0.18)
    b.box('vinyl', (1.95, 0.14, 0.48), (0, 0.55, -1.85), bevel=0.05)
    b.box('vinyl', (1.95, 0.42, 0.12), (0, 0.8, -2.12), (-0.12, 0, 0), bevel=0.05)
    b.box('gelWhite', (1.5, 0.12, 0.7), (0, 0.72, -2.65), bevel=0.04)
    b.box('vinylAccent', (1.4, 0.06, 0.6), (0, 0.8, -2.65), bevel=0.03)
    b.box('teak', (2.0, 0.06, 0.55), (0, 0.18, -3.38), bevel=0.02)                         # swim platform
    b.box('cowlGrey', (0.22, 0.7, 0.3), (0, -0.1, -3.3), bevel=0.05)                        # sterndrive leg
    b.cyl('cowlGrey', 0.07, 0.4, (0, -0.42, -3.3), axis='z')
    for s in (-1, 1):
        b.tube('alu', [(s * 1.05, 0.82, -1.25), (s * 0.95, 1.6, -1.4), (s * 0.6, 2.05, -1.55), (0, 2.12, -1.6)], 0.035, seg=8, cap=False)
    b.box('rubber', (0.4, 0.12, 0.3), (0, 2.12, -1.6), bevel=0.03)
    nav_lights(b, h, 3.08, 0.86)
    cleat(b, 1.0, 0.74, -2.9)
    cleat(b, -1.0, 0.74, -2.9)
    # The prop on the sterndrive.
    bm = bmesh.new()
    for k in range(3):
        bl = bmesh.new()
        bmesh.ops.create_cube(bl, size=1)
        bmesh.ops.scale(bl, vec=(0.13, 0.012, 0.09), verts=bl.verts)
        bl.transform(Matrix.Rotation(k / 3 * 2 * math.pi, 4, 'Z') @ Matrix.Translation((0.1, 0, 0)) @ Matrix.Rotation(0.6, 4, 'X'))
        me = bpy.data.meshes.new('tmp')
        bl.to_mesh(me)
        bl.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    b.add(bm, 'aluDull', mover='prop', pivot=(0, -0.42, -3.55))
    b.spot('sit', 0.62, 0.35 + 0.29 - 0.44, -0.25)
    b.spot('sit', -0.62, 0.35 + 0.29 - 0.44, -0.25)


def pontoons(b, L, gap, r, m='alu'):
    for s in (-1, 1):
        b.cyl(m, r, L - r * 2, (s * gap, r * 0.3, -r), axis='z', seg=20)
        b.sphere(m, r, (s * gap, r * 0.3, L / 2 - r * 2), (1, 1, 2.2), seg=20)
        b.cyl(m, r, 0.05, (s * gap, r * 0.3, -L / 2), axis='z', seg=20)


def pontoon_boat(b):
    pontoons(b, 7.5, 1.2, 0.4)
    b.box('aluDull', (3.1, 0.14, 7.4), (0, 0.6, 0), bevel=0.02)
    b.box('teak', (3.0, 0.03, 7.2), (0, 0.685, 0), bevel=0.005)
    # Fence panels round the deck, a gate at the bow.
    for s in (-1, 1):
        b.box('gelWhite', (0.04, 0.6, 6.2), (s * 1.48, 1.0, -0.3), bevel=0.01)
        b.box('paint', (0.045, 0.12, 6.2), (s * 1.48, 0.86, -0.3), bevel=0.005)
        b.box('gelWhite', (1.0, 0.6, 0.04), (s * 1.0, 1.0, 2.8), bevel=0.01)
        b.box('gelWhite', (1.0, 0.6, 0.04), (s * 1.0, 1.0, -3.4), bevel=0.01)
        b.tube('chrome', [(s * 1.48, 1.32, -3.4), (s * 1.48, 1.32, 2.8), (s * 0.5, 1.32, 2.8)], 0.02, seg=6)
    # Sofas, a helm console, a canopy and the outboard.
    for s in (-1, 1):
        b.box('vinyl', (0.55, 0.42, 2.4), (s * 1.12, 0.92, 0.6), bevel=0.06)
        b.box('vinyl', (0.14, 0.45, 2.4), (s * 1.38, 1.3, 0.6), bevel=0.05)
    b.box('vinyl', (2.4, 0.42, 0.55), (0, 0.92, -2.95), bevel=0.06)
    console(b, 1.0, 0.7, -1.2, w=0.6, h=0.75)
    bucket_seat(b, 1.0, 0.7, -1.85, post=0.22)
    bimini(b, -2.2, 0.8, 2.35, 1.5, 0.08)
    outboard(b, -3.75, 0.72, 0.9)
    b.spot('sit', -1.12, 1.13 - 0.44, 0.0, math.pi / 2)
    b.spot('sit', 1.0, 0.7 + 0.33 - 0.44, -1.85)
    b.spot('rod', 0, 0.7, 3.2)


def houseboat(b):
    pontoons(b, 11, 1.6, 0.45)
    b.box('aluDull', (4.4, 0.16, 10.8), (0, 0.6, 0), bevel=0.02)
    b.box('teak', (4.3, 0.03, 10.6), (0, 0.69, 0), bevel=0.005)
    # The cabin: walls with a band of windows, a door, roof deck with rails.
    cy, ch = 0.7, 2.1
    b.box('cabin', (3.8, ch, 6.5), (0, cy + ch / 2, -1.0), bevel=0.04)
    for s in (-1, 1):
        b.box('glass', (0.02, 0.6, 5.4), (s * 1.91, cy + 1.35, -1.0), bevel=0)
        b.box('paint', (0.03, 0.12, 6.5), (s * 1.91, cy + 0.55, -1.0), bevel=0.005)
    b.box('glass', (3.0, 0.6, 0.02), (0, cy + 1.35, 2.26), bevel=0)
    b.box('teak', (0.85, 1.9, 0.03), (-1.2, cy + 0.95, 2.26), bevel=0.01)
    b.box('cabin', (4.2, 0.12, 8.0), (0, cy + ch + 0.06, -0.5), bevel=0.02)
    b.box('paint', (4.22, 0.08, 8.02), (0, cy + ch + 0.02, -0.5), bevel=0.01)
    pts = [(-2.0, cy + ch + 0.12, z) for z in (-4.4, -2.0, 0.4, 3.4)] + [(2.0, cy + ch + 0.12, z) for z in (3.4, 0.4, -2.0, -4.4)]
    railing(b, pts, 0.85)
    railing(b, [(-2.1, 0.7, 2.6), (-2.1, 0.7, 5.3), (2.1, 0.7, 5.3), (2.1, 0.7, 2.6)], 0.8)
    for x in (-0.8, 0.8):
        b.box('vinyl', (0.55, 0.4, 0.5), (x, 0.9, 4.0), bevel=0.05)
    outboard(b, -5.45, 0.72, 0.9)
    b.spot('rod', 1.2, 0.7, 4.6, 0.5)
    b.spot('sit', -0.8, 1.1 - 0.44, 4.0, math.pi)


def yacht(b):
    h = Hull(6.5, 2.35, sheer=(0.85, 1.0), keel=-0.3, dead=14, chine=0.97, bow=0.35, bowp=0.65, rail=False, forefoot=0.45)
    hull(b, h, ['gelWhite'] * 4 + ['gelWhite', 'gelWhite', 'gelWhite', 'paint', 'gelWhite', 'gelWhite', 'gelWhite'], transom='gelWhite')
    deck(b, h, [(-3.24, -1.2, 0.55), (-1.2, 3.24, 0.93)], cap=0.08, cap_mat='gelWhite', liner='gelWhite', floor='gelWhite')
    # Keel fin and rudder, cabin top with ports, mast, boom and sails.
    b.box('bottom', (0.08, 1.0, 1.0), (0, -0.75, 0.2), (0.2, 0, 0), bevel=0.02)
    b.box('bottom', (0.3, 0.2, 1.1), (0, -1.25, 0.1), bevel=0.06)
    b.box('bottom', (0.05, 0.7, 0.35), (0, -0.25, -3.0), bevel=0.01)
    b.box('gelWhite', (1.5, 0.35, 2.4), (0, 1.1, 0.2), bevel=0.08)
    for s in (-1, 1):
        for z in (-0.5, 0.2, 0.9):
            b.box('glass', (0.02, 0.1, 0.35), (s * 0.755, 1.12, z), bevel=0)
    b.cyl('alu', 0.05, 8.4, (0, 5.2, 0.6), r2=0.035, seg=10)
    b.cyl('alu', 0.04, 3.3, (0, 1.75, -1.0), axis='z', seg=8)
    b.tube('chrome', [(0, 9.3, 0.6), (0, 1.0, 3.2)], 0.004, seg=4, cap=False)
    b.tube('chrome', [(0, 9.3, 0.6), (0, 0.9, -3.2)], 0.004, seg=4, cap=False)
    for s in (-1, 1):
        b.tube('chrome', [(s * 1.1, 1.0, -3.0), (s * 1.12, 1.0, 0.0), (s * 0.9, 1.05, 2.4), (0, 1.1, 3.25)], 0.008, seg=4, cap=False)
    b.surface('sail', lambda u, v: (0.25 * math.sin(v * math.pi) * (1 - u) ** 0.6, 1.85 + u * 7.2, 0.55 - v * 3.0 * (1 - u * 0.97)), 10, 8)
    b.surface('sail', lambda u, v: (0.2 * math.sin(v * math.pi) * (1 - u), 1.15 + u * 7.0, 3.1 - v * 2.4 * (1 - u * 0.98) - u * 2.45), 10, 6)
    b.tube('teak', [(0, 0.75, -3.1), (0, 0.85, -2.2)], 0.025, seg=6)
    b.spot('sit', 0.6, 0.55 + 0.4 - 0.44, -2.2, -math.pi / 2)
    b.box('gelWhite', (0.4, 0.4, 1.2), (0.85, 0.75, -2.0), bevel=0.04)


BOATS = {'bass': bass_boat, 'tiger': tiger_boat, 'kayak': kayak, 'ski': ski_boat, 'pontoon': pontoon_boat,
         'houseboat': houseboat, 'yacht': yacht}


# ---------------------------------------------------------- bake and export

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


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.name = name
    return o


def bake_ao(objs):
    """Ambient occlusion into a colour attribute, softened so nothing goes black."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.render.bake.target = 'VERTEX_COLORS'
    world = scene.world or bpy.data.worlds.new('w')
    scene.world = world
    world.light_settings.distance = 0.7
    for o in objs:
        me = o.data
        attr = me.color_attributes.new('AO', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = attr
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='AO')
    # Into byte colours (a quarter of the size of float ones in the file).
    for o in objs:
        me = o.data
        ao = [0.28 + 0.72 * d.color[0] ** 1.3 for d in me.color_attributes['AO'].data]
        me.color_attributes.remove(me.color_attributes['AO'])
        byte = me.color_attributes.new('AO8', 'BYTE_COLOR', 'CORNER')
        for v, d in zip(ao, byte.data):
            d.color = (v, v, v, 1.0)
        me.color_attributes.active_color = byte


def preview(kind, path):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    world = scene.world
    world.use_nodes = True
    nt = world.node_tree
    sky = nt.nodes.new('ShaderNodeTexSky')
    nt.links.new(sky.outputs['Color'], nt.nodes['Background'].inputs['Color'])
    nt.nodes['Background'].inputs['Strength'].default_value = 0.25
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    water = bpy.context.object
    wm = bpy.data.materials.new('water')
    wm.use_nodes = True
    p = wm.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.02, 0.05, 0.05, 1)
    p.inputs['Roughness'].default_value = 0.08
    water.data.materials.append(wm)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.9, 0.2, 2.2)
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    size = {'houseboat': 14, 'yacht': 15, 'pontoon': 11, 'ski': 9, 'kayak': 6}.get(kind, 8)
    for i, (az, el) in enumerate(((0.7, 0.32), (2.6, 0.55))):
        d = size
        cam.location = (math.sin(az) * d, -math.cos(az) * d, d * math.sin(el) * 0.9 + (3.2 if kind == 'yacht' else 0.3))
        look = Vector((0, 0, 3.5 if kind == 'yacht' else 0.5))
        cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.camera = cam
        scene.render.resolution_x, scene.render.resolution_y = 800, 500
        scene.render.filepath = os.path.join(path, f'boat-{kind}-{i}.png')
        bpy.ops.render.render(write_still=True)


def build(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    print(kind, 'baking on', use_gpu(scene), flush=True)
    make_materials(kind)
    b = Boat(kind)
    BOATS[kind](b)
    root = bpy.data.objects.new(f'boat-{kind}', None)
    scene.collection.objects.link(root)
    body = join(b.parts, 'body')
    body.data.transform(TO_BLENDER)
    movers = []
    for name, o, pivot in b.movers:
        o.data.transform(TO_BLENDER)
        o.location = TO_BLENDER @ Vector(pivot)
        o.name = name
        movers.append(o)
    bake_ao([body] + movers)
    for o in [body] + movers:
        o.parent = root
    for i, (k, x, y, z, turn) in enumerate(b.spots):
        e = bpy.data.objects.new(f'spot-{k}-{i}', None)
        scene.collection.objects.link(e)
        e.location = TO_BLENDER @ Vector((x, y, z))
        e.rotation_euler = (0, 0, turn)
        e.parent = root
    tris = sum(len(p.vertices) - 2 for o in [body] + movers for p in o.data.polygons)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'boat-{kind}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82,
                              export_vertex_color='NAME', export_vertex_color_name='AO8', export_all_vertex_colors=False, export_apply=True, export_yup=True)
    print(f'boat {kind}: {tris} triangles, {os.path.getsize(path) // 1024} KB', flush=True)
    if PREVIEW:
        preview(kind, PREVIEW)


for k in BOATS:
    if not ONLY or k in ONLY:
        build(k)
