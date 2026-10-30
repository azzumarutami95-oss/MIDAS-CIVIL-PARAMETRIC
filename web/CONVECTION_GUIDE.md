# Panduan convection boundaries

Koefisien `h` menyatakan pertukaran panas permukaan dengan lingkungan melalui
`q″ = h × (Tpermukaan − Tlingkungan)`. Masukkan **W/(m²·°C)**; selisih suhu
dalam °C dan K setara. Untuk MCT N–m–kJ–°C dengan waktu jam, aplikasi memakai
`h_MCT = 3,6 × h` dalam kJ/(m²·jam·°C).

## Rentang acuan dan batas masukan

| Kondisi | Acuan h, W/(m²·°C) | Cara menggunakan |
| --- | ---: | --- |
| Udara, konveksi alami | 2–25 | Acuan umum gas tanpa penggerak aliran; periksa orientasi, ukuran, beda suhu dan kondisi angin. |
| Udara, konveksi paksa | 25–250 | Acuan umum aliran yang digerakkan; pilih berdasarkan kondisi aliran atau hasil kalibrasi. |
| Bekisting atau penutup curing | Tidak ada satu rentang universal | Gunakan sifat/ketebalan lapisan dan tahanan perpindahan panas, atau data pengukuran. |
| Masukan aplikasi | 0–200 | Batas numerik aplikasi, bukan rentang fisik aman atau persyaratan kode. |

Rentang udara berasal dari [kuliah perpindahan panas NPTEL/IIT, modul 6,
halaman 2](https://archive.nptel.ac.in/content/storage2/courses/112108149/pdf/M6/M6TeacherSlides.pdf).
Rentang tersebut bukan spesifikasi penerimaan untuk proyek beton tertentu.
Nilai 200–250 pada acuan konveksi paksa berada di luar batas masukan aplikasi;
jangan menggantinya dengan 200 hanya agar dapat diekspor.

`h = 0` menghasilkan **fluks konveksi nol pada permukaan tersebut**. Nilai ini
bukan koefisien udara biasa dan tidak mematikan konduksi, sumber panas hidrasi,
atau kondisi temperatur tetap. Kondisi termal dasar diatur terpisah.

## Acuan bekisting dan curing

[Manual MIDAS](https://support.midasuser.com/hc/en-us/articles/18297974301337-Convection-Coefficient-Functions)
memuat nilai rata-rata historis dari Korean Concrete Standard Specification
(1996). Berikut konversinya, dengan **1 kcal = 4184 J** dan faktor
`4184/3600 = 1,162222…` dari kcal/(m²·jam·°C) ke W/(m²·°C):

| Kondisi pada tabel sumber | kcal/(m²·jam·°C) | W/(m²·°C), dibulatkan |
| --- | ---: | ---: |
| Bekisting logam/baja | 12 | 13,9 |
| Plywood | 7 | 8,1 |
| Sheet | 5 | 5,8 |
| Curing mattress; watering + mattress; watering + sheet | 4,5 | 5,2 |
| Polystyrene 5 cm + sheet | 1,5 | 1,7 |

Ini **titik acuan rata-rata**, bukan batas bawah/atas yang harus dipenuhi.
Jenis bahan, ketebalan, kontak antarlapisan, kondisi basah dan angin proyek
dapat berbeda. Bekisting baja dan plywood tidak boleh dianggap mempunyai
koefisien yang sama hanya karena keduanya memakai bekisting.

Jika lapisan tidak dimodelkan sebagai elemen, perkiraan koefisien efektif
melalui lapisan dapat memakai:

```text
h_eff = 1 / (1/h_udara + Σ(d_i/k_i))
```

`d_i` adalah ketebalan lapisan dalam m dan `k_i` konduktivitas dalam W/(m·°C).
Hubungan ini adalah pendekatan tahanan seri satu dimensi; tambahkan tahanan
kontak jika diperlukan. [FHWA-HRT-04-127, persamaan 26](https://www.fhwa.dot.gov/publications/research/infrastructure/pavements/pccp/04127/alt.cfm)
menjelaskan penggabungan konveksi dan lapisan pelindung. Jangan menghitung
tahanan bekisting dua kali jika lapisan sudah dimodelkan sebagai elemen.

## Empat langkah memilih nilai

1. **Periksa permukaan dan tahap.** Pilih sisi/atas yang benar-benar terpapar.
   Konveksi atas beton lama dihentikan ketika menjadi sambungan internal saat
   beton baru aktif. Periksa waktu bongkar bekisting dan akhir curing.
2. **Cocokkan kondisi aktual.** Untuk udara terbuka, periksa angin, orientasi
   dan beda suhu. Untuk bekisting/penutup, gunakan data lapisan atau koefisien
   efektif terukur. Bedakan sheet, blanket dan kontak air langsung.
3. **Catat satuan dan asumsi.** Nilai awal aplikasi 10 untuk udara, 3 untuk
   sisi berbekisting, dan 5 untuk atas saat curing adalah asumsi contoh.
   Pilih nilai proyek secara eksplisit; panduan bukan kalibrasi otomatis.
4. **Uji sensitivitas dan cocokkan data.** Bandingkan beberapa nilai h yang
   masuk akal untuk kondisi lapangan, termasuk perubahan setelah stripping
   dan curing. Cocokkan riwayat temperatur permukaan/inti yang diukur dan
   periksa pengaruh mesh serta langkah waktu sebelum menilai tegangan.

Penyiraman, genangan, fogging dan penguapan tidak selalu dapat diwakili oleh
koefisien penutup yang sama. Temperatur air dan perpindahan kalor laten dapat
memerlukan model atau kalibrasi tersendiri. Radiasi dan penyinaran matahari
juga bukan otomatis tercakup dalam h udara. [FHWA Appendix B, bagian
B.1.2.2.3–B.1.2.5](https://www.fhwa.dot.gov/publications/research/infrastructure/pavements/pccp/04127/appb.cfm)
membedakan mekanisme tersebut. Memilih angka dalam rentang acuan tidak
membuktikan keamanan termal atau keberhasilan analisis native MIDAS.
