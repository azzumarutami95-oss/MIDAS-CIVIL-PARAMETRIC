# MIDAS Civil Parametric — Pilar Solid FC30

## Model contoh panas hidrasi bertahap

**[Unduh MCT hidrasi + staging](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/raw/refs/heads/main/output/pilar_fc30_hydration/PILAR_FC30_HYDRATION_STAGED_ASSUMED.mct)**

[Unduh paket ZIP hidrasi](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/raw/refs/heads/main/output/PILAR_FC30_HYDRATION_PAKET.zip)

- [Parameter, tahap, kondisi batas dan petunjuk analisis](output/pilar_fc30_hydration/README_HYDRATION.md)
- [Parameter contoh yang dapat diubah](output/pilar_fc30_hydration/parameters.json)
- [Sumber teknis dan batas verifikasi jurnal](output/pilar_fc30_hydration/SOURCES.md)

Model hidrasi menggunakan **N–m–kJ–°C, waktu jam** dan empat tahap sampai 30 hari
setelah pengecoran baru. Mencakup sumber panas adiabatik, konveksi bekisting/
udara/curing, suhu awal/dasar, dan pergantian grup batas. Nilai input merupakan
**asumsi contoh**, bukan hasil kalibrasi campuran/proyek. Pola tahap dicocokkan
dengan tutorial resmi MIDASIT; impor/solver native dan verifikasi jurnal belum
dilaksanakan. Belum merupakan penilaian retak yang tervalidasi.

## Model geometri awal

Model dasar solid HEX8 untuk MIDAS Civil klasik: pilar diameter 7,5 m,
tinggi 8 m, terdiri dari beton lama 4 m dan beton baru 4 m.

**[Unduh file MCT](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/raw/refs/heads/main/output/pilar_fc30/PILAR_D7500_H8000_FC30_HEX8.mct)**

- [Lihat file MCT di GitHub](output/pilar_fc30/PILAR_D7500_H8000_FC30_HEX8.mct)
- [Petunjuk impor dan asumsi material](output/pilar_fc30/PETUNJUK_IMPORT.md)

Model berisi 26.433 node dan 24.576 elemen solid 8-node. Material elastis
berbasis f'c 30 MPa menggunakan asumsi E = 25,74 GPa. Pemeriksaan geometri
lolos; impor langsung di MIDAS Civil belum diuji.

**Belum merupakan model analisis panas hidrasi lengkap.** Properti termal,
pembangkitan panas, suhu awal, kondisi curing, dan tahap analisis belum
ditetapkan. Baca petunjuk sebelum menjalankan analisis.
