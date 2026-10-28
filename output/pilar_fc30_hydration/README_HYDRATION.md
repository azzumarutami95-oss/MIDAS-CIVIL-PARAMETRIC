# Model contoh panas hidrasi bertahap — MIDAS Civil klasik

File: **PILAR_FC30_HYDRATION_STAGED_ASSUMED.mct**.

Status: **input contoh dengan asumsi**, atas persetujuan pengguna. Mesh, material
termal, sumber panas, konveksi, temperatur dasar, grup batas, tahapan hidrasi,
kontrol analisis, dan node pemantauan sudah ditulis di MCT. Impor dan solver MIDAS
belum dijalankan. Tidak ada hasil prediksi temperatur atau penilaian retak yang
diklaim sudah tervalidasi.

## Geometri dan beton eksisting

- Pilar solid diameter 7,5 m, pusat X = Y = 0.
- Beton lama: Z = 0–4 m, umur aktual menurut pengguna >2 bulan.
- Beton baru: Z = 4–8 m, dicor sekaligus.
- 26.433 node, 24.576 elemen HEX8; 12.288 elemen per tahap.
- 801 node sambungan pada Z = 4 m dipakai bersama; kontak termal/ikatan sempurna.
- Penampang 5 blok dan 32 lapis vertikal @0,25 m, tanpa elemen pusat degenerat.

Analisis dimulai dari keadaan beton lama sebelum pengecoran baru. Beton lama
tidak dicor ulang dan tidak diberi ulang kurva panas beton segar. Sumber panas
lama diasumsikan nol; sisa hidrasi diabaikan. Riwayat temperatur >2 bulan tidak
direkonstruksi. Umur lama bukan parameter AGE tambahan pada kartu HYD-STAGE.

**Umur >2 bulan tidak membuktikan suhu inti beton lama sama dengan udara.**
Untuk diameter sebesar ini, ganti temperatur awal seragam dengan hasil
pengukuran atau riwayat termal yang dapat dipertanggungjawabkan sebelum dipakai
untuk penilaian proyek. Asumsi nol sisa panas juga perlu ditinjau bila memakai
semen/pengganti semen dengan reaksi jangka panjang.

## Parameter contoh dan satuan

**File hidrasi menggunakan N, m, kJ, °C; waktu hidrasi dalam jam dan massa kg.**
Ini berbeda dari file geometri awal yang menggunakan kN. Jangan menyalin angka
material dari file ini ke model dengan satuan lain tanpa konversi.

| Parameter | Asumsi fisik | Angka dalam MCT |
| --- | --- | --- |
| f'c | 30 MPa | Dasar nama dan E; bukan input perkembangan kekuatan |
| E | 4700√30 = 25.742,9602 MPa | 25.742.960.202,7428 N/m² |
| Poisson | 0,20 | 0,20 |
| Massa jenis | 2.400 kg/m³ | DEN = 23.535,96 N/m³, g = 9,80665 m/s² |
| Panas jenis | 0,90 kJ/kg·°C | SPHEAT = 0,90 |
| Konduktivitas | 2,40 W/m·°C | HEATCO = 8,64 kJ/m·jam·°C |
| Muai termal | 1,0 × 10^-5 /°C | 1,0e-5 |
| Suhu awal beton lama | 28°C seragam | 28 |
| Suhu pengecoran beton baru | 30°C | 30 |
| Udara | 28°C konstan | 28 |
| Suhu dasar | 28°C konstan, reservoir ideal | 28 |

Massa jenis dan berat isi konsisten melalui gamma = rho g. Dokumentasi unit
MIDAS memetakan N ke kg dan kN ke ton; pemakaian N di sini menghindari salah
memasukkan panas jenis dalam kJ/ton. Konduktivitas dan konveksi dikalikan **3,6**
untuk mengubah W menjadi kJ/jam. Nilai massa jenis 2.400 kg/m³ pada contoh termal
ini menghasilkan berat isi 23,536 kN/m³; ini merupakan asumsi yang diperbarui
secara konsisten, bukan angka 24 kN/m³ persis pada model geometri sebelumnya.

### Sumber panas beton baru

Dipakai tabel kenaikan temperatur adiabatik:

```text
ΔTad(t) = K [1 − exp(−a t/24)]
K = 45 °C
a = 0,50 per hari
t = umur beton baru dalam jam sejak aktivasi
```

Kartu `HYD-HEATSRCF` menggunakan `USER, 1, YES`: ordinat tabel adalah **kenaikan
temperatur adiabatik**, bukan temperatur absolut dan bukan laju panas yang
dimasukkan dua kali. Kurva hanya untuk beton baru; beton lama memakai kurva nol.

Dengan rho cp = 2.160 kJ/m³·°C, energi asimtotik = 97.200 kJ/m³ dan laju awal
ideal = 2.025 kJ/m³·jam. Temperatur adiabatik batas beton baru 30 + 45 = 75°C
bukan hasil temperatur pilar: model pilar mengalami perpindahan panas.

**K dan a bukan hasil uji campuran dan tidak diturunkan dari f'c 30 MPa.**
Kurva sederhana ini mengabaikan induksi awal yang terukur, perubahan sifat
terhadap umur, dan ketergantungan laju reaksi pada temperatur. Equivalent age
dimatikan karena belum ada kalibrasi energi aktivasi. Jika data uji adiabatik/
semiadiabatik tersedia, ganti tabel atau parameter sumber panas secara sesuai.

### Kondisi permukaan

| Grup | Permukaan | h fisik W/m²·°C | MCT kJ/m²·jam·°C |
| --- | --- | --- | --- |
| OLD_SIDE | Sisi beton lama | 10 | 36 |
| OLD_TOP | Atas beton lama, hanya sebelum pengecoran baru | 10 | 36 |
| NEW_FORM | Sisi beton baru dengan bekisting | 3 | 10,8 |
| NEW_AIR | Sisi beton baru setelah bongkar bekisting | 10 | 36 |
| TOP_CURE | Atas beton baru selama curing | 5 | 18 |
| TOP_AIR | Atas beton baru setelah curing | 10 | 36 |

Nilai bekisting dan curing adalah **koefisien efektif asumsi**. Tidak ada elemen
bekisting eksplisit, model kelembapan/evaporasi, air curing, radiasi matahari,
radiasi gelombang panjang, ataupun pipa pendingin. h udara bukan nilai universal:
kecepatan angin, orientasi, dan kondisi penutup memengaruhinya.

Dasar Z = 0 memakai temperatur tetap 28°C, mewakili reservoir panas ideal.
Fondasi/struktur di bawah pilar tidak dimodelkan. Ini dapat memengaruhi gradien
di bagian bawah. Uji sensitivitas dengan dasar adiabatik atau domain fondasi
eksplisit sebelum menyimpulkan pengaruh pengekangan/perpindahan panas dasar.
Dasar tidak diberi konveksi sekaligus dengan temperatur tetap.

## Staging hidrasi

Waktu STEP adalah **waktu lokal kumulatif tiap tahap dalam jam**. Awal pengecoran
baru terjadi pada waktu global 1 jam; umur beton baru = waktu global − 1 jam.

| Tahap | Waktu global | Umur beton baru | Aktivasi dan perubahan |
| --- | --- | --- | --- |
| H0_OLD_INIT | 0–1 jam | Belum dicor | Aktifkan beton lama pada 28°C; sumber nol; konveksi sisi dan atas; dasar tetap |
| H1_POUR_FORM | 1–73 jam | 0–72 jam | Aktifkan seluruh beton baru sekali pada 30°C; sumber baru; bekisting dan curing atas aktif; OLD_TOP dinonaktifkan |
| H2_STRIP_FORM | 73–169 jam | 72–168 jam | NEW_FORM nonaktif, NEW_AIR aktif; beton dan sumber panas terus berlangsung; temperatur tidak diinisialisasi ulang |
| H3_END_CURING | 169–721 jam | 168–720 jam | TOP_CURE nonaktif, TOP_AIR aktif; pendinginan diteruskan sampai hari ke-30 |

Beton lama tidak dinonaktifkan. Beton baru tidak diaktifkan ulang ketika
bekisting/curing berubah. Bidang sambungan Z = 4 m adalah permukaan luar hanya
pada H0; setelah pengecoran baru, tidak ada konveksi pada bidang internal itu.
`NAME=..., NO, 0` pada H2/H3 berarti opsi temperatur awal **dimatikan**, bukan
pendinginan atau reset beton ke 0°C.

Langkah waktu contoh: 0,5 jam pada umur 0–24 jam; 1 jam pada 24–72 jam; 2 jam
pada 72–168 jam; 6 jam pada 168–720 jam. Faktor integrasi theta = 1 (backward
Euler). Jadwal ini belum dibuktikan melalui studi konvergensi.

### Batas interpretasi tegangan

Translasi dasar dikekang (`111000`) sebagai idealisasi mekanis agar model tidak
mempunyai gerakan benda tegar. Berat sendiri, equivalent age, creep dan susut
dimatikan. Material memakai E konstan, belum ada perkembangan modulus, kuat
tarik/tekan, creep/susut dan keadaan tegangan awal beton lama yang terkalibrasi.
`TYPE=BOTH` pada HYD-CTRL adalah jenis creep/susut yang **tidak diaktifkan**,
bukan pemilih mode termal/tegangan.

Fokus model ini adalah menyiapkan kasus temperatur transien. Jika Civil
menghasilkan tegangan elastis, hasil itu belum layak menjadi keputusan risiko
retak. Tambahkan model mekanis umur dini dan pengekangan aktual untuk analisis
termomekanis/retak.

## Impor dan pemeriksaan di MIDAS Civil klasik

1. Mulai dari model baru/kosong. Buka MCT Command Shell dan muat file `.mct`.
2. Jalankan perintah; periksa log impor. Jumlah yang diharapkan: 26.433 node,
   24.576 solid, 2 material, 4 tahap hidrasi, dan 6 titik pemantauan.
3. Periksa satuan **N–m–kJ–°C** dan jam di dialog hidrasi. Pastikan panas jenis
   0,90, konduktivitas 8,64 dan h udara 36 tampil dengan satuan yang sesuai.
4. Periksa material lama tidak menghasilkan panas baru; waktu nol sumber baru
   mengikuti aktivasi beton baru pada H1, bukan dihitung sebagai sudah berumur
   satu jam pada awal H1.
5. Periksa temperatur awal 30°C diterapkan pada beton yang baru diaktifkan;
   temperatur beton lama dan sejarahnya tidak direset. Semantik ini mengikuti
   pola tutorial resmi, tetapi tetap harus diperiksa pada rilis Civil Anda.
6. Tampilkan setiap tahap. Pada H0 hanya beton bawah aktif. Pada H1 kedua beton
   aktif; konveksi OLD_TOP sudah hilang. H2/H3 hanya mengganti grup batas.
7. Jalankan Heat of Hydration Analysis melalui antarmuka Civil. MCT ini
   mendefinisikan input; tidak mengeksekusi solver otomatis.
8. Tinjau temperatur inti, permukaan, sambungan dan dasar, neraca energi, serta
   waktu dan nilai puncak. Grafik ΔT inti–permukaan harus membandingkan lokasi
   pada elevasi/waktu yang sama, misalnya NEW_CORE_Z6 dan NEW_SIDE_Z6.
9. Ulangi dengan timestep setengah dan mesh lebih halus. Uji sensitivitas suhu
   awal beton lama, K/a, h/curing/bekisting, serta kondisi termal dasar. Jangan
   menyatakan konvergen sebelum membandingkan hasil solver.

Tidak ada instalasi MIDAS Civil di lingkungan pembuat file ini. Jika suatu
rilis klasik menolak kartu/opsi, simpan pesan error beserta nomor barisnya.
Kemampuan API NX yang dipakai sebagai pembanding definisi bukan bukti bahwa
setiap opsi telah diuji pada semua rilis Civil klasik.

## Isi paket dan cara mengubah asumsi

- `parameters.json`: semua parameter contoh dan status asumsi.
- `thermal_input_units.csv`: angka fisik dan konversinya ke unit MCT.
- `staging_schedule.csv`: tahap, waktu, grup aktif dan jumlah elemen/muka.
- `convection_faces.csv`: daftar elemen, nomor muka lokal, node, luas, dan h.
- `adiabatic_heat_curve.csv`: kurva adiabatik dan audit energi sumber panas.
- `monitor_nodes.csv`: koordinat dan ID titik pemantauan.
- `input_verification.json`: audit masukan/topologi, **bukan** hasil solver.
- `SOURCES.md`: sumber input MIDAS, keterbatasan akses jurnal dan rujukan lanjutan.
- `INPUT_DIAGRAM.png`: kurva masukan, jadwal batas, dan tahapan; bukan hasil suhu.

Untuk meregenerasi dari checkout repositori, edit `parameters.json` lalu jalankan:

```sh
python3 scripts/generate_hydration_model.py
```

Membutuhkan Python 3 dan NumPy. Generator memakai kembali
`scripts/generate_pilar_fc30.py`. Simpan salinan parameter sebelum mengubahnya.
Geometri dan topologi mesh saat ini tetap D7,5 m, H4+4 m. Untuk geometri lain,
ubah generator mesh dan validasinya sebagai perubahan pemodelan terpisah.

Pemeriksaan yang lulus: Jacobian dan konektivitas mesh; pembacaan ulang tabel
node/elemen MCT; grup beton aktif sekali; tidak ada muka konveksi aktif rangkap
atau pada sambungan internal; semua muka luar aktif tercakup konveksi atau
temperatur dasar; satuan/kurva masukan konsisten. Pemeriksaan ini tidak menguji
parser native Civil atau hasil temperatur/tegangan.
