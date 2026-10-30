# Downloads the Microsoft Rocketbox people (MIT licence,
# github.com/microsoft/Microsoft-Rocketbox) the campsite uses, and the
# motions they play, into art-source/rocketbox/ (gitignored).
# tools/blender/build_campers.py turns them into game models.
#
#   python tools/fetch-rocketbox.py

import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'art-source', 'rocketbox')
RAW = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/'

# People picked to look like a weekend at an SA dam.
AVATARS = {
    'Adults': ['Male_Adult_01', 'Male_Adult_04', 'Male_Adult_05', 'Male_Adult_10', 'Male_Adult_12',
               'Male_Adult_14', 'Female_Adult_04', 'Female_Adult_17'],
    'Children': ['Male_Child_02', 'Female_Child_01'],
}
# Only the colour, normal and opacity maps are used (not specular).
WANT_TEX = ('_color.tga', '_normal.tga')

ANIMS = {
    'all_animations_max_motextr_xy': ['m_walk_neutral_01', 'f_walk_neutral_01', 'm_walk_stroll_01', 'f_walk_stroll_01'],
    'all_animations_max_motextr_static': [
        'm_idle_neutral_01', 'm_idle_neutral_02', 'f_idle_neutral_01', 'm_idle_look_around_01', 'm_idle_stretch_arms_01',
        'm_drink_drinking', 'm_drink_idle', 'f_drink_drinking', 'f_drink_idle',
        'm_sit_chair_idle_neutral_01', 'm_sit_chair_idle_relaxed_01', 'm_sit_chair_idle_look_around', 'm_sit_chair_breathe_01',
        'f_sit_chair_idle_neutral_01', 'f_sit_chair_breathe_01',
        'm_sit_table_idle_neutral_01', 'm_crouch_idle', 'm_work_table', 'm_cheer_01', 'f_cheer_01',
        'm_gestic_talk_relaxed_01', 'm_gestic_laugh_loud', 'f_gestic_talk_relaxed_01', 'm_take_picture', 'm_claphands_01',
    ],
}


def get(path, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    urllib.request.urlretrieve(RAW + urllib.parse.quote(path), dest + '.part')
    os.replace(dest + '.part', dest)
    print('got', path, flush=True)


def tree():
    import json
    url = 'https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/master?recursive=1'
    return [t['path'] for t in json.load(urllib.request.urlopen(url))['tree']]


def main():
    paths = tree()
    for group, names in AVATARS.items():
        for name in names:
            base = f'Assets/Avatars/{group}/{name}/'
            get(base + f'Export/{name}.fbx', os.path.join(OUT, 'avatars', name, f'{name}.fbx'))
            for p in paths:
                if p.startswith(base + 'Textures/') and p.endswith(WANT_TEX) or p.startswith(base + 'Textures/') and 'opacity' in p:
                    get(p, os.path.join(OUT, 'avatars', name, 'Textures', os.path.basename(p)))
    for folder, names in ANIMS.items():
        for n in names:
            get(f'Assets/Animations/{folder}/{n}.max.fbx', os.path.join(OUT, 'anims', f'{n}.fbx'))
    get('LICENSE.md', os.path.join(OUT, 'LICENSE.md'))
    print('DONE')


if __name__ == '__main__':
    sys.exit(main())
