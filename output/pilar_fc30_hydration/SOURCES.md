# Sumber dan batas verifikasi

Tanggal penyiapan: 28 Oktober 2026. Parameter contoh bukan data material proyek
dan bukan angka yang diklaim diambil dari jurnal tertentu.

## Sumber yang dapat diperiksa pada tugas ini

1. **MIDASIT — tutorial resmi Heat of Hydration.**
   https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/examples/python/Tut7%20Heat%20of%20Hydration.py
   Dipakai untuk pola tahapan: aktifkan pengecoran atas, pertahankan beton bawah,
   dan nonaktifkan konveksi bekas permukaan atas saat menjadi bidang internal.
   Angka parameter tutorial tidak disalin sebagai angka proyek pilar ini.

2. **MIDASIT — implementasi Python resmi modul hidrasi.**
   https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/midas_civil/_heat_of_hydration.py
   Docstring `HoH.CS.STAGE` menyatakan `add_step` dalam jam. Implementasi
   mendukung grup elemen/batas aktif, batas nonaktif dan opsi temperatur awal.

3. **Contoh generator MCT Civil 2022 publik, TimmyTran22/Midas.**
   https://github.com/TimmyTran22/Midas/blob/main/generateMct2.py
   Referensi sintaks klasik `HYD-PRTEMPER`, `HYD-HEATSRCF`, `HYD-CONVCOEF`,
   `HYD-AMBTEMPF`, `HYD-HEATSRC`, `HYD-CONBNDR`, `HYD-STAGE`, `HYD-CTRL`,
   `HYD-NODE`, dan urutan muka HEX8. Ini contoh pihak ketiga, bukan hasil uji
   impor file pilar pada aplikasi Civil.

4. **Salinan publik dokumentasi API MIDAS Civil NX.**
   https://github.com/python261/midas-civil-NX-API/blob/main/db/project/Unit-System.md
   https://github.com/python261/midas-civil-NX-API/blob/main/db/hydration/Heat-Source-Functions.md
   https://github.com/python261/midas-civil-NX-API/blob/main/db/construction-stage/Define-Construction-Stage-for-Hydration.md
   https://github.com/python261/midas-civil-NX-API/blob/main/db/analysis-control/Heat-of-Hydration-Analysis-Control.md
   Pembanding pemetaan satuan N/kg, arti USER adiabatic-temperature, grup tahap,
   equivalent age, serta opsi creep/susut. Merupakan mirror dokumentasi API NX,
   sehingga bukan jaminan kompatibilitas semua versi klasik.

## Jurnal: belum diverifikasi pada tugas ini

Akses `support.midasuser.com` dan `api.crossref.org` ditolak oleh kebijakan proxy.
Belum ada naskah jurnal yang berhasil dibaca/diverifikasi. Karena itu paket ini
**tidak dinyatakan sebagai model yang sudah divalidasi berdasarkan jurnal**.
Rujukan teknis primer yang benar-benar diperiksa adalah sumber MIDAS di atas.

Dua kandidat bacaan dari pengetahuan bibliografi untuk diverifikasi selanjutnya:

- Schindler, A. K., dan Folliard, K. J. (2005), “Heat of Hydration Models for
  Cementitious Materials,” *ACI Materials Journal*, 102(1), 24–33.
  DOI kandidat: https://doi.org/10.14359/14246.
- Riding, K. A., Poole, J. L., Schindler, A. K., Juenger, M. C. G., dan Folliard,
  K. J. (2007), “Temperature Boundary Condition Models for Concrete Bridge
  Members,” *ACI Materials Journal*, 104(4), 379–387.

Detail bibliografi dan isi kedua kandidat belum diperiksa ulang dari penerbit
dalam tugas ini. Tidak ada angka K, a, k, cp, h atau jadwal bekisting pada paket
ini yang diklaim berasal dari keduanya. Juga tidak diklaim kedua artikel tersebut
menggunakan MIDAS Civil. Untuk memenuhi kajian khusus jurnal MIDAS Civil,
lanjutkan verifikasi sumber yang menyebut perangkat lunak, material, jadwal
tahap, kondisi batas dan pembandingan dengan pengukuran secara eksplisit.

Penambahan domain `manual.midasuser.com`, `support.midasuser.com`,
`api.crossref.org` dan `doi.org` telah disimpan sebagai draft konfigurasi
lingkungan. Penyimpanan draft tidak mengaktifkan akses atau mempublikasikan
lingkungan. Jika akses diaktifkan pengguna, rujukan yang terhambat perlu dibaca
dan penilaian bibliografi diperbarui sebelum mengklaim verifikasi jurnal.
