# Builds the people at the camps in Blender: a skeleton fleshed out with
# Blender's Skin modifier and smoothed, a head, hat and shoes, coloured by
# outfit (vertex colours). Three poses -- sitting in a camp chair, standing,
# and standing with a rod -- each in several outfits and skin tones.
#
#   blender --background --python tools/blender/build_people.py -- <repo root>
#
# Writes assets/scenery/models/personSit.glb, personStand.glb, personRod.glb;
# each holds one object per outfit (the game picks one at random). Metres,
# Y up, the person facing +z (toward the water, like the built ones).

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = argv[0] if argv else os.getcwd()
OUT = os.path.join(ROOT, 'assets', 'scenery', 'models')

SKIN = [(0.36, 0.22, 0.14), (0.55, 0.36, 0.24), (0.80, 0.60, 0.46), (0.25, 0.15, 0.10)]
OUTFITS = [
    dict(shirt=(0.15, 0.30, 0.55), pants=(0.55, 0.48, 0.35), shorts=True, long=False, hat=('bucket', (0.45, 0.42, 0.30)), shoes=(0.2, 0.18, 0.15), belly=1.1),
    dict(shirt=(0.75, 0.20, 0.15), pants=(0.12, 0.14, 0.20), shorts=False, long=False, hat=('cap', (0.10, 0.25, 0.12)), shoes=(0.9, 0.9, 0.88), belly=1.0),
    dict(shirt=(0.30, 0.42, 0.26), pants=(0.35, 0.30, 0.22), shorts=True, long=True, hat=('bucket', (0.30, 0.35, 0.22)), shoes=(0.3, 0.22, 0.15), belly=1.25),
    dict(shirt=(0.92, 0.88, 0.70), pants=(0.20, 0.30, 0.45), shorts=False, long=False, hat=('cap', (0.80, 0.55, 0.10)), shoes=(0.15, 0.15, 0.15), belly=0.95),
]

# Joints in Blender space (x right, -y forward, z up), with skin radii
# (sideways, front-to-back) and the body part each bone belongs to.
def skeleton(pose, belly):
    J = {}
    if pose == 'sit':
        J.update(pelvis=(0, 0.02, 0.50), belly=(0, 0.03, 0.70), chest=(0, 0.05, 0.92), neck=(0, 0.05, 1.08),
                 hipL=(0.1, 0.0, 0.48), kneeL=(0.11, -0.44, 0.50), ankleL=(0.13, -0.47, 0.09), toeL=(0.13, -0.62, 0.04),
                 shoL=(0.2, 0.05, 1.00), elbL=(0.25, -0.02, 0.76), handL=(0.18, -0.30, 0.58))
    else:
        J.update(pelvis=(0, 0, 0.95), belly=(0, 0, 1.15), chest=(0, 0, 1.37), neck=(0, 0, 1.53),
                 hipL=(0.1, 0, 0.92), kneeL=(0.11, -0.02, 0.50), ankleL=(0.11, 0.0, 0.09), toeL=(0.11, -0.15, 0.04),
                 shoL=(0.2, 0, 1.45))
        if pose == 'rod':
            J.update(elbL=(0.2, -0.2, 1.17), handL=(0.06, -0.40, 1.12))
        else:
            J.update(elbL=(0.25, 0.0, 1.18), handL=(0.27, -0.03, 0.93))
    # Mirror the left side.
    for k in list(J):
        if k.endswith('L'):
            x, y, z = J[k]
            J[k[:-1] + 'R'] = (-x, y, z)
    if pose == 'rod':
        J['handR'] = (0.0, -0.28, 0.98)  # lower hand on the butt
        J['elbR'] = (-0.2, -0.08, 1.1)
    radius = dict(pelvis=(0.17, 0.12), belly=(0.15 * belly, 0.13 * belly), chest=(0.18, 0.12), neck=(0.055, 0.055),
                  hip=(0.085, 0.085), knee=(0.06, 0.06), ankle=(0.045, 0.045), toe=(0.045, 0.04),
                  sho=(0.06, 0.06), elb=(0.045, 0.045), hand=(0.04, 0.035))
    bones = [('pelvis', 'belly', 'torso'), ('belly', 'chest', 'torso'), ('chest', 'neck', 'neck')]
    for s in 'LR':
        bones += [('pelvis', 'hip' + s, 'torso'), ('hip' + s, 'knee' + s, 'thigh'), ('knee' + s, 'ankle' + s, 'shin'),
                  ('ankle' + s, 'toe' + s, 'foot'), ('chest', 'sho' + s, 'torso'), ('sho' + s, 'elb' + s, 'upperArm'),
                  ('elb' + s, 'hand' + s, 'forearm')]
    return J, radius, bones


def colour_for(part, outfit, skin):
    if part in ('torso', 'upperArm'):
        return outfit['shirt']
    if part == 'forearm':
        return outfit['shirt'] if outfit['long'] else skin
    if part == 'thigh':
        return outfit['pants']
    if part == 'shin':
        return skin if outfit['shorts'] else outfit['pants']
    if part == 'foot':
        return outfit['shoes']
    return skin


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (p - (a + ab * t)).length


def body_object(pose, outfit, skin, name):
    J, radius, bones = skeleton(pose, outfit['belly'])
    keys = list(J)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([J[k] for k in keys], [(keys.index(a), keys.index(b)) for a, b, _ in bones], [])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    skin_mod = obj.modifiers.new('Skin', 'SKIN')
    skin_mod.branch_smoothing = 0.6
    for i, k in enumerate(keys):
        base = ''.join(ch for ch in k if not ch.isupper()) if k[-1] in 'LR' else k
        r = radius.get(base, (0.06, 0.06))
        mesh.skin_vertices[0].data[i].radius = r
    mesh.skin_vertices[0].data[keys.index('pelvis')].use_root = True
    sub = obj.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier='Skin')
    bpy.ops.object.modifier_apply(modifier='Subsurf')

    # Colour each vertex by the bone it's nearest.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    col = bm.loops.layers.color.new('Col')
    segs = [(Vector(J[a]), Vector(J[b]), part) for a, b, part in bones]
    for f in bm.faces:
        for loop in f.loops:
            p = loop.vert.co
            part = min(segs, key=lambda s: seg_dist(p, s[0], s[1]))[2]
            c = colour_for(part, outfit, skin)
            loop[col] = (*c, 1.0)
    for f in bm.faces:
        f.smooth = True

    # Head, with a hat.
    neck = Vector(J['neck'])
    head_c = neck + Vector((0, -0.01, 0.14))
    res = bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, radius=0.105)
    for v in res['verts']:
        v.co.z *= 1.18
        v.co.y *= 1.05
        v.co += head_c
    head_faces = {f for v in res['verts'] for f in v.link_faces}
    hat_kind, hat_col = outfit['hat']
    for f in head_faces:
        f.smooth = True
        for loop in f.loops:
            # A dark eye line and the hat's crown over the top of the head.
            rel = loop.vert.co - head_c
            c = skin
            if rel.z > 0.06:
                c = hat_col
            elif -0.02 < rel.z < 0.015 and rel.y < -0.07:
                c = tuple(v * 0.35 for v in skin)
            loop[col] = (*c, 1.0)
    # Brim: a wide flat ring for a bucket hat, a peak in front for a cap.
    if hat_kind == 'bucket':
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.17, radius2=0.12, depth=0.04)
        for v in res['verts']:
            v.co += head_c + Vector((0, 0, 0.08))
    else:
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.08, radius2=0.08, depth=0.015)
        for v in res['verts']:
            v.co.y *= 1.4
            v.co += head_c + Vector((0, -0.11, 0.07))
    for f in {f for v in res['verts'] for f in v.link_faces}:
        for loop in f.loops:
            loop[col] = (*hat_col, 1.0)

    if pose == 'rod':
        # The rod: from below the lower hand, out over the water and up.
        a, b = Vector(J['handR']) + Vector((0, 0.15, -0.1)), Vector(J['handL']) + Vector((0, -2.6, 1.45))
        d = b - a
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.014, radius2=0.004, depth=d.length)
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized())
        for v in res['verts']:
            v.co = rot @ v.co + (a + b) / 2
        for f in {f for v in res['verts'] for f in v.link_faces}:
            for loop in f.loops:
                loop[col] = (0.08, 0.08, 0.08, 1.0)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def build(pose, file_name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for i, outfit in enumerate(OUTFITS):
        obj = body_object(pose, outfit, SKIN[i % len(SKIN)], f'{pose}_{i}')
        obj.location.x = i * 1.0  # spread out; the game re-centres each
    os.makedirs(OUT, exist_ok=True)
    kw = dict(filepath=os.path.join(OUT, file_name), export_format='GLB', export_apply=True,
              export_materials='NONE')
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    print('built', file_name)


build('sit', 'personSit.glb')
build('stand', 'personStand.glb')
build('rod', 'personRod.glb')
