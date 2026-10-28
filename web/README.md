# Civil Hydration — aplikasi HTML offline

Unduh **[CIVIL_HEAT_HYDRATION.html](../downloads/CIVIL_HEAT_HYDRATION.html)**,
simpan sebagai `.html`, lalu buka dengan browser desktop modern seperti Chrome
atau Edge. Tidak perlu Python, Node, server, instalasi, akun MIDAS API, atau
koneksi internet untuk menggunakan aplikasi. Aplikasi tidak mengirim parameter
ke server. Tautan referensi hanya dibuka bila diklik.

## Alur penggunaan

1. Atur diameter, tinggi beton lama/baru dan pembagian mesh. Default: D7,5 m,
   H4+4 m; 26.433 node dan 24.576 HEX8 dengan node sambungan bersama.
2. Periksa preset campuran dari foto. Kolom sumber foto adalah catatan tetap;
   kolom kg/m³, volume batch dan kadar air bebas dapat diubah.
3. Atur sifat termal, suhu awal/pengecoran, K/a, konveksi dan kondisi dasar.
   Opsi dasar **temperatur tetap** menghasilkan `HYD-PRTEMPER`. Opsi
   **adiabatik** menghilangkan kondisi temperatur tetap; fluks dasar nol.
4. Atur jam bongkar bekisting, akhir curing, akhir analisis dan langkah waktu.
5. Periksa pratinjau, konversi unit dan pesan pemeriksaan. Klik **Unduh .MCT**.
   Browser menghasilkan `PILAR_HEAT_HYDRATION.MCT` lengkap, berisi semua node,
   elemen, material, sumber panas, konveksi, tahapan dan kontrol analisis.
6. Impor ke model kosong pada MIDAS Civil klasik melalui MCT Command Shell.
   Periksa log parser, unit, aktivasi beton, sumber panas dan kondisi batas.

Gunakan **Simpan parameter JSON** untuk membawa pekerjaan ke perangkat lain.
**Buka parameter JSON** menerima format aplikasi `civil-heat-studio/v1`.
JSON masukan yang rusak/tidak valid tidak mengganti parameter saat ini. JSON
lama generator Python memakai format berbeda dan bukan format impor aplikasi.
**Unduh ringkasan input** menyimpan `.txt` berisi parameter, unit, jadwal,
node pemantauan dan batas interpretasi. Tombol reset meminta konfirmasi.

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

Satuan **N–m–kJ–°C, waktu hidrasi jam, massa kg**. Konduktivitas dan h yang
diisi dalam W dikonversi ke kJ/jam dengan faktor 3,6. Berat isi = rho ×9,80665.
E = 4700√f'c MPa, asumsi beton normal. f'c menjadi dasar E/nama; belum merupakan
kurva tegangan-regangan atau model perkembangan kuat tekan/tarik.

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
Belum ada radiasi matahari, penguapan, bekisting padat, cooling pipe, equivalent
age, creep/susut, E(t) atau model retak yang terkalibrasi.

Impor native dan solver MIDAS belum tersedia untuk diuji di lingkungan ini.
Periksa versi klasik yang dipakai, temperatur elemen baru/node sambungan,
kelanjutan umur panas, neraca energi serta konvergensi mesh/waktu. Hasil
tegangan elastis bukan penilaian retak tervalidasi. Verifikasi jurnal belum
dilakukan; pola staging mengacu tutorial resmi MIDASIT dan sintaks klasik
dicocokkan dengan contoh MCT publik yang tercantum di aplikasi.

## Pengembangan dan pemeriksaan

Sumber: `index.html`, `styles.css`, `engine.js` dan `app.js`, tanpa bundler npm
atau dependensi runtime eksternal. Mesh dibentuk secara lokal, tidak mengambil
model MCT dari server. Guard resource: 100.000 elemen / 125.000 node.

```sh
python3 scripts/build_html.py
node tests/engine.test.js
python3 tests/browser_smoke.py
```

Builder menggunakan Python standard library. Tes browser memerlukan Python
Playwright dan Chromium (hanya untuk pengembangan, bukan pemakaian HTML).
Pratinjau mesh memeriksa konektivitas dan Jacobian penampang; ekstrusi lurus
berlapis positif menjaga orientasi HEX8. Pemeriksaan input tidak menggantikan
parser native maupun studi konvergensi hasil solver.
