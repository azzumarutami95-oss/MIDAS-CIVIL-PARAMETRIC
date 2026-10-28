# Pilar solid untuk MIDAS Civil klasik

File utama: **PILAR_D7500_H8000_FC30_HEX8.mct**.

## Isi model

| Parameter | Nilai |
| --- | --- |
| Penampang | Lingkaran solid, diameter 7,5 m |
| Sumbu pilar | Z; pusat penampang X = Y = 0 |
| Tinggi | 8 m, dari Z = 0 sampai Z = 8 m |
| Tahap 1 / material 1 | Beton lama, Z = 0–4 m; umur aktual >2 bulan |
| Tahap 2 / material 2 | Beton baru, Z = 4–8 m; dicor satu tahap |
| Elemen | 24.576 solid hexahedral 8-node, tanpa elemen beam/plate |
| Node | 26.433 |
| Pembagian vertikal | 32 lapis @ 0,25 m; 16 lapis per tahap |
| Penampang | 768 quad per lapis, 5 blok; 64 sisi pada keliling |
| Sambungan Z = 4 m | 801 node bersama; tidak ada node rangkap |
| Satuan | kN, m, kJ, derajat Celsius |

Mesh terdiri dari satu blok persegi di tengah dan empat blok luar yang mengikuti
lingkaran. Tidak ada elemen yang mengerucut menjadi titik pada sumbu pilar.
Keliling memakai chord lurus dari elemen orde pertama. Volume mesh 352,792386 m3,
lebih kecil 0,180174% dari silinder ideal 353,429174 m3 akibat aproksimasi keliling.

## Material f'c = 30 MPa

Dua material beton didefinisikan agar beton lama dan baru mudah dibedakan dan
dapat diberi data termal berbeda nantinya. Nilai mekanis awal keduanya sama:

- Nama: `FC30_OLD` dan `FC30_NEW`.
- Modulus elastisitas asumsi beton berat normal: E = 4700 sqrt(30) =
  **25.742,9602 MPa** = 25,7429602 GPa.
- Poisson ratio = **0,20**.
- Berat isi asumsi = **24 kN/m3**.
- Koefisien muai termal asumsi = **1,0e-5 /derajat Celsius**.

Format material yang digunakan adalah CONC dengan data elastis isotropik user.
Format ini tidak memiliki kolom kuat tekan tersendiri: f'c 30 MPa menjadi dasar
penamaan dan perhitungan E. Model ini tidak mendefinisikan kurva tegangan-regangan,
perkembangan kuat tekan, kuat tarik, atau parameter retak. Nilai E, Poisson,
berat isi, dan muai termal perlu disesuaikan apabila data campuran tersedia.

## Cara impor

1. Buat model **baru/kosong** di MIDAS Civil klasik agar ID node/elemen tidak
   bertabrakan dengan model lain. Gunakan satuan kN dan m.
2. Buka **Tools > MCT Command Shell**, lalu gunakan fungsi membuka/membaca file
   pada Command Shell untuk memuat `PILAR_D7500_H8000_FC30_HEX8.mct`.
   Bila versi Anda menyediakan impor MCT langsung, file yang sama dapat dipakai.
3. Jalankan perintah MCT (Run/Execute sesuai versi). Periksa log pesan impor.
4. Tampilkan semua elemen dalam tampilan isometrik dan mode solid/shaded.
   Gunakan warna berdasarkan material untuk membedakan beton lama dan baru.
5. Pastikan terdapat **26.433 node, 24.576 elemen solid, dan 2 material**.
   Periksa rentang koordinat: X dan Y = -3,75 sampai +3,75 m; Z = 0 sampai 8 m.
6. Periksa grup `STAGE1_OLD`, `STAGE2_NEW`, `JOINT_Z4`, `BASE_Z0`, `TOP_Z8`,
   `OUTER_SIDE`, dan `AXIS_NODES`, lalu simpan model sebagai file MIDAS Civil.

Jika impor dihentikan dengan pesan error, simpan log dan nomor barisnya untuk
penyesuaian terhadap rilis Civil yang digunakan. MIDAS Civil tidak tersedia di
lingkungan Linux pembuat file ini; impor dan solver MIDAS **belum diuji langsung**.

## Batas lingkup analisis panas hidrasi

Ini adalah **model dasar geometri, mesh, material elastis, dan grup**. Jangan
langsung menjalankan analisis hidrasi. `SPHEAT` dan `HEATCO` pada material masih
bernilai **0 sebagai belum ditetapkan**, bukan nilai properti termal beton.
Grup tahap belum merupakan definisi construction stage atau aktivasi elemen.
Umur >2 bulan tercatat dalam petunjuk; belum dimasukkan sebagai material age.

Untuk analisis panas hidrasi yang bermakna, masih diperlukan:

- Kapasitas panas jenis, konduktivitas, dan data campuran termasuk jenis/kadar
  semen serta kurva kenaikan suhu adiabatik atau hukum pembangkitan panas.
- Suhu awal beton lama, suhu pengecoran beton baru, suhu lingkungan terhadap
  waktu, serta waktu mulai dan durasi simulasi.
- Konveksi permukaan, jenis/durasi bekisting, curing/insulasi, serta kondisi
  perpindahan panas pada dasar ke struktur/fondasi di bawahnya.
- Definisi tahap analisis/aktivasi beton dan umur beton sesuai rilis Civil.
- Jika menghitung tegangan/risiko retak: tumpuan, modulus terhadap umur, creep,
  susut, dan kuat tarik terhadap umur.

Node bersama pada sambungan mengasumsikan kontak termal dan ikatan mekanis
sempurna. Tidak ada resistansi kontak atau slip. Belum ada tumpuan atau beban.
Beton lama berumur >2 bulan tidak diaktifkan kembali sebagai beton baru pada
file dasar ini; riwayat termalnya perlu diatur saat melengkapi analisis.

## Pemeriksaan dan berkas tambahan

`mesh_quality.json` menyimpan hasil pemeriksaan pada koordinat dan konektivitas
yang dibaca ulang dari file MCT:

- Jacobian positif di 8 sudut, 8 titik Gauss, dan pusat setiap elemen.
- Minimum scaled Jacobian sekitar **0,7071**.
- Panjang rusuk sekitar **0,1704–0,4660 m**.
- Rasio panjang rusuk maksimum per elemen sekitar **1,8641**.
- Tidak ada node/elemen rangkap, orphan node, atau permukaan retak internal.
- Sambungan kedua tahap berbagi 801 node dan 768 muka elemen.

Pemeriksaan geometri ini bukan studi konvergensi mesh untuk temperatur/tegangan.
Lakukan studi konvergensi setelah data termal dan skenario analisis ditetapkan.

- `PREVIEW_MESH.png`: pratinjau dari mesh aktual, bukan gambar AI.
- `PILAR_FC30_HEX8.vtk`: salinan mesh untuk inspeksi di ParaView atau pembaca VTK.
- `generate_pilar_fc30.py`: generator dan pemeriksaan; membutuhkan Python 3,
  NumPy, dan Matplotlib. Jalankan dari direktori paket:

  ```sh
  python3 generate_pilar_fc30.py --out hasil_regenerasi
  ```

Sintaks MCT dicocokkan dengan contoh ekspor publik berikut. Ini bukan bukti
kompatibilitas untuk setiap rilis MIDAS Civil:

- https://github.com/TimmyTran22/Midas/blob/main/generateMct2.py
- https://github.com/1molPotato/ifc2mct/blob/master/Tests/TestFiles/mct-test.mct
- https://github.com/lizhao2022/MIDAS_MCT/blob/master/prototype.mct
