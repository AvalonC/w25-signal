"""Assemble evaluated, millimetre-scale flat jewelry using rigid joints only."""
import math
from mathutils import Vector, Matrix


def bounds(objects):
    points = [v.co for o in objects for v in o.data.vertices]
    return (Vector([min(p[i] for p in points) for i in range(3)]),
            Vector([max(p[i] for p in points) for i in range(3)]))


def assemble_ring(objects):
    groups = {}
    for obj in objects:
        name = obj.name
        if name.startswith(('Extension', 'Fan charm', 'Terminal jump ring')):
            key = 'Tail assembly'
        elif name.startswith('Chain gap'):
            key = name
        else:
            key = name.split(' · ')[0]
        groups.setdefault(key, []).append(obj)

    terminal = next(o for o in objects if o.name == 'Terminal jump ring')
    a, b = bounds([terminal]); terminal_x = (a.x + b.x) / 2
    clasp = next(o for o in objects if o.name == 'Lobster clasp · hollow teardrop shell')
    # Close the terminal ring through the rounded nose of the clasp. Using the
    # fan's outer bounds for circumference leaves a gap at the fastening.
    a, _ = bounds([clasp]); clasp_joint_x = a.x + .65
    circumference = terminal_x - clasp_joint_x
    radius = circumference / math.tau
    center_x = (terminal_x + clasp_joint_x) / 2
    max_edge_error = 0.0
    frames = {}
    for key, group in groups.items():
        a, b = bounds(group)
        x = terminal_x if key == 'Tail assembly' else (a.x + b.x) / 2
        pivot = Vector((x, 0, 1.25))
        theta = (x - center_x) / radius
        tangent = Vector((-math.cos(theta), -math.sin(theta), 0))
        outward = Vector((-math.sin(theta), math.cos(theta), 0))
        # 90-degree roll about the chain tangent: source +Z (stone crown)
        # faces radially outward, source -Y (extension) points down.
        # Clockwise when viewed along the chain toward increasing source X.
        rotation = Matrix((tangent, Vector((0, 0, 1)), outward)).transposed()
        target = outward * radius
        assert abs(rotation.determinant() - 1) < 1e-6
        frames[key] = dict(outward=list(outward), parts=[o.name for o in group])
        for obj in group:
            mesh = obj.data
            before = [v.co.copy() for v in mesh.vertices]
            for v, p in zip(mesh.vertices, before):
                v.co = (target + rotation @ (p - pivot)) * .001
            # Verify actual edge lengths after baking, not just polygon counts.
            for edge in mesh.edges:
                i, j = edge.vertices
                error = abs((before[i] - before[j]).length -
                            (mesh.vertices[i].co - mesh.vertices[j].co).length * 1000)
                max_edge_error = max(max_edge_error, error)
            mesh.update()
    assert max_edge_error < .0001, ('Non-rigid geometry change', max_edge_error)
    normal = frames['Pink four-point star']['outward']
    report = dict(method='rigid-components', rollDegrees=90, gemstoneFacing='outward',
                  sourceUnits='millimeters', maxEdgeLengthErrorMm=max_edge_error,
                  tailParts=frames['Tail assembly']['parts'], groups=frames)
    return radius, report, [normal[0], normal[2], -normal[1]]
