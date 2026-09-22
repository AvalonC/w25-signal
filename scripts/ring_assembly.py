"""Assemble evaluated, millimetre-scale flat jewelry using rigid joints only."""
import math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree


def bounds(objects):
    points = [v.co for o in objects for v in o.data.vertices]
    return (Vector([min(p[i] for p in points) for i in range(3)]),
            Vector([max(p[i] for p in points) for i in range(3)]))


def close_clasp(objects, outward, radius):
    """Thread the rigid clasp body through the terminal ring at right angles.

    The separately modelled swivel bail keeps its chain-side orientation. The
    shell, gate, pivot, seam and lever turn together, so the factory gate remains
    shut and the tail and all stone stations retain their original positions.
    """
    terminal = next(o for o in objects if o.name == 'Terminal jump ring')
    clasp = [o for o in objects if o.name.startswith('Lobster clasp')
             and not o.name.endswith('terminal bail')]
    outward = Vector(outward)
    tangent = Vector((-outward.y, outward.x, 0))
    pivot = outward * radius * .001
    rotation = Matrix.Rotation(math.pi / 2, 3, tangent)
    for obj in clasp:
        for v in obj.data.vertices:
            v.co = pivot + rotation @ (v.co - pivot)
        obj.data.update()

    def tree(obj):
        return BVHTree.FromPolygons([v.co for v in obj.data.vertices],
                                   [list(p.vertices) for p in obj.data.polygons])

    terminal_tree = tree(terminal)
    checks = []
    for obj in clasp:
        other = tree(obj)
        intersections = len(terminal_tree.overlap(other))
        # Check both vertex-to-surface directions; a one-way bound misses the
        # thin terminal ring approaching a broad clasp face.
        clearance = min(
            min(terminal_tree.find_nearest(v.co)[3] for v in obj.data.vertices),
            min(other.find_nearest(v.co)[3] for v in terminal.data.vertices)) * 1000
        assert intersections == 0, ('Clasp intersects terminal ring', obj.name, intersections)
        assert clearance > .02, ('Clasp clearance too small', obj.name, clearance)
        checks.append(dict(part=obj.name, triangleIntersections=intersections,
                           clearanceMethod='bidirectional vertex-to-surface sampling',
                           minimumSurfaceClearanceMm=clearance))

    # The terminal centreline crosses the clasp's middle plane twice. Exactly
    # one crossing must be enclosed by the actual shell aperture. This proves
    # interlocking rather than relying on a visually overlapping silhouette.
    a, b = bounds([terminal]); center = (a + b) / 2
    outer_radius = (b.x - a.x) / 2
    inner_radius = min(math.hypot(v.co.x - center.x, v.co.z - center.z)
                       for v in terminal.data.vertices)
    ring_radius = (outer_radius + inner_radius) / 2
    shell = next(o for o in clasp if o.name.endswith('hollow teardrop shell'))
    shell_tree = tree(shell)
    crossings = []
    for side in [-1, 1]:
        point = center + Vector((side * ring_radius, 0, 0))
        enclosed = all(shell_tree.ray_cast(point, Vector((math.cos(i * math.tau / 32),
                       math.sin(i * math.tau / 32), 0)), .012)[0] is not None
                       for i in range(32))
        crossings.append(dict(positionMeters=list(point), insideClaspAperture=enclosed))
    assert sum(p['insideClaspAperture'] for p in crossings) == 1, ('Clasp is not linked', crossings)
    return dict(bodyRollDegrees=90, bail='original swivel joint', gate='closed; rigid with body',
                terminalRingPlane='XZ', claspAperturePlane='XY', apertureCrossings=1,
                terminalCentrelineCrossings=crossings,
                minimumSurfaceClearanceMm=min(c['minimumSurfaceClearanceMm'] for c in checks),
                checks=checks)


def assemble_ring(objects):
    original = {obj.name: [v.co.copy() for v in obj.data.vertices] for obj in objects}
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
    clasp = close_clasp(objects, frames['Lobster clasp']['outward'], radius)
    for obj in objects:
        before = original[obj.name]
        for edge in obj.data.edges:
            i, j = edge.vertices
            max_edge_error = max(max_edge_error, abs((before[i] - before[j]).length -
                (obj.data.vertices[i].co - obj.data.vertices[j].co).length * 1000))
    assert max_edge_error < .0001, ('Non-rigid geometry change', max_edge_error)
    normal = frames['Pink four-point star']['outward']
    report = dict(method='rigid-components', rollDegrees=90, gemstoneFacing='outward',
                  sourceUnits='millimeters', maxEdgeLengthErrorMm=max_edge_error,
                  tailParts=frames['Tail assembly']['parts'], groups=frames, clasp=clasp)
    return radius, report, [normal[0], normal[2], -normal[1]]
