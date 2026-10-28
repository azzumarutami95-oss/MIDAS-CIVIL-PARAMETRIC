# Civil Hydration NX untuk Windows

**[Buka halaman unduh installer di GitHub Releases](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/latest)**

**[Unduh langsung installer v1.1.0 (.exe)](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/download/v1.1.0/Civil-Hydration-NX-Setup-1.1.0-x64.exe)**

Berkas versi 1.1.0: `Civil-Hydration-NX-Setup-1.1.0-x64.exe`.
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
sumber panas, kondisi batas dan staging. Membuka JSON mengisi kembali parameter
tersebut agar dapat diedit dan diekspor menjadi MCT baru.

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
serta [petunjuk input](../web/README.md).

Paket ini merupakan aplikasi independen. File keluaran berbentuk `.MCT`;
setelah impor, model native disimpan melalui MIDAS Civil. Keberhasilan build
installer tidak membuktikan kompatibilitas seluruh kartu MCT atau validitas
hasil solver. [Pengujian Windows v1.0.0](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/actions/runs/40722485089)
berhasil: instalasi per pengguna, pembukaan aplikasi terpasang, ekspor MCT/JSON/TXT,
pembatalan penyimpanan, impor JSON, pemulihan parameter setelah restart, dan
uninstall. Berkas yang diterbitkan dilengkapi `SHA256SUMS.txt`. Pengujian ini
tidak menjalankan parser atau solver MIDAS.

Pengujian Windows untuk fitur Open/Save/Save As versi 1.1.0 belum dicatat pada
dokumen ini; status build tersedia di halaman Actions repository.

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
dist/Civil-Hydration-NX-Setup-1.1.0-x64.exe
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
