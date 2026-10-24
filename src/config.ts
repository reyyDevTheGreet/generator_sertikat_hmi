/**
 * =========================================================================
 * KONFIGURASI GENERATOR SERTIFIKAT SEMINAR HMP - DIVISI AKADEMIK
 * =========================================================================
 */
import { CertificateDesign, RoleConfig, RoleType, SignerInfo } from './types';

export const CONFIG = {
  // -----------------------------------------------------------------------
  // 1. SLUG ROUTE PANITIA (CETAK MASSAL)
  // -----------------------------------------------------------------------
  // Alamat rahasia panitia (unlisted slug), tidak ditautkan dari halaman publik.
  // Ganti nilai konstanta ini sewaktu-waktu jika ingin mengubah alamat halaman panitia.
  PANITIA_ROUTE_SLUG: 'panitia-x7k2',

  // -----------------------------------------------------------------------
  // 2. DATA SOURCE (GOOGLE SHEETS CSV - TAB FINAL)
  // -----------------------------------------------------------------------
  csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2hXv9YJadpwpiBT5MI38GD605o2Kq5fkPuwWYZqNl_r__YqWnlSAj-nAUPwVuFmX01fB2Ii44_vfw/pub?output=csv',

  // -----------------------------------------------------------------------
  // 3. IDENTITAS ORGANISASI & KONTAK
  // -----------------------------------------------------------------------
  organizationName: 'HIMPUNAN MAHASISWA ISLAM (HMI)',
  divisionName: 'Divisi Panitia Acara',
  universityName: 'STKIP Budidaya Binjai',
  contactPerson: 'Panitia Komisariat Budidaya',
  contactEmail: 'rayhanpsd881@gmail.com',
  contactWhatsapp: '6282170894285',

  // -----------------------------------------------------------------------
  // 4. DAFTAR 15 DESAIN SERTIFIKAT RESMI
  // -----------------------------------------------------------------------
  designs: [
    {
      id: 'klasik',
      nama: 'Klasik',
      suasana: ['formal', 'terang'],
      palet: { latar: '#FBF7EE', utama: '#1B2A49', aksen: '#B8923A', teks: '#1B2A49' },
      ciri: 'Border ganda navy dan emas, font serif, ornamen sudut sederhana. Desain bawaan (fallback).',
    },
    {
      id: 'modern',
      nama: 'Modern',
      suasana: ['santai', 'terang'],
      palet: { latar: '#FFFFFF', utama: '#1D4ED8', aksen: '#0EA5E9', teks: '#0F172A' },
      ciri: 'Banyak ruang kosong, garis aksen tipis di tepi, font sans-serif bersih.',
    },
    {
      id: 'elegan-emas',
      nama: 'Elegan Emas',
      suasana: ['formal', 'terang'],
      palet: { latar: '#FAF6EC', utama: '#1A1A1A', aksen: '#C9A227', teks: '#1A1A1A' },
      ciri: 'Garis emas tipis, ornamen sudut, nama peserta memakai font script atau serif display.',
    },
    {
      id: 'ceria',
      nama: 'Ceria',
      suasana: ['santai', 'terang'],
      palet: { latar: '#FFF8E1', utama: '#F97316', aksen: '#EC4899', teks: '#3B2A12' },
      ciri: 'Hiasan bulat dan confetti dari CSS, font rounded, warna hangat.',
    },
    {
      id: 'akademik',
      nama: 'Akademik',
      suasana: ['formal', 'terang'],
      palet: { latar: '#F5F7FA', utama: '#12355B', aksen: '#8A98A8', teks: '#1B2733' },
      ciri: 'Pita biru tua di bagian atas, logo di tengah atas, serif formal.',
    },
    {
      id: 'hijau-alam',
      nama: 'Hijau Alam',
      suasana: ['santai', 'terang'],
      palet: { latar: '#F4F1E8', utama: '#3E6B4F', aksen: '#A3B18A', teks: '#24352B' },
      ciri: 'Motif daun garis sederhana di sudut, nuansa tenang.',
    },
    {
      id: 'royal-biru',
      nama: 'Royal Biru',
      suasana: ['formal', 'terang'],
      palet: { latar: '#FFFFFF', utama: '#1E3A8A', aksen: '#D4AF37', teks: '#111C44' },
      ciri: 'Segel emas bundar dan pita di bagian bawah, border biru royal.',
    },
    {
      id: 'maroon',
      nama: 'Maroon',
      suasana: ['formal', 'terang'],
      palet: { latar: '#FFF9F2', utama: '#7A1F2B', aksen: '#D9B382', teks: '#3B0F15' },
      ciri: 'Border tebal maroon dengan garis krem emas di dalam, serif tegas.',
    },
    {
      id: 'minimalis',
      nama: 'Minimalis',
      suasana: ['santai', 'terang'],
      palet: { latar: '#FFFFFF', utama: '#111111', aksen: '#111111', teks: '#111111' },
      ciri: 'Hitam putih, tipografi besar, satu garis tipis, ruang kosong luas.',
    },
    {
      id: 'geometris',
      nama: 'Geometris',
      suasana: ['santai', 'terang'],
      palet: { latar: '#FFFFFF', utama: '#0F766E', aksen: '#F97316', teks: '#134E4A' },
      ciri: 'Segitiga dan bidang diagonal di sudut (clip-path), kombinasi teal dan oranye.',
    },
    {
      id: 'pastel',
      nama: 'Pastel Lembut',
      suasana: ['santai', 'terang'],
      palet: { latar: '#FFF5F7', utama: '#B185DB', aksen: '#A0E7E5', teks: '#4A3F5C' },
      ciri: 'Warna pastel lembut, sudut membulat, hiasan awan atau lingkaran.',
    },
    {
      id: 'gelap',
      nama: 'Gelap Elegan',
      suasana: ['formal', 'gelap'],
      palet: { latar: '#1F2328', utama: '#F3E9DC', aksen: '#C57B57', teks: '#F3E9DC' },
      ciri: 'Latar arang, teks krem, garis tembaga. Pastikan kontras tinggi.',
    },
    {
      id: 'batik',
      nama: 'Nuansa Batik',
      suasana: ['formal', 'terang'],
      palet: { latar: '#F3E6CC', utama: '#5C3A21', aksen: '#A0522D', teks: '#3E2415' },
      ciri: 'Pola batik sederhana dari CSS/SVG inline di tepi, warna sogan.',
    },
    {
      id: 'senja',
      nama: 'Senja',
      suasana: ['santai', 'terang'],
      palet: { latar: '#FFFFFF', utama: '#7C3AED', aksen: '#FB923C', teks: '#2E1065' },
      ciri: 'Pita atas dengan gradasi lembut oranye ke ungu, selebihnya bersih.',
    },
    {
      id: 'retro',
      nama: 'Retro',
      suasana: ['santai', 'terang'],
      palet: { latar: '#F4E9D8', utama: '#0F766E', aksen: '#E4572E', teks: '#2B2D42' },
      ciri: 'Tepi bergerigi (scalloped), serif tebal, kombinasi krem, teal, dan oranye bata.',
    },
  ] as CertificateDesign[],

  // -----------------------------------------------------------------------
  // 5. TEKS KHUSUS PER JENIS (PESERTA, PANITIA, PEMATERI)
  // -----------------------------------------------------------------------
  defaultKegiatan: 'seminar akademik',
  roleTexts: {
    peserta: {
      title: 'SERTIFIKAT PESERTA',
      englishSub: 'CERTIFICATE OF PARTICIPATION',
      presentedTo: 'DIBERIKAN DENGAN BANGGA KEPADA:',
      roleBadge: 'PESERTA',
      paragraph:
        'Atas partisipasi aktif, dedikasi, dan kontribusinya sebagai {role} dalam menyukseskan kegiatan {kegiatan}:',
    },
    panitia: {
      title: 'SERTIFIKAT PANITIA',
      englishSub: 'CERTIFICATE OF ORGANIZING COMMITTEE',
      presentedTo: 'DIBERIKAN DENGAN APRESIASI TERTINGGI KEPADA:',
      roleBadge: 'PANITIA PELAKSANA',
      paragraph:
        'Atas kerja keras, dedikasi penuh, dan kontribusinya sebagai {role} dalam menyelenggarakan kegiatan {kegiatan}:',
    },
    pemateri: {
      title: 'SERTIFIKAT PEMATERI',
      englishSub: 'CERTIFICATE OF APPRECIATION - SPEAKER',
      presentedTo: 'DIBERIKAN DENGAN RASA HORMAT KEPADA:',
      roleBadge: 'PEMATERI / NARASUMBER',
      paragraph:
        'Atas dedikasi keilmuan, transfer pengetahuan, dan kontribusi wawasan berharga sebagai {role} pada kegiatan {kegiatan}:',
    },
  } as Record<RoleType, RoleConfig>,

  // -----------------------------------------------------------------------
  // 6. PENANDATANGAN SERTIFIKAT
  // -----------------------------------------------------------------------
  signatories: [
    {
      title: 'Ketua Divisi Panitia',
      name: 'Aditya Pratama, S.Kom.',
      idNumber: 'NIM. 2108561050',
      signatureImage: '',
    },
    {
      title: 'Ketua Umum HMI',
      name: 'Nabila Zahra Khairunnisa',
      idNumber: 'NIM. 2108561012',
      signatureImage: '',
    },
  ] as SignerInfo[],
};

export function normalizeDesignId(rawId: string | undefined | null): string {
  if (!rawId || typeof rawId !== 'string') return 'klasik';
  const cleaned = rawId.trim().toLowerCase().replace(/\s+/g, '-');
  if (!cleaned) return 'klasik';
  const found = CONFIG.designs.some((d) => d.id === cleaned);
  return found ? cleaned : 'klasik';
}

export function normalizeJenis(rawJenis: string | undefined | null): RoleType {
  if (!rawJenis || typeof rawJenis !== 'string') return 'peserta';
  const cleaned = rawJenis.trim().toLowerCase();
  if (cleaned.includes('panitia')) return 'panitia';
  if (
    cleaned.includes('pemateri') ||
    cleaned.includes('narasumber') ||
    cleaned.includes('speaker')
  )
    return 'pemateri';
  return 'peserta';
}

export function normalizeKegiatan(raw: string | undefined | null): string {
  const cleaned = typeof raw === 'string' ? raw.trim() : '';
  return cleaned || CONFIG.defaultKegiatan;
}
