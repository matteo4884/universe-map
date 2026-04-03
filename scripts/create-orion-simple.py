import bpy
import math
import sys

out_path = sys.argv[-1]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

def make_mat(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

mat_white = make_mat("Body_White", (0.85, 0.85, 0.82, 1.0), 0.1, 0.4)
mat_dark = make_mat("Body_Dark", (0.15, 0.15, 0.15, 1.0), 0.2, 0.6)
mat_gold = make_mat("Thermal_Gold", (0.72, 0.53, 0.15, 1.0), 0.8, 0.3)
mat_panel = make_mat("Solar_Panel", (0.05, 0.08, 0.25, 1.0), 0.3, 0.2)
mat_silver = make_mat("Service_Module", (0.6, 0.6, 0.62, 1.0), 0.5, 0.35)
mat_nozzle = make_mat("Nozzle", (0.3, 0.3, 0.3, 1.0), 0.7, 0.4)

# ENGINE NOZZLE: z = -2.0 to -1.0
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.8, radius2=0.4, depth=1.0, location=(0, 0, -1.5))
bpy.context.active_object.data.materials.append(mat_nozzle)

# SERVICE MODULE: z = -0.9 to 3.1
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=2.3, depth=4.0, location=(0, 0, 1.1))
bpy.context.active_object.data.materials.append(mat_gold)

# ADAPTER RING: z = 3.2 to 3.6
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=2.5, depth=0.4, location=(0, 0, 3.4))
bpy.context.active_object.data.materials.append(mat_silver)

# HEAT SHIELD: z = 3.7 to 3.85
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=2.5, depth=0.15, location=(0, 0, 3.775))
bpy.context.active_object.data.materials.append(mat_dark)

# CREW MODULE: z = 3.9 to 7.2
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=2.5, radius2=1.2, depth=3.3, location=(0, 0, 5.55))
bpy.context.active_object.data.materials.append(mat_white)

# FORWARD BAY COVER: z = 7.3 to 8.1
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=1.2, radius2=0.3, depth=0.8, location=(0, 0, 7.7))
bpy.context.active_object.data.materials.append(mat_dark)

# DOCKING PORT: z = 8.2 to 8.5
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.4, depth=0.3, location=(0, 0, 8.35))
bpy.context.active_object.data.materials.append(mat_silver)

# WINDOWS
for i, angle in enumerate([0.5, -0.5, 2.6, -2.6]):
    x = 2.0 * math.cos(angle)
    y = 2.0 * math.sin(angle)
    bpy.ops.mesh.primitive_cube_add(size=0.25, location=(x, y, 5.8))
    bpy.context.active_object.data.materials.append(mat_dark)

# SOLAR PANELS
for i in range(4):
    angle = math.radians(i * 90 + 45)
    arm_start = 2.5
    arm_length = 1.0
    arm_cx = (arm_start + arm_length / 2) * math.cos(angle)
    arm_cy = (arm_start + arm_length / 2) * math.sin(angle)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.04, depth=arm_length, location=(arm_cx, arm_cy, 1.1))
    arm = bpy.context.active_object
    arm.rotation_euler = (0, math.pi / 2, angle)
    arm.data.materials.append(mat_silver)

    panel_length = 7.0
    panel_width = 2.2
    panel_start = arm_start + arm_length + 0.1
    panel_cx = (panel_start + panel_length / 2) * math.cos(angle)
    panel_cy = (panel_start + panel_length / 2) * math.sin(angle)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(panel_cx, panel_cy, 1.1))
    panel = bpy.context.active_object
    panel.scale = (panel_length / 2, panel_width / 2, 0.03)
    panel.rotation_euler = (0, 0, angle)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    panel.data.materials.append(mat_panel)

# JOIN & EXPORT
bpy.ops.object.select_all(action='DESELECT')
meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_apply=True)
print(f"SUCCESS")
