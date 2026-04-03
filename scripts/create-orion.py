import bpy
import bmesh
import math
import sys

out_path = sys.argv[-1]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# ============================================================
# MATERIALS — more realistic colors
# ============================================================

def make_mat(name, color, metallic=0.0, roughness=0.5, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 0.3
    return mat

# Capsule: matte white thermal protection
mat_capsule = make_mat("Capsule_White", (0.88, 0.86, 0.83, 1.0), 0.0, 0.7)
# Heat shield: dark charred ablative
mat_heatshield = make_mat("Heat_Shield", (0.08, 0.06, 0.05, 1.0), 0.1, 0.9)
# Forward bay: dark composite
mat_forward = make_mat("Forward_Bay", (0.12, 0.12, 0.12, 1.0), 0.15, 0.7)
# Gold thermal MLI blanket
mat_gold = make_mat("Gold_MLI", (0.76, 0.55, 0.12, 1.0), 0.85, 0.25)
# Silver metallic panels
mat_silver = make_mat("Silver_Panel", (0.7, 0.7, 0.72, 1.0), 0.6, 0.3)
# Solar panel: dark blue with slight sheen
mat_solar = make_mat("Solar_Panel", (0.03, 0.05, 0.18, 1.0), 0.2, 0.15,
                      emission=(0.02, 0.04, 0.12, 1.0))
# Solar panel frame
mat_panel_frame = make_mat("Panel_Frame", (0.25, 0.25, 0.27, 1.0), 0.5, 0.4)
# Engine: dark metallic
mat_engine = make_mat("Engine", (0.2, 0.2, 0.22, 1.0), 0.8, 0.35)
# Window: very dark with slight reflection
mat_window = make_mat("Window", (0.02, 0.02, 0.03, 1.0), 0.3, 0.1)
# Docking ring
mat_dock = make_mat("Docking", (0.5, 0.5, 0.5, 1.0), 0.7, 0.3)
# RCS thruster
mat_rcs = make_mat("RCS", (0.35, 0.35, 0.35, 1.0), 0.6, 0.4)

all_objects = []

def add(op, name, mat, **kw):
    op(**kw)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    all_objects.append(o)
    return o

# ============================================================
# Orion dimensions (real, in meters):
# Crew module: 5.02m diameter, 3.3m tall (cone)
# Service module: 5.0m diameter, 4.78m tall (cylinder)
# Solar panels: 4 x-wing style, each ~7m long
# Total height: ~10m (without panels)
# ============================================================

# Z-axis = up. Capsule on top, engine at bottom.
# NO overlapping geometry — gaps between all parts.

# ============================================================
# ENGINE SECTION (bottom)
# ============================================================

# Main engine nozzle — bell shape
add(bpy.ops.mesh.primitive_cone_add, "Engine_Bell", mat_engine,
    vertices=24, radius1=0.85, radius2=0.35, depth=1.2,
    location=(0, 0, -1.6))

# Engine throat
add(bpy.ops.mesh.primitive_cylinder_add, "Engine_Throat", mat_engine,
    vertices=16, radius=0.35, depth=0.3,
    location=(0, 0, -0.85))

# 4 small ACS thrusters around base
for i in range(4):
    angle = math.radians(i * 90)
    x = 2.1 * math.cos(angle)
    y = 2.1 * math.sin(angle)
    add(bpy.ops.mesh.primitive_cone_add, f"ACS_Thruster_{i}", mat_rcs,
        vertices=8, radius1=0.12, radius2=0.06, depth=0.25,
        location=(x, y, -0.9))

# ============================================================
# SERVICE MODULE (ESM) — European Service Module
# ============================================================

# Main body — cylinder
add(bpy.ops.mesh.primitive_cylinder_add, "ESM_Body", mat_silver,
    vertices=32, radius=2.3, depth=4.0,
    location=(0, 0, 1.3))

# Gold MLI thermal blanket — upper section (not overlapping, slightly narrower top ring)
add(bpy.ops.mesh.primitive_cylinder_add, "ESM_Gold_Upper", mat_gold,
    vertices=32, radius=2.32, depth=0.8,
    location=(0, 0, 2.7))

# Gold MLI — lower section
add(bpy.ops.mesh.primitive_cylinder_add, "ESM_Gold_Lower", mat_gold,
    vertices=32, radius=2.32, depth=0.6,
    location=(0, 0, 0.0))

# Bottom plate
add(bpy.ops.mesh.primitive_cylinder_add, "ESM_Bottom", mat_silver,
    vertices=32, radius=2.3, depth=0.1,
    location=(0, 0, -0.65))

# Radiator panels (2, on opposite sides)
for i in range(2):
    angle = math.radians(i * 180 + 90)
    x = 2.45 * math.cos(angle)
    y = 2.45 * math.sin(angle)
    p = add(bpy.ops.mesh.primitive_cube_add, f"Radiator_{i}", mat_silver,
        size=1, location=(x, y, 1.5))
    p.scale = (0.02, 1.0, 1.8)
    p.rotation_euler = (0, 0, angle)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# ============================================================
# SPACECRAFT ADAPTER
# ============================================================

add(bpy.ops.mesh.primitive_cylinder_add, "Adapter", mat_silver,
    vertices=32, radius=2.5, depth=0.35,
    location=(0, 0, 3.5))

# ============================================================
# HEAT SHIELD
# ============================================================

add(bpy.ops.mesh.primitive_cylinder_add, "Heat_Shield", mat_heatshield,
    vertices=32, radius=2.51, depth=0.2,
    location=(0, 0, 3.8))

# ============================================================
# CREW MODULE (capsule)
# ============================================================

# Main cone body — 2 sections for color variation
# Lower section (wider)
add(bpy.ops.mesh.primitive_cone_add, "Capsule_Lower", mat_capsule,
    vertices=32, radius1=2.5, radius2=1.9, depth=1.5,
    location=(0, 0, 4.7))

# Upper section (narrower)
add(bpy.ops.mesh.primitive_cone_add, "Capsule_Upper", mat_capsule,
    vertices=32, radius1=1.9, radius2=1.2, depth=1.8,
    location=(0, 0, 6.35))

# Windows — 2 triangular forward windows
for i, angle in enumerate([0.4, -0.4]):
    x = 1.55 * math.cos(angle)
    y = 1.55 * math.sin(angle)
    w = add(bpy.ops.mesh.primitive_cube_add, f"Window_Fwd_{i}", mat_window,
        size=1, location=(x, y, 6.8))
    w.scale = (0.15, 0.12, 0.22)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# Windows — 2 side rendezvous windows
for i, angle in enumerate([2.3, -2.3]):
    x = 1.75 * math.cos(angle)
    y = 1.75 * math.sin(angle)
    w = add(bpy.ops.mesh.primitive_cylinder_add, f"Window_Side_{i}", mat_window,
        vertices=12, radius=0.1, depth=0.05,
        location=(x, y, 5.5))
    w.rotation_euler = (0, math.pi/2, angle)

# ============================================================
# FORWARD BAY COVER & DOCKING
# ============================================================

# Forward bay cover
add(bpy.ops.mesh.primitive_cone_add, "Forward_Bay", mat_forward,
    vertices=32, radius1=1.2, radius2=0.5, depth=0.7,
    location=(0, 0, 7.6))

# Docking mechanism housing
add(bpy.ops.mesh.primitive_cylinder_add, "Dock_Housing", mat_dock,
    vertices=20, radius=0.5, depth=0.25,
    location=(0, 0, 8.1))

# Docking ring
add(bpy.ops.mesh.primitive_torus_add, "Dock_Ring", mat_dock,
    major_radius=0.42, minor_radius=0.04,
    major_segments=24, minor_segments=8,
    location=(0, 0, 8.3))

# ============================================================
# SOLAR PANELS — 4 panels in X-wing configuration
# ============================================================

panel_length = 7.0
panel_width = 2.0

for i in range(4):
    angle = math.radians(i * 90 + 45)
    z_height = 1.3  # centered on ESM

    # Deployment arm
    arm_start = 2.5
    arm_length = 0.8
    arm_cx = (arm_start + arm_length / 2) * math.cos(angle)
    arm_cy = (arm_start + arm_length / 2) * math.sin(angle)
    arm = add(bpy.ops.mesh.primitive_cylinder_add, f"Arm_{i}", mat_panel_frame,
        vertices=8, radius=0.05, depth=arm_length,
        location=(arm_cx, arm_cy, z_height))
    arm.rotation_euler = (0, math.pi/2, angle)

    # Hinge joint
    hinge_dist = arm_start + arm_length
    hx = hinge_dist * math.cos(angle)
    hy = hinge_dist * math.sin(angle)
    add(bpy.ops.mesh.primitive_cube_add, f"Hinge_{i}", mat_panel_frame,
        size=0.15, location=(hx, hy, z_height))

    # Panel — 3 segments with thin gaps (frame visible between)
    seg_length = (panel_length - 0.1) / 3
    for s in range(3):
        seg_start = hinge_dist + 0.1 + s * (seg_length + 0.05)
        seg_cx = (seg_start + seg_length / 2) * math.cos(angle)
        seg_cy = (seg_start + seg_length / 2) * math.sin(angle)
        p = add(bpy.ops.mesh.primitive_cube_add, f"Panel_{i}_Seg_{s}", mat_solar,
            size=1, location=(seg_cx, seg_cy, z_height))
        p.scale = (seg_length / 2, panel_width / 2, 0.02)
        p.rotation_euler = (0, 0, angle)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Panel frame bars (2 long bars along the panel)
    for side in [-1, 1]:
        bar_start = hinge_dist + 0.05
        bar_cx = (bar_start + panel_length / 2) * math.cos(angle) + side * (panel_width/2 - 0.05) * math.cos(angle + math.pi/2)
        bar_cy = (bar_start + panel_length / 2) * math.sin(angle) + side * (panel_width/2 - 0.05) * math.sin(angle + math.pi/2)
        bar = add(bpy.ops.mesh.primitive_cylinder_add, f"Bar_{i}_{side}", mat_panel_frame,
            vertices=6, radius=0.025, depth=panel_length,
            location=(bar_cx, bar_cy, z_height))
        bar.rotation_euler = (0, math.pi/2, angle)

# ============================================================
# 4 RCS thruster pods on capsule
# ============================================================

for i in range(4):
    angle = math.radians(i * 90 + 22.5)
    x = 2.2 * math.cos(angle)
    y = 2.2 * math.sin(angle)
    add(bpy.ops.mesh.primitive_cube_add, f"RCS_Pod_{i}", mat_rcs,
        size=0.2, location=(x, y, 5.0))

# ============================================================
# JOIN, CLEAN, EXPORT
# ============================================================

bpy.ops.object.select_all(action='DESELECT')
for obj in all_objects:
    if obj and obj.name in bpy.data.objects:
        obj.select_set(True)
bpy.context.view_layer.objects.active = all_objects[0]
bpy.ops.object.join()

# Clean geometry
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.001)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

# Center origin
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

# Smooth shading for nicer look
bpy.ops.object.shade_smooth()

# Export
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
)

print(f"SUCCESS: Detailed Orion model exported to {out_path}")
