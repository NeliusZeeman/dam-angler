# South African campsite pieces for build_camp.py, modelled on what SA
# campers pitch and drive (researched Nov 2026: Outdoor Warehouse, Cape Union
# Mart and 4x4 forum listings; NAAMSA 2025 bakkie sales via Cars.co.za):
#
#   tentDome     a nylon family dome (Coleman Skydome / Natural Instincts
#                Country Dome type): near-upright walls, two-tone fly, side
#                windows, a front awning on two poles
#   bowTent      a canvas bow tent (Tentco Junior/Senior Bow type): 2.6 m square,
#                upright walls, bowed roof, khaki canvas, green PVC skirt
#   gazebo       a 3 x 3 m canvas gazebo on a steel frame, set in front of a
#                bow tent the SA way
#   bakkieHilux / bakkieRanger / bakkieDmax
#                double-cab bakkies in the three best-selling front styles
#                (tall trapezoid grille and swept lamps; wide upright grille
#                with square lamps; slim lamps joined by a grille bar), with a
#                canopy, a roller-shutter lid or a roof rack and jerry cans --
#                no badges or names
#   cruiser      a boxy Land Cruiser 79-type double cab: flat bonnet, round
#                lamps, upright screen, snorkel, steel bumper, rooftop tent
#   suv          a 7-seat bakkie-based SUV (Fortuner type)
#   trailer      an off-road camper trailer: box body, A-frame, jockey wheel,
#                jerry cans, folded rooftop tent
#   braaiStand   a campsite steel braai on a pole, with grid and wind plate
#   potjie       a three-legged cast-iron pot
#   campChair    a folding canvas camp chair with armrests and a cup holder
#   campTable    a folding aluminium camp table
#   powerPost    a campsite electricity point on a post
#
# Blender: length along Y with the front toward -Y (+Z in the game), width
# along X, up Z, standing on the origin. Real metres.

import bpy
import bmesh
import math
from mathutils import Vector


def build_with(h):
    """Bind the shared helpers from build_camp.py (mat, box, cyl, rod, ...)."""
    globals().update(h)


# ─── Shapes ──────────────────────────────────────────────────────────────────

def profile(points, width, material, bevel=0.0, x0=None, segments=2):
    """A side profile (y, z) extruded across the width (centred on x=0 or from x0)."""
    bm = bmesh.new()
    left = -width / 2 if x0 is None else x0
    verts = [bm.verts.new((left, y, z)) for y, z in points]
    face = bm.faces.new(verts)
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(width, 0, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('profile')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('profile', me)
    bpy.context.scene.collection.objects.link(o)
    return finish(o, material, bevel, segments)


def arc_pts(cy, cz, r, a0, a1, n=10):
    return [(cy + math.cos(math.radians(a0 + (a1 - a0) * i / n)) * r, cz + math.sin(math.radians(a0 + (a1 - a0) * i / n)) * r) for i in range(n + 1)]


def arch_band(cy, r_in, r_out, width, material, z_axle):
    """A black wheel-arch flare: a band round the top of the wheel."""
    pts = arc_pts(cy, z_axle, r_out, 168, 12) + arc_pts(cy, z_axle, r_in, 12, 168)
    return profile(pts, width, material)


def tyre(y, x, r, w, tyre_mat, rim_mat, z=None):
    z = r if z is None else z
    parts = [cyl(r, w, (x, y, z), tyre_mat, rot=(0, math.pi / 2, 0), verts=22)]
    parts.append(cyl(r * 0.62, w + 0.012, (x, y, z), rim_mat, rot=(0, math.pi / 2, 0), verts=14))
    parts.append(cyl(r * 0.2, w + 0.03, (x, y, z), mat('hub', (0.2, 0.2, 0.2), 0.5, 0.6), rot=(0, math.pi / 2, 0), verts=8))
    return parts


def jerry(x, y, z, colour):
    m = mat(f'jerry-{colour}', {'green': (0.18, 0.34, 0.16), 'red': (0.62, 0.1, 0.07), 'black': (0.08, 0.08, 0.08)}[colour], 0.5)
    return [box((0.17, 0.35, 0.47), (x, y, z + 0.235), m, 0.02), box((0.04, 0.12, 0.05), (x, y - 0.08, z + 0.49), m, 0.01)]


# ─── Vehicles ────────────────────────────────────────────────────────────────

def vehicle(style='hilux', back='canopy', rack=False, rtt=False, bullbar=False, snorkel=False):
    """A double-cab bakkie (or SUV/cruiser by style) from side profiles."""
    paint = mat('paint', (0.93, 0.93, 0.92), 0.28, 0.45)
    glass = mat('glass', (0.06, 0.09, 0.11), 0.06, 0.3)
    trim = mat('trim', (0.07, 0.07, 0.075), 0.65)
    chrome = mat('chrome', (0.75, 0.76, 0.78), 0.2, 1.0)
    lamp = mat('lamp', (0.95, 0.95, 0.9), 0.1, 0.1)
    amber = mat('amber', (0.95, 0.55, 0.1), 0.3)
    tail = mat('taillamp', (0.75, 0.06, 0.05), 0.25)
    tyre_m = mat('tyre', (0.05, 0.05, 0.05), 0.92)
    rim = mat('rim', (0.55, 0.56, 0.58), 0.3, 0.9)
    plate_f = mat('plateF', (0.95, 0.95, 0.93), 0.5)
    plate_r = mat('plateR', (0.95, 0.85, 0.2), 0.5)
    steel = mat('steel', (0.12, 0.12, 0.12), 0.45, 0.7)
    p = []
    cruiser = style == 'cruiser'
    suv = style == 'suv'
    # Real sizes: Hilux DC 5.33 m long, wheelbase 3.085; LC79 DC 5.22, 3.18;
    # Fortuner 4.80, 2.745.
    if cruiser:
        L, W, wb, front_oh, r, belt, roof = 5.22, 1.87, 3.18, 0.83, 0.40, 1.25, 1.96
    elif suv:
        L, W, wb, front_oh, r, belt, roof = 4.80, 1.855, 2.745, 0.93, 0.39, 1.24, 1.84
    else:
        L, W, wb, front_oh, r, belt, roof = 5.33, 1.855, 3.085, 0.93, 0.39, 1.24, 1.82
    yf, yr = -L / 2, L / 2
    ax_f, ax_r = yf + front_oh, yf + front_oh + wb
    sill = 0.52
    ra = r + 0.075  # arch radius
    start = math.degrees(math.asin(max(-1, min(1, (sill - r) / ra))))
    # Lower body: bonnet and belt line on top, the arches cut out below.
    if cruiser:
        top = [(yf, 0.6), (yf - 0.02, 1.0), (yf + 0.05, 1.2), (yf + 1.6, 1.24), (yf + 1.62, belt)]
    elif style == 'ranger':
        top = [(yf, 0.52), (yf + 0.0, 0.9), (yf + 0.02, 1.12), (yf + 0.12, 1.18), (yf + 1.72, 1.22), (yf + 1.76, belt)]
    elif style == 'dmax':
        top = [(yf, 0.52), (yf + 0.0, 0.88), (yf + 0.03, 1.08), (yf + 0.22, 1.16), (yf + 1.72, 1.21), (yf + 1.76, belt)]
    else:  # hilux / suv
        top = [(yf, 0.52), (yf + 0.0, 0.9), (yf + 0.03, 1.1), (yf + 0.16, 1.17), (yf + 1.72, 1.21), (yf + 1.76, belt)]
    top += [(yr - 0.04, belt - 0.02), (yr, belt - 0.05), (yr + 0.01, 0.62), (yr - 0.06, sill)]
    # Each arch runs rear-to-front over the top of its wheel.
    lower = top + arc_pts(ax_r, r, ra, start, 180 - start) + arc_pts(ax_f, r, ra, start, 180 - start) + [(yf + 0.12, sill)]
    p.append(profile(lower, W, paint, 0.03))
    # Glasshouse: a cab (bakkie) or the full length (SUV).
    cab_front = yf + (1.62 if cruiser else 1.76)
    if cruiser:
        cab = [(cab_front, belt), (cab_front + 0.2, roof), (cab_front + 1.85, roof), (cab_front + 1.9, belt)]
    elif suv:
        cab = [(cab_front, belt), (cab_front + 0.62, roof), (yr - 0.32, roof - 0.03), (yr - 0.04, belt + 0.06)]
    else:
        cab = [(cab_front, belt), (cab_front + 0.62, roof), (cab_front + 1.5, roof), (cab_front + 1.58, belt)]
    p.append(profile(cab, W - 0.12, paint, 0.05))
    inset = lambda pts, d: [(y + (d if i in (0, 1) else -d), z + (d if i in (0, 3) else -d * 0.8)) for i, (y, z) in enumerate(pts)]
    p.append(profile(inset(cab, 0.06), W - 0.1, glass))
    # Door pillars over the side glass.
    pillars = [cab_front + 0.95] if not suv else [cab_front + 0.95, cab_front + 1.95]
    for y in pillars:
        p.append(box((W - 0.09, 0.08, roof - belt - 0.05), (0, y, (roof + belt) / 2), paint))
    if not suv:
        cab_rear = cab[-1][0]
        if back == 'canopy':
            can = [(cab_rear + 0.04, belt - 0.02), (cab_rear + 0.06, roof - 0.05), (yr - 0.06, roof - 0.07), (yr - 0.03, belt - 0.02)]
            p.append(profile(can, W - 0.06, mat('canopy', (0.92, 0.92, 0.9), 0.3, 0.4), 0.04))
            p.append(profile(inset(can, 0.09), W - 0.04, glass))
        elif back == 'roller':
            p.append(box((W - 0.1, yr - cab_rear - 0.12, 0.05), (0, (cab_rear + yr) / 2, belt), steel, 0.01))
            p.append(box((W - 0.06, 0.06, 0.55), (0, cab_rear + 0.08, belt + 0.27), trim, 0.01))  # sports bar
        elif back == 'deck':  # cruiser flat-deck dropside with a load
            p.append(box((W, yr - cab_rear, 0.06), (0, (cab_rear + yr) / 2, belt - 0.02), steel))
            for x in (-0.5, 0, 0.5):
                p += jerry(x, yr - 0.4, belt + 0.02, 'green')
    # Front: lamps, grille and bumper by style.
    zl = 1.03 if not cruiser else 1.02
    if style == 'hilux' or suv:
        p.append(profile([(yf - 0.025, 0.72), (yf - 0.035, 1.02), (yf + 0.02, 1.06), (yf + 0.02, 0.72)], 0.9, chrome, 0.01))  # trapezoid grille
        p.append(profile([(yf - 0.03, 0.75), (yf - 0.04, 0.99), (yf + 0.02, 1.02), (yf + 0.02, 0.75)], 0.84, trim))
        for s in (-1, 1):
            p.append(box((0.42, 0.08, 0.1), (s * 0.68, yf + 0.02, zl + 0.03), lamp, 0.02, rot=(0, 0, 0)))
            p.append(box((0.42, 0.06, 0.02), (s * 0.68, yf + 0.0, zl - 0.02), amber))
    elif style == 'ranger':
        p.append(box((1.3, 0.08, 0.34), (0, yf - 0.03, 0.88), trim, 0.02))
        for z in (0.8, 0.9, 1.0):
            p.append(box((1.24, 0.1, 0.035), (0, yf - 0.04, z), chrome))
        for s in (-1, 1):
            p.append(box((0.3, 0.08, 0.2), (s * 0.77, yf - 0.02, 0.96), lamp, 0.02))
            p.append(box((0.03, 0.1, 0.26), (s * 0.63, yf - 0.03, 0.95), lamp))  # C-clamp lamp bar
    elif style == 'dmax':
        p.append(box((1.5, 0.08, 0.06), (0, yf - 0.02, 1.0), chrome, 0.01))  # bar joining the lamps
        p.append(box((1.0, 0.08, 0.24), (0, yf - 0.02, 0.82), trim, 0.02))
        for s in (-1, 1):
            p.append(box((0.36, 0.08, 0.08), (s * 0.72, yf + 0.0, 1.0), lamp, 0.02))
    else:  # cruiser: round lamps in a flat face, slotted grille
        p.append(box((1.0, 0.06, 0.38), (0, yf - 0.03, 0.98), trim))
        for k in range(5):
            p.append(box((0.9, 0.07, 0.025), (0, yf - 0.04, 0.84 + k * 0.07), chrome))
        for s in (-1, 1):
            p.append(cyl(0.09, 0.06, (s * 0.7, yf - 0.03, 1.0), lamp, rot=(math.pi / 2, 0, 0), verts=14))
    p.append(box((W + 0.04, 0.2, 0.2), (0, yf - 0.05, 0.6), trim if not cruiser else steel, 0.04))  # bumper
    p.append(box((0.52, 0.02, 0.11), (0, yf - 0.16, 0.6), plate_f))
    p.append(box((0.52, 0.02, 0.11), (0, yr + 0.05, 0.75), plate_r))
    p.append(box((W, 0.16, 0.16), (0, yr + 0.02, 0.56), trim, 0.03))   # rear bumper / step
    for s in (-1, 1):
        p.append(box((0.08, 0.05, 0.3), (s * (W / 2 - 0.08), yr + 0.01, 1.0), tail, 0.01))
        p.append(box((0.07, 0.22, 0.1), (s * (W / 2 + 0.02), cab_front + 0.35, belt + 0.12), trim, 0.01))  # mirrors
        p.append(box((0.14, wb - 1.1, 0.05), (s * (W / 2 + 0.03), (ax_f + ax_r) / 2, 0.42), trim, 0.01))  # side step
        for ay in (ax_f, ax_r):
            p += tyre(ay, s * (W / 2 - 0.12), r, 0.27, tyre_m, rim)
            p.append(arch_band(ay, ra, ra + 0.06, W + 0.05, trim, r) if not cruiser else arch_band(ay, ra, ra + 0.03, W + 0.02, paint, r))
    p.append(box((0.08, 0.3, 0.08), (0, yr + 0.18, 0.5), steel))  # tow hitch
    if bullbar or cruiser:
        for s in (-1, 1):
            p.append(rod((s * 0.55, yf - 0.18, 0.5), (s * 0.55, yf - 0.12, 1.12), 0.035, steel))
        p.append(rod((-0.85, yf - 0.16, 0.95), (0.85, yf - 0.16, 0.95), 0.035, steel))
        p.append(rod((-0.55, yf - 0.12, 1.12), (0.55, yf - 0.12, 1.12), 0.035, steel))
    if snorkel or cruiser:
        x = W / 2 + 0.06
        p.append(rod((x, cab_front - 0.2, 0.95), (x, cab_front + 0.05, roof + 0.05), 0.045, trim))
        p.append(box((0.12, 0.2, 0.12), (x, cab_front + 0.02, roof + 0.08), trim, 0.03))
    if rack or rtt:
        rack_len = 1.45 if not suv else 2.2
        y0 = cab[1][0] + 0.05
        for x in (-0.75, 0.75):
            p.append(box((0.05, rack_len, 0.05), (x, y0 + rack_len / 2, roof + 0.08), steel))
        for k in range(4):
            p.append(box((1.6, 0.04, 0.04), (0, y0 + k * rack_len / 3, roof + 0.06), steel))
        if rtt:
            # A folded rooftop tent: hard shell with a black travel cover.
            p.append(box((1.4, 1.35, 0.3), (0, y0 + 0.7, roof + 0.27), mat('rtt', (0.1, 0.1, 0.1), 0.7), 0.05))
            p.append(box((1.42, 1.37, 0.05), (0, y0 + 0.7, roof + 0.43), mat('rttlid', (0.45, 0.47, 0.43), 0.6), 0.03))
        else:
            for x in (-0.45, -0.2):
                p += jerry(x, y0 + 0.4, roof + 0.1, 'red' if x < -0.3 else 'green')
    return p


def trailer():
    body = mat('trailerBody', (0.12, 0.12, 0.12), 0.5, 0.3)
    steel = mat('steel', (0.12, 0.12, 0.12), 0.45, 0.7)
    tyre_m = mat('tyre', (0.05, 0.05, 0.05), 0.92)
    rim = mat('rim', (0.55, 0.56, 0.58), 0.3, 0.9)
    p = [box((1.6, 2.5, 0.9), (0, 0.3, 0.95), body, 0.04)]
    p.append(box((1.62, 2.52, 0.06), (0, 0.3, 1.42), mat('trailerLid', (0.85, 0.85, 0.83), 0.4, 0.3), 0.02))
    p.append(box((1.5, 1.3, 0.25), (0, 0.6, 1.58), mat('rtt', (0.1, 0.1, 0.1), 0.7), 0.04))
    for s in (-1, 1):
        p += tyre(0.4, s * 0.92, 0.38, 0.26, tyre_m, rim)
        p.append(box((0.3, 0.9, 0.05), (s * 0.92, 0.4, 0.82), body, 0.02))  # mudguards
    p.append(rod((-0.6, -0.95, 0.55), (0, -2.2, 0.55), 0.04, steel))
    p.append(rod((0.6, -0.95, 0.55), (0, -2.2, 0.55), 0.04, steel))
    p.append(rod((0, -1.9, 0.55), (0, -1.9, 0.08), 0.03, steel))
    p.append(cyl(0.08, 0.05, (0, -1.9, 0.08), tyre_m, rot=(0, math.pi / 2, 0), verts=12))
    p.append(box((1.2, 0.45, 0.45), (0, -1.15, 0.78), body, 0.03))  # nose box
    p += jerry(-0.35, -1.5, 0.55, 'green') + jerry(0.35, -1.5, 0.55, 'green')
    p.append(cyl(0.15, 0.55, (0, -1.5, 0.83), mat('gas', (0.12, 0.42, 0.72), 0.35, 0.3), verts=14))
    return p


# ─── Tents and gazebo ────────────────────────────────────────────────────────

def family_dome():
    fly = mat('fly', (0.25, 0.45, 0.3), 0.8)
    top_m = mat('flyTop', (0.5, 0.52, 0.5), 0.8)
    dark = mat('tent-dark', (0.06, 0.06, 0.06), 0.9)
    pole = mat('pole', (0.2, 0.2, 0.22), 0.4, 0.6)
    rope = mat('rope', (0.85, 0.8, 0.65), 0.9)
    R, H = 1.55, 1.85
    bm = bmesh.new()
    rings, segs = 12, 32
    grid = []
    for j in range(rings + 1):
        v = j / rings
        f = max(0.0, 1 - v ** 2.4) ** 0.42
        row = []
        for i in range(segs):
            a = i / segs * math.tau
            # Squarish footprint (superellipse), steep walls, rounded roof.
            c, s = math.cos(a), math.sin(a)
            n = (abs(c) ** 4 + abs(s) ** 4) ** -0.25
            row.append(bm.verts.new((c * n * R * f, s * n * R * f, v * H)))
        grid.append(row)
    for j in range(rings):
        for i in range(segs):
            f = bm.faces.new((grid[j][i], grid[j][(i + 1) % segs], grid[j + 1][(i + 1) % segs], grid[j + 1][i]))
            f.material_index = 0 if j < rings * 0.55 else 1
    me = bpy.data.meshes.new('dome')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('dome', me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(fly)
    o.data.materials.append(top_m)
    for p_ in o.data.polygons:
        p_.use_smooth = True
    parts = [o]
    # Door (front, -Y) and side windows: dark panels on the walls.
    parts.append(box((1.1, 0.03, 1.45), (0, -R * 1.0, 0.75), dark))
    for s in (-1, 1):
        parts.append(box((0.03, 0.9, 0.4), (s * R * 0.99, 0, 1.15), dark))
    # The awning: a canopy out over the door on two poles.
    bm = bmesh.new()
    a = [bm.verts.new(v) for v in ((-1.2, -R * 0.9, 1.62), (1.2, -R * 0.9, 1.62), (1.25, -R - 1.7, 1.75), (-1.25, -R - 1.7, 1.75))]
    bm.faces.new(a)
    me = bpy.data.meshes.new('awning')
    bm.to_mesh(me)
    bm.free()
    aw = bpy.data.objects.new('awning', me)
    bpy.context.scene.collection.objects.link(aw)
    parts.append(finish(aw, top_m))
    for s in (-1, 1):
        parts.append(rod((s * 1.25, -R - 1.7, 0), (s * 1.25, -R - 1.7, 1.78), 0.014, pole))
        parts.append(rod((s * 1.25, -R - 1.7, 1.75), (s * 1.6, -R - 2.6, 0.02), 0.005, rope, 4))
    # Crossing poles over the roof.
    # (Along the diagonals, following the dome's own profile.)
    vs = [k / 10 for k in range(11)]
    for s in (-1, 1):
        d = Vector((math.cos(s * math.pi / 4), math.sin(s * math.pi / 4), 0))
        side = [(d * (R * 1.19 * max(0.0, 1 - v ** 2.4) ** 0.42 + 0.02), v * H + 0.01) for v in vs]
        pts = [tuple(-q + Vector((0, 0, z))) for q, z in side] + [tuple(q + Vector((0, 0, z))) for q, z in reversed(side[:-1])]
        parts.append(arc_tube(pts, 0.011, pole))
    for ang in (0.8, 2.35, 3.9, 5.5):
        top = Vector((math.cos(ang) * R * 0.8, math.sin(ang) * R * 0.8, H * 0.75))
        peg = Vector((math.cos(ang) * (R + 1.0), math.sin(ang) * (R + 1.0), 0.02))
        parts.append(rod(top, peg, 0.005, rope, 4))
    return parts


def bow_tent():
    canvas = mat('canvas', (0.72, 0.64, 0.47), 0.95)
    skirt = mat('skirt', (0.2, 0.28, 0.18), 0.7)
    dark = mat('tent-dark', (0.06, 0.06, 0.06), 0.9)
    pole = mat('pole', (0.2, 0.2, 0.22), 0.4, 0.6)
    rope = mat('rope', (0.85, 0.8, 0.65), 0.9)
    S, Wh, H = 2.6, 1.55, 2.0
    parts = []
    # Walls and a bowed roof: the end profile (bows run across) extruded along Y.
    end = [(-S / 2, 0.0), (S / 2, 0.0), (S / 2, Wh)]
    for i in range(1, 12):
        t = i / 12
        end.append((S / 2 - S * t, Wh + math.sin(t * math.pi) * (H - Wh)))
    end.append((-S / 2, Wh))
    bm = bmesh.new()
    verts = [bm.verts.new((x, -S / 2, z)) for x, z in end]
    face = bm.faces.new(verts)
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, S, 0), verts=[e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('bow')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('bow', me)
    bpy.context.scene.collection.objects.link(o)
    parts.append(finish(o, canvas, 0.02))
    parts.append(box((S + 0.02, S + 0.02, 0.18), (0, 0, 0.09), skirt))
    # Door with a rolled flap, mesh windows with canvas flaps rolled up.
    parts.append(box((1.0, 0.03, 1.55), (0, -S / 2 - 0.01, 0.9), dark))
    parts.append(cyl(0.07, 1.05, (0, -S / 2 - 0.05, 1.72), canvas, rot=(0, math.pi / 2, 0), verts=10))
    for s in (-1, 1):
        parts.append(box((0.03, 1.1, 0.5), (s * (S / 2 + 0.01), 0, 1.05), dark))
        parts.append(cyl(0.05, 1.15, (s * (S / 2 + 0.05), 0, 1.36), canvas, rot=(math.pi / 2, 0, 0), verts=8))
    # The bows show as ridges, and guy ropes from the eaves.
    for y in (-S / 2 + 0.05, 0, S / 2 - 0.05):
        pts = [(x, y, z + 0.02) for x, z in end[2:-1]]
        parts.append(arc_tube(pts, 0.015, pole))
    for s in (-1, 1):
        for y in (-S / 2, S / 2):
            parts.append(rod((s * S / 2, y, Wh), (s * (S / 2 + 1.0), y + (0.4 if y > 0 else -0.4), 0.02), 0.005, rope, 4))
    return parts


def canvas_gazebo():
    canvas = mat('gazeboCanvas', (0.68, 0.6, 0.44), 0.95)
    steel = mat('frame', (0.3, 0.3, 0.3), 0.4, 0.8)
    parts = []
    w, h = 1.5, 2.05
    corners = [(-w, -w), (w, -w), (w, w), (-w, w)]
    for x, y in corners:
        parts.append(rod((x, y, 0), (x, y, h + 0.05), 0.022, steel, 8))
        parts.append(box((0.14, 0.14, 0.02), (x, y, 0.01), steel))
    for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1]):
        parts.append(rod((x0, y0, h), (x1, y1, h), 0.018, steel, 6))
        parts.append(rod((x0, y0, h), (0, 0, h + 0.65), 0.016, steel, 6))
    # Pitched canvas roof with a valance round the eaves.
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=w * 1.5, radius2=0.05, depth=0.68, location=(0, 0, h + 0.36), rotation=(0, 0, math.pi / 4))
    parts.append(finish(bpy.context.active_object, canvas))
    for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1]):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        along = abs(x1 - x0) > 0.1
        parts.append(box((2 * w + 0.12 if along else 0.02, 0.02 if along else 2 * w + 0.12, 0.25), (cx * 1.03, cy * 1.03, h - 0.1), canvas))
    # One wall let down on the windward side (back, +Y), the others rolled up.
    parts.append(box((2 * w, 0.02, h - 0.2), (0, w + 0.02, (h - 0.2) / 2 + 0.05), canvas))
    for x in (-w, w):
        parts.append(cyl(0.06, 2 * w, (x * 1.02, 0, h - 0.27), canvas, rot=(math.pi / 2, 0, 0), verts=8))
    return parts


# ─── Campsite gear ───────────────────────────────────────────────────────────

def braai_stand():
    steel = mat('braaiSteel', (0.14, 0.13, 0.12), 0.6, 0.5)
    grid = mat('grid', (0.4, 0.4, 0.4), 0.4, 0.9)
    coal = mat('coal', (0.12, 0.06, 0.03), 0.95)
    return [rod((0, 0, 0), (0, 0, 0.72), 0.04, steel), box((0.5, 0.5, 0.02), (0, 0, 0.01), steel),
            box((0.7, 0.5, 0.12), (0, 0, 0.78), steel, 0.01), box((0.66, 0.46, 0.04), (0, 0, 0.82), coal),
            box((0.7, 0.02, 0.35), (0, 0.25, 0.98), steel), box((0.64, 0.44, 0.01), (0, 0, 0.88), grid)]


def potjie():
    iron = mat('castIron', (0.08, 0.08, 0.08), 0.6, 0.6)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, segments=18, ring_count=10, location=(0, 0, 0.3))
    pot = finish(bpy.context.active_object, iron, smooth=True)
    pot.scale = (1, 1, 0.85)
    p = [pot, cyl(0.15, 0.03, (0, 0, 0.48), iron, verts=16), cyl(0.03, 0.04, (0, 0, 0.51), iron, verts=8)]
    for a in (0, 2.1, 4.2):
        p.append(rod((math.cos(a) * 0.12, math.sin(a) * 0.12, 0.2), (math.cos(a) * 0.16, math.sin(a) * 0.16, 0), 0.015, iron, 5))
    p.append(arc_tube([(-0.2 * math.cos(t), 0, 0.42 + 0.2 * math.sin(t)) for t in [i / 10 * math.pi for i in range(11)]], 0.006, iron))
    return p


def camp_chair():
    seat = mat('chair', (0.15, 0.3, 0.5), 0.85)
    frame = mat('chairFrame', (0.1, 0.1, 0.1), 0.5, 0.6)
    p = []
    for s in (-1, 1):
        p.append(rod((s * 0.27, -0.25, 0), (s * 0.27, 0.22, 0.48), 0.012, frame, 5))
        p.append(rod((s * 0.27, 0.22, 0), (s * 0.27, -0.25, 0.48), 0.012, frame, 5))
        p.append(rod((s * 0.29, -0.28, 0.6), (s * 0.29, 0.22, 0.6), 0.012, frame, 5))
        p.append(rod((s * 0.29, -0.28, 0.0), (s * 0.29, -0.28, 0.6), 0.012, frame, 5))
        p.append(box((0.1, 0.45, 0.015), (s * 0.31, -0.03, 0.61), seat))  # armrest
    p.append(cyl(0.04, 0.07, (0.36, -0.22, 0.58), seat, verts=10))  # cup holder
    bm = bmesh.new()
    pts = [(-0.26, -0.2, 0.44), (0.26, -0.2, 0.44), (0.26, 0.2, 0.4), (-0.26, 0.2, 0.4)]
    bm.faces.new([bm.verts.new(v) for v in pts])
    back = [(-0.26, 0.2, 0.42), (0.26, 0.2, 0.42), (0.27, 0.28, 0.92), (-0.27, 0.28, 0.92)]
    bm.faces.new([bm.verts.new(v) for v in back])
    me = bpy.data.meshes.new('sling')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('sling', me)
    bpy.context.scene.collection.objects.link(o)
    sol = o.modifiers.new('thick', 'SOLIDIFY')
    sol.thickness = 0.01
    p.append(finish(o, seat))
    for s in (-1, 1):
        p.append(rod((s * 0.27, 0.22, 0.48), (s * 0.28, 0.28, 0.93), 0.012, frame, 5))
    return p


def camp_table():
    top = mat('tableTop', (0.85, 0.86, 0.86), 0.3, 0.6)
    leg = mat('chairFrame', (0.1, 0.1, 0.1), 0.5, 0.6)
    p = [box((1.2, 0.6, 0.03), (0, 0, 0.7), top, 0.008)]
    for s in (-1, 1):
        p.append(rod((s * 0.5, -0.25, 0), (s * 0.5, 0.25, 0.69), 0.012, leg, 5))
        p.append(rod((s * 0.5, 0.25, 0), (s * 0.5, -0.25, 0.69), 0.012, leg, 5))
    return p


def power_post():
    green = mat('postGreen', (0.15, 0.38, 0.2), 0.5, 0.2)
    grey = mat('postGrey', (0.6, 0.6, 0.6), 0.5)
    return [box((0.18, 0.18, 1.1), (0, 0, 0.55), green, 0.02), box((0.26, 0.2, 0.3), (0, 0, 1.0), green, 0.02),
            box((0.16, 0.02, 0.1), (0, -0.11, 0.95), grey), box((0.12, 0.02, 0.06), (0, -0.11, 1.08), mat('plateF', (0.95, 0.95, 0.93), 0.5))]


PIECES = {
    'tentDome': family_dome, 'bowTent': bow_tent, 'gazebo': canvas_gazebo,
    'bakkieHilux': lambda: vehicle('hilux', 'canopy'),
    'bakkieRanger': lambda: vehicle('ranger', 'roller', rack=False, bullbar=True),
    'bakkieDmax': lambda: vehicle('dmax', 'canopy', rack=True),
    'cruiser': lambda: vehicle('cruiser', 'deck', rtt=True),
    'suv': lambda: vehicle('suv', rack=True),
    'trailer': trailer, 'braaiStand': braai_stand, 'potjie': potjie,
    'campChair': camp_chair, 'campTable': camp_table, 'powerPost': power_post,
}
