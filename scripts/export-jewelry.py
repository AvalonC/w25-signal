"""Blender --background --python export-jewelry.py -- SOURCE.blend [OUTPUT/public].
Rebuild every W25 jewelry asset from the factory source without decimation.
"""
import bpy, os, sys, json, math, random, bisect, zipfile, struct
from mathutils import Vector, Matrix
from pxr import Usd, UsdGeom, UsdUtils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
from ring_assembly import assemble_ring

args=sys.argv[sys.argv.index('--')+1:]
source=os.path.abspath(args[0])
out=os.path.abspath(args[1]) if len(args)>1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'public')
os.makedirs(os.path.join(out,'models'),exist_ok=True)
work=os.path.join(os.path.dirname(out),'work');os.makedirs(work,exist_ok=True)
REVISION='GU1893-v6-ring-r1'

def save_json(name,value):
    with open(os.path.join(out,'models',name+'.json'),'w',encoding='utf8') as f:json.dump(value,f,indent=2,ensure_ascii=False)

def load():
    bpy.ops.wm.open_mainfile(filepath=source)
    dg=bpy.context.evaluated_depsgraph_get();result=[]
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {'MESH','CURVE'} or not any(c.name.startswith(('01','02','03','04','05')) for c in obj.users_collection):continue
        me=bpy.data.meshes.new_from_object(obj.evaluated_get(dg),depsgraph=dg,preserve_all_data_layers=True)
        for v in me.vertices:v.co=obj.matrix_world@v.co
        result.append((obj.name,me))
    # Source files can contain additional scenes. Remove all original objects
    # from this in-memory export copy so recreated names remain stable.
    for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.context.window.scene=bpy.data.scenes.new('GU1893 finished jewelry')
    objects=[]
    for name,me in result:
        obj=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(obj);objects.append(obj)
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
    bpy.context.scene.unit_settings.length_unit='MILLIMETERS'
    return objects

def counts(objects):
    for obj in objects:obj.data.calc_loop_triangles()
    return dict(objects=len(objects),vertices=sum(len(o.data.vertices) for o in objects),polygons=sum(len(o.data.polygons) for o in objects),triangles=sum(len(o.data.loop_triangles) for o in objects))

def bounds(objects):
    pts=[v.co for o in objects for v in o.data.vertices]
    lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
    return lo,hi

def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]

def glb(objects,name):
    select(objects)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out,'models',name+'.glb'),export_format='GLB',use_selection=True,export_apply=False)

def usdz(objects,name):
    select(objects);saved=[]
    for mat in bpy.data.materials:
        p=mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
        if p:
            saved.append((p,p.inputs['Transmission Weight'].default_value,p.inputs['Roughness'].default_value))
            p.inputs['Transmission Weight'].default_value=0;p.inputs['Roughness'].default_value=max(.1,p.inputs['Roughness'].default_value)
    path=os.path.join(out,'models',name+'.usdz')
    bpy.ops.wm.usd_export(filepath=path,check_existing=False,selected_objects_only=True,
        export_animation=False,export_hair=False,export_armatures=False,export_shapekeys=False,
        export_uvmaps=False,export_mesh_colors=False,export_normals=True,export_materials=True,
        generate_preview_surface=True,generate_materialx_network=False,convert_orientation=True,
        export_global_up_selection='Y',export_global_forward_selection='NEGATIVE_Z',
        convert_scene_units='METERS',meters_per_unit=1.0,export_lights=False,export_cameras=False,
        export_curves=False,export_points=False,export_volumes=False,export_custom_properties=False,
        author_blender_name=False,allow_unicode=False,triangulate_meshes=True,
        export_subdivision='TESSELLATE',root_prim_path='/Bracelet',convert_world_material=False)
    for p,t,r in saved:p.inputs['Transmission Weight'].default_value=t;p.inputs['Roughness'].default_value=r
    stage=Usd.Stage.Open(path);assert stage and stage.GetDefaultPrim()
    assert UsdGeom.GetStageUpAxis(stage)=='Y' and UsdGeom.GetStageMetersPerUnit(stage)==1
    cc=UsdUtils.ComplianceChecker(arkit=True,skipARKitRootLayerCheck=False);cc.CheckCompliance(path)
    errors=list(map(str,cc.GetErrors()));failed=list(map(str,cc.GetFailedChecks()))
    with zipfile.ZipFile(path) as zf,open(path,'rb') as fp:
        for i in zf.infolist():
            fp.seek(i.header_offset+26);fn,ex=struct.unpack('<HH',fp.read(4))
            assert i.compress_type==zipfile.ZIP_STORED and (i.header_offset+30+fn+ex)%64==0
    usdtris=sum(sum(UsdGeom.Mesh(p).GetFaceVertexCountsAttr().Get())//3 for p in stage.Traverse() if p.IsA(UsdGeom.Mesh))
    assert usdtris==counts(objects)['triangles'],('USD geometry loss',usdtris,counts(objects))
    lo,hi=bounds(objects)
    report={'revision':REVISION,'errors':errors,'failedChecks':failed,'warnings':list(map(str,cc.GetWarnings())),'sizeMeters':list(hi-lo),'triangles':usdtris,'deviceTested':False}
    save_json(name+'-validation',report)
    assert not errors and not failed,report

def render(objects,name,save_blend=None):
    scene=bpy.context.scene;lo,hi=bounds(objects);center=(lo+hi)/2;span=max(hi-lo)
    world=bpy.data.worlds.new('Soft studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.45,.5,.6,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    for i,(offset,color,power) in enumerate([((-.6,-.4,1.2),(1,.93,.98),3),((.5,.6,.9),(.65,.8,1),2),((.7,-.2,.5),(1,.7,.86),1)]):
        data=bpy.data.lights.new('Reflection '+str(i),'AREA');data.energy=power*.001*(span/.007)**2;data.shape='DISK';data.size=span*.7;data.color=color
        ob=bpy.data.objects.new(data.name,data);scene.collection.objects.link(ob);ob.location=center+Vector(offset)*span;ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Preview');cam=bpy.data.objects.new('Preview',data);scene.collection.objects.link(cam)
    theta,phi=(math.radians(52),math.radians(60)) if span>.02 else (0,math.atan(.55/1.3))
    direction=Vector((math.sin(theta)*math.sin(phi),-math.cos(theta)*math.sin(phi),math.cos(phi)))
    cam.location=center+direction*span*1.4;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=span*1.2;data.clip_start=.0001;scene.camera=cam
    scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
    scene.render.use_compositing=False;scene.render.use_sequencer=False
    scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.filepath=os.path.join(out,name+'.png')
    if save_blend:
        scene['factory_revision']=REVISION;scene['tail_draped']=True;scene['source_blend']=source
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=='VIEW_3D':
                    area.spaces.active.region_3d.view_distance=span*1.8;area.spaces.active.region_3d.view_location=center;area.spaces.active.clip_start=.0001
        bpy.ops.wm.save_as_mainfile(filepath=save_blend)
    bpy.ops.render.render(write_still=True)
    return {'target':[center.x,center.z,-center.y],'span':span*1.2,'theta':theta,'phi':phi}

objects=load();sourcecounts=counts(objects);wire=[]
for obj in objects:
    me=obj.data;edges=[list(e.vertices) for e in me.edges];chosen=edges[::max(1,math.ceil(len(edges)/160))]
    used=sorted(set(i for e in chosen for i in e));indices={v:i for i,v in enumerate(used)}
    wire.append({'name':obj.name,'pink':'pink' in obj.name.lower(),'vertices':[[round(c,5) for c in me.vertices[i].co] for i in used],'edges':[[indices[a],indices[b]] for a,b in chosen]})
save_json('bracelet-wire',{'source':os.path.basename(source),'revision':REVISION,'effectOnly':True,'objects':wire})
for obj in objects:
    for v in obj.data.vertices:v.co*=.001
usdz(objects,'bracelet')

objects=load()
radius, assembly, gemstone_normal = assemble_ring(objects)
save_json('bracelet-assembly-validation', dict(revision=REVISION, **assembly))
assert counts(objects)==sourcecounts,'Ring creation changed the full geometry'
metadata=counts(objects);metadata.update(revision=REVISION,units='meters',decimated=False)
gem=next(o for o in objects if 'four-point' in o.name and 'brilliant' in o.name)
center=sum((v.co for v in gem.data.vertices),Vector())/len(gem.data.vertices)
metadata.update(hotspot=[center.x,center.z,-center.y],normal=gemstone_normal)
triangles=[];cumulative=[];total=0
for obj in objects:
    for tri in obj.data.loop_triangles:
        a,b,c=[obj.data.vertices[i].co.copy() for i in tri.vertices];area=(b-a).cross(c-a).length/2
        if area<=0:continue
        total+=area;cumulative.append(total);triangles.append((a,b,c))
rng=random.Random(2508);points=[]
for i in range(1050):
    a,b,c=triangles[bisect.bisect_left(cumulative,(i+rng.random())/1050*total)]
    u=math.sqrt(rng.random());v=rng.random();p=(1-u)*a+u*(1-v)*b+u*v*c
    points.append([round(p.x,8),round(p.z,8),round(-p.y,8)])
save_json('bracelet-stars',{'points':points,'effectOnly':True,'source':'bracelet-ring.glb','revision':REVISION})
glb(objects,'bracelet-ring');usdz(objects,'bracelet-ring')
metadata['poster']=render(objects,'model-ring-preview',os.path.join(work,'bracelet-ring.blend'))
save_json('jewelry-metadata',metadata)
manifest={'revision':REVISION,'source':os.path.basename(source),'objects':sourcecounts['objects'],'evaluatedVertices':sourcecounts['vertices'],'evaluatedPolygons':sourcecounts['polygons'],'triangles':sourcecounts['triangles'],'ringRadiusMm':radius,'decimated':False,'export':'bracelet-ring.glb'}
objects=load()
for obj in list(objects):
    if not obj.name.startswith('Pink four-point star'):bpy.data.objects.remove(obj,do_unlink=True);objects.remove(obj)
lo,hi=bounds(objects);center=(lo+hi)/2
for obj in objects:
    for v in obj.data.vertices:v.co=(v.co-center)*.001
manifest['sapphire']=counts(objects)
save_json('bracelet-ring-manifest',manifest)
glb(objects,'sapphire-star');render(objects,'sapphire-preview',os.path.join(work,'sapphire-star.blend'))
print('FACTORY_ASSETS_COMPLETE',json.dumps(manifest),flush=True)
