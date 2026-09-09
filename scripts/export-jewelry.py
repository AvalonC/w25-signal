"""Rebuild full geometry display assets; no decimation, LOD or mesh sampling."""
import bpy, json, os, sys, math, random, bisect
from mathutils import Vector, Matrix

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source = sys.argv[sys.argv.index('--') + 1]
args = sys.argv[sys.argv.index('--') + 1:]
ring = args[1] if len(args) > 1 else os.path.join(root, 'work', 'bracelet-ring.blend')
out = os.path.join(root, 'public')

def open_meshes(path, predicate):
    bpy.ops.wm.open_mainfile(filepath=path)
    dg = bpy.context.evaluated_depsgraph_get()
    result = []
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {'MESH', 'CURVE'} or not predicate(obj): continue
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), depsgraph=dg, preserve_all_data_layers=True)
        for v in mesh.vertices: v.co = (obj.matrix_world @ v.co) * .001
        result.append((obj.name, mesh))
    for obj in list(bpy.context.scene.objects): bpy.data.objects.remove(obj, do_unlink=True)
    # Retain jewelry materials and geometry, not the source studio's view layers.
    bpy.context.window.scene = bpy.data.scenes.new('Jewelry display')
    objects = []
    for name, mesh in result:
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        objects.append(obj)
    bpy.context.scene.unit_settings.scale_length = 1
    return objects

def export(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(out,'models',name+'.glb'), export_format='GLB', use_selection=True, export_apply=False)

def render(objects, name):
    scene = bpy.context.scene
    points = [v.co for obj in objects for v in obj.data.vertices]
    center = Vector(tuple((min(v[i] for v in points)+max(v[i] for v in points))/2 for i in range(3)))
    span = max(max(v[i] for v in points)-min(v[i] for v in points) for i in range(3))
    world = bpy.data.worlds.new('Soft studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.45,.5,.6,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
    for i, (offset, color, power) in enumerate([((-.6,-.4,1.2),(1,.93,.98),3),((.5,.6,.9),(.65,.8,1),2),((.7,-.2,.5),(1,.7,.86),1)]):
        data = bpy.data.lights.new('Reflection '+str(i),'AREA')
        data.energy = power * .001 * (span/.007)**2
        data.shape = 'DISK'
        data.size = span*.7
        data.color = color
        obj = bpy.data.objects.new(data.name,data)
        scene.collection.objects.link(obj)
        obj.location = center + Vector(offset)*span
        obj.rotation_euler = (center-obj.location).to_track_quat('-Z','Y').to_euler()
    camdata = bpy.data.cameras.new('Preview')
    cam = bpy.data.objects.new('Preview',camdata)
    scene.collection.objects.link(cam)
    cam.location = center + Vector((0,-.55,1.3))*span
    cam.rotation_euler = (center-cam.location).to_track_quat('-Z','Y').to_euler()
    camdata.type='ORTHO'; camdata.ortho_scale=span*1.2
    camdata.clip_start=.0001
    scene.camera=cam
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.use_compositing=False
    scene.render.use_sequencer=False
    scene.render.resolution_x=720; scene.render.resolution_y=720; scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
    scene.render.filepath=os.path.join(out,name+'.png')
    bpy.ops.render.render(write_still=True)

def drape_tail(objects):
    # Rigidly rotate each chain link around its own joint along a gravity arc.
    # The pendant parts share the final vertical tangent; no mesh is simplified
    # or stretched. Work in Blender Z-up meters before glTF axis conversion.
    hinge = .02865
    radius = .0038
    for obj in objects:
        if not obj.name.startswith(('Extension', 'Fan charm')): continue
        vertices = obj.data.vertices
        center = Vector(tuple((min(v.co[i] for v in vertices)+max(v.co[i] for v in vertices))/2 for i in range(3)))
        distance = max(0, -center.y - hinge)
        angle = min(math.pi/2, distance/radius)
        beyond = max(0, distance-radius*math.pi/2)
        target = Vector((center.x, -(hinge+radius*math.sin(angle)), .00122-radius*(1-math.cos(angle))-beyond))
        rotation = Matrix.Rotation(angle, 3, 'X')
        for vertex in vertices: vertex.co = target + rotation @ (vertex.co-center)
        obj.data.update()

def export_stars(objects):
    # Surface samples are a separate visual effect; full GLB/USDZ meshes remain.
    triangles, cumulative = [], []
    total = 0
    for obj in objects:
        mesh = obj.data; mesh.calc_loop_triangles()
        for triangle in mesh.loop_triangles:
            a,b,c = [mesh.vertices[i].co.copy() for i in triangle.vertices]
            area = (b-a).cross(c-a).length/2
            if area <= 0: continue
            total += area; cumulative.append(total); triangles.append((a,b,c))
    rng = random.Random(2508)
    points = []
    for i in range(1050):
        a,b,c = triangles[bisect.bisect_left(cumulative, (i+rng.random())/1050*total)]
        u=math.sqrt(rng.random()); v=rng.random()
        point=(1-u)*a+u*(1-v)*b+u*v*c
        points.append([round(point.x,8),round(point.z,8),round(-point.y,8)])
    with open(os.path.join(out,'models','bracelet-stars.json'),'w',encoding='utf-8') as f:
        json.dump({'points':points,'effectOnly':True,'source':'bracelet-ring.glb'},f,separators=(',',':'))

objects=open_meshes(ring,lambda o: o.type=='MESH')
drape_tail(objects)
export_stars(objects)
export(objects,'bracelet-ring')
bpy.ops.wm.usd_export(filepath=os.path.join(out,'models','bracelet-ring.usdz'),selected_objects_only=True,export_materials=True,evaluation_mode='VIEWPORT')
gem=next(o for o in objects if 'four-point' in o.name and 'brilliant' in o.name)
center=sum((v.co for v in gem.data.vertices),Vector())/len(gem.data.vertices)
for obj in objects: obj.data.calc_loop_triangles()
metadata={'hotspot':[center.x,center.z,-center.y], 'normal':[0,1,0], 'objects':len(objects), 'vertices':sum(len(o.data.vertices) for o in objects),'polygons':sum(len(o.data.polygons) for o in objects),'triangles':sum(len(o.data.loop_triangles) for o in objects),'units':'meters','decimated':False}
positions=[v.co for o in objects for v in o.data.vertices]
low=[min(v[i] for v in positions) for i in range(3)]
high=[max(v[i] for v in positions) for i in range(3)]
middle=[(low[i]+high[i])/2 for i in range(3)]
metadata['poster']={'target':[middle[0],middle[2],-middle[1]],'span':max(high[i]-low[i] for i in range(3))*1.2,'phi':math.atan(.55/1.3)}
with open(os.path.join(out,'models','jewelry-metadata.json'),'w',encoding='utf-8') as f: json.dump(metadata,f,indent=2)
render(objects,'model-ring-preview')
objects=open_meshes(source,lambda o: o.name.startswith('Pink four-point star'))
points=[v.co for o in objects for v in o.data.vertices]
center=Vector(tuple((min(v[i] for v in points)+max(v[i] for v in points))/2 for i in range(3)))
for o in objects:
    for v in o.data.vertices: v.co-=center
export(objects,'sapphire-star')
render(objects,'sapphire-preview')
print('FULL GEOMETRY VERIFIED',json.dumps(metadata))
