#!/usr/bin/env python3
"""Build source-backed classic Civil hydration MCT and audit staged boundaries.

Generate from a conforming five-block mesh. This checks inputs and topology;
it does not replace an actual MIDAS import, thermal solve or convergence study.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import csv
import json
import math
from pathlib import Path
import sys

import numpy as np

from generate_pilar_fc30 import make_mesh, ranges, read_mct, validate

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'output'/'pilar_fc30_hydration'
# Local face indices follow the classic HEX8 MCT convention.
FACES = [[0,1,2,3], [4,5,6,7], [0,1,5,4], [1,2,6,5], [2,3,7,6], [3,0,4,7]]


def write_csv(path, fields, rows):
    with path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def split_ranges(ids, max_chars=320):
    chunks, current = [], ''
    for span in ranges(ids).split():
        trial = (current+' '+span).strip()
        if len(trial) > max_chars:
            chunks.append(current)
            current = span
        else:
            current = trial
    if current:
        chunks.append(current)
    return chunks


def steps_until(end, step, start=0):
    count = (end-start)/step
    if abs(count-round(count)) > 1e-8:
        raise ValueError(f'Interval {start}..{end} must divide into step {step}')
    return [round(start+step*i, 8) for i in range(1,round(count)+1)]


def main():
    config = Path(sys.argv[1]) if len(sys.argv)>1 else OUT/'parameters.json'
    p = json.loads(config.read_text())
    assert p['units'] == {'force':'N','length':'M','heat':'KJ','temperature':'C','hydration_time':'hour','mass':'kg'}
    assert p['geometry'] == {'diameter_m':7.5,'height_old_m':4.0,'height_new_m':4.0}
    assert p['base_thermal_condition'] == 'PRESCRIBED_TEMPERATURE_ASSUMED_HEAT_RESERVOIR'
    assert p['mechanical_restraint'] == 'BASE_TRANSLATIONS_FIXED_ILLUSTRATIVE_ONLY'
    m, t, heat, hc, s = [p[k] for k in ['material','temperatures','heat_source','convection','schedule']]
    assert m['density_kg_m3']>0 and m['specific_heat_kJ_kg_C']>0 and m['conductivity_W_m_C']>0
    assert heat['K_C']>0 and heat['alpha_per_day']>0 and heat['equivalent_age'] is False
    assert all(value>0 for value in hc.values())
    assert 0<s['strip_formwork_at_new_age_hours']<s['end_top_curing_at_new_age_hours']<s['end_analysis_at_new_age_hours']
    assert s['strip_formwork_at_new_age_hours']>=24 and s['old_initialization_hours']>0
    points, cells, _ = make_mesh()
    ids = np.arange(1,len(cells)+1)
    old = points[cells,2].mean(axis=1)<4
    mats = np.where(old,1,2)
    mesh_report = validate(points,cells,mats)
    # The mesh validator knows only geometry, not the subsequently added cards.
    mesh_report.pop('thermal_analysis_configured', None)
    mesh_report.pop('midas_import_tested', None)
    nodes = np.arange(1,len(points)+1)
    base_nodes = nodes[np.isclose(points[:,2],0)]
    groups = {'STAGE1_OLD': (nodes[points[:,2]<=4],ids[old]),
              'STAGE2_NEW': (nodes[points[:,2]>=4],ids[~old]),
              'JOINT_Z4': (nodes[np.isclose(points[:,2],4)],[])}
    face_count = Counter(tuple(sorted(c[f])) for c in cells for f in FACES)
    selected = defaultdict(list)
    face_info = {}
    for eid,c in enumerate(cells,1):
        for face_no,f in enumerate(FACES,1):
            coords = points[c[f]]
            key = tuple(sorted(c[f]))
            exterior = face_count[key]==1
            zz = coords[:,2]
            rr = np.linalg.norm(coords[:,:2],axis=1)
            name = None
            if exterior and np.allclose(zz,0):
                name='BASE'
            elif exterior and np.allclose(zz,8):
                name='NEW_TOP'
            elif exterior and np.allclose(rr,3.75):
                name='OLD_SIDE' if zz.mean()<4 else 'NEW_SIDE'
            elif np.allclose(zz,4) and points[c,2].mean()<4:
                name='OLD_TOP_PREPOUR'
            if name:
                selected[name].append((eid,face_no))
                # Area of the two triangles; all faces are planar quads.
                area = sum(np.linalg.norm(np.cross(coords[i]-coords[0],coords[j]-coords[0]))/2
                           for i,j in [(1,2),(2,3)])
                face_info[(eid,face_no)]={'key':key,'area':float(area),'nodes':c[f]+1}
    assert {name:len(fs) for name,fs in selected.items()} == {'BASE':768,'OLD_SIDE':1024,'OLD_TOP_PREPOUR':768,'NEW_SIDE':1024,'NEW_TOP':768}
    bc = {
        'OLD_SIDE': ('OLD_SIDE','H_OLD_SIDE'),
        'OLD_TOP': ('OLD_TOP_PREPOUR','H_OLD_TOP'),
        'NEW_FORM': ('NEW_SIDE','H_FORM'),
        'NEW_AIR': ('NEW_SIDE','H_NEW_AIR'),
        'TOP_CURE': ('NEW_TOP','H_TOP_CURE'),
        'TOP_AIR': ('NEW_TOP','H_TOP_AIR'),
    }
    hfunc = {'H_OLD_SIDE':hc['old_side_W_m2_C'], 'H_OLD_TOP':hc['old_top_before_pour_W_m2_C'],
             'H_FORM':hc['new_formwork_effective_W_m2_C'], 'H_NEW_AIR':hc['new_side_air_W_m2_C'],
             'H_TOP_CURE':hc['new_top_curing_effective_W_m2_C'], 'H_TOP_AIR':hc['new_top_air_W_m2_C']}
    strip=s['strip_formwork_at_new_age_hours']; cure=s['end_top_curing_at_new_age_hours']; end=s['end_analysis_at_new_age_hours']
    stage_def = [
        {'name':'H0_OLD_INIT','temp':t['old_initial_C'], 'steps':steps_until(s['old_initialization_hours'],s['old_initialization_hours']),
         'ae':['STAGE1_OLD'],'ab':['MECH_BASE','BASE_TEMP','OLD_SIDE','OLD_TOP'],'db':[]},
        {'name':'H1_POUR_FORM','temp':t['new_placing_C'],
         'steps':steps_until(24,s['time_step_0_to_24h'])+steps_until(strip,s['time_step_24h_to_stripping'],24),
         'ae':['STAGE2_NEW'],'ab':['NEW_FORM','TOP_CURE'],'db':['OLD_TOP']},
        {'name':'H2_STRIP_FORM','temp':None,'steps':steps_until(cure-strip,s['time_step_stripping_to_curing_end']),
         'ae':[],'ab':['NEW_AIR'],'db':['NEW_FORM']},
        {'name':'H3_END_CURING','temp':None,'steps':steps_until(end-cure,s['time_step_curing_end_to_analysis_end']),
         'ae':[],'ab':['TOP_AIR'],'db':['TOP_CURE']},
    ]
    # Input-state audit of the actual activation schedule before writing cards.
    active_elems, active_bn, audit, elapsed = set(),set(),[],0.0
    for stage in stage_def:
        for name in stage['ae']:
            new=set(groups[name][1]); assert not new&active_elems
            active_elems |= new
        for name in stage['db']:
            assert name in active_bn
            active_bn.remove(name)
        for name in stage['ab']:
            assert name not in active_bn
            active_bn.add(name)
        exposed=Counter(tuple(sorted(cells[e-1][f])) for e in active_elems for f in FACES)
        active_conv={}
        for name in active_bn:
            if name not in bc:
                continue
            for pair in selected[bc[name][0]]:
                assert pair[0] in active_elems
                key=face_info[pair]['key']
                assert exposed[key]==1, 'Convection assigned to an internal/inactive face'
                assert key not in active_conv, 'Double convection on a face'
                active_conv[key]=name
        thermal_base={face_info[pair]['key'] for pair in selected['BASE']}
        assert not thermal_base.intersection(active_conv)
        active_exterior={key for key,value in exposed.items() if value==1}
        assert active_exterior==set(active_conv)|thermal_base, 'Missing exposed face BC'
        duration=stage['steps'][-1]
        audit.append({'name':stage['name'],'start_global_h':elapsed,'end_global_h':elapsed+duration,
                      'active_elements':len(active_elems),'active_convection_faces':len(active_conv),
                      'active_boundary_groups':sorted(active_bn), 'new_element_groups':stage['ae'],
                      'initial_temperature_override':stage['temp'], 'steps':len(stage['steps']),
                      'joint_convection': 'OLD_TOP' in active_bn})
        elapsed+=duration
    assert len(active_elems)==len(cells) and math.isclose(elapsed,end+s['old_initialization_hours'])
    assert all(not a['joint_convection'] for a in audit[1:])
    # Dense table avoids relying on undocumented units of a built-in alpha.
    curve_time=np.unique(np.concatenate(([0],np.arange(.5,72.001,.5),np.arange(74,end+2,2),[end+48])))
    curve=heat['K_C']*(-np.expm1(-heat['alpha_per_day']*curve_time/24))
    cv=m['density_kg_m3']*m['specific_heat_kJ_kg_C']
    curve_rows=[{'new_age_h':float(x),'adiabatic_rise_C':float(y),'cumulative_heat_kJ_m3':float(y*cv),
                 'instantaneous_heat_kJ_m3_h':float(cv*heat['K_C']*heat['alpha_per_day']/24*math.exp(-heat['alpha_per_day']*x/24))}
                for x,y in zip(curve_time,curve)]
    assert curve[0]==0 and np.all(np.diff(curve)>=0) and curve[-1]<=heat['K_C']
    # No empirical curve copied from a journal: every default is an assumption.
    E=4700*math.sqrt(m['fc_MPa'])*1e6
    lines=['; MIDAS CIVIL CLASSIC - ILLUSTRATIVE HEAT-OF-HYDRATION INPUT',
           '; NOT PROJECT CALIBRATED. N,m,kJ,degC; hydration time HOURS; mass kg.',
           '; Old concrete mature state: initial T assumed, zero residual heat.',
           '; New concrete heats from its activation; never reactivated.',
           '; Initial old state does not reconstruct its >2 month thermal history.',
           '; Base T fixed and base mechanical translations fixed are assumptions.',
           '; No calibrated age-dependent modulus, creep, shrinkage or crack model.',
           '; See README_HYDRATION.md and parameters.json BEFORE running.',
           '*UNIT','N, M, KJ, C','', '*STRUCTYPE',
           '; iSTYP,iMASS,iSMAS,bMASSOFFSET,bSELFWEIGHT,GRAV,TEMPER,bALIGNBEAM,bALIGNSLAB,bROTRIGID',
           f'0, 1, 3, NO, NO, {m["gravity_m_s2"]}, {t["old_initial_C"]}, NO, NO, NO',
           '', '*MATERIAL', '; iMAT,TYPE,MNAME,SPHEAT,HEATCO,PLAST,TUNIT,bMASS,DAMPRATIO,2,E,nu,alpha,DEN,MASS']
    for mid,name in [(1,'FC30_OLD'),(2,'FC30_NEW')]:
        lines.append(f'{mid}, CONC, {name}, {m["specific_heat_kJ_kg_C"]:.9f}, {3.6*m["conductivity_W_m_C"]:.9f}, , C, NO, 0.05, 2, {E:.6f}, {m["poisson"]}, {m["thermal_expansion_per_C"]}, {m["density_kg_m3"]*m["gravity_m_s2"]:.6f}, 0')
    lines+=['','*MATL-COLOR','1, 90, 100, 110, 180, 186, 193, 48, 60, 72, NO, 0.5',
            '2, 160, 90, 35, 220, 139, 61, 48, 60, 72, NO, 0.5','','*NODE']
    lines += [f'{i}, {x:.10f}, {y:.10f}, {z:.10f}' for i,(x,y,z) in enumerate(points,1)]
    lines += ['','*ELEMENT','; iEL,TYPE,iMAT,iPRO,n1,n2,n3,n4,n5,n6,n7,n8']
    lines += [f'{i}, SOLID, {mats[i-1]}, 0, '+', '.join(str(x+1) for x in c) for i,c in enumerate(cells,1)]
    lines+=['','*GROUP','; NAME,NODE_LIST,ELEM_LIST,PLANE_TYPE']
    lines += [f'{name}, {ranges(ns)}, {ranges(es)}, 0' for name,(ns,es) in groups.items()]
    bn_names=['MECH_BASE','BASE_TEMP',*bc]
    lines+=['','*BNDR-GROUP','; NAME,AUTOTYPE']+[f'{name}, 0' for name in bn_names]
    lines+=['','*CONSTRAINT','; NODE_LIST,CONST,GROUP',f'{ranges(base_nodes)}, 111000, MECH_BASE',
            '', '*HYD-PRTEMPER','; NODE_LIST,TEMPERATURE,GROUP',f'{ranges(base_nodes)}, {t["base_C"]}, BASE_TEMP',
            '', '*HYD-HEATSRCF','; FUNC=NAME,TYPE,SCALE,bTEMPER; USER + YES means adiabatic temperature RISE',
            'FUNC=OLD_ZERO, USER, 1, YES', f'0, 0',f'{end+48:.6f}, 0',
            'FUNC=NEW_ADIABATIC, USER, 1, YES']
    lines += [f'{x:.6f}, {y:.9f}' for x,y in zip(curve_time,curve)]
    lines+=['','*HYD-CONVCOEF','; FUNC=NAME,CONST,COEFFICIENT in kJ/(m2.hour.degC)']
    lines += [f'FUNC={name}, CONST, {3.6*h:.9f}' for name,h in hfunc.items()]
    lines+=['','*HYD-AMBTEMPF',f'FUNC=AMBIENT, CONST, {t["ambient_C"]}',
            '', '*HYD-HEATSRC','; ELEM_LIST,FUNCNAME',f'{ranges(ids[old])}, OLD_ZERO',f'{ranges(ids[~old])}, NEW_ADIABATIC',
            '', '*HYD-CONBNDR','; ELEM_LIST,CCFUNC,ATFUNC,FACE,GROUP']
    bc_rows=[]
    for name,(surface,func) in bc.items():
        by_face=defaultdict(list)
        for eid,face in selected[surface]:
            by_face[face].append(eid)
            info=face_info[eid,face]
            bc_rows.append({'boundary_group':name,'element':eid,'local_face':face,
                            'node_ids':' '.join(map(str,info['nodes'])), 'area_m2':info['area'],
                            'coefficient_function':func,'h_W_m2_C':hfunc[func],
                            'h_kJ_m2_h_C':3.6*hfunc[func], 'ambient_C':t['ambient_C']})
        for face,elems in by_face.items():
            for chunk in split_ranges(elems):
                lines.append(f'{chunk}, {func}, AMBIENT, {face}, {name}')
    lines+=['','*HYD-STAGE','; STEP entries are cumulative stage-local times in HOURS, not days.',
            '; No AGE token exists here. Old age is modeled via mature state and zero source.']
    for stage in stage_def:
        initial=stage['temp']
        lines.append(f'NAME={stage["name"]}, '+(f'YES, {initial}' if initial is not None else 'NO, 0'))
        lines.append('STEP='+', '.join(f'{x:g}' for x in stage['steps']))
        for key,field in [('ae','AELEM'),('ab','ABNDR'),('db','DBNDR')]:
            if stage[key]: lines.append(field+'='+', '.join(stage[key]))
    lines+=['','*HYD-CTRL',
            '; bLAST-FINAL,STAGE,CN-FACTOR,INIT-TEMPER,EVAL,bUSEEA,bINCSW,SWF,bCNS,TYPE,CCM,iITER,TOL',
            '; theta=1 backward Euler; equivalent-age/creep/shrinkage/selfweight disabled.',
            '; TYPE=BOTH is the disabled creep/shrinkage type, NOT a thermal/stress selector.',
            f'YES, , 1, {t["old_initial_C"]}, GAUSS, NO, NO, -1, NO, BOTH, 0, 5, 0.001',
            '', '*HYD-NODE','; NAME,iNODE,iCOMP,iType (nodal graph monitors)']
    monitors=[]
    for name,target in [('OLD_CORE_Z2',(0,0,2)),('JOINT_CORE_Z4',(0,0,4)),('NEW_CORE_Z6',(0,0,6)),
                        ('NEW_SIDE_Z6',(3.75,0,6)),('NEW_TOP_Z8',(0,0,8)),('NEW_NEAR_TOP',(0,0,7.75))]:
        node=int(np.argmin(np.linalg.norm(points-np.array(target),axis=1)))
        assert np.allclose(points[node],target)
        lines.append(f'{name}, {node+1}, 3, 0')
        monitors.append({'name':name,'node':node+1,'X_m':points[node,0],'Y_m':points[node,1],'Z_m':points[node,2]})
    lines += ['','*ENDDATA','']
    assert max(map(len,lines))<1024
    path=OUT/'PILAR_FC30_HYDRATION_STAGED_ASSUMED.mct'
    path.write_text('\n'.join(lines),encoding='ascii')
    parsed_points,parsed_cells,parsed_mats=read_mct(path)
    assert np.array_equal(parsed_points,points) and np.array_equal(parsed_cells,cells) and np.array_equal(parsed_mats,mats)
    write_csv(OUT/'convection_faces.csv', list(bc_rows[0]), bc_rows)
    write_csv(OUT/'adiabatic_heat_curve.csv',list(curve_rows[0]),curve_rows)
    write_csv(OUT/'monitor_nodes.csv',list(monitors[0]),monitors)
    stage_rows=[{'stage':a['name'],'global_start_h':a['start_global_h'],'global_end_h':a['end_global_h'],
                 'new_age_start_h':a['start_global_h']-s['old_initialization_hours'],
                 'new_age_end_h':a['end_global_h']-s['old_initialization_hours'],
                 'active_elements':a['active_elements'],'convection_faces':a['active_convection_faces'],
                 'active_boundary_groups':';'.join(a['active_boundary_groups']),
                 'initial_temperature_override_C':a['initial_temperature_override']} for a in audit]
    write_csv(OUT/'staging_schedule.csv',list(stage_rows[0]),stage_rows)
    input_rows=[{'parameter':'specific_heat','physical_value':m['specific_heat_kJ_kg_C'],'physical_unit':'kJ/(kg.C)',
                 'MCT_value':m['specific_heat_kJ_kg_C'],'MCT_unit':'kJ/(kg.C)'},
                {'parameter':'conductivity','physical_value':m['conductivity_W_m_C'],'physical_unit':'W/(m.C)',
                 'MCT_value':3.6*m['conductivity_W_m_C'],'MCT_unit':'kJ/(m.h.C)'},
                {'parameter':'weight_density','physical_value':m['density_kg_m3'],'physical_unit':'kg/m3',
                 'MCT_value':m['density_kg_m3']*m['gravity_m_s2'],'MCT_unit':'N/m3'}]
    input_rows += [{'parameter':name,'physical_value':h,'physical_unit':'W/(m2.C)',
                    'MCT_value':3.6*h,'MCT_unit':'kJ/(m2.h.C)'} for name,h in hfunc.items()]
    write_csv(OUT/'thermal_input_units.csv',list(input_rows[0]),input_rows)
    report={'status':'PASS_INPUT_TOPOLOGY_AND_SCHEDULE_AUDIT_ONLY','hydration_input_cards_written':True,'midas_import_executed':False,
            'midas_solver_executed':False,'journal_validation_completed':False,
            'mesh':mesh_report,'units':p['units'],'rho_cp_kJ_m3_C':cv,
            'heat_asymptotic_kJ_m3':cv*heat['K_C'],
            'total_new_concrete_heat_asymptotic_kJ':cv*heat['K_C']*mesh_report['mesh_volume_m3']/2,
            'heat_source_old_is_zero':True,'heat_source_new_activates_once':True,
            'convection_on_internal_joint_after_new_activation':False,
            'stages':audit,'surface_counts':{name:len(fs) for name,fs in selected.items()},
            'surface_areas_m2':{name:sum(face_info[x]['area'] for x in fs) for name,fs in selected.items()},
            'maximum_MCT_line_length':max(map(len,lines))}
    (OUT/'input_verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'MCT':str(path),'stage_count':len(audit),'node_count':len(points),'element_count':len(cells),
                      'input_audit':'PASS','MIDAS_run':False,'journal_validation':False},indent=2))


if __name__=='__main__':
    main()
