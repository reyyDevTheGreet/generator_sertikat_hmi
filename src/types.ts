/**
 * Types & Interfaces untuk Sistem Sertifikat Seminar HMP
 */

export type RoleType = 'peserta' | 'panitia' | 'pemateri';

export type SuasanaType = 'formal' | 'santai' | 'terang' | 'gelap';

export interface Participant {
   kegiatan?: string;
  nama: string;
  nim: string;
  email: string;
  jenis: RoleType;
  desain: string;
  seminar: string;
  tanggal: string;
  nomor_sertifikat: string;
  metode?: string; // misal: 'cetak', 'digital', atau kosong
}

export interface CertificateDesign {
  id: string;
  nama: string;
  suasana: SuasanaType[];
  palet: {
    latar: string;
    utama: string;
    aksen: string;
    teks: string;
  };
  ciri: string;
}

export interface SignerInfo {
  title: string;
  name: string;
  idNumber: string;
  signatureImage?: string;
}

export interface RoleConfig {
  title: string;
  englishSub: string;
  presentedTo: string;
  roleBadge: string;
  paragraph: string;
}
