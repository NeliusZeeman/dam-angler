# Bakes soft ambient shade into a model's vertex colours (Cycles ambient
# occlusion): how much open sky each point can see. Crown interiors, the
# underside of a gazebo roof, tent folds, wheel arches and the base of a
# reed clump come out darker. The game multiplies its lighting by it, so the
# sun and its moving shadows stay live while this soft shade costs nothing
# at run time -- no extra pictures or lights, which matters on phones.
#
# Used by build_trees.py, build_reeds.py and build_camp.py before export.

import bpy

ATTR = 'Shade'


def bake_ao(objects, distance, floor=0.5, samples=48):
    """Bake each object on its own (the others hidden: a file holds several
    shapes and levels of detail standing on the same spot), then squeeze the
    result into floor..1 so nothing goes black. `floor` may be a function of
    the object, for parts that should stay lighter (leaves)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    if not scene.world:
        scene.world = bpy.data.worlds.new('World')
    scene.world.light_settings.distance = distance
    others = [o for o in scene.objects if o.type == 'MESH']
    for obj in objects:
        for o in others:
            o.hide_render = o is not obj
        me = obj.data
        if ATTR in me.color_attributes:
            me.color_attributes.remove(me.color_attributes[ATTR])
        attr = me.color_attributes.new(ATTR, 'BYTE_COLOR', 'POINT')
        me.color_attributes.active_color = attr
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        lo = floor(obj) if callable(floor) else floor
        vals = [0.0] * (len(me.vertices) * 4)
        attr.data.foreach_get('color', vals)
        for i in range(0, len(vals), 4):
            a = lo + (1 - lo) * vals[i]
            vals[i] = vals[i + 1] = vals[i + 2] = a
            vals[i + 3] = 1.0
        attr.data.foreach_set('color', vals)
    for o in others:
        o.hide_render = False


def gltf_colour_options():
    """Export options that write the active colour attribute (they changed
    names across Blender versions)."""
    for opts in ({'export_vertex_color': 'ACTIVE'}, {'export_colors': True}):
        try:
            bpy.ops.export_scene.gltf.get_rna_type().properties[next(iter(opts))]
            return opts
        except KeyError:
            continue
    return {}
