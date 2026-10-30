# Civil Hydration — NX workspace HTML offline

Unduh **[CIVIL_HEAT_HYDRATION_NX.html](../downloads/CIVIL_HEAT_HYDRATION_NX.html)**,
simpan sebagai `.html`, lalu buka dengan browser desktop modern seperti Chrome
atau Edge. Tidak perlu Python, Node, server, instalasi, akun MIDAS API, atau
koneksi internet untuk menggunakan aplikasi. Aplikasi tidak mengirim parameter
ke server. Tautan referensi hanya dibuka bila diklik. Nama file HTML sebelumnya
tetap tersedia dengan tampilan baru yang sama. Parameter JSON v1 sebelumnya
tetap dapat dibuka.

## Navigasi ruang kerja NX

- Ribbon dan Model Tree memilih tab Model, Mix Design, Heat of Hydration,
  Time Dependent Material, Construction Stage, serta Check & Export.
- Model menampilkan panel geometri/material/mesh dan viewport yang lebih luas.
- Drag di viewport untuk orbit, scroll untuk zoom, Shift + drag untuk pan.
  Tombol ISO/Depan/Atas mengganti arah kamera; Fit view atau double-click
  menyesuaikan skala tanpa mengubah geometri.
- Tombol Mesh menampilkan/menyembunyikan rusuk. Pilihan Semua/Beton lama/Beton
  baru memfilter objek untuk pemeriksaan. Filter visual **tidak mengubah**
  elemen, sumber panas, atau staging pada file ekspor.
- Panel Output mencatat aktivitas input/ekspor aktual. Panel ini bukan hasil
  solver NX. Warna viewport menunjukkan segmen beton, bukan temperatur.

Antarmuka ini alat independen yang mengikuti pola ruang kerja perangkat lunak
analisis struktur, bukan produk MIDAS. Ekspor tetap `.MCT`. Pustaka resmi
MIDASIT menyediakan [`Model.importMCT()` untuk Civil NX](https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/midas_civil/_model.py#L797).
Setelah impor, model dapat disimpan dalam format native oleh aplikasi Civil NX.
Mengganti ekstensi MCT menjadi `.mcb` bukan konversi format dan tidak dilakukan.

## Alur penggunaan

1. Atur diameter, tinggi beton lama/baru dan pembagian mesh. Default: D7,5 m,
   H4+4 m; 26.433 node dan 24.576 HEX8 dengan node sambungan bersama.
2. Periksa preset campuran dari foto. Kolom sumber foto adalah catatan tetap;
   kolom kg/m³, volume batch dan kadar air bebas dapat diubah.
3. Atur sifat termal, suhu awal/pengecoran, K/a, konveksi dan kondisi dasar.
   Opsi dasar **temperatur tetap** menghasilkan `HYD-PRTEMPER`. Opsi
   **adiabatik** menghilangkan kondisi temperatur tetap; fluks dasar nol.
4. Pada **Time Dependent Material**, pilih model creep/shrinkage dan
   perkembangan kuat tekan. Periksa input atau isi tabel custom jobmix,
   lalu tentukan link ke material dasar beton lama/baru.
5. Atur jam bongkar bekisting, akhir curing, akhir analisis dan langkah waktu.
6. Periksa pratinjau, konversi unit dan pesan pemeriksaan. Klik **Unduh .MCT**.
   Browser menghasilkan `PILAR_HEAT_HYDRATION.MCT` lengkap, berisi semua node,
   elemen, material, sumber panas, konveksi, tahapan, definisi/link material
   bergantung waktu yang aktif, dan kontrol analisis.
7. Impor ke model kosong pada MIDAS Civil NX melalui impor MCT atau MCT Command Shell.
   Periksa log parser, unit, aktivasi beton, sumber panas dan kondisi batas.

Gunakan **Simpan parameter JSON** untuk membawa pekerjaan ke perangkat lain.
**Buka parameter JSON** menerima format aplikasi `civil-heat-studio/v1`.
JSON masukan yang rusak/tidak valid tidak mengganti parameter saat ini. JSON
lama generator Python memakai format berbeda dan bukan format impor aplikasi.
**Unduh ringkasan input** menyimpan `.txt` berisi parameter, unit, jadwal,
node pemantauan dan batas interpretasi. Tombol reset meminta konfirmasi.

## Kriteria convection boundaries

Pada **Heat of Hydration → Konveksi permukaan**, panduan pemilihan h
menjelaskan rentang acuan udara, koefisien efektif bekisting/curing, serta
permukaan dan tahap yang digunakan. Acuan umum udara adalah **2–25** untuk
konveksi alami dan **25–250 W/(m²·°C)** untuk konveksi paksa; batas masukan
aplikasi tetap **0–200**, sehingga kedua rentang tersebut tidak boleh dianggap
sebagai batas validasi yang sama.

Bekisting dan penutup tidak memiliki satu rentang universal. Bandingkan
bahan/ketebalan aktual dengan acuan historis MIDAS atau gunakan tahanan seri
`h_eff = 1 / (1/h_udara + Σd/k)`. Nilai h=0 berarti fluks konveksi nol pada
muka terkait; kondisi dasar termal tetap diatur terpisah. Nilai awal aplikasi
adalah asumsi, dan angka dalam rentang acuan bukan tanda model telah aman
atau terkalibrasi. [Petunjuk empat langkah, tabel acuan dan sumber](CONVECTION_GUIDE.md).

## Berat sendiri SW

Panel **Model → Berat sendiri / self weight** menampilkan kasus **SW**, tipe
**Dead Load (D)**, dan grup **LG_SW**. Faktor arah global default **X=0, Y=0,
Z=−1** dapat diedit dan disimpan di `config.selfWeight` pada JSON. JSON v1 lama
yang belum memiliki kelompok tersebut memakai nilai default ini saat dibuka;
parameter SW yang ada tetapi tidak lengkap atau tidak valid ditolak.

Pratinjau, laporan TXT, serta ekspor MCT menggunakan parameter yang sama.
MCT memuat `*LOAD-GROUP`, `*STLDCASE`, `*USE-STLD, SW`, dan `*SELFWEIGHT`.
Grup diaktifkan sekali melalui `ALOAD=LG_SW, 0` pada awal H0 dan tetap aktif
saat elemen beton baru diaktifkan pada H1. Berat isi material menggunakan
`rho × 9,80665` N/m³. Berat sendiri otomatis `HYD-CTRL.bINCSW` tetap `NO`
untuk menghindari beban ganda. Penerimaan kartu dan penerapannya pada elemen
yang baru aktif tetap perlu diperiksa melalui impor/solver MIDAS Civil.

## Material bergantung waktu dan link

Tab **Time Dependent Material** pada pembaruan versi aplikasi **1.1.1**
menyediakan Creep & Shrinkage (C&S), Compression Strength, serta link ke
material **1 · FC_OLD** dan **2 · FC_NEW**. Pilihan, parameter, tabel custom,
dan link disimpan pada `config.timeDependent`; pratinjau dan laporan memakai
masukan yang sama dengan ekspor MCT.

C&S menyediakan ACI209 native MIDAS, CEB-FIP 1990, AASHTO LRFD 2006, serta
fungsi user. Parameter mencakup kelembapan, umur mulai susut, ukuran nosional
atau V/S, metode curing, dan parameter campuran yang sesuai model. Kandungan
semen ACI dapat diambil secara eksplisit dari Mix Design aktif atau diisi
manual. Pilihan ultimit USER pada model ACI berbeda dari tabel USER penuh.

Compression Strength menyediakan ACI 209R-92, CEB-FIP 1990, konvensi
AASHTO/WSDOT yang menggunakan model ACI 209R-92, serta tabel user berisi
**umur (hari), fc, ft, E (MPa)**. AASHTO tidak memiliki model perkembangan
kuat tekan terhadap umur tersendiri; ekspornya memakai kode ACI yang
didokumentasikan, bukan token MCT AASHTO yang tidak tersedia untuk kekuatan.
Untuk CEB, kuat tekan rata-rata 28 hari adalah `fcm,28 = fck,28 + selisih`
dengan selisih yang dapat diperiksa/diedit. Data uji pada foto tidak otomatis
menentukan selisih ini atau kurva umur 28 hari.

Default proyek baru menghubungkan C&S dan kekuatan ke **beton baru saja**.
Link beton lama dapat diubah, tetapi umur matang dan riwayat tegangan/susutnya
tidak direkonstruksi oleh tahap hidrasi aplikasi ini. JSON lama yang belum
memiliki kelompok `timeDependent` dimigrasikan dengan fitur **nonaktif**;
aktifkan secara eksplisit setelah meninjau parameternya. Kelompok yang sudah
ada tetapi rusak atau tidak lengkap ditolak.

MCT aktif memuat `*TDM-TYPE`, `*TDM-ELAST`, `*TDM-LINK`, serta `*TDM-FUNC`
untuk fungsi C&S user. Umur fungsi material tetap **hari**, sedangkan tahap
panas hidrasi memakai **jam**. MPa dikonversi ke N/m² dan microstrain ke
regangan tak berdimensi. Kontrol creep/shrinkage hidrasi mengikuti mode dan
link yang dipilih; definisi dan link tetap perlu diverifikasi setelah impor.

[Rumus, format CSV, rujukan primer, konversi, dan batas penerapan](TIME_DEPENDENT_METHODS.md).

Penyimpanan lokal browser digunakan bila tersedia. Pengaturan browser/file
lokal dapat membatasi penyimpanan atau unduhan; gunakan ekspor JSON dan izinkan
unduhan untuk berkas HTML lokal jika browser memintanya. Jangan mengandalkan
penyimpanan browser sebagai satu-satunya salinan pekerjaan.

## Preset foto dan batas interpretasi

Semen 432, fly ash 108, air 151, pasir 749, agregat 976, Plastiment VZ 2,16 dan
Viscoflow 8,1 kg/m³. Binder 540 kg/m³, fly ash 20%, w/c 0,34954 dan w/b 0,27963.
Angka “28” pada foto sesuai w/b dalam persen. S/A foto 49 tidak sama dengan
fraksi massa pasir 43,42%; berat jenis dan basis volume belum tersedia.

Total massa bahan 2.426,26 kg/m³ bukan hasil pengukuran massa jenis beton.
Massa jenis termal default tetap 2.400 kg/m³. Tombol yang disediakan dapat
secara eksplisit mengisinya dari total massa. Mengubah campuran tidak otomatis
mengubah K/a, f'c atau sifat termal.

Koreksi batch 0,035 m³ mengasumsikan kadar air 4% pasir dan 0,15% agregat adalah
air bebas terhadap basis SSD. Absorpsi belum tersedia. Air ditambah hitungan
4,18516 kg; pasir basah 27,2636 kg dan agregat basah 34,21124 kg. Pembulatan
foto dipertahankan terpisah dari hitungan aktif. Ini bukan sistem kontrol
batching lapangan.

Kuat tekan foto 3 hari 24,5 MPa; 7 hari tertulis 42,4 MPa (rata-rata hitungan
42,4667). Data 28 hari belum ada. Persentase 54/94 tidak otomatis berarti f'c30
atau mengubah f'c menjadi angka lain. Suhu uji 31,1°C/32,3°C tidak otomatis
menjadi suhu pengecoran aktual. Nilai 0 pada awal foto tidak digunakan sebagai
temperatur pengecoran.

## Model termal yang diekspor

Material Data menyediakan metode **manual / perhitungan** untuk specific heat
dan heat conduction: cp berbobot massa; k seri/paralel/geometrik berbobot volume;
serta acuan beton kering EN1992-1-2 pada Tref. Beton lama dapat memakai cp/k manual
terpisah. Nilai aktif SPHEAT/HEATCO, Cv, difusivitas dan energi sumber ditampilkan.

Lihat **[rumus, rujukan dan batas penerapan](THERMAL_METHODS.md)**. Sifat fase
adalah asumsi editable; EC2 berasal dari beton mengeras untuk kebakaran. Metode
tersebut tidak otomatis mengkalibrasi campuran segar. Nilai ekspor konstan pada
suhu referensi. JSON v1 lama dimigrasikan ke metode manual.

Satuan **N–m–kJ–°C, waktu hidrasi jam, massa kg**. Konduktivitas dan h yang
diisi dalam W dikonversi ke kJ/jam dengan faktor 3,6. Berat isi = rho ×9,80665.
E = 4700√f'c MPa, asumsi beton normal. f'c menjadi dasar E/nama; belum merupakan
kurva tegangan-regangan nonlinier. Saat material bergantung waktu diaktifkan
dan dihubungkan, fungsi kuat tekan/E(t) dipakai melalui definisi TDM terpisah.

Default K45°C, a0,5/hari: ΔTad(t)=K[1−exp(−a t/24)], t dalam jam. Tabel MCT
memakai **kenaikan** adiabatik (`USER,YES`), bukan suhu absolut atau tambahan
panas kedua. Kurva di layar adalah input, bukan hasil temperatur pilar.

Empat tahap: inisialisasi beton lama 1 jam; beton baru 0–72 jam; setelah
bongkar bekisting 72–168 jam; setelah curing sampai 720 jam. Beton baru aktif
sekali. Konveksi atas lama dihapus saat menjadi sambungan internal, sementara
beton lama tetap aktif. Tahap bongkar/akhir curing tidak mereset temperatur
atau sumber panas. Tumpuan translasi dasar tetap adalah idealisasi mekanis
yang terpisah dari opsi kondisi termal dasar.

Beton lama diasumsikan matang dengan sumber panas nol dan suhu awal seragam;
riwayat termal/stres >2 bulan tidak direkonstruksi. Umur tidak membuktikan inti
beton telah mencapai suhu udara. K/a dan properti termal perlu data uji.
Radiasi matahari, penguapan, bekisting padat, cooling pipe, dan equivalent age
belum dimodelkan. Creep/susut serta perkembangan kuat tekan/E(t) yang tersedia
memerlukan data proyek; memilih kode tidak mengkalibrasi model retak.

Impor native dan solver MIDAS belum tersedia untuk diuji di lingkungan ini.
Periksa kartu hidrasi pada rilis Civil NX yang dipakai, temperatur elemen baru/node sambungan,
kelanjutan umur panas, neraca energi serta konvergensi mesh/waktu. Hasil
tegangan elastis bukan penilaian retak tervalidasi. Verifikasi jurnal belum
dilakukan; pola staging mengacu tutorial resmi MIDASIT dan sintaks klasik
dicocokkan dengan contoh MCT publik yang tercantum di aplikasi.

## Pengembangan dan pemeriksaan

Sumber: `index.html`, `styles.css`, `thermal.js`, `time-dependent.js`, `engine.js`, `viewport.js`, `app.js` dan
`nx-ui.js`, tanpa bundler npm
atau dependensi runtime eksternal. Mesh dibentuk secara lokal, tidak mengambil
model MCT dari server. Guard resource: 100.000 elemen / 125.000 node.

```sh
python3 scripts/build_html.py
node tests/engine.test.js
node tests/thermal.test.js
python3 tests/browser_smoke.py
python3 tests/nx_browser.py
python3 tests/thermal_browser.py
```

Builder menggunakan Python standard library. Tes browser memerlukan Python
Playwright dan Chromium (hanya untuk pengembangan, bukan pemakaian HTML).
Pratinjau mesh memeriksa konektivitas dan Jacobian penampang; ekstrusi lurus
berlapis positif menjaga orientasi HEX8. Pemeriksaan input tidak menggantikan
parser native maupun studi konvergensi hasil solver.
