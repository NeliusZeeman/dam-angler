# Builds every fish species as a 3D model in Blender and saves it as
# assets/fish3d/<species>.glb, which the game loads in place of its
# hand-coded fish (src/fishModels.js).
#
#   blender --background --python tools/blender/build_fish.py -- looks.json assets/fish3d
#
# looks.json is the game's SPECIES_LOOK (tools/build-fish-models.mjs writes it
# and runs this). The models keep the game's layout so its swimming, skins
# and fin textures fit them unchanged:
#   +x is the snout, +y up, +z the fish's right flank; the body runs from the
#   tail stalk (t=0) to the snout (t=1) over x = (-0.2 .. 0.26) * length;
#   body UVs: u round the body (top of the back at u=0.75), v from tail to
#   snout; fin UVs: u along the fin's root, v from root to edge.
#
# Each file holds these meshes:
#   Body      the skin, smooth (subdivided), with gill covers, mouth, lips and
#             eye sockets shaped in, and a vertex colour that darkens the gape,
#             gill slit and sockets
#   BodyLow   a light version for fish seen from a distance
#   Fins      every fin, membranes ribbed along their rays
#   Eyes      both eyes (vertex colours: iris and pupil)
#   Extras    barbels and teeth where the species has them (may be absent)

import bpy
import bmesh
import json
import math
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LOOKS_PATH = argv[0] if len(argv) > 0 else 'looks.json'
OUT_DIR = argv[1] if len(argv) > 1 else 'assets/fish3d'
ONLY = set(argv[2].split(',')) if len(argv) > 2 and argv[2] else None

BODY_X0, BODY_X1 = -0.2, 0.26


def clamp01(v):
    return min(1.0, max(0.0, v))


def smooth(a, b, v):
    t = clamp01((v - a) / (b - a))
    return t * t * (3 - 2 * t)


def gauss(d, w):
    return math.exp(-(d * d) / (w * w))


def curve(samples, t):
    """Catmull-Rom through evenly spaced samples (as in fish3d.js)."""
    n = len(samples) - 1
    f = clamp01(t) * n
    i = min(n - 1, int(math.floor(f)))
    u = f - i
    p0, p1, p2, p3 = samples[max(0, i - 1)], samples[i], samples[i + 1], samples[min(n, i + 2)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)


# ─── Body plans ─────────────────────────────────────────────────────────────
# Each family's outline from real proportions: `depth` is the body's greatest
# depth as a share of its length (snout to tail stalk) -- a carp about a
# third, a bluegill half, a trout a quarter -- split between back and belly
# by `split`. `back` and `belly` give the outline at nine stations, tail stalk
# -> snout, as shares of that depth; `width` the half-width (as before).
# Mouth: 'sub' underslung with fleshy lips (carp, yellowfish, mudfish),
# 'terminal', 'oblique' (bass: big, angled up, lower jaw jutting), 'wide'
# (catfish). `snout` 0 blunt .. 1 pointed.

def plan(depth, split, back, belly, width, **kw):
    return dict(depth=depth, split=split, back=back, belly=belly, width=width, **kw)


PLANS = {
    # Arched back rising behind the head, flatter belly, blunt snout.
    'carp': plan(0.34, 0.57,
        back=[0.30, 0.40, 0.60, 0.84, 0.98, 1.00, 0.90, 0.66, 0.36],
        belly=[0.34, 0.42, 0.62, 0.86, 0.98, 1.00, 0.94, 0.78, 0.50],
        width=[0.012, 0.018, 0.031, 0.044, 0.052, 0.054, 0.052, 0.045, 0.033],
        square=2.1, mouth='sub', mouthSize=0.7, lips=1.8, eyeT=0.885, eyeY=0.28, eyeR=0.011, opT=0.8,
        snout=0.35),
    # Streamlined river cyprinid: gentle arch, rubbery underslung lips.
    'yellowfish': plan(0.27, 0.55,
        back=[0.32, 0.44, 0.66, 0.88, 0.99, 1.00, 0.90, 0.68, 0.38],
        belly=[0.36, 0.46, 0.66, 0.88, 0.99, 1.00, 0.92, 0.76, 0.50],
        width=[0.012, 0.018, 0.030, 0.042, 0.050, 0.052, 0.050, 0.043, 0.032],
        square=2.0, mouth='sub', mouthSize=0.85, lips=2.0, eyeT=0.885, eyeY=0.26, eyeR=0.011, opT=0.79,
        snout=0.5),
    # The big predatory yellowfish: long head, terminal mouth.
    'yellowfish-predator': plan(0.24, 0.53,
        back=[0.34, 0.46, 0.68, 0.90, 1.00, 1.00, 0.90, 0.70, 0.42],
        belly=[0.36, 0.46, 0.68, 0.90, 1.00, 0.98, 0.88, 0.70, 0.44],
        width=[0.012, 0.018, 0.030, 0.042, 0.050, 0.051, 0.049, 0.042, 0.030],
        square=2.0, mouth='terminal', mouthSize=1.1, lips=1.3, eyeT=0.875, eyeY=0.3, eyeR=0.011, opT=0.76,
        snout=0.7),
    # Bass: long, big head, huge oblique mouth, jaw reaching past the eye.
    'bass': plan(0.29, 0.5,
        back=[0.34, 0.46, 0.70, 0.92, 1.00, 0.98, 0.88, 0.70, 0.46],
        belly=[0.34, 0.44, 0.66, 0.88, 1.00, 1.00, 0.92, 0.78, 0.56],
        width=[0.012, 0.018, 0.031, 0.043, 0.051, 0.053, 0.052, 0.046, 0.034],
        square=2.0, mouth='oblique', mouthSize=1.5, lips=1.0, eyeT=0.86, eyeY=0.4, eyeR=0.012, opT=0.71,
        snout=0.85),
    # Bluegill / sunfish: a deep flat disc with a little mouth up front.
    'sunfish': plan(0.5, 0.52,
        back=[0.24, 0.40, 0.68, 0.92, 1.00, 0.98, 0.86, 0.62, 0.34],
        belly=[0.24, 0.40, 0.70, 0.94, 1.00, 0.96, 0.82, 0.58, 0.30],
        width=[0.010, 0.015, 0.025, 0.034, 0.040, 0.042, 0.040, 0.035, 0.026],
        square=2.0, mouth='terminal', mouthSize=0.6, lips=1.1, eyeT=0.85, eyeY=0.38, eyeR=0.013, opT=0.74,
        snout=0.45),
    # Tilapia: deep, compressed, steep forehead, small thick-lipped mouth.
    'tilapia': plan(0.4, 0.55,
        back=[0.28, 0.42, 0.68, 0.92, 1.00, 0.98, 0.88, 0.68, 0.36],
        belly=[0.30, 0.42, 0.66, 0.90, 1.00, 0.98, 0.88, 0.70, 0.42],
        width=[0.011, 0.017, 0.028, 0.039, 0.046, 0.048, 0.046, 0.040, 0.030],
        square=2.0, mouth='terminal', mouthSize=0.8, lips=1.7, eyeT=0.86, eyeY=0.36, eyeR=0.012, opT=0.75,
        snout=0.45),
    # Tigerfish: torpedo body, pointed snout, toothy terminal mouth, big eye.
    'tiger': plan(0.26, 0.51,
        back=[0.32, 0.44, 0.68, 0.90, 1.00, 0.98, 0.86, 0.64, 0.36],
        belly=[0.32, 0.44, 0.68, 0.90, 1.00, 0.98, 0.86, 0.62, 0.32],
        width=[0.012, 0.018, 0.030, 0.041, 0.048, 0.049, 0.047, 0.040, 0.028],
        square=2.0, mouth='terminal', mouthSize=1.4, lips=0.8, eyeT=0.87, eyeY=0.28, eyeR=0.014, opT=0.75,
        snout=0.95),
    # Trout: fusiform, terminal mouth, jaw back to behind the eye.
    'trout': plan(0.24, 0.51,
        back=[0.34, 0.46, 0.70, 0.92, 1.00, 0.98, 0.88, 0.68, 0.42],
        belly=[0.36, 0.46, 0.68, 0.90, 1.00, 1.00, 0.90, 0.70, 0.44],
        width=[0.012, 0.018, 0.030, 0.042, 0.049, 0.050, 0.048, 0.042, 0.030],
        square=2.0, mouth='terminal', mouthSize=1.2, lips=1.0, eyeT=0.875, eyeY=0.3, eyeR=0.011, opT=0.76,
        snout=0.75),
    # Sharptooth catfish: long, rounded body tapering to a flat tail, broad
    # flat bony head wider than it is deep, wide mouth, tiny eyes.
    'catfish': plan(0.16, 0.54,
        back=[0.36, 0.56, 0.84, 0.98, 1.00, 0.96, 0.86, 0.70, 0.48],
        belly=[0.34, 0.52, 0.80, 0.96, 1.00, 0.92, 0.78, 0.60, 0.40],
        width=[0.008, 0.014, 0.028, 0.044, 0.056, 0.064, 0.072, 0.072, 0.058],
        square=2.4, mouth='wide', mouthSize=1.6, lips=1.2, eyeT=0.9, eyeY=0.55, eyeR=0.006, opT=0.74,
        snout=0.3),
}

SPECIES_PLAN = {
    'mozambique-tilapia': 'tilapia', 'banded-tilapia': 'tilapia',
    'common-carp': 'carp', 'mirror-carp': 'carp',
    'largemouth-bass': 'bass', 'smallmouth-bass': 'bass',
    'catfish': 'catfish', 'tigerfish': 'tiger',
    'smallmouth-yellowfish': 'yellowfish', 'largescale-yellowfish': 'yellowfish',
    'clanwilliam-yellowfish': 'yellowfish', 'mudfish': 'yellowfish',
    'largemouth-yellowfish': 'yellowfish-predator',
    'rainbow-trout': 'trout', 'brown-trout': 'trout',
    'bluegill': 'sunfish',
}

# Eye colours: iris ring (RGB 0..1).
IRIS = {
    'bass': (0.62, 0.52, 0.22), 'tiger': (0.86, 0.62, 0.22), 'catfish': (0.25, 0.22, 0.16),
    'carp': (0.82, 0.66, 0.30), 'yellowfish': (0.80, 0.66, 0.30), 'yellowfish-predator': (0.80, 0.62, 0.28),
    'sunfish': (0.55, 0.40, 0.22), 'tilapia': (0.70, 0.62, 0.40), 'trout': (0.80, 0.74, 0.55),
}


class Shape:
    """A species' body: outline at t (0 tail .. 1 snout) in its own proportions."""

    def __init__(self, look, plan):
        self.look, self.plan = look, plan
        self.len, self.depth, self.width = look['shape']

    def at(self, t):
        p = self.plan
        # Body length snout to tail stalk, and the greatest depth over it.
        body_len = (BODY_X1 - BODY_X0) * self.len
        depth = p['depth'] * body_len * (0.85 + 0.15 * self.depth)
        top_max, bot_max = depth * p['split'], depth * (1 - p['split'])
        # The snout rounds off over the last stretch: blunt fish (carp,
        # catfish) like a dome, pointed ones (tiger, bass) more like a cone.
        s0 = 0.9
        if t > s0:
            u = (t - s0) / (1 - s0)
            nose = max(0.0, 1 - u * u) ** (0.5 + 0.6 * p['snout'])
        else:
            nose = 1.0
        return dict(
            x=(BODY_X0 + (BODY_X1 - BODY_X0) * t) * self.len,
            cy=-0.004 * math.sin(math.pi * t) * self.depth,
            top=curve(p['back'], t) * top_max * nose,
            bot=curve(p['belly'], t) * bot_max * nose,
            w=curve(p['width'], t) * (self.width / 0.55) * nose,
        )

    def fin_scale(self):
        """Fin heights relative to the old shared body (0.2 deep)."""
        body_len = (BODY_X1 - BODY_X0) * self.len
        return self.plan['depth'] * body_len * (0.85 + 0.15 * self.depth) / 0.2

    def x_at(self, t):
        return (BODY_X0 + (BODY_X1 - BODY_X0) * t) * self.len


# ─── Body ───────────────────────────────────────────────────────────────────

def body_mesh(name, shape, rings, segs, detail):
    plan = shape.plan
    sq = plan['square']
    verts, uvs_of, cols = [], [], []
    ring_idx = []
    head_x = shape.x_at(1.0)
    eye_t = plan['eyeT']
    eye = shape.at(eye_t)
    eye_y = eye['cy'] + eye['top'] * plan['eyeY']
    op = shape.at(plan['opT'])
    for i in range(rings + 1):
        t = i / rings * 0.995  # the last ring sits just short of the nose tip
        b = shape.at(t)
        row = []
        for j in range(segs):
            u = j / segs
            phi = u * math.pi * 2
            s, c = -math.sin(phi), math.cos(phi)
            h = b['top'] if s > 0 else b['bot']
            ys = math.copysign(abs(s) ** (2 / sq), s)
            zs = math.copysign(abs(c) ** (2 / sq), c)
            x, y, z = b['x'], b['cy'] + ys * h, zs * b['w']
            shade = 1.0
            if detail:
                x, y, z, shade = sculpt(shape, t, b, x, y, z, s, c, eye_t, eye_y, op)
            row.append(len(verts))
            verts.append((x, y, z))
            cols.append(shade)
        ring_idx.append(row)
    tail_pole = len(verts)
    b0 = shape.at(0)
    verts.append((b0['x'] - 0.004 * shape.len, b0['cy'], 0)); cols.append(1.0)
    nose_pole = len(verts)
    bn = shape.at(0.995)
    verts.append((head_x, bn['cy'] + nose_y_offset(plan, shape), 0)); cols.append(0.85 if detail else 1.0)

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bv = [bm.verts.new(v) for v in verts]
    bm.verts.ensure_lookup_table()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    col_layer = bm.loops.layers.color.new('Col')

    def face(ids, uvs):
        f = bm.faces.new([bv[k] for k in ids])
        for loop, uv, k in zip(f.loops, uvs, ids):
            loop[uv_layer].uv = uv
            g = cols[k]
            loop[col_layer] = (g, g, g, 1.0)
        return f

    for i in range(rings):
        t0, t1 = i / rings, (i + 1) / rings
        for j in range(segs):
            j1 = (j + 1) % segs
            u0, u1 = j / segs, (j + 1) / segs
            a, b_, c_, d = ring_idx[i][j], ring_idx[i][j1], ring_idx[i + 1][j1], ring_idx[i + 1][j]
            face([a, d, c_, b_], [(u0, t0), (u0, t1), (u1, t1), (u1, t0)])
    for j in range(segs):
        j1 = (j + 1) % segs
        u0, u1 = j / segs, (j + 1) / segs
        face([tail_pole, ring_idx[0][j], ring_idx[0][j1]], [((u0 + u1) / 2, 0.0), (u0, 0.0), (u1, 0.0)])
        face([nose_pole, ring_idx[rings][j1], ring_idx[rings][j]], [((u0 + u1) / 2, 1.0), (u1, 1.0), (u0, 1.0)])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def nose_y_offset(plan, shape):
    # Underslung mouths sit low on a rounded snout; bass and tiger jut.
    return {'sub': -0.004, 'terminal': -0.002, 'oblique': 0.004, 'wide': 0.0}[plan['mouth']] * shape.depth


def sculpt(shape, t, b, x, y, z, s, c, eye_t, eye_y, op):
    """Shapes the head: gill cover, mouth and lips, eye socket. Returns the
    moved point and a shade (1 = skin colour, lower = darker)."""
    plan = shape.plan
    L = shape.len
    shade = 1.0
    side = abs(c)  # 1 on the flank, 0 on the back or belly
    h = (b['top'] if s > 0 else b['bot']) or 1e-4
    rel_y = (y - b['cy']) / h  # -1 belly .. 1 back

    # Push along the surface normal of the (elliptical) section.
    def push(amount):
        nonlocal x, y, z
        ny = s / max(1e-4, h)
        nz = c / max(1e-4, b['w'])
        n = math.hypot(ny, nz) or 1.0
        y += amount * ny / n
        z += amount * nz / n

    # Gill cover: its edge arcs back toward the top and bottom of the head.
    # A groove along the edge, the plate just in front standing a touch proud.
    edge_t = plan['opT'] - 0.03 * (1 - rel_y * rel_y)
    d = (t - edge_t) * (BODY_X1 - BODY_X0) * L
    if abs(rel_y) < 0.9:
        fade = side ** 0.6 * (1 - smooth(0.75, 0.9, abs(rel_y)))
        push((-0.0014 * gauss(d, 0.0045) + 0.0012 * smooth(0.0, 0.01, d) * (1 - smooth(0.02, 0.05, d))) * fade)
        shade *= 1 - 0.2 * gauss(d, 0.0045) * fade
        # The little gill slit opening low behind the plate.
        if rel_y < -0.2:
            shade *= 1 - 0.35 * gauss(d + 0.002, 0.002) * fade

    # Eye socket: a shallow dish the eye sits in.
    dx = x - shape.x_at(eye_t)
    dy = y - eye_y
    r_eye = plan['eyeR'] * shape.len
    de = math.hypot(dx, dy)
    if c * 1 != 0 and side > 0.3:
        push(-0.0022 * gauss(de, r_eye * 1.25) * side)
        shade *= 1 - 0.18 * gauss(de - r_eye * 1.15, r_eye * 0.35) * side

    # Mouth: the gape line runs from the tip of the snout back to the corner
    # of the jaw; lips swell above and below it.
    m = plan['mouth']
    size = plan['mouthSize']
    snout_x = shape.x_at(1.0)
    jaw_len = {'sub': 0.018, 'terminal': 0.024, 'oblique': 0.036, 'wide': 0.03}[m] * size * L
    gx = snout_x - x  # distance back from the tip
    if gx < jaw_len * 1.6:
        k = gx / jaw_len  # 0 at the tip, 1 at the corner
        if m == 'sub':
            line_y = b['cy'] - h * (0.35 + 0.2 * k)
        elif m == 'oblique':
            line_y = b['cy'] + h * (0.08 - 0.42 * k)
        elif m == 'wide':
            line_y = b['cy'] - h * 0.15
        else:
            line_y = b['cy'] - h * (0.05 + 0.12 * k)
        along = 1 - smooth(0.85, 1.25, k)
        dline = y - line_y
        lip = plan['lips']
        push((-0.0034 * gauss(dline, 0.0022 * size) + 0.0016 * lip * gauss(abs(dline) - 0.004 * size, 0.0028)) * along)
        shade *= 1 - 0.85 * gauss(dline, 0.0026 * size) * along
        # A big-mouthed bass has its lower jaw jutting past the upper.
        if m == 'oblique' and dline < 0:
            x += 0.004 * L * (1 - k) * along * smooth(-0.002, -0.012, dline)
        # Lips are paler on the carp and yellowfish.
        if m == 'sub':
            shade *= 1 + 0.12 * gauss(abs(dline) - 0.004 * size, 0.003) * along

    # Lateral line: a faint seam along the flank.
    if side > 0.5:
        shade *= 1 - 0.06 * gauss(rel_y - 0.12, 0.05) * smooth(0.1, 0.3, t) * (1 - smooth(0.7, 0.8, t))

    # Nape: carp and tilapia have a slight dip behind the head before the hump.
    return x, y, z, max(0.15, min(1.15, shade))


# ─── Fins ───────────────────────────────────────────────────────────────────

DORSAL = {
    'perch': dict(t0=0.3, t1=0.74, height=0.07),
    'carp': dict(t0=0.36, t1=0.8, height=0.065),
    'tiger': dict(t0=0.46, t1=0.63, height=0.085),
    'catfish': dict(t0=0.1, t1=0.74, height=0.04),
}
ANAL = {
    'perch': dict(t0=0.14, t1=0.32, height=0.05),
    'carp': dict(t0=0.12, t1=0.26, height=0.05),
    'tiger': dict(t0=0.12, t1=0.3, height=0.055),
    'catfish': dict(t0=0.06, t1=0.52, height=0.035),
}
TAIL = {
    'forked': dict(len=0.15, half=0.1, reach=lambda sv: 0.45 + 0.55 * abs(sv) ** 1.3),
    'notched': dict(len=0.12, half=0.085, reach=lambda sv: 0.78 + 0.22 * abs(sv)),
    'round': dict(len=0.1, half=0.06, reach=lambda sv: 0.55 + 0.45 * math.sqrt(max(0.0, 1 - sv * sv))),
}


def dorsal_profile(style, s, spiky):
    if style == 'perch':
        a = (math.sin(math.pi * clamp01(s / 0.45)) ** 0.7) if s < 0.45 else 0
        b = ((0.45 + 0.35 * abs(math.cos(s * math.pi * 8)) ** 4) if spiky else 0.62) * smooth(0.38, 0.48, s) if s > 0.4 else 0
        return max(a, b)
    if style == 'carp':
        return 0.28 + 0.72 * s ** 2.5
    if style == 'tiger':
        return 0.15 + 0.85 * s ** 1.4
    return math.sqrt(max(0.0, math.sin(math.pi * s)))


class FinBuilder:
    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')

    def membrane(self, root, tip, cols=14, rows=4, rays=None, ribs=0.0012):
        """A fin between a root line and an edge line (functions of s), ribbed
        along its rays: the membrane folds between them like a real fin."""
        rays = rays or max(4, cols // 2)
        grid = []
        for i in range(cols + 1):
            s = i / cols
            r, e = root(s), tip(s)
            # Across-fin direction (for the ribbing), from neighbouring samples.
            r2, e2 = root(min(1, s + 0.01)), tip(min(1, s + 0.01))
            ax = [(e[k] - r[k]) for k in range(3)]
            bx = [((r2[k] + e2[k]) - (r[k] + e[k])) / 2 for k in range(3)]
            n = (ax[1] * bx[2] - ax[2] * bx[1], ax[2] * bx[0] - ax[0] * bx[2], ax[0] * bx[1] - ax[1] * bx[0])
            nl = math.sqrt(sum(v * v for v in n)) or 1.0
            n = [v / nl for v in n]
            fold = math.cos(s * rays * math.pi * 2) * ribs
            col = []
            for k in range(rows + 1):
                v = k / rows
                p = [r[q] + (e[q] - r[q]) * v for q in range(3)]
                amt = fold * math.sin(math.pi * min(1.0, v * 1.2)) * (0.4 + 0.6 * v)
                p = [p[q] + n[q] * amt for q in range(3)]
                col.append((self.bm.verts.new(p), (s, v)))
            grid.append(col)
        for i in range(cols):
            for k in range(rows):
                q = [grid[i][k], grid[i + 1][k], grid[i + 1][k + 1], grid[i][k + 1]]
                try:
                    f = self.bm.faces.new([g[0] for g in q])
                except ValueError:
                    continue
                for loop, g in zip(f.loops, q):
                    loop[self.uv].uv = g[1]

    def to_mesh(self, name):
        mesh = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(mesh)
        self.bm.free()
        return mesh


def fins_mesh(shape):
    look, plan = shape.look, shape.plan
    L, depth = shape.len, shape.fin_scale()
    style = look.get('fins', 'perch')
    spiky = look.get('spiky', False)
    fb = FinBuilder()
    V = lambda x, y, z=0.0: (x, y, z)

    d = DORSAL[style]
    def d_root(s):
        b = shape.at(d['t0'] + (d['t1'] - d['t0']) * s)
        return V(b['x'], b['cy'] + b['top'] * 0.8)
    def d_tip(s):
        b = shape.at(d['t0'] + (d['t1'] - d['t0']) * s)
        hgt = d['height'] * depth * max(0.04, dorsal_profile(style, s, spiky))
        return V(b['x'] - hgt * 0.45, b['cy'] + b['top'] + hgt)
    fb.membrane(d_root, d_tip, cols=36 if style == 'perch' else 22, rows=5,
                rays=16 if style == 'perch' else 12, ribs=0.0010 * L)
    if style == 'tiger':
        def a_root(s):
            b = shape.at(0.12 + 0.07 * s)
            return V(b['x'], b['cy'] + b['top'] * 0.8)
        def a_tip(s):
            b = shape.at(0.12 + 0.07 * s)
            return V(b['x'] - 0.01, b['cy'] + b['top'] + 0.022 * depth * math.sin(math.pi * s))
        fb.membrane(a_root, a_tip, cols=6, rows=2, rays=1, ribs=0.0)

    a = ANAL[style]
    def an_root(s):
        b = shape.at(a['t0'] + (a['t1'] - a['t0']) * s)
        return V(b['x'], b['cy'] - b['bot'] * 0.8)
    def an_tip(s):
        b = shape.at(a['t0'] + (a['t1'] - a['t0']) * s)
        if style == 'catfish':
            hgt = a['height'] * depth * math.sqrt(max(0.0, math.sin(math.pi * s)))
        else:
            hgt = a['height'] * depth * (math.sin(math.pi * s) ** 0.6) * (0.5 + 0.5 * s)
        return V(b['x'] - hgt * 0.5, b['cy'] - b['bot'] - max(0.002, hgt))
    fb.membrane(an_root, an_tip, cols=16, rows=4, rays=9, ribs=0.0009 * L)

    for side in (1, -1):
        pel = shape.at(0.58)
        def p_root(s, side=side):
            b = shape.at(0.54 + 0.08 * s)
            return V(b['x'], b['cy'] - b['bot'] * 0.85, side * b['w'] * 0.35)
        def p_tip(s, side=side):
            b = shape.at(0.54 + 0.08 * s)
            r = 0.045 * depth * (0.3 + 0.7 * s)
            return V(b['x'] - r * 0.9, pel['cy'] - pel['bot'] - r * 0.55, side * (b['w'] * 0.35 + r * 0.5))
        fb.membrane(p_root, p_tip, cols=8, rows=3, rays=5, ribs=0.0006 * L)
        # Pectorals: just behind the gill cover, low on the flank.
        pt = plan['opT'] - 0.04
        pec = shape.at(pt)
        def c_root(s, side=side):
            b = shape.at(pt - 0.03 + 0.06 * s)
            return V(b['x'], b['cy'] - b['bot'] * 0.3, side * b['w'] * 0.9)
        def c_tip(s, side=side):
            reach = (0.05 if style == 'catfish' else 0.065) * (0.35 + 0.65 * math.sin(math.pi * (0.3 + 0.7 * s)))
            return V(pec['x'] - 0.03 * L + (s - 0.5) * 0.02 - reach * 0.7, pec['cy'] - pec['bot'] * 0.4 - reach * 0.45,
                     side * (pec['w'] * 0.95 + reach * 0.75))
        fb.membrane(c_root, c_tip, cols=10, rows=4, rays=7, ribs=0.0007 * L)

    tail = TAIL[look.get('tail', 'forked')]
    stalk = shape.at(0.02)
    def t_root(s):
        sv = s * 2 - 1
        h = stalk['top'] if sv > 0 else stalk['bot']
        return V(stalk['x'], stalk['cy'] + sv * h * 0.95)
    def t_tip(s):
        sv = s * 2 - 1
        return V(stalk['x'] - tail['len'] * L * tail['reach'](sv), stalk['cy'] + sv * tail['half'] * depth)
    fb.membrane(t_root, t_tip, cols=28, rows=6, rays=14, ribs=0.0012 * L)
    return fb.to_mesh('Fins')


# ─── Eyes, barbels, teeth ───────────────────────────────────────────────────

def eyes_mesh(shape, plan_name):
    plan = shape.plan
    bm = bmesh.new()
    col = bm.loops.layers.color.new('Col')
    iris = IRIS.get(plan_name, (0.8, 0.7, 0.4))
    eye_t = plan['eyeT']
    b = shape.at(eye_t)
    r = plan['eyeR'] * shape.len
    ey = b['cy'] + b['top'] * plan['eyeY']
    rel = clamp01(plan['eyeY'])
    surf_z = b['w'] * math.sqrt(max(0.0, 1 - rel * rel))
    for side in (1, -1):
        res = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r)
        vs = res['verts']
        for v in vs:
            v.co.z *= 0.55
            # Bulge the cornea a little.
            if v.co.z > 0:
                v.co.z *= 1.15
            v.co.z *= side
            v.co.x += shape.x_at(eye_t)
            v.co.y += ey
            v.co.z += side * (surf_z - r * 0.15)
        faces = {f for v in vs for f in v.link_faces}
        for f in faces:
            for loop in f.loops:
                p = loop.vert.co
                lz = (p.z - side * (surf_z - r * 0.15)) * side
                lr = math.hypot(p.x - shape.x_at(eye_t), p.y - ey)
                front = lz > 0
                if front and lr < r * 0.42:
                    c = (0.02, 0.02, 0.02)
                elif front and lr < r * 0.5:
                    c = tuple(v * 0.45 for v in iris)
                elif front:
                    c = iris
                else:
                    c = (0.35, 0.33, 0.28)
                loop[col] = (*c, 1.0)
    mesh = bpy.data.meshes.new('Eyes')
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def tube(bm, col, pts, radius, color, sides=6):
    """A tapering tube along points (barbels)."""
    rings = []
    for i, p in enumerate(pts):
        nxt = pts[min(len(pts) - 1, i + 1)]
        prv = pts[max(0, i - 1)]
        d = [nxt[k] - prv[k] for k in range(3)]
        dl = math.sqrt(sum(v * v for v in d)) or 1.0
        d = [v / dl for v in d]
        up = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
        a = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
        al = math.sqrt(sum(v * v for v in a)) or 1.0
        a = [v / al for v in a]
        b = (d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0])
        rr = radius * (1 - 0.8 * i / (len(pts) - 1))
        ring = []
        for k in range(sides):
            ang = k / sides * math.pi * 2
            ring.append(bm.verts.new([p[q] + (a[q] * math.cos(ang) + b[q] * math.sin(ang)) * rr for q in range(3)]))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            k1 = (k + 1) % sides
            f = bm.faces.new([rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]])
            for loop in f.loops:
                loop[col] = (*color, 1.0)


def extras_mesh(shape):
    look, plan = shape.look, shape.plan
    barbels = look.get('barbels', 0)
    teeth = look.get('teeth', False)
    if not barbels and not teeth:
        return None
    bm = bmesh.new()
    col = bm.loops.layers.color.new('Col')
    L = shape.len
    snout = shape.x_at(1.0)
    nb = shape.at(0.97)
    mouth_y = nb['cy'] + nose_y_offset(plan, shape) - nb['bot'] * 0.3
    for i in range(barbels):
        side = 1 if i % 2 else -1
        tier = i // 2
        reach = (0.12 + tier * 0.03) if barbels > 2 else 0.05
        pts = []
        for k in range(7):
            t = k / 6
            pts.append((snout - 0.012 - tier * 0.006 + t * reach * 0.55,
                        mouth_y - tier * 0.006 - t * t * 0.045 + math.sin(t * 3 + i) * 0.004,
                        side * (0.012 + tier * 0.004 + t * reach * 0.7)))
        tube(bm, col, pts, 0.0032 if barbels > 2 else 0.0026, (0.17, 0.16, 0.14))
    if teeth:
        for i in range(7):
            for jaw in (1, -1):
                a = (i / 6 - 0.5) * 1.7
                base = (snout - 0.01 - abs(a) * 0.022, mouth_y + jaw * 0.002, math.sin(a) * 0.024)
                res = bmesh.ops.create_cone(bm, cap_ends=False, segments=5, radius1=0.0035, radius2=0.0, depth=0.016)
                for v in res['verts']:
                    v.co.y *= -jaw  # point toward the gape
                    v.co.y += jaw * 0.008
                    v.co.x += base[0]; v.co.y += base[1]; v.co.z += base[2]
                for f in {f for v in res['verts'] for f in v.link_faces}:
                    for loop in f.loops:
                        loop[col] = (0.95, 0.93, 0.86, 1.0)
    mesh = bpy.data.meshes.new('Extras')
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return mesh


# ─── Build and export ───────────────────────────────────────────────────────

def add_object(mesh, name, subdivide=0, smooth_shade=True):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if smooth_shade:
        for p in mesh.polygons:
            p.use_smooth = True
    if subdivide:
        mod = obj.modifiers.new('Subdivision', 'SUBSURF')
        mod.levels = subdivide
        mod.render_levels = subdivide
        mod.uv_smooth = 'PRESERVE_BOUNDARIES'
    return obj


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)


def export(path):
    kw = dict(filepath=path, export_format='GLB', export_yup=False, export_apply=True,
              export_materials='NONE', export_normals=True, export_texcoords=True)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE', export_all_vertex_colors=True)
    except TypeError:
        try:
            bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
        except TypeError:
            bpy.ops.export_scene.gltf(**kw, export_colors=True)


def build(species_id, look):
    plan_name = SPECIES_PLAN.get(species_id, 'tilapia')
    shape = Shape(look, PLANS[plan_name])
    clear_scene()
    add_object(body_mesh('Body', shape, rings=44, segs=32, detail=True), 'Body', subdivide=1)
    add_object(body_mesh('BodyLow', shape, rings=22, segs=14, detail=False), 'BodyLow')
    add_object(fins_mesh(shape), 'Fins')
    add_object(eyes_mesh(shape, plan_name), 'Eyes')
    extras = extras_mesh(shape)
    if extras:
        add_object(extras, 'Extras')
    os.makedirs(OUT_DIR, exist_ok=True)
    export(os.path.join(OUT_DIR, f'{species_id}.glb'))


def main():
    with open(LOOKS_PATH, encoding='utf-8') as f:
        looks = json.load(f)
    for species_id, look in looks.items():
        if ONLY and species_id not in ONLY:
            continue
        build(species_id, look)
        print(f'built {species_id}')


main()
