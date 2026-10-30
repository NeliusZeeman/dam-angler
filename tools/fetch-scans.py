# Downloads the photo-scanned textures and models listed in tools/scans.json
# from Poly Haven (CC0) into art-source/ (kept out of git). Already-downloaded
# files are skipped. Then run tools/build-scenery.mjs to make the game files.
#
#   python tools/fetch-scans.py

import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'art-source')
API = 'https://api.polyhaven.com/files/'
HEAD = {'User-Agent': 'dam-angler-build'}


def get_json(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=HEAD)))


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return 0
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = urllib.request.urlopen(urllib.request.Request(url, headers=HEAD)).read()
    with open(path + '.part', 'wb') as f:
        f.write(data)
    os.replace(path + '.part', path)
    return len(data)


def main():
    cfg = json.load(open(os.path.join(ROOT, 'tools', 'scans.json'), encoding='utf-8'))
    total = 0
    for asset in cfg['textures'].values():
        files = get_json(API + asset)
        for m, short in (('Diffuse', 'diff'), ('nor_gl', 'nor'), ('Rough', 'rough')):
            total += download(files[m]['1k']['jpg']['url'], os.path.join(OUT, 'textures', asset, f'{short}.jpg'))
        print('texture', asset)
    for asset in cfg['models'].values():
        g = get_json(API + asset)['gltf']['1k']['gltf']
        base = os.path.join(OUT, 'models', asset)
        total += download(g['url'], os.path.join(base, os.path.basename(g['url'])))
        for rel, inc in g.get('include', {}).items():
            total += download(inc['url'], os.path.join(base, *rel.split('/')))
        print('model', asset)
    print(f'downloaded {total / 1e6:.1f} MB')


main()
