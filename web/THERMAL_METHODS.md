# Specific heat dan heat conduction untuk Material Data MCT

Modul ini menghitung **input material konstan**, bukan hasil temperatur atau
kalibrasi campuran proyek. `thermal.js` menyediakan satu hasil aktif yang dipakai
bersama oleh material MCT, pratinjau, tabel unit, JSON, Cv dan ringkasan energi.

## Pilihan metode

| Parameter | Pilihan | Batas penerapan |
| --- | --- | --- |
| cₚ | Manual | Hasil uji/nilai pilihan pengguna |
| cₚ | Campuran | Neraca kapasitas panas dari massa dan sifat fase |
| cₚ | EC2 kering | Acuan beton mengeras untuk desain kebakaran pada Tref |
| k | Manual | Hasil uji/nilai pilihan pengguna |
| k | Seri / paralel | Batas geometri ideal komposit skalar |
| k | Geometrik | Estimasi homogenisasi, bukan keluaran kode desain |
| k | EC2 bawah / atas | Dua kurva kode pada Tref; bukan batas universal semua beton |

Metode awal tetap manual. Beralih ke hitungan tidak menimpa nilai manual.
Beton lama dapat mengikuti nilai aktif baru atau memakai cp/k manual terpisah.
Material 1 adalah beton lama; material 2 beton baru. Massa jenis, f'c/E, Poisson
dan muai termal saat ini tetap input bersama. JSON v1 lama dimigrasikan ke metode
manual agar cp/k pekerjaan sebelumnya tetap dipakai.

## Neraca panas jenis campuran

```text
cp_mix = Σ(mᵢ cpᵢ) / Σmᵢ
```

Pembobotan menggunakan massa. Metode ini setara dengan penjumlahan kapasitas
panas volumetrik fase jika basis massa/volume konsisten. Rujukan implementasi
yang diperiksa: [BAMresearch/FenicsConcrete](https://github.com/BAMresearch/FenicsConcrete/blob/master/fenics_concrete/mori_tanaka_homogenization.py#L296).

Ini estimasi komposisi pada keadaan referensi. Perubahan air terikat/bebas,
derajat hidrasi dan kelembapan memerlukan data tambahan. Panas reaksi tidak
ditambahkan ke cp; ia masuk sebagai sumber panas. Air agregat pada koreksi batch
merupakan bagian air efektif rencana dan tidak dihitung dua kali.

## Konduktivitas campuran

```text
Vᵢ = mᵢ / ρᵢ; Vsum = ΣVᵢ; vᵢ = Vᵢ / Vsum
k_series = 1 / Σ(vᵢ / kᵢ)
k_parallel = Σ(vᵢ kᵢ)
k_geometric = exp[Σ(vᵢ ln kᵢ)]
```

Gunakan fraksi **volume**, bukan massa. Untuk sifat positif, harmonik ≤ geometrik
≤ aritmetik. Seri/paralel adalah batas ideal konduksi skalar tanpa resistansi
kontak fase terpisah; hasilnya tidak mengukur k beton proyek.

Rujukan batas Wiener yang diperiksa adalah
[SimPEG](https://github.com/simpeg/simpeg/blob/main/simpeg/maps/_property_maps.py#L1282),
yang merujuk S. Torquato, *Random Heterogeneous Materials* (2002),
DOI [10.1007/978-1-4757-6355-3](https://doi.org/10.1007/978-1-4757-6355-3).
Implementasinya mendukung bentuk matematis umum, bukan kalibrasi beton foto.
Geometrik adalah pilihan estimasi tersendiri.

Vsum ditampilkan terhadap 1 m³ nominal. Normalisasi memakai fase yang diketahui;
selisih 1 − Vsum tidak dianggap kadar udara terukur. Porositas dan resistansi
kontak membutuhkan data/model tersendiri. Massa jenis fase yang salah akan
mengubah fraksi volume serta k, sehingga audit volume harus diperiksa.

## Acuan EN 1992-1-2 beton kering

Rumus diperiksa terhadap [ConcreteEC2.cpp, OpenSees for Fire](https://github.com/OpenSeesforFire/openseesforfire.github.io/blob/OpenSees-SRC/SRC/HeatTransfer/HeatTransferMaterial/ConcreteEC2.cpp).
Kode aplikasi ditulis sendiri dari hubungan matematis. Untuk T dalam °C,
domain acuan 20–1200°C:

```text
cp [J/(kg·K)] = 900          ; 20 ≤ T ≤ 100
              800 + T      ; 100 < T ≤ 200
              900 + 0.5 T   ; 200 < T ≤ 400
              1100         ; 400 < T ≤ 1200

k_lower [W/(m·K)] = 1.36 − 0.136(T/100) + 0.0057(T/100)²
k_upper [W/(m·K)] = 2.00 − 0.2451(T/100) + 0.0107(T/100)²
```

cp dibagi 1000 untuk kJ/kg·°C. Pada T20°C: cp0,900, k_lower1,333028 dan
k_upper1,951408. Pada T200°C cp1,000; T400°C cp1,100; T1200°C k0,5488/0,5996.

**Ini acuan beton mengeras untuk desain kebakaran.** Pemilihan opsi tersebut
tidak mengkalibrasi beton segar/fly ash proyek. Angka yang diekspor konstan pada
satu Tref, bukan fungsi temperatur dalam solver. Puncak cp kelembapan/penguapan
dan perubahan densitas temperatur tinggi tidak termasuk opsi kering ini. Nilai
manual k2,4 tetap diterima; kurva upper EC2 tidak membatasi semua jenis beton.

## Preset fase: asumsi yang dapat diedit

Merek semen/lokasi agregat tidak menentukan mineralogi atau sifat termal.

| Fase | m kg/m³ | ρ kg/m³ | cp kJ/kg·°C | k W/m·°C |
| --- | ---: | ---: | ---: | ---: |
| Semen | 432 | 3150 | 0,84 | 1,50 |
| Fly ash | 108 | 2300 | 0,75 | 0,70 |
| Air | 151 | 1000 | 4,18 | 0,60 |
| Pasir | 749 | 2650 | 0,80 | 3,00 |
| Agregat kasar | 976 | 2700 | 0,80 | 3,00 |
| Admixture 1 | 2,16 | 1100 | 3,50 | 0,50 |
| Admixture 2 | 8,10 | 1100 | 3,50 | 0,50 |

Admixture memakai surrogate cairan berair; data produknya belum tersedia.
Total massa2426,26 kg/m³ dan Vsum0,988549643 m³. Hasil tabel asumsi ini:

- cp_mix **1,026670678 kJ/kg·°C**.
- k_series **1,53612**; k_geometric **1,955367943**;
  k_parallel **2,29247 W/m·°C**.
- HEATCO geometrik **7,039324596 kJ/m·jam·°C**.
- Dengan rho model2400: Cv **2464,009628 kJ/m³·°C**;
  difusivitas **7,9357155e-7 m²/s**.

Massa jenis model tetap independen. Menghitung campuran tidak otomatis mengubah
K/a sumber panas, f'c atau massa jenis model.

## Energi sumber panas dan kartu material

```text
Cv = ρ_model × cp_active                  [kJ/(m³·°C)]
diffusivity = k_active / (Cv × 1000)      [m²/s]
Q_infinity = Cv × K                      [kJ/m³]

SPHEAT = cp_active                       [kJ/(kg·°C)]
HEATCO = k_active_W_per_m_C × 3.6         [kJ/(m·jam·°C)]
DEN = ρ_model × 9.80665                   [N/m³]
```

K adalah kenaikan adiabatik asimtotik. K45°C tetap dengan cp_manual0,9 memberi
Q∞97200 kJ/m³; cp_mix contoh memberi Q∞110880,433259 kJ/m³. **Mengubah cp sambil
mempertahankan kurva kenaikan adiabatik mengubah energi reaksi tersirat.**
Kalibrasi cp dan K/a harus konsisten dengan energi uji campuran.

Pemetaan N ke kg diperiksa dari [dokumentasi unit MIDAS](https://github.com/python261/midas-civil-NX-API/blob/main/db/project/Unit-System.md).
Jangan memakai angka SPHEAT yang sama pada unit kN/ton tanpa konversi.

## Cakupan penelusuran dan pengujian

Sumber yang berhasil diperiksa adalah implementasi OpenSees for Fire, neraca
kapasitas BAM/FenicsConcrete, batas SimPEG/rujukannya, serta unit dan pola
staging MIDASIT. Ini bukan kajian sistematis seluruh jurnal/prosiding. Akses
penerbit, Crossref dan manual resmi yang diminta dalam draft jaringan belum
aktif pada runtime; naskah jurnal/prosiding penuh tidak berhasil diverifikasi.
Tidak ada angka fase contoh yang diklaim sebagai data jurnal atau data uji proyek.

Untuk proyek, ganti sifat fase/sifat efektif dengan pengujian yang sesuai
mineralogi, kelembapan, umur dan suhu campuran. Periksa riwayat suhu beton lama,
curing, pengekangan, neraca energi dan studi konvergensi. Native parser/solver
NX belum dijalankan di lingkungan ini.

Tes program meliputi neraca/invariansi cp, batas campuran, titik EC2, material
1/2 pada MCT, unit, migrasi JSON, peralihan metode, validasi fase dan browser.
Tes pembentuk input ini tidak memvalidasi prediksi suhu/tegangan atau risiko retak.
