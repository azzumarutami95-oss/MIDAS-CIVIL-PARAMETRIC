# Material bergantung waktu — versi aplikasi 1.1.1

Pembaruan material pada versi aplikasi **1.1.1** menyediakan definisi creep
dan shrinkage (C&S), perkembangan kuat tekan, serta **Time Dependent Material
Link**. Pengaturan terdapat di tab **Time Dependent Material**. Parameter
yang sama dipakai untuk JSON, pratinjau, laporan TXT, dan MCT lengkap.

## Mulai dari contoh yang dapat diimpor

- [Contoh MCT dengan C&S, kekuatan dan link](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/download/v1.1.1-materials/PILAR_TIME_DEPENDENT_EXAMPLE.MCT)
- [JSON parameter contoh tersebut](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/download/v1.1.1-materials/PARAMETER_TIME_DEPENDENT_EXAMPLE.json)

Contoh dihasilkan oleh mesin aplikasi melalui `scripts/build_material_examples.cjs`.
Model default memakai CEB-FIP 1990 dengan `fck,28 = 30 MPa`, selisih mean
strength `8 MPa`, RH `70%`, awal susut `3 hari`, dan semen normal/cepat NR.
C&S dan kekuatan dihubungkan ke **material 2 · FC_NEW**. **Material 1 ·
FC_OLD** tetap memakai material mekanis konstan. Angka ini merupakan asumsi
contoh yang perlu disesuaikan terhadap proyek, bukan hasil kalibrasi jobmix.

Versi aplikasi tetap **1.1.1**; aset pembaruan material berada pada revisi
rilis **v1.1.1-materials**.

## Model dan acuan yang tersedia

| Bagian | Pilihan aplikasi | Ekspor MCT |
| --- | --- | --- |
| Creep / shrinkage | ACI209 native MIDAS | `TDM-TYPE` dengan kode `ACI` |
| Creep / shrinkage | CEB-FIP 1990 | `TDM-TYPE` dengan kode `CEB` |
| Creep / shrinkage | AASHTO LRFD 2006 | `TDM-TYPE` dengan kode `AASHTO` |
| Creep / shrinkage | User / custom jobmix | `TDM-FUNC` dan `TDM-TYPE, USER` |
| Compression strength | ACI 209R-92 | `TDM-ELAST, CODE, ACI` |
| Compression strength | CEB-FIP 1990 | `TDM-ELAST, CODE, CEB-FIP(1990)` |
| Compression strength | AASHTO / konvensi WSDOT | Kode `ACI`, dengan acuan ACI 209R-92 |
| Compression strength | User / custom jobmix | `TDM-ELAST, USER` dengan tabel empat kolom |

**Pilihan ACI pada C&S mengikuti model ACI209(1982) yang disebut dalam
dokumentasi MIDAS.** Acuan ACI 209R-92 pada perkembangan kuat tekan dinyatakan
terpisah. Aplikasi tidak mengklaim bahwa seluruh revisi ACI atau edisi AASHTO
yang lebih baru telah diimplementasikan oleh kartu native tersebut.

AASHTO tidak menetapkan model perkembangan kuat tekan terhadap umur tersendiri.
[Dokumentasi resmi WSDOT PGS Library](https://www.wsdot.wa.gov/eesc/bridge/software/Documentation/PGSLibrary/8.0/tg_time_dependent_material_models.html)
menjelaskan penggunaan ACI 209R-92 untuk bagian ini. Karena itu pilihan
kekuatan AASHTO dalam aplikasi memakai konvensi tersebut dan mengekspor kode
ACI yang tersedia. Aplikasi tidak membuat token native `TDM-ELAST, CODE,
AASHTO`.

Kurva C&S model kode dihitung oleh MIDAS berdasarkan parameter yang diekspor.
Grafik aplikasi memperlihatkan kurva acuan kuat tekan; nilai E(t) dan ft(t)
untuk model native tidak diperkirakan di layar dan ditandai **—**. Nilai
tersebut tetap perlu diperiksa setelah impor dan analisis di MIDAS.

## Parameter C&S

Parameter umum mencakup kelembapan relatif dan umur beton saat susut mulai
terjadi. Semen CEB dipilih RS, NR, atau SL. Ukuran nosional CEB adalah
`h = 2V/S`, sedangkan ACI dan AASHTO menggunakan rasio `V/S`.

Nilai awal `h = 3,75 m` dan `V/S = 1,875 m` berasal dari silinder berdiameter
7,5 m jika hanya permukaan sisi dianggap terpapar; muka ujung diabaikan.
Kedua ukuran dapat diedit dan **tidak berubah otomatis** saat diameter atau
tinggi model diubah. Gunakan luas permukaan yang benar-benar terpapar dan
parameter yang sesuai dengan idealisasi anggota pada proyek.

ACI menyediakan dua cara menentukan nilai ultimit:

- **CODE** memakai metode curing, slump, persentase agregat halus, kadar
  udara, dan kandungan semen. Sumber kandungan semen dapat dipilih dari
  `mix.cement` pada Mix Design aktif atau input manual dalam kg/m³. Sumber
  ini memakai massa semen, bukan otomatis jumlah semen dan fly ash.
- **USER** pada model ACI menerima koefisien creep ultimit dan regangan
  shrinkage ultimit. Ini tetap model ACI dengan nilai ultimit yang diberikan;
  pilihan ini berbeda dari model **User / custom jobmix** dengan tabel penuh.

Koefisien a dan b yang dapat diedit diteruskan ke definisi ACI. Mengubah
angka semen di Mix Design tidak mengkalibrasi creep, shrinkage, curing,
kelembapan, atau kekuatan terhadap umur secara otomatis.

AASHTO menyediakan opsi paparan terhadap pengeringan sebelum lima hari
curing. Gunakan opsi ini sesuai definisi kode dan kondisi proyek; pilihan
tersebut bukan pembacaan otomatis dari jadwal bongkar bekisting.

## Perkembangan kuat tekan

Untuk ACI, kurva acuan menggunakan

`fc(t) = fc,28 × t / (a + b·t)`

dengan t dalam hari. Contoh awal `a = 4`, `b = 0,85` mewakili acuan moist-cured
Type I pada ACI 209R-92. Koefisien dapat diubah berdasarkan curing dan data
yang mendasarinya. Rumus mengikuti bentuk kode, sehingga tidak dinormalisasi
ulang untuk memaksa nilai tepat sama dengan fc,28 pada t = 28 hari.

Untuk CEB-FIP 1990, kurva acuan menggunakan

`βcc(t) = exp[s·(1 − √(28/t))]`

`fcm(t) = βcc(t) × fcm,28`

dengan s = 0,20 untuk RS, 0,25 untuk NR, dan 0,38 untuk SL. Nilai pada umur
nol ditampilkan nol; nilai tersebut bukan prediksi kuat tekan beton segar.

**Kuat tekan karakteristik dan rata-rata dibedakan.** `material.fc` menjadi
acuan karakteristik 28 hari pada C&S. Untuk kurva kekuatan CEB, aplikasi
menggunakan `fcm,28 = material.fc + cebMeanOffset`, dengan selisih awal 8 MPa
yang dapat diperiksa dan diedit. Dengan fc = 30 MPa, definisi C&S menerima
30 MPa dan definisi kekuatan CEB menerima 38 MPa. Pembedaan ini mengikuti
[tutorial resmi MIDAS Civil FCM](https://support.midasuser.com/hc/en-us/articles/47452644584985--CIVIL-Construction-Stage-Analysis-using-FCM-Bridge-Wizard)
yang membedakan input characteristic strength dan mean strength.

Untuk kekuatan USER, isi data absolut yang diperlukan. Nilai nominal fc
material dasar, nilai rata-rata uji, dan kuat tekan pada umur tertentu tidak
dianggap sebagai besaran yang sama secara otomatis.

## Tabel user dan custom jobmix

Masukan tabel berupa CSV numerik tanpa judul kolom. Gunakan **titik** untuk
desimal; pemisah kolom dapat berupa koma, titik koma, atau tab. Semua nilai
harus berhingga. Baris yang diawali `#` dapat dipakai sebagai catatan.

### Kekuatan: empat kolom

Urutan kolom adalah **umur beton (hari), fc (MPa), ft (MPa), E (MPa)**.
Contoh berikut adalah asumsi ilustratif:

```text
0, 0, 0, 0
1, 8, 0.6, 13000
7, 23, 1.8, 23000
28, 30, 2.5, 25743
90, 34, 2.8, 27500
```

Umur harus meningkat tanpa duplikasi dan dimulai pada nol. Untuk umur di
atas nol, fc dan E harus positif; ft boleh nol jika hal itu merupakan input
yang dipilih pengguna. Isi cakupan umur sampai akhir analisis agar aplikasi
tidak perlu mengandalkan ekstrapolasi. Faktor skala USER mengalikan **E saja**,
mengikuti dokumentasi MIDAS. fc dan ft tetap memakai nilai yang diisikan.
MCT menyimpan E asli bersama faktor skala, sehingga faktor tidak dihitung dua
kali. Tabel di layar memperlihatkan E setelah faktor skala.

Menurut [panduan MIDAS Comp. Strength](https://support.midasuser.com/hc/en-us/articles/29786771254809-Time-Dependent-Material-Comp-Strength),
E USER memengaruhi analisis kekakuan; data fc dan ft USER dipakai dalam
perhitungan indeks retak analisis panas hidrasi. Nilai ft nol tidak menyediakan
kuat tarik positif untuk evaluasi tersebut. Aplikasi ini tidak menghasilkan
indeks retak atau menyatakan hasilnya telah tervalidasi.

### Creep: tiga kolom

Urutan kolom adalah **umur pembebanan (hari), durasi setelah beban (hari),
koefisien creep φ**. Setiap umur pembebanan membentuk fungsi tersendiri:

```text
3, 0, 0
3, 1, 0.25
3, 7, 0.7
3, 365, 1.9
7, 0, 0
7, 1, 0.22
7, 7, 0.61
7, 365, 1.65
```

Durasi setiap fungsi harus meningkat, dimulai durasi nol dengan φ nol, dan
mencakup durasi analisis. Data φ tidak berdimensi. MIDAS memakai modulus
acuan untuk menginterpretasikan fungsi bertipe **CC (Creep Coefficient)**.
Pilih modulus acuan dari material dasar atau isi E acuan dalam MPa secara
eksplisit. Nilai itu harus cocok dengan dasar koefisien creep hasil uji;
mengubah E acuan tanpa mengubah dasar data dapat mengubah compliance.

[Panduan resmi MIDAS C&S](https://support.midasuser.com/hc/en-us/articles/29785568014617-Time-Dependent-Material-Creep-Shrinkage)
menyarankan sedikitnya lima fungsi dengan umur pembebanan berbeda untuk
interpolasi umur. Contoh awal aplikasi menyediakan lima kelompok; cuplikan
dua kelompok di atas hanya menjelaskan format.

### Shrinkage: dua kolom

Urutan kolom adalah **umur fungsi (hari), besar regangan susut positif
(microstrain/με)**. Mulai dari umur nol, gunakan umur meningkat, dan cakup
akhir analisis. Contoh:

```text
0, 0
3, 0
7, 80
28, 220
90, 380
365, 550
```

Pengguna harus memastikan basis umur, awal pengeringan, dan kondisi curing
fungsi sesuai data proyek. Data ini tidak merekonstruksi susut sebelum awal
analisis atau riwayat tegangan awal beton lama.

## Link material dan kontrol hidrasi

Satu definisi bernama `TD_CS` dan satu definisi `TD_FC` dapat dihubungkan
secara independen ke material 1 (beton lama) dan material 2 (beton baru).
Default proyek baru hanya menghubungkan keduanya ke material 2:

```text
*TDM-LINK
2, TD_CS, TD_FC
```

Kolom link C&S dan kekuatan dapat diaktifkan terpisah. Kartu yang tidak
terhubung tetap merupakan definisi input dan tidak menetapkan properti pada
material dasar. Kontrol `HYD-CTRL` mengaktifkan creep/shrinkage ketika ada
link C&S aktif; pilihan efek adalah BOTH, CREEP, atau SHRINK. Metode umum
kode memakai jumlah iterasi dan toleransi yang diberikan. Berat sendiri
otomatis tetap nonaktif karena SW sudah diterapkan melalui LG_SW.

Tahap hidrasi aplikasi ini tidak mengatur umur awal matang beton lama. Link
lama dimatikan secara default agar material lama tidak diasumsikan baru
dicor. Bila link lama diaktifkan, periksa basis umur dan fungsi yang sesuai
beton matang di MIDAS, serta riwayat tegangan/susut yang memang ingin dimodelkan.

Proyek JSON v1 yang belum mempunyai `config.timeDependent` tetap dapat
dibuka. Kelompok baru ditambahkan dengan `enabled = no` agar perilaku mekanis
lama tetap konstan sampai pengguna meninjaunya dan mengaktifkannya. Kelompok
yang sudah ada tetapi tidak lengkap atau salah tipe tidak digantikan diam-diam
dengan parameter contoh.

## Satuan ekspor

| Besaran | Input aplikasi | Kartu MCT N–m–kJ–°C |
| --- | --- | --- |
| Tahap/kurva panas hidrasi | jam | jam |
| Umur kuat tekan, awal susut, umur/durasi fungsi C&S | hari | hari |
| fc, ft, E | MPa | N/m², dikali 10⁶ |
| Slump ACI | mm | m, dibagi 1.000 |
| Ukuran nosional dan V/S | m | m |
| Kelembapan, agregat halus, udara | persen | persen |
| Kandungan semen ACI | kg/m³ | kg/m³ |
| φ custom | tanpa satuan | tanpa satuan, tipe CC dengan E acuan |
| Shrinkage tabel `TDM-FUNC` | με | regangan tanpa satuan, dikali 10⁻⁶ |
| Ultimit susut ACI USER | με | nilai microstrain pada field USS ACI |

Contoh: fc 30 MPa menjadi 30.000.000 N/m². Tabel susut 550 με menjadi
0,00055 pada `TDM-FUNC`; field ultimit ACI USS tetap menerima angka
microstrain sesuai format model ACI. Hari material tidak dikalikan 24 hanya
karena tahap hidrasi menggunakan jam.

## Sintaks, verifikasi dan batas penerapan

Definisi kode ditulis dalam `*TDM-TYPE` dan `*TDM-ELAST`; fungsi custom C&S
ditulis dalam `*TDM-FUNC`; relasinya memakai `*TDM-LINK`. Urutan field
dicocokkan dengan [MCT Quick Reference MIDAS](https://manual.midasuser.com/EN_Common/Civil/865/Start/14_Appendix/MCT_File_Quick_Reference.htm),
[SDK resmi MIDASIT](https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/midas_civil/_material.py),
dan header beserta baris dari contoh MCT Civil yang terlampir pada pekerjaan.
Ekspor USER kekuatan menggunakan format empat kolom modern; beberapa quick
reference lama hanya menunjukkan umur/E dan tidak menggambarkan semua field
versi baru.

Foto jobmix menyediakan komposisi dan sebagian hasil kuat tekan 3/7 hari.
Data tersebut tidak menyediakan kurva creep/susut, ft(t), E(t), atau hasil
28 hari yang terukur. Memilih model kode dan mengganti parameter campuran
tidak mengubahnya menjadi kalibrasi mekanis. Tabel awal aplikasi adalah asumsi
yang dapat diganti, bukan hasil pengujian campuran pengguna.

Impor native dan solver MIDAS belum tersedia untuk pengujian model di
lingkungan ini. Setelah impor, periksa penerimaan kartu, nilai satuan,
nama/link material, basis umur elemen baru dan lama, mode C&S, perkembangan
E, konvergensi iterasi/waktu/mesh, serta interpretasi indeks retak jika
digunakan. Tes aplikasi dan keberhasilan build installer tidak membuktikan
bahwa model telah dikalibrasi atau hasil solver telah diverifikasi.

Rujukan tambahan: [MIDAS Creep/Shrinkage](https://support.midasuser.com/hc/en-us/articles/17536942646553-Creep-Shrinkage),
[format properti C&S/API](https://support.midasuser.com/hc/en-us/articles/35808006330009-Time-Dependent-Material-Properties-Creep-Shrinkage),
[kontrol hidrasi](https://manual.midasuser.com/EN_Common/Civil/865/Start/06_Analysis/Hydration_Heat_Analysis_Control.htm),
dan [FHWA-HRT-05-058, Bab 4](https://www.fhwa.dot.gov/publications/research/infrastructure/structures/05058/04.cfm)
untuk contoh persamaan perkembangan kuat tekan ACI yang dinyatakan secara
eksplisit. Acuan ini menjelaskan metode; persyaratan proyek dan edisi kode
yang berlaku tetap perlu ditentukan oleh pengguna.
