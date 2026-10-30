# Turns the Microsoft Rocketbox people (MIT licence; fetched into
# art-source/rocketbox by tools/fetch-rocketbox.py) into the game's campers
# and bank anglers:
#
#   assets/people/<name>.glb   one person: skinned mesh (real face, skin,
#                              clothes, hair) on the 3ds Max Biped skeleton,
#                              textures shrunk to WebP
#   assets/people/motions.glb  the skeleton with every motion as its own
#                              clip (walk, idle, sit, drink, cheer...) --
#                              three.js plays them on any person, since the
#                              bones are named the same
#   assets/people/motions.json how fast each walk moves (metres a second)
#
#   blender --background --python tools/blender/build_campers.py -- <repo root>

import bpy
import json
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = os.path.abspath(argv[0] if argv else os.getcwd())
SRC = os.path.join(ROOT, 'art-source', 'rocketbox')
OUT = os.path.join(ROOT, 'assets', 'people')

# Game name -> Rocketbox avatar.
PEOPLE = {
    'man-shorts': 'Male_Adult_01', 'man-jacket': 'Male_Adult_04', 'man-vest': 'Male_Adult_05',
    'man-check': 'Male_Adult_10', 'man-denim': 'Male_Adult_12', 'man-chinos': 'Male_Adult_14',
    'woman-jacket': 'Female_Adult_04', 'woman-green': 'Female_Adult_17',
    'boy': 'Male_Child_02', 'girl': 'Female_Child_01',
}
FACE = 1024   # head texture: the face is what people look at
BODY = 1024
NORMAL = 512
OPACITY = 512

# Clips, by game name -> Rocketbox motion file (art-source/rocketbox/anims).
MOTIONS = {
    'walk': 'm_walk_neutral_01', 'walkF': 'f_walk_neutral_01', 'stroll': 'm_walk_stroll_01', 'strollF': 'f_walk_stroll_01',
    'idle': 'm_idle_neutral_01', 'idle2': 'm_idle_neutral_02', 'idleF': 'f_idle_neutral_01',
    'lookAround': 'm_idle_look_around_01', 'stretch': 'm_idle_stretch_arms_01',
    'drink': 'm_drink_drinking', 'drinkIdle': 'm_drink_idle', 'drinkF': 'f_drink_drinking', 'drinkIdleF': 'f_drink_idle',
    'sit': 'm_sit_chair_idle_neutral_01', 'sitRelaxed': 'm_sit_chair_idle_relaxed_01', 'sitLook': 'm_sit_chair_idle_look_around',
    'sitBreathe': 'm_sit_chair_breathe_01', 'sitF': 'f_sit_chair_idle_neutral_01', 'sitBreatheF': 'f_sit_chair_breathe_01',
    'sitTable': 'm_sit_table_idle_neutral_01', 'crouch': 'm_crouch_idle', 'work': 'm_work_table',
    'cheer': 'm_cheer_01', 'cheerF': 'f_cheer_01', 'talk': 'm_gestic_talk_relaxed_01', 'talkF': 'f_gestic_talk_relaxed_01',
    'laugh': 'm_gestic_laugh_loud', 'photo': 'm_take_picture', 'clap': 'm_claphands_01',
}
# Bones whose position moves (the rest only rotate).
ROOT_BONES = {'Bip01', 'Bip01 Pelvis'}
# Long recordings are cut to a loopable stretch (seconds).
MAX_SECONDS = 9


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=False)
    return [o for o in bpy.data.objects if o not in before]


def tex_file(folder, suffix):
    tdir = os.path.join(folder, 'Textures')
    for f in os.listdir(tdir):
        if f.endswith(suffix):
            return os.path.join(tdir, f)
    return None


def load_image(path, size, name):
    img = bpy.data.images.load(path)
    img.name = name
    img.pixels[0]  # make sure it's read before scaling
    if img.size[0] > size:
        img.scale(size, size)
    return img


def make_material(name, color, normal=None, alpha=False, roughness=0.62):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0
    tc = nt.nodes.new('ShaderNodeTexImage')
    tc.image = color
    nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha:
        nt.links.new(tc.outputs['Alpha'], bsdf.inputs['Alpha'])
        mat.blend_method = 'CLIP' if hasattr(mat, 'blend_method') else None
        mat['gltf_alpha_mode'] = 'MASK'
    if normal is not None:
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = normal
        normal.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = 0.8
        nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def build_person(name, avatar):
    reset()
    folder = os.path.join(SRC, 'avatars', avatar)
    objs = import_fbx(os.path.join(folder, f'{avatar}.fbx'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    meshes = [o for o in objs if o.type == 'MESH']
    for o in objs:
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o)
    # The children's skeletons are named Bip02: same bones, so name them
    # like everyone else's for the motions to find them (the mesh's vertex
    # groups follow the rename).
    for b in arm.data.bones:
        if b.name.startswith('Bip02'):
            b.name = 'Bip01' + b.name[5:]
    # Fresh materials from the colour and normal maps (the FBX's own ones
    # carry 3ds Max specular setups glTF can't use).
    mats = {}
    for part, size in (('body', BODY), ('head', FACE)):
        color = tex_file(folder, f'_{part}_color.tga')
        normal = tex_file(folder, f'_{part}_normal.tga')
        mats[part] = make_material(
            f'{name}-{part}', load_image(color, size, f'{name}-{part}'),
            load_image(normal, NORMAL, f'{name}-{part}-n') if normal else None,
            roughness=0.55 if part == 'head' else 0.75)
    op = tex_file(folder, '_opacity_color.tga')
    if op:
        mats['opacity'] = make_material(f'{name}-hair', load_image(op, OPACITY, f'{name}-hair'), alpha=True, roughness=0.6)
    for m in meshes:
        for i, slot in enumerate(m.material_slots):
            old = slot.material.name if slot.material else ''
            part = 'head' if '_head' in old else 'opacity' if 'opacity' in old else 'body'
            if part in mats:
                m.material_slots[i].material = mats[part]
        m.name = name
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    arm.animation_data_clear()
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm] + meshes:
        o.select_set(True)
    path = os.path.join(OUT, f'{name}.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, use_selection=True, export_format='GLB', export_animations=False,
        export_image_format='WEBP', export_image_quality=82, export_yup=True,
        export_skins=True, export_def_bones=False, export_morph=False,
    )
    tris = sum(sum(len(p.vertices) - 2 for p in m.data.polygons) for m in meshes)
    print(f'person {name}: {tris} tris, {os.path.getsize(path) // 1024} KB', flush=True)


def channelbag(action):
    """The action's F-curves (Blender 4.4+ keeps them in layered slots)."""
    if hasattr(action, 'layers') and action.layers:
        for layer in action.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    return cb.fcurves
    return action.fcurves


def build_motions():
    reset()
    # The skeleton everyone shares, from one of the people.
    objs = import_fbx(os.path.join(SRC, 'avatars', 'Male_Adult_01', 'Male_Adult_01.fbx'))
    target = next(o for o in objs if o.type == 'ARMATURE')
    for o in objs:
        if o is not target:
            bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    bones = {b.name for b in target.data.bones}
    target.animation_data_create()
    speeds = {}
    for clip, src in MOTIONS.items():
        new = import_fbx(os.path.join(SRC, 'anims', f'{src}.fbx'))
        src_arm = next(o for o in new if o.type == 'ARMATURE' and o.animation_data and o.animation_data.action)
        action = src_arm.animation_data.action
        # How far the walk moves per second: from the motion the exporter
        # took out of the pelvis and put on the helper.
        helper = next((o for o in new if o.name.startswith('MotionExtractionHelper') and o.animation_data and o.animation_data.action), None)
        if helper:
            fc = [f for f in channelbag(helper.animation_data.action) if f.data_path == 'location']
            if fc:
                s, e = helper.animation_data.action.frame_range
                d = sum((f.evaluate(e) - f.evaluate(s)) ** 2 for f in fc[:2]) ** 0.5
                speeds[clip] = round(d / ((e - s) / 30), 3)
        s, e = action.frame_range
        end = min(e, s + MAX_SECONDS * 30)
        # Retarget: the motion's skeleton rests in a different pose from the
        # people's (A-pose vs T-pose), so each bone copies its source's
        # orientation in world space and the result is baked into keys.
        src_bones = {b.name for b in src_arm.data.bones}
        for pb in target.pose.bones:
            if pb.name not in src_bones:
                continue
            c = pb.constraints.new('COPY_ROTATION')
            c.target, c.subtarget = src_arm, pb.name
            if pb.name in ROOT_BONES:
                c = pb.constraints.new('COPY_LOCATION')
                c.target, c.subtarget = src_arm, pb.name
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = target
        target.select_set(True)
        bpy.ops.object.mode_set(mode='POSE')
        bpy.ops.pose.select_all(action='SELECT')
        bpy.ops.nla.bake(frame_start=int(s), frame_end=int(end), step=1, only_selected=False, visual_keying=True,
                         clear_constraints=True, use_current_action=False, bake_types={'POSE'})
        bpy.ops.object.mode_set(mode='OBJECT')
        baked = target.animation_data.action
        slot = target.animation_data.action_slot
        # Only bones the people have, fingers only when holding something
        # (a can, a plate), and only rotations below the hips: the limbs
        # don't stretch, so their position and scale keys are dead weight.
        fcs = channelbag(baked)
        for f in list(fcs):
            bone = f.data_path.split('"')[1] if '"' in f.data_path else None
            if bone and bone not in bones:
                fcs.remove(f)
            elif bone and 'Finger' in bone and not clip.startswith('drink'):
                fcs.remove(f)
            elif bone and bone not in ROOT_BONES and not f.data_path.endswith(('rotation_quaternion', 'rotation_euler')):
                fcs.remove(f)
        baked.name = clip
        target.animation_data.action = None
        track = target.animation_data.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, int(s), baked)
        if hasattr(strip, 'action_slot') and slot:
            strip.action_slot = slot
        for t in target.animation_data.nla_tracks:
            t.mute = t is not track
        for o in new:
            bpy.data.objects.remove(o)
        print(f'motion {clip}: {(end - s) / 30:.1f} s', flush=True)
    for t in target.animation_data.nla_tracks:
        t.mute = False
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    path = os.path.join(OUT, 'motions.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, use_selection=True, export_format='GLB', export_animations=True,
        export_animation_mode='NLA_TRACKS', export_frame_step=2, export_optimize_animation_size=True,
        export_force_sampling=False, export_yup=True, export_skins=True, export_def_bones=False,
    )
    with open(os.path.join(OUT, 'motions.json'), 'w') as f:
        json.dump({'walkSpeed': speeds}, f, indent=1)
    print(f'motions: {os.path.getsize(path) // 1024} KB, walk speeds {speeds}', flush=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(argv[1].split(',')) if len(argv) > 1 and argv[1] else None
    for name, avatar in PEOPLE.items():
        if only and name not in only:
            continue
        build_person(name, avatar)
    if not only or 'motions' in only:
        build_motions()


main()
