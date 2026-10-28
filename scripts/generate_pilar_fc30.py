#!/usr/bin/env python3
"""Generate and check a conforming five-block HEX8 pier mesh for Civil classic.

Requires Python 3, numpy and matplotlib. No MIDAS installation is required to
generate files; final import compatibility must be checked in MIDAS Civil.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path

import numpy as np

RADIUS = 3.75
HEIGHT = 8.0
JOINT = 4.0
HALF_SQUARE = 0.45 * RADIUS
N_SIDE = 16
N_RADIAL = 8
N_Z = 32
FC_MPA = 30.0
E_KN_M2 = 4700.0 * math.sqrt(FC_MPA) * 1000.0
SIGNS = np.array([[-1,-1,-1], [1,-1,-1], [1,1,-1], [-1,1,-1],
                  [-1,-1,1], [1,-1,1], [1,1,1], [-1,1,1]], dtype=float)
FACES = np.array([[0,3,2,1], [4,5,6,7], [0,1,5,4],
                  [1,2,6,5], [2,3,7,6], [3,0,4,7]])
EDGES = np.array([[0,1], [1,2], [2,3], [3,0], [4,5], [5,6],
                  [6,7], [7,4], [0,4], [1,5], [2,6], [3,7]])


def make_mesh():
    xy, lookup, quads = [], {}, []

    def node(p):
        key = tuple(round(float(v), 12) for v in p)
        if key not in lookup:
            lookup[key] = len(xy)
            xy.append(p)
        return lookup[key]

    a = HALF_SQUARE
    grid = [[node((-a + 2*a*i/N_SIDE, -a + 2*a*j/N_SIDE))
             for i in range(N_SIDE + 1)] for j in range(N_SIDE + 1)]
    for j in range(N_SIDE):
        for i in range(N_SIDE):
            quads.append([grid[j][i], grid[j][i+1],
                          grid[j+1][i+1], grid[j+1][i]])
    for side in range(4):
        rows = []
        for radial in range(N_RADIAL + 1):
            row = []
            t = radial / N_RADIAL
            for i in range(N_SIDE + 1):
                u = -a + 2*a*i/N_SIDE
                q = np.array([(u, -a), (a, u), (-u, a), (-a, -u)][side])
                b = RADIUS * q / np.linalg.norm(q)
                row.append(node((1-t)*q + t*b))
            rows.append(row)
        for j in range(N_RADIAL):
            for i in range(N_SIDE):
                quads.append([rows[j][i], rows[j+1][i],
                              rows[j+1][i+1], rows[j][i+1]])
    xy, quads = np.asarray(xy), np.asarray(quads, dtype=int)
    # Put the 64 perimeter nodes first on every plane, keeping group ranges
    # compact without relying on long MCT lines or continuation syntax.
    boundary = np.flatnonzero(np.isclose(np.linalg.norm(xy, axis=1), RADIUS))
    boundary = boundary[np.argsort(np.arctan2(xy[boundary,1], xy[boundary,0]))]
    interior = np.setdiff1d(np.arange(len(xy)), boundary)
    order = np.concatenate((boundary, interior))
    inverse = np.empty(len(xy), dtype=int)
    inverse[order] = np.arange(len(xy))
    xy, quads = xy[order], inverse[quads]
    n = len(xy)
    points = np.concatenate([np.column_stack((xy, np.full(n, k*HEIGHT/N_Z)))
                             for k in range(N_Z + 1)])
    cells = np.concatenate([np.column_stack((quads+k*n, quads+(k+1)*n))
                            for k in range(N_Z)])
    # Validate exactly the coordinates that will be serialized in MCT.
    return np.round(points, 10), cells, quads


def ranges(ids):
    values = sorted(set(int(x) for x in ids))
    if not values:
        return ''
    spans, start, end = [], values[0], values[0]
    for x in values[1:]:
        if x == end + 1:
            end = x
        else:
            spans.append(str(start) if start == end else f'{start}to{end}')
            start = end = x
    spans.append(str(start) if start == end else f'{start}to{end}')
    return ' '.join(spans)


def write_mct(path, points, cells):
    lines = [
        '; MIDAS Civil classic - solid pier for subsequent hydration heat setup',
        '; Units: kN, m, kJ, degC. Linear 8-node SOLID elements.',
        '; Diameter=7.5 m; existing concrete z=0..4 m; new concrete z=4..8 m.',
        '; Shared interface nodes assume perfect bond and thermal contact.',
        '; fc=30 MPa; normal-weight E=4700*sqrt(fc)=25742.960202 MPa.',
        '; Assumed nu=0.20; weight density=24 kN/m3; alpha=1e-5 /degC.',
        '; NOT A COMPLETE HYDRATION ANALYSIS: SPHEAT=HEATCO=0 (not assigned).',
        '; No supports, convection, initial temperatures, stages or heat law set.',
        '; MATERIAL user elastic data do not define a nonlinear strength law.',
        '', '*UNIT', 'KN, M, KJ, C', '', '*MATERIAL',
        '; iMAT,TYPE,MNAME,SPHEAT,HEATCO,PLAST,TUNIT,bMASS,DAMPRATIO,DATA1',
        '; DATA1 = 2,ELAST,POISN,THERMAL,DEN,MASS',
        f'1, CONC, FC30_OLD, 0, 0, , C, NO, 0.05, 2, {E_KN_M2:.6f}, 0.2, 1e-5, 24, 0',
        f'2, CONC, FC30_NEW, 0, 0, , C, NO, 0.05, 2, {E_KN_M2:.6f}, 0.2, 1e-5, 24, 0',
        '', '*MATL-COLOR',
        '; iMAT,W_R,W_G,W_B,HF_R,HF_G,HF_B,HE_R,HE_G,HE_B,bBLEND,FACT',
        '1, 90, 100, 110, 180, 186, 193, 48, 60, 72, NO, 0.5',
        '2, 160, 90, 35, 220, 139, 61, 48, 60, 72, NO, 0.5',
        '', '*NODE', '; iNO, X, Y, Z',
    ]
    lines += [f'{i}, {x:.10f}, {y:.10f}, {z:.10f}'
              for i, (x,y,z) in enumerate(points, 1)]
    lines += ['', '*ELEMENT', '; iEL, TYPE, iMAT, iPRO, N1,N2,N3,N4,N5,N6,N7,N8']
    for i, c in enumerate(cells, 1):
        material = 1 if points[c, 2].mean() < JOINT else 2
        lines.append(f'{i}, SOLID, {material}, 0, ' + ', '.join(str(n+1) for n in c))
    nn = np.arange(1, len(points) + 1)
    ne = np.arange(1, len(cells) + 1)
    z = points[:, 2]
    old_elements = points[cells, 2].mean(axis=1) < JOINT
    groups = [
        ('STAGE1_OLD', nn[z <= JOINT], ne[old_elements]),
        ('STAGE2_NEW', nn[z >= JOINT], ne[~old_elements]),
        ('JOINT_Z4', nn[np.isclose(z, JOINT)], []),
        ('BASE_Z0', nn[np.isclose(z, 0)], []),
        ('TOP_Z8', nn[np.isclose(z, HEIGHT)], []),
        ('OUTER_SIDE', nn[np.isclose(np.linalg.norm(points[:, :2], axis=1), RADIUS)], []),
        ('AXIS_NODES', nn[np.isclose(np.linalg.norm(points[:, :2], axis=1), 0)], []),
    ]
    lines += ['', '*GROUP', '; NAME, NODE_LIST, ELEM_LIST, PLANE_TYPE']
    for name, nodes, elements in groups:
        lines.append(f'{name}, {ranges(nodes)}, {ranges(elements)}, 0')
    lines += ['', '*ENDDATA', '']
    assert max(map(len, lines)) <= 512, 'Keep MCT lines short for classic import'
    path.write_text('\n'.join(lines), encoding='ascii')


def read_mct(path):
    """Read back actual MCT node/element tables; catch serialization errors."""
    points, cells, materials, section = [], [], [], ''
    for line in path.read_text(encoding='ascii').splitlines():
        line = line.strip()
        if not line or line.startswith(';'):
            continue
        if line.startswith('*'):
            section = line
            continue
        fields = [x.strip() for x in line.split(',')]
        if section == '*NODE':
            assert int(fields[0]) == len(points) + 1
            points.append([float(x) for x in fields[1:4]])
        elif section == '*ELEMENT':
            assert fields[1] == 'SOLID' and len(fields) == 12
            assert int(fields[0]) == len(cells) + 1
            materials.append(int(fields[2]))
            cells.append([int(x)-1 for x in fields[4:12]])
    return np.array(points), np.array(cells), np.array(materials)


def validate(points, cells, materials):
    assert points.shape == (26433, 3) and cells.shape == (24576, 8)
    assert np.isfinite(points).all()
    assert len(np.unique(points, axis=0)) == len(points), 'Duplicate nodes'
    assert cells.min() == 0 and cells.max() == len(points)-1
    assert len(np.unique(cells)) == len(points), 'Orphan nodes'
    assert len(np.unique(np.sort(cells, axis=1), axis=0)) == len(cells)
    assert all(len(set(c)) == 8 for c in cells), 'Degenerate connectivity'
    assert np.allclose(points.min(axis=0), [-RADIUS,-RADIUS,0])
    assert np.allclose(points.max(axis=0), [RADIUS,RADIUS,HEIGHT])
    xyz = points[cells]
    min_det, min_scaled, volume = math.inf, math.inf, 0.0
    gauss = SIGNS / math.sqrt(3)
    for index, p in enumerate(np.concatenate((SIGNS, gauss, [[0,0,0]]))):
        d = np.empty((8,3))
        for dim in range(3):
            other = [j for j in range(3) if j != dim]
            d[:,dim] = SIGNS[:,dim]/8 * np.prod(1+SIGNS[:,other]*p[other], axis=1)
        jac = np.einsum('eni,nj->eij', xyz, d)
        det = np.linalg.det(jac)
        scaled = det / np.prod(np.linalg.norm(jac, axis=1), axis=1)
        min_det = min(min_det, float(det.min()))
        min_scaled = min(min_scaled, float(scaled.min()))
        if 8 <= index < 16:
            volume += float(det.sum())
    assert min_det > 0, 'Inverted element'
    lengths = np.linalg.norm(xyz[:,EDGES[:,1],:] - xyz[:,EDGES[:,0],:], axis=2)
    assert min_scaled > 0.70
    assert lengths.max() < 0.5
    aspect = lengths.max(axis=1)/lengths.min(axis=1)
    faces = Counter(tuple(sorted(int(n) for n in f)) for c in cells for f in c[FACES])
    assert max(faces.values()) == 2, 'Non-manifold face'
    boundary_faces = sum(v == 1 for v in faces.values())
    assert boundary_faces == 3584
    # The only exposed faces must be at bottom, top or the cylindrical skin.
    radius = np.linalg.norm(points[:,:2], axis=1)
    for face, count in faces.items():
        if count == 1:
            zz = points[list(face),2]
            assert (np.allclose(zz, 0) or np.allclose(zz, HEIGHT)
                    or np.allclose(radius[list(face)], RADIUS)), 'Internal crack'
    old, new = cells[materials == 1], cells[materials == 2]
    assert len(old) == len(new) == 12288
    assert points[old,2].max() == JOINT and points[new,2].min() == JOINT
    shared = set(old.ravel()).intersection(new.ravel())
    assert len(shared) == 801
    assert np.allclose(points[list(shared),2], JOINT)
    interface_faces = sum(np.allclose(points[list(f),2], JOINT) for f in faces)
    assert interface_faces == 768
    exact_volume = math.pi*RADIUS**2*HEIGHT
    return {
        'validation': 'PASS - standalone geometry/connectivity checks; not a MIDAS import or solver run',
        'nodes': len(points), 'hex8_elements': len(cells),
        'elements_stage1': len(old), 'elements_stage2': len(new),
        'nodes_per_horizontal_plane': 801, 'shared_interface_nodes': len(shared),
        'shared_interface_faces': interface_faces, 'horizontal_layers': N_Z,
        'vertical_step_m': HEIGHT/N_Z, 'circumference_divisions': N_SIDE*4,
        'min_edge_m': float(lengths.min()), 'max_edge_m': float(lengths.max()),
        'max_element_edge_ratio': float(aspect.max()),
        'minimum_jacobian_determinant_m3': min_det,
        'minimum_scaled_jacobian_corners_gauss_center': min_scaled,
        'duplicate_nodes': 0, 'duplicate_elements': 0, 'orphan_nodes': 0,
        'exposed_faces': boundary_faces, 'internal_cracks': 0,
        'mesh_volume_m3': volume, 'exact_cylinder_volume_m3': exact_volume,
        'polygon_volume_deficit_percent': 100*(exact_volume-volume)/exact_volume,
        'fc_MPa': FC_MPA, 'E_MPa_assumed_normal_weight': E_KN_M2/1000,
        'thermal_analysis_configured': False,
        'midas_import_tested': False,
    }


def write_vtk(path, points, cells, materials):
    with path.open('w', encoding='ascii') as f:
        f.write('# vtk DataFile Version 3.0\nFC30 pier HEX8 mesh, SI coordinates\nASCII\nDATASET UNSTRUCTURED_GRID\n')
        f.write(f'POINTS {len(points)} double\n')
        for p in points:
            f.write(' '.join(f'{v:.10f}' for v in p) + '\n')
        f.write(f'CELLS {len(cells)} {9*len(cells)}\n')
        for c in cells:
            f.write('8 ' + ' '.join(str(n) for n in c) + '\n')
        f.write(f'CELL_TYPES {len(cells)}\n' + '12\n'*len(cells))
        f.write(f'CELL_DATA {len(cells)}\nSCALARS casting_stage int 1\nLOOKUP_TABLE default\n')
        f.write('\n'.join(str(n) for n in materials)+'\n')


def preview(path, points, cells, quads):
    import os
    os.environ.setdefault('MPLCONFIGDIR', '/tmp/pilar-matplotlib')
    os.environ.setdefault('XDG_CACHE_HOME', '/tmp/pilar-cache')
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.collections import PolyCollection
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    fig = plt.figure(figsize=(14,9), facecolor='white')
    ax = fig.add_subplot(121, projection='3d')
    face_map = {}
    for c in cells:
        for f in c[FACES]:
            key = tuple(sorted(f))
            face_map[key] = None if key in face_map else f
    external = [points[f] for f in face_map.values() if f is not None]
    colors = ['#dc8b3d' if f[:,2].mean()>JOINT else '#b4bac1' for f in external]
    ax.add_collection3d(Poly3DCollection(external, facecolors=colors,
        edgecolors='#303c48', linewidths=.25, alpha=1))
    ax.set(xlim=(-4,4), ylim=(-4,4), zlim=(0,8), xlabel='X (m)', ylabel='Y (m)', zlabel='Z (m)')
    ax.set_box_aspect((7.5,7.5,8))
    ax.view_init(elev=24, azim=-55)
    ax.set_title('SOLID HEX8 | 2 tahap pengecoran', fontsize=13, pad=18)
    ax.text2D(.02,.94,'Oranye: beton baru, z = 4-8 m\nAbu-abu: beton lama, z = 0-4 m', transform=ax.transAxes, fontsize=10)
    plan = fig.add_subplot(122)
    xy = points[:801,:2]
    plan.add_collection(PolyCollection(xy[quads], facecolors='#e8eef4',
                                     edgecolors='#243e54', linewidths=.5))
    plan.set(xlim=(-4.2,4.2), ylim=(-4.2,4.2), xlabel='X (m)', ylabel='Y (m)')
    plan.set_aspect('equal')
    plan.set_title('Tampak atas: mesh 5 blok tanpa elemen pusat degenerat', fontsize=11)
    plan.annotate('', xy=(-RADIUS,-4), xytext=(RADIUS,-4),
                  arrowprops={'arrowstyle':'<->', 'color':'#243e54'})
    plan.text(0,-3.92,'Diameter 7,5 m',ha='center',va='bottom',fontsize=11)
    fig.suptitle("PILAR f'c 30 MPa | DIAMETER 7,5 m | TINGGI 8 m", fontsize=17, weight='bold', y=.96)
    fig.text(.5,.09,'26.433 node | 24.576 solid HEX8 | 32 lapis @ 0,25 m | 801 node bersama pada sambungan +4 m',
             ha='center',fontsize=11)
    fig.text(.5,.05,'Mesh geometri aktual dari file MCT. Warna menunjukkan tahap, bukan hasil analisis suhu.',
             ha='center',fontsize=10,color='#505d68')
    fig.subplots_adjust(left=.03,right=.97,bottom=.15,top=.86,wspace=.16)
    fig.savefig(path,dpi=180)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path,
        default=Path(__file__).resolve().parents[1]/'output'/'pilar_fc30')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    points, cells, quads = make_mesh()
    mct = args.out/'PILAR_D7500_H8000_FC30_HEX8.mct'
    write_mct(mct, points, cells)
    parsed_points, parsed_cells, materials = read_mct(mct)
    assert np.array_equal(points, parsed_points) and np.array_equal(cells, parsed_cells)
    report = validate(parsed_points, parsed_cells, materials)
    (args.out/'mesh_quality.json').write_text(json.dumps(report,indent=2)+'\n')
    write_vtk(args.out/'PILAR_FC30_HEX8.vtk', points, cells, materials)
    preview(args.out/'PREVIEW_MESH.png', points, cells, quads)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
