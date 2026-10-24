import React, { forwardRef, useMemo, Component, ReactNode } from 'react';
import { CONFIG, normalizeDesignId, normalizeJenis, normalizeKegiatan } from '../config';
import { Participant, SignerInfo } from '../types';

interface CertificateCanvasProps {
  data: Partial<Participant>;
  isWetSignature?: boolean;
  signatoriesOverride?: SignerInfo[];
  className?: string;
  style?: React.CSSProperties;
}

// ============================================================
// ErrorBoundary INTERNAL (di dalam file ini aja)
// ------------------------------------------------------------
// Tujuan: kalau ADA APAPUN yang error pas render sertifikat,
// aplikasi UTAMA tidak ikut blank putih. Yang kena cuma
// area sertifikatnya, dan kita kasih tampilan fallback.
// File lain TIDAK perlu diubah.
// ============================================================
interface BoundaryState {
  hasError: boolean;
  message?: string;
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Munculin error di console biar gampang ditrace (F12 -> Console)
    console.error('[CertificateCanvas] Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            border: '2px dashed #c0392b',
            color: '#c0392b',
            padding: '16px',
            textAlign: 'center',
            fontSize: '0.85rem',
            background: '#fdf0ef',
            borderRadius: '8px',
          }}
        >
          ⚠️ Area sertifikat gagal render (aplikasi tetap jalan).
          <br />
          Cek <strong>Console (F12)</strong> buat lihat error detailnya.
          <br />
          <small>{this.state.message}</small>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper aman: paksa jadi string, apapun inputnya
const safeString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.length > 0 ? v : fallback;

// ============================================================
// CertificateCanvasV2 (HARDENED)
// ------------------------------------------------------------
// FIX 1: duplikasi nama kegiatan (paragraf generik, judul tengah doang)
// FIX 2: tidak boleh bikin app blank putih — semua data dipaksa aman,
//        ErrorBoundary nangkep error render, fallback roleConfig kalau
//        config kosong/undefined.
// Kode asli CertificateCanvas.tsx TIDAK diubah sama sekali.
// ============================================================
export const CertificateCanvas = forwardRef<HTMLDivElement, CertificateCanvasProps>(
  ({ data, isWetSignature = false, signatoriesOverride, className = '', style }, ref) => {
    // ---- BLOK AMAN: semua nilai dari `data` dipaksa jadi string aman ----
    const rawDesign = safeString(data?.desain, 'klasik');
    console.log('DATA SERTIFIKAT:', data);
    const rawJenis = safeString(data?.jenis, 'peserta');

    let designId = 'klasik';
    let jenis = 'peserta';
    try {
      designId = normalizeDesignId(rawDesign);
      jenis = normalizeJenis(rawJenis);
    } catch (e) {
      console.warn('[CertificateCanvas] normalize gagal, pakai default.', e);
    }

    // roleConfig fallback berlapis: config[jenis] -> config.peserta -> hardcoded
    const roleConfig =
      (CONFIG && (CONFIG as any).roleTexts
        ? ((CONFIG as any).roleTexts[jenis] || (CONFIG as any).roleTexts.peserta)
        : undefined) || {
        title: 'SERTIFIKAT',
        englishSub: 'CERTIFICATE',
        presentedTo: 'Diberikan kepada:',
        roleBadge: 'Peserta',
        paragraph: 'telah mengikuti kegiatan sebagai {role}',
      };

    // FIX duplikasi kegiatan: token {kegiatan} di-strip, paragraf jadi generik.
    // Dibungkus try/catch + safeString biar tidak pernah melempar error.
    let paragraphText = '';
    try {
      paragraphText = safeString((roleConfig as any).paragraph)
        .replace(/\{kegiatan\}/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.])/g, '$1')
        .trim();
    } catch (e) {
      console.warn('[CertificateCanvas] gagal proses paragraf, pakai default.', e);
      paragraphText = 'telah mengikuti kegiatan sebagai {role}';
    }
    const paragraphParts = paragraphText.split('{role}');
    const inlineRole = jenis.toUpperCase(); // PESERTA / PANITIA / PEMATERI

    const signers = signatoriesOverride || (CONFIG as any).signatories || [];

    const signer1 = signers[0] || {
      title: 'Ketua Divisi Akademik',
      name: 'Aditya Pratama, S.Kom.',
      idNumber: 'NIM. 2108561050',
    };
    const signer2 = signers[1] || {
      title: 'Ketua Umum HMI',
      name: 'Nabila Zahra Khairunnisa',
      idNumber: 'NIM. 2108561012',
    };

    // FIX: kegiatan dinormalisasi SEKALI dan hanya dipakai di judul tengah.
    // Kolom "kegiatan" dari Google Sheets (kosong -> pakai default di config)
    let kegiatan = 'Nama Kegiatan';
    try {
      kegiatan = normalizeKegiatan(
        (data as Partial<Participant> & { kegiatan?: string })?.kegiatan
      );
    } catch (e) {
      console.warn('[CertificateCanvas] normalizeKegiatan gagal.', e);
    }
    kegiatan = safeString(kegiatan, 'Nama Kegiatan');

    // Auto-fit ukuran font nama peserta agar nama bergelar panjang tidak keluar batas
    const recipientName = safeString(data?.nama, 'Nama Peserta Lengkap');
    const nameFontSize = useMemo(() => {
      const len = recipientName.length;
      if (len > 52) return '1.15rem';
      if (len > 38) return '1.4rem';
      if (len > 28) return '1.65rem';
      return '1.85rem';
    }, [recipientName]);

    return (
      <CanvasErrorBoundary>
        <div
          ref={ref}
          className={`certificate-canvas ${className}`}
          data-desain={designId}
          data-jenis={jenis}
          style={style}
        >
          <div className="cert-outer-border">
            {/* Corner Ornaments */}
            <div className="cert-corner cert-corner-tl" />
            <div className="cert-corner cert-corner-tr" />
            <div className="cert-corner cert-corner-bl" />
            <div className="cert-corner cert-corner-br" />

            {/* Watermark Lambang */}
            <div className="cert-watermark" aria-hidden="true">
              <svg viewBox="0 0 100 100" fill="currentColor">
                <path d="M50 5 L85 20 L85 55 C85 75 50 95 50 95 C50 95 15 75 15 55 L15 20 Z" />
              </svg>
            </div>

            <div className="cert-inner-border">
              <div className="cert-content">
                {/* 1. Header Lembaga & Logo */}
                <div className="cert-header">
                  <div className="w-[52px] h-[52px] flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
                      <polygon
                        points="50,5 92,26 92,74 50,95 8,74 8,26"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="rgba(0,0,0,0.03)"
                      />
                      <path d="M50 18 L76 32 L50 46 L24 32 Z" fill="currentColor" />
                      <polygon
                        points="50,50 70,62 70,72 50,82 30,72 30,62"
                        fill="var(--aksen, #c59b27)"
                      />
                      <circle cx="50" cy="46" r="4" fill="#ffffff" />
                    </svg>
                  </div>

                  <div className="flex-1 px-3">
                    <div className="cert-org-name">{CONFIG.organizationName}</div>
                    <div className="cert-univ-name">
                      {[CONFIG.divisionName, CONFIG.universityName].filter(Boolean).join(' • ')}
                    </div>
                  </div>

                  <div className="w-[52px] h-[52px] flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
                      <circle
                        cx="50"
                        cy="50"
                        r="44"
                        stroke="var(--aksen, #c59b27)"
                        strokeWidth="3"
                        strokeDasharray="3 3"
                      />
                      <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="2" />
                      <path
                        d="M50 20 L58 38 L78 38 L62 50 L68 68 L50 56 L32 68 L38 50 L22 38 L42 38 Z"
                        fill="var(--aksen, #c59b27)"
                      />
                    </svg>
                  </div>
                </div>

                {/* 2. Judul Sertifikat */}
                <div>
                  <h2 className="cert-main-title">{roleConfig.title}</h2>
                  <div className="cert-sub-title">{roleConfig.englishSub}</div>
                  <div className="cert-number">
                    <span>No: </span>
                    <span>{data.nomor_sertifikat || '---/HMP-AKAD/---/2026'}</span>
                  </div>
                </div>

                {/* 3. Penerima Sertifikat */}
                <div>
                  <div className="cert-presented-to">{roleConfig.presentedTo}</div>
                  <div className="cert-name-container">
                    <div className="cert-recipient-name" style={{ fontSize: nameFontSize }}>
                      {recipientName}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
                    <span className="cert-nim-badge">
                      {data.nim ? `NIM. ${data.nim}` : 'NIM. ------------'}
                    </span>
                    <span className="cert-role-tag">{roleConfig.roleBadge}</span>
                  </div>
                </div>

                {/* 4. Deskripsi Partisipasi & Nama Kegiatan */}
                <div className="px-5">
                  <p className="cert-event-desc">
                    {paragraphParts.map((part, idx, arr) => (
                      <React.Fragment key={idx}>
                        {part}
                        {idx < arr.length - 1 && (
                          <span className="cert-role-tag mx-1 text-[0.7rem] px-2 py-0.5">
                            {inlineRole}
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </p>
                  {/* FIX: nama kegiatan hanya tampil DI SINI (sekali, judul tengah) */}
                  <h3 className="cert-seminar-title">{kegiatan}</h3>
                  <div className="cert-seminar-date">
                    <span>Dilaksanakan pada: </span>
                    <strong>{data.tanggal || '12 November 2026'}</strong>
                  </div>
                </div>

                {/* 5. Tanda Tangan & Ornamen Segel */}
                <div className="cert-footer-section">
                  {/* Penandatangan 1 */}
                  <div className="cert-signer">
                    <div className="cert-signer-role">{signer1.title}</div>
                    <div className="cert-signature-area">
                      {isWetSignature ? (
                        /* Saklar TTD Basah Aktif: Kosongkan untuk tanda tangan basah tinta */
                        <div className="w-32 border-b border-dashed border-gray-400 opacity-60 h-4" />
                      ) : signer1.signatureImage ? (
                        <img
                          src={signer1.signatureImage}
                          alt="TTD 1"
                          className="cert-signature-img signature-img-loadable"
                        />
                      ) : (
                        <span className="cert-signature-script">
                          {signer1.name ? signer1.name.split(' ')[0] : 'Aditya'}
                        </span>
                      )}
                    </div>
                    <div className="cert-signer-name">{signer1.name}</div>
                    <div className="cert-signer-id">{signer1.idNumber}</div>
                  </div>

                  {/* Segel Emas Resmi */}
                  <div className="cert-seal">
                    <div className="seal-circle">
                      <span className="seal-text-top">HMI</span>
                      <div className="seal-icon">★</div>
                      <span className="seal-text-bottom">HIMPUNAN MAHASISWA ISLAM</span>
                    </div>
                  </div>

                  {/* Penandatangan 2 */}
                  <div className="cert-signer">
                    <div className="cert-signer-role">{signer2.title}</div>
                    <div className="cert-signature-area">
                      {isWetSignature ? (
                        /* Saklar TTD Basah Aktif: Kosongkan untuk tanda tangan basah tinta */
                        <div className="w-32 border-b border-dashed border-gray-400 opacity-60 h-4" />
                      ) : signer2.signatureImage ? (
                        <img
                          src={signer2.signatureImage}
                          alt="TTD 2"
                          className="cert-signature-img signature-img-loadable"
                        />
                      ) : (
                        <span className="cert-signature-script">
                          {signer2.name ? signer2.name.split(' ')[0] : 'Nabila'}
                        </span>
                      )}
                    </div>
                    <div className="cert-signer-name">{signer2.name}</div>
                    <div className="cert-signer-id">{signer2.idNumber}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CanvasErrorBoundary>
    );
  }
);

CertificateCanvas.displayName = 'CertificateCanvas';