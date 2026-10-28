#!/usr/bin/env python3
"""Plot inputs only: no thermal field or solver result is fabricated."""
import csv
import json
import os
from pathlib import Path

os.environ.setdefault('MPLCONFIGDIR','/tmp/pilar-matplotlib')
os.environ.setdefault('XDG_CACHE_HOME','/tmp/pilar-cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

out=Path(__file__).resolve().parents[1]/'output'/'pilar_fc30_hydration'
p=json.loads((out/'parameters.json').read_text())
with (out/'adiabatic_heat_curve.csv').open() as f:
    curve=list(csv.DictReader(f))
time=np.array([float(row['new_age_h']) for row in curve])/24
rise=np.array([float(row['adiabatic_rise_C']) for row in curve])
rate=np.array([float(row['instantaneous_heat_kJ_m3_h']) for row in curve])
strip=p['schedule']['strip_formwork_at_new_age_hours']/24
cure=p['schedule']['end_top_curing_at_new_age_hours']/24
end=p['schedule']['end_analysis_at_new_age_hours']/24
h=p['convection']
fig,axs=plt.subplots(2,2,figsize=(13,8))
fig.suptitle('MASUKAN MODEL PANAS HIDRASI PILAR FC30',fontsize=17,weight='bold')
ax=axs[0,0]
ax.plot(time,rise,color='#db8036',lw=2)
ax.set(xlim=(0,end),ylim=(0,50),ylabel='Kenaikan adiabatik (°C)',xlabel='Umur beton baru (hari)',
       title='Kurva adiabatik asumsi: K = 45°C; a = 0,50/hari')
ax.text(.98,.1,'Bukan temperatur pilar hasil analisis',ha='right',transform=ax.transAxes,fontsize=9)
ax=axs[0,1]
ax.plot(time,rate,color='#446a8e',lw=2)
ax.set(xlim=(0,end),ylim=(0,2200),ylabel='Sumber panas (kJ/m³·jam)',xlabel='Umur beton baru (hari)',
       title='Laju panas ekuivalen dari turunan kurva masukan')
ax.text(.98,.83,'Beton lama: sumber panas diasumsikan nol',ha='right',transform=ax.transAxes,fontsize=9)
ax=axs[1,0]
ax.step([0,strip,strip,end],[h['new_formwork_effective_W_m2_C'],h['new_formwork_effective_W_m2_C'],h['new_side_air_W_m2_C'],h['new_side_air_W_m2_C']],where='post',color='#db8036',lw=2,label='Sisi beton baru')
ax.step([0,cure,cure,end],[h['new_top_curing_effective_W_m2_C'],h['new_top_curing_effective_W_m2_C'],h['new_top_air_W_m2_C'],h['new_top_air_W_m2_C']],where='post',color='#357b66',lw=2,label='Atas beton baru')
ax.axhline(h['old_side_W_m2_C'],color='#777777',ls='--',lw=1,label='Sisi beton lama')
ax.set(xlim=(0,end),ylim=(0,13),ylabel='h efektif (W/m²·°C)',xlabel='Umur beton baru (hari)',title='Pergantian grup konveksi, tanpa tumpang tindih')
ax.legend(loc='lower right',fontsize=9)
ax=axs[1,1]
for y,start,width,color,label in [(2,0,strip,'#db8036','H1: bekisting + curing'),
                                 (1,strip,cure-strip,'#78a494','H2: bongkar bekisting'),
                                 (0,cure,end-cure,'#446a8e','H3: akhir curing / pendinginan')]:
    ax.barh(y,width,left=start,height=.55,color=color)
    ax.text(start+.2,y,label,va='center',fontsize=9,color='white' if y==0 else '#102532')
ax.set(xlim=(0,end),ylim=(-.7,3),yticks=[],xlabel='Umur beton baru (hari)',title='Jadwal contoh: satu aktivasi pengecoran baru')
ax.text(.02,.92,'H0: inisialisasi beton lama 1 jam sebelum pengecoran',transform=ax.transAxes,fontsize=9)
for ax in axs.ravel():
    ax.grid(alpha=.2)
    ax.set_axisbelow(True)
fig.text(.5,.035,'SELURUH ANGKA ADALAH ASUMSI CONTOH. Grafik ini menunjukkan input, bukan hasil solver MIDAS.',ha='center',fontsize=10,color='#7b3027')
fig.tight_layout(rect=(0,.07,1,.95),h_pad=2,w_pad=2)
fig.savefig(out/'INPUT_DIAGRAM.png',dpi=180)
plt.close(fig)
print(out/'INPUT_DIAGRAM.png')
