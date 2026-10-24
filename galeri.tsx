import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { CONFIG } from './src/config';
import type { RoleType, SuasanaType, SignerInfo } from './src/types';
import { CertificateCanvas } from './src/components/CertificateCanvas';
import './src/index.css';

const CERT_W = 980;
const CERT_H = 693;

const DUMMY_DATA = {
  nama: 'Muhammad Abdurrahman Al-Fatih',
  seminar: 'Seminar Contoh Divisi Akademik',
  kegiatan: 'seminar akademik',
  tanggal: '12 November 2026',
  nomor_sertifikat: '001/PST/SEM-AKD/XI/2026',
  nim: '2101005',
};

// ---------------------------------------------------------------------------
// Signatories dari localStorage (aman terhadap data rusak)
// ---------------------------------------------------------------------------
function loadSignatories(): SignerInfo[] {
  try {
    const saved = localStorage.getItem('hmp_signatories');
    if (!saved) return CONFIG.signatories;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as SignerInfo[];
    return CONFIG.signatories;
  } catch {
    return CONFIG.signatories;
  }
}
const signatories = loadSignatories();

// ---------------------------------------------------------------------------
// Error boundary: satu desain rusak tidak merusak yang lain
// ---------------------------------------------------------------------------
class PreviewBoundary extends React.Component<
  { children: React.ReactNode; id: string },
  { err: boolean; msg: string }
> {
  state = { err: false, msg: '' };
  static getDerivedStateFromError(e: unknown) {
    return { err: true, msg: e instanceof Error ? e.message : String(e) };
  }
  componentDidCatch(e: unknown) {
    console.error('Preview gagal dirender:', this.props.id, e);
  }
  render() {
    if (this.state.err) {
      return (
        <div
          style={{
            width: CERT_W,
            height: CERT_H,
            background: '#450a0a',
            color: '#fecaca',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 40,
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 700 }}>Gagal render: {this.props.id}</div>
          <div style={{ fontSize: 24, opacity: 0.8 }}>{this.state.msg}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Responsive Card Preview Component
// ---------------------------------------------------------------------------
const ResponsiveCardPreview: React.FC<{ designId: string; jenis: RoleType }> = ({
  designId,
  jenis,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.35);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth || containerRef.current.getBoundingClientRect().width;
      if (width > 0) {
        setScale(width / CERT_W);
      }
    };

    updateScale();
    const frame = requestAnimationFrame(updateScale);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(updateScale);
      ro.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateScale);
      if (ro) ro.disconnect();
    };
  }, []);

  const height = Math.max(140, Math.round(CERT_H * scale));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
        backgroundColor: '#0f172a',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${CERT_W}px`,
          height: `${CERT_H}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      >
        <PreviewBoundary id={designId}>
          <CertificateCanvas
            data={{ ...DUMMY_DATA, desain: designId, jenis }}
            signatoriesOverride={signatories}
          />
        </PreviewBoundary>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Toast & Salin
// ---------------------------------------------------------------------------
let toastTimer: number | undefined;
function showToast(msg: string) {
  const toast = document.getElementById('copy-toast');
  const toastText = document.getElementById('copy-toast-text');
  if (toast && toastText) {
    toastText.textContent = msg;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
  }
}

function fallbackCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand('copy');
    showToast(`ID Desain "${text}" tersalin ke clipboard!`);
  } catch {
    showToast(`ID: ${text}`);
  }
  document.body.removeChild(el);
}

function copyId(id: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(id)
      .then(() => showToast(`ID Desain "${id}" tersalin ke clipboard!`))
      .catch(() => fallbackCopy(id));
  } else {
    fallbackCopy(id);
  }
}

// ---------------------------------------------------------------------------
// Modal Preview Besar
// ---------------------------------------------------------------------------
let currentModalDesignId: string | null = null;
let currentModalJenis: RoleType = 'peserta';

function applyModalScale() {
  const modalViewport = document.getElementById('modal-viewport');
  const modalZoom = document.getElementById('modal-zoom-container');
  if (!modalViewport || !modalZoom) return;

  const available = Math.max(280, modalViewport.clientWidth - 32);
  const scale = Math.min(1, Math.max(0.25, available / CERT_W));
  modalZoom.style.width = `${CERT_W * scale}px`;
  modalZoom.style.height = `${CERT_H * scale}px`;
  const inner = modalZoom.firstElementChild as HTMLElement | null;
  if (inner) {
    inner.style.width = `${CERT_W}px`;
    inner.style.height = `${CERT_H}px`;
    inner.style.transformOrigin = 'top left';
    inner.style.transform = `scale(${scale})`;
  }
}

let modalRoot: any = null;

function openModal(id: string, jenis: RoleType) {
  currentModalDesignId = id;
  currentModalJenis = jenis;
  const modal = document.getElementById('gallery-preview-modal');
  const modalTitle = document.getElementById('modal-design-title');
  const modalIdLabel = document.getElementById('modal-design-id');
  const modalZoom = document.getElementById('modal-zoom-container');
  if (!modal || !modalZoom) return;

  const design = CONFIG.designs.find((d) => d.id === id);
  if (modalTitle) modalTitle.textContent = `Desain: ${design?.nama ?? id}`;
  if (modalIdLabel) modalIdLabel.textContent = `ID: ${id}`;

  if (!modalRoot) {
    modalZoom.innerHTML = '<div></div>';
    modalRoot = createRoot(modalZoom.firstElementChild as HTMLElement);
  }

  modalRoot.render(
    <PreviewBoundary id={id}>
      <CertificateCanvas
        data={{ ...DUMMY_DATA, desain: id, jenis }}
        signatoriesOverride={signatories}
      />
    </PreviewBoundary>
  );

  modal.classList.add('open');
  requestAnimationFrame(applyModalScale);
}

function closeModal() {
  currentModalDesignId = null;
  const modal = document.getElementById('gallery-preview-modal');
  if (modal) modal.classList.remove('open');
}

// ---------------------------------------------------------------------------
// Gallery Cards React Component
// ---------------------------------------------------------------------------
interface GalleryGridProps {
  initialJenis?: RoleType;
  initialFilter?: string;
}

export const GalleryGrid: React.FC<GalleryGridProps> = () => {
  const [jenis, setJenis] = useState<RoleType>('peserta');
  const [filter, setFilter] = useState<string>('semua');

  // Bind global HTML buttons in controls bar
  useEffect(() => {
    const handleJenisClick = (e: Event) => {
      const btn = (e.currentTarget as HTMLElement);
      const newJenis = btn.dataset.jenis as RoleType;
      if (!newJenis) return;
      document.querySelectorAll<HTMLElement>('[data-jenis]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      setJenis(newJenis);
    };

    const handleFilterClick = (e: Event) => {
      const btn = (e.currentTarget as HTMLElement);
      const newFilter = btn.dataset.filter || 'semua';
      document.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      setFilter(newFilter);
    };

    const jenisBtns = document.querySelectorAll<HTMLElement>('[data-jenis]');
    const filterBtns = document.querySelectorAll<HTMLElement>('[data-filter]');

    jenisBtns.forEach((btn) => btn.addEventListener('click', handleJenisClick));
    filterBtns.forEach((btn) => btn.addEventListener('click', handleFilterClick));

    // Modal controls
    const closeBtn = document.getElementById('btn-close-gallery-modal');
    const modalCopyBtn = document.getElementById('btn-modal-copy-id');
    const modalEl = document.getElementById('gallery-preview-modal');

    const handleModalCopy = () => {
      if (currentModalDesignId) copyId(currentModalDesignId);
    };

    const handleModalBackdrop = (e: MouseEvent) => {
      if (e.target === modalEl) closeModal();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };

    closeBtn?.addEventListener('click', closeModal);
    modalCopyBtn?.addEventListener('click', handleModalCopy);
    modalEl?.addEventListener('click', handleModalBackdrop);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', applyModalScale);

    return () => {
      jenisBtns.forEach((btn) => btn.removeEventListener('click', handleJenisClick));
      filterBtns.forEach((btn) => btn.removeEventListener('click', handleFilterClick));
      closeBtn?.removeEventListener('click', closeModal);
      modalCopyBtn?.removeEventListener('click', handleModalCopy);
      modalEl?.removeEventListener('click', handleModalBackdrop);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', applyModalScale);
    };
  }, []);

  const filteredDesigns = CONFIG.designs.filter(
    (d) => filter === 'semua' || d.suasana.includes(filter as SuasanaType)
  );

  return (
    <>
      {filteredDesigns.map((d) => (
        <article key={d.id} className="design-card">
          {/* Card Preview */}
          <div
            className="card-preview-holder"
            onClick={() => openModal(d.id, jenis)}
            title="Klik untuk memperbesar pratinjau"
          >
            <ResponsiveCardPreview designId={d.id} jenis={jenis} />
          </div>

          {/* Card Info */}
          <div className="card-info">
            <div>
              <div className="card-header-line">
                <h3 className="card-title">{d.nama}</h3>
                <code className="card-id-badge">{d.id}</code>
              </div>

              <div className="card-suasana-badges">
                {d.suasana.map((s) => (
                  <span key={s} className={`badge-suasana ${s}`}>
                    {s}
                  </span>
                ))}
              </div>

              <p className="card-desc">{d.ciri}</p>
            </div>

            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  copyId(d.id);
                }}
              >
                <span>Salin ID Desain</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(d.id, jenis);
                }}
                title="Lihat ukuran besar"
              >
                Lihat
              </button>
            </div>
          </div>
        </article>
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Mount to DOM
// ---------------------------------------------------------------------------
function init() {
  const grid = document.getElementById('designs-grid');
  if (grid) {
    const root = createRoot(grid);
    root.render(<GalleryGrid />);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
