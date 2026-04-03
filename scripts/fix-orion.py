import bpy
import bmesh
import sys
import math

fbx_path = sys.argv[-2]
out_path = sys.argv[-1]

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import FBX
bpy.ops.import_scene.fbx(filepath=fbx_path)

# Select all mesh objects and join
bpy.ops.object.select_all(action='DESELECT')
meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
if not meshes:
    print("ERROR: No meshes found")
    sys.exit(1)

for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()

obj = bpy.context.active_object

# Enter edit mode
bpy.ops.object.mode_set(mode='EDIT')

# Remove doubles first
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.001)

# Recalculate normals
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)

# Now remove interior faces:
# Use bmesh to delete faces whose normals point inward (toward center of object)
bpy.ops.object.mode_set(mode='OBJECT')
bm = bmesh.new()
bm.from_mesh(obj.data)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# Calculate object center
from mathutils import Vector
center = Vector((0, 0, 0))
for v in bm.verts:
    center += v.co
center /= len(bm.verts)

# Find faces pointing inward — face normal dot (face_center - object_center) < 0
faces_to_delete = []
for face in bm.faces:
    face_center = face.calc_center_median()
    outward_dir = (face_center - center).normalized()
    dot = face.normal.dot(outward_dir)
    if dot < -0.3:  # Normal points inward
        faces_to_delete.append(face)

print(f"Removing {len(faces_to_delete)} inward-facing faces out of {len(bm.faces)} total")
bmesh.ops.delete(bm, geom=faces_to_delete, context='FACES')

bm.to_mesh(obj.data)
bm.free()

# Final cleanup
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

# Export as GLB
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
)

print(f"SUCCESS: Exported to {out_path}")
