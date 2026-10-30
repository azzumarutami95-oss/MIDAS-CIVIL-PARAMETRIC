# Civil Hydration NX untuk Windows

**[Buka halaman unduh installer di GitHub Releases](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/latest)**

**[Unduh langsung installer v1.1.1 — pembaruan material (.exe)](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/download/v1.1.1-materials/Civil-Hydration-NX-Setup-1.1.1-x64.exe)**

Berkas versi 1.1.1: `Civil-Hydration-NX-Setup-1.1.1-x64.exe`.
Paket ini ditujukan untuk Windows 10/11 64-bit dengan prosesor x64. Aplikasi
menyertakan Electron/Chromium sehingga penggunaan normal tidak memerlukan
instalasi Node.js, Python, browser tambahan, atau koneksi internet.

## Instalasi dan penggunaan

1. Unduh installer `.exe` dari bagian **Assets** pada halaman Releases.
2. Jalankan installer, pilih folder instalasi untuk akun pengguna Anda, lalu
   selesaikan instalasi. Instalasi per pengguna tidak memerlukan hak administrator.
3. Buka **Civil Hydration NX** melalui shortcut desktop atau Start Menu.
4. Atur geometri, mix design, material termal, konveksi, sumber panas dan tahapan.
   Pada **Thermal & heat**, specific heat dan heat conduction dapat memakai
   input manual atau metode perhitungan yang tersedia.
   Pada **Time Dependent Material**, pilih kode C&S dan perkembangan kuat
   tekan, isi parameter atau tabel custom jobmix, lalu periksa link material.
5. Klik **Save** untuk menyimpan proyek JSON yang dapat diedit kembali. Untuk
   proyek baru, pilih nama dan folder tujuan pada dialog penyimpanan.
6. Klik **Unduh .MCT** atau gunakan **File → Ekspor model .MCT…**. Pilih nama
   dan folder tujuan pada dialog penyimpanan, kemudian impor file ke MIDAS Civil.

Installer saat ini belum ditandatangani secara digital; Windows mungkin
menampilkan penerbit yang belum terverifikasi. Status ini tidak menyatakan
adanya sertifikasi dari MIDASIT.

Perhitungan input, pratinjau, impor/ekspor JSON dan pembuatan MCT berjalan
offline. Tautan rujukan teknis dibuka di browser sistem dan membutuhkan internet.
Aplikasi ini menyusun input; analisis suhu dan tegangan dilakukan di MIDAS Civil.

## Open, Save dan Save As

File proyek berupa JSON dan menyimpan seluruh parameter: geometri, mesh, mix
design, material mekanis, specific heat dan heat conduction beserta metode
perhitungan dan properti fasenya, material beton lama, temperatur, konveksi,
sumber panas, kondisi batas, staging, C&S, perkembangan kuat tekan dan link
material bergantung waktu. Membuka JSON mengisi kembali parameter
tersebut agar dapat diedit dan diekspor menjadi MCT baru.

Rilis v1.1.1 menambahkan **SW · Dead Load (D) · LG_SW** dengan faktor global
default **(0, 0, −1)**. Faktor tersedia di panel Model dan ikut tersimpan pada
JSON, pratinjau, laporan TXT serta ekspor MCT. Proyek JSON v1 lama memperoleh
parameter SW default saat dibuka. Grup aktif mulai H0 dan dipertahankan pada
tahap berikutnya; berat sendiri otomatis hidrasi tetap nonaktif agar beban
tidak dihitung ganda. Lihat [rincian SW](../web/README.md#berat-sendiri-sw).

Pembaruan material tetap memakai versi aplikasi **1.1.1**. C&S menyediakan
ACI native MIDAS, CEB-FIP 1990, AASHTO LRFD 2006 dan fungsi user; perkembangan
kuat tekan menyediakan ACI, CEB-FIP, konvensi AASHTO/WSDOT melalui ACI, serta
tabel custom `umur, fc, ft, E`. Definisi dan link material ikut masuk ke MCT,
pratinjau, laporan, dan JSON. Default menghubungkan beton baru saja. Proyek
JSON lama yang belum memiliki parameter ini membukanya dalam keadaan
nonaktif untuk mempertahankan perilaku mekanis sebelumnya.
[Rumus, satuan dan batas material bergantung waktu](../web/TIME_DEPENDENT_METHODS.md).
Aset pembaruan berada pada revisi rilis `v1.1.1-materials`, termasuk
[contoh MCT](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/download/v1.1.1-materials/PILAR_TIME_DEPENDENT_EXAMPLE.MCT)
dan [parameter JSON contoh](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/download/v1.1.1-materials/PARAMETER_TIME_DEPENDENT_EXAMPLE.json).

- **Open / Buka (`Ctrl+O`)** memilih proyek melalui dialog Windows. JSON yang
  dibuka menjadi file proyek aktif.
- **Save (`Ctrl+S`)** menyimpan perubahan ke file aktif yang sama. Pada proyek
  yang belum memiliki lokasi, Save meminta nama dan folder terlebih dahulu.
- **Save As (`Ctrl+Shift+S`)** memilih nama atau lokasi baru, lalu menjadikannya
  file aktif. File asli tetap dipertahankan.

Nama file aktif ditampilkan di header. Tanda `*` menunjukkan perubahan yang
belum disimpan ke file. Jika proyek berubah lalu Anda membuka file lain atau
menutup aplikasi, dialog menawarkan menyimpan perubahan, membuang perubahan,
atau membatalkan tindakan tersebut.

JSON proyek memakai format yang sama dengan versi HTML sehingga parameter
dapat dipindahkan di antara kedua aplikasi. Save/Save As yang menulis langsung
ke file aktif tersedia pada aplikasi Windows; tombol Simpan versi HTML tetap
mengunduh salinan JSON melalui browser.

Aplikasi mengedit parameter proyek JSON. File `.MCT` merupakan hasil ekspor
untuk MIDAS Civil; aplikasi tidak membuka dan mengedit file MCT yang sudah ada.

## Pemulihan lokal dan pemindahan pekerjaan

Parameter valid juga disimpan otomatis pada profil lokal aplikasi sebagai
salinan pemulihan. Penyimpanan ini terpisah dari file proyek dan penyimpanan
browser versi HTML. Setelah aplikasi dijalankan kembali, parameter lokal dapat
dipulihkan, tetapi lokasi file proyek sebelumnya tidak otomatis menjadi file
aktif. Gunakan **Buka** untuk melanjutkan file yang sama; jika langsung memilih
Save, aplikasi akan meminta lokasi penyimpanan.

Untuk memindahkan pekerjaan dari versi HTML:

1. Pada versi HTML, klik **Simpan** untuk mengekspor parameter `.json`.
2. Buka aplikasi Windows, klik **Buka**, lalu pilih JSON tersebut.
3. Periksa kembali parameter. Gunakan **Save As** untuk membuat salinan kerja
   dengan nama baru sebelum mengubah model jika file awal perlu dipertahankan.

Pembaruan dengan identitas aplikasi yang sama mempertahankan profil lokal.
Uninstaller dikonfigurasi untuk mempertahankan data aplikasi; tetap gunakan
JSON sebagai cadangan portabel, khususnya sebelum memindahkan PC atau
menghapus profil pengguna Windows.

Pintasan yang tersedia:

| Perintah | Pintasan |
| --- | --- |
| Buka parameter JSON | `Ctrl+O` |
| Save proyek aktif | `Ctrl+S` |
| Save As proyek | `Ctrl+Shift+S` |
| Ekspor model MCT | `Ctrl+Alt+E` |

Ringkasan input `.txt` dapat disimpan melalui **File → Simpan ringkasan input…**
atau tombol **Input report**. Dialog penyimpanan menentukan lokasi berkas ekspor.

## Batas penerapan

Fitur perhitungan material, konversi satuan, mesh HEX8 dan staging memakai mesin
yang sama dengan aplikasi HTML. Parameter contoh tetap memerlukan kalibrasi
terhadap campuran dan kondisi proyek. Baca [rumus dan batas metode termal](../web/THERMAL_METHODS.md)
serta [material bergantung waktu](../web/TIME_DEPENDENT_METHODS.md) dan
[petunjuk input](../web/README.md). Tabel foto campuran tidak otomatis
menghasilkan kurva creep, shrinkage, kuat tarik, atau modulus terukur.

Paket ini merupakan aplikasi independen. File keluaran berbentuk `.MCT`;
setelah impor, model native disimpan melalui MIDAS Civil. Keberhasilan build
installer tidak membuktikan kompatibilitas seluruh kartu MCT atau validitas
hasil solver. [Pengujian Windows v1.1.0](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/actions/runs/40728766613)
berhasil: instalasi per pengguna, pembukaan aplikasi terpasang, Save ke file aktif,
Save As dengan file asal tetap utuh, pembatalan dan kegagalan Save As, membuka
proyek lalu menyimpan editnya, penolakan JSON rusak, pengingat perubahan sebelum
Open/close, simpan sebelum membuka proyek lain atau menutup aplikasi, ekspor
MCT/TXT, pemulihan parameter setelah restart, dan uninstall. Berkas rilis dilengkapi
`SHA256SUMS.txt`. Pengujian ini tidak menjalankan parser atau solver MIDAS.

## Build dari source

Gunakan Windows x64 dengan Node.js LTS, npm dan Python 3. Skrip build mengacu
pada perintah `python3` di `PATH`. Pillow dipakai untuk membuat ikon PNG/ICO.
Koneksi internet diperlukan saat mengunduh dependensi dan runtime build.

Jalankan dari folder repository:

```powershell
python3 -m pip install Pillow
npm ci
npm test
npm run build:win
```

Jika instalasi Python hanya menyediakan perintah `python`, tahap aset dan
packaging yang setara dapat dijalankan sebagai berikut setelah `npm ci` dan
`npm test`:

```powershell
python -m pip install Pillow
python scripts/build_desktop_assets.py
npx electron-builder --win nsis --x64 --publish never
```

Hasil installer berada di:

```text
dist/Civil-Hydration-NX-Setup-1.1.1-x64.exe
```

`npm start` membuka versi pengembangan setelah dependensi dan aset tersedia.
Versi dependensi build dikunci melalui `package-lock.json`; konfigurasi paket
dan installer berada di [package.json](../package.json).

Workflow [Windows build](../.github/workflows/windows.yml) membangun dan
menerbitkan installer untuk tag rilis berpola `v*`. Untuk rilis berikutnya,
sesuaikan versi paket terlebih dahulu agar nama installer mengikuti nomor
versi tersebut. Rilis otomatis menggunakan konfigurasi NSIS per pengguna,
pilihan folder instalasi, shortcut desktop/Start Menu, dan penyimpanan data
aplikasi saat uninstall.
