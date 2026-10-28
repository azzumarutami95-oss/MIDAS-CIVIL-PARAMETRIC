# Civil Hydration NX untuk Windows

**[Buka halaman unduh installer di GitHub Releases](https://github.com/azzumarutami95-oss/MIDAS-CIVIL-PARAMETRIC/releases/latest)**

Berkas versi 1.0.0: `Civil-Hydration-NX-Setup-1.0.0-x64.exe`.
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
5. Klik **Unduh .MCT** atau gunakan **File → Ekspor model .MCT…**. Pilih nama
   dan folder tujuan pada dialog penyimpanan, kemudian impor file ke MIDAS Civil.

Installer saat ini belum ditandatangani secara digital; Windows mungkin
menampilkan penerbit yang belum terverifikasi. Status ini tidak menyatakan
adanya sertifikasi dari MIDASIT.

Perhitungan input, pratinjau, impor/ekspor JSON dan pembuatan MCT berjalan
offline. Tautan rujukan teknis dibuka di browser sistem dan membutuhkan internet.
Aplikasi ini menyusun input; analisis suhu dan tegangan dilakukan di MIDAS Civil.

## Menyimpan dan memindahkan pekerjaan

Parameter valid disimpan otomatis pada profil lokal aplikasi. Profil desktop
terpisah dari penyimpanan browser versi HTML. Untuk memindahkan pekerjaan:

1. Pada versi HTML, klik **Simpan** untuk mengekspor parameter `.json`.
2. Buka aplikasi Windows, klik **Buka**, lalu pilih JSON tersebut.
3. Periksa kembali parameter dan simpan cadangan JSON sebelum mengubah model.

Pembaruan dengan identitas aplikasi yang sama mempertahankan profil lokal.
Uninstaller dikonfigurasi untuk mempertahankan data aplikasi; tetap gunakan
JSON sebagai cadangan portabel, khususnya sebelum memindahkan PC atau
menghapus profil pengguna Windows.

Pintasan yang tersedia:

| Perintah | Pintasan |
| --- | --- |
| Buka parameter JSON | `Ctrl+O` |
| Simpan parameter JSON | `Ctrl+S` |
| Ekspor model MCT | `Ctrl+Shift+S` |

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
hasil solver. Pengujian instalasi dan penggunaan pada Windows aktual masih
perlu dicatat terpisah dari pengujian numerik dan antarmuka di lingkungan build.

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
dist/Civil-Hydration-NX-Setup-1.0.0-x64.exe
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
