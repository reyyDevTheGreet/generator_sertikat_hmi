import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import Logo from '../assets/logo-hmi.png';
import { CONFIG, normalizeDesignId, normalizeJenis } from '../config';
import { Participant, RoleType, SignerInfo } from '../types';
import { CertificateCanvas } from '../components/CertificateCanvas';

// -------------------------------------------------------------------------
// INISIASI SUPABASE
// -------------------------------------------------------------------------
const supabaseUrl = 'https://bkcxekrphldxcntvkdmg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrY3hla3JwaGxkeGNudHZrZG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NDQ1OTksImV4cCI6MjEwODQyMDU5OX0.d5mc7Zj9B5R1ShrF4tUP3XXpbnE3zSC-KZIU5l3CXGE';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PrintPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let portalRoot = document.getElementById('print-portal-root');
    let created = false;
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = 'print-portal-root';
      document.body.appendChild(portalRoot);
      created = true;
    }
    setContainer(portalRoot);

    return () => {
      if (created && portalRoot && portalRoot.parentNode) {
        portalRoot.parentNode.removeChild(portalRoot);
      }
    };
  }, []);

  if (!container) return null;
  return createPortal(children, container);
};

export const PanitiaPage: React.FC = () => {
  useEffect(() => {
    let metaTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'robots';
      document.head.appendChild(metaTag);
      created = true;
    }
    metaTag.content = 'noindex,nofollow';

    return () => {
      if (created && metaTag) {
        document.head.removeChild(metaTag);
      } else if (metaTag) {
        metaTag.content = 'index,follow';
      }
    };
  }, []);

  // Auth State
  const [session, setSession] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Login Form States
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [resetSentNotice, setResetSentNotice] = useState<string | null>(null);

  // Print Tool Data & Filters
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [dataSourceName, setDataSourceName] = useState<string>('Memeriksa...');

  const [filterSeminar, setFilterSeminar] = useState<string>('semua');
  const [filterJenis, setFilterJenis] = useState<string>('semua');
  const [filterMetode, setFilterMetode] = useState<string>('semua');
  const [searchNimManual, setSearchNimManual] = useState<string>('');

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'nama' | 'nim' | 'nomor_sertifikat'>('nim');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const [signatories, setSignatories] = useState<SignerInfo[]>(() => {
    const saved = localStorage.getItem('hmp_signatories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return CONFIG.signatories;
      }
    }
    return CONFIG.signatories;
  });
  const [isProcessingSig1, setIsProcessingSig1] = useState<boolean>(false);
  const [isProcessingSig2, setIsProcessingSig2] = useState<boolean>(false);
  const [showSignerSettings, setShowSignerSettings] = useState<boolean>(true);
  const [signatureInkColor, setSignatureInkColor] = useState<'black' | 'blue'>(() => {
    const saved = localStorage.getItem('hmp_signature_ink_color');
    return saved === 'black' || saved === 'blue' ? saved : 'black';
  });
  const rawSigFile1Ref = useRef<File | null>(null);
  const rawSigFile2Ref = useRef<File | null>(null);

  const [isWetSignature, setIsWetSignature] = useState<boolean>(false);
  const [previewSample, setPreviewSample] = useState<Participant | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const [sigPadOpen, setSigPadOpen] = useState<boolean>(false);
  const [sigPadTarget, setSigPadTarget] = useState<0 | 1>(0);
  const [sigPadHasInk, setSigPadHasInk] = useState<boolean>(false);
  const sigPadCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadDrawingRef = useRef<boolean>(false);
  const sigPadLastRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const sigPadWidthRef = useRef<number>(2.5);

  const [showAddManualModal, setShowAddManualModal] = useState<boolean>(false);
  const [manualForm, setManualForm] = useState<Participant>({
    nama: '',
    nim: '',
    email: '',
    jenis: 'peserta',
    desain: 'klasik',
    kegiatan: 'Seminar Akademik',
    seminar: 'Seminar Akademik',
    tanggal: '12 November 2026',
    nomor_sertifikat: '',
    metode: 'cetak',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef1 = useRef<HTMLInputElement>(null);
  const sigInputRef2 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('hmp_signatories', JSON.stringify(signatories));
  }, [signatories]);

  useEffect(() => {
    localStorage.setItem('hmp_signature_ink_color', signatureInkColor);
  }, [signatureInkColor]);

  // Cek Sesi Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }: any) => {
      setSession(currentSession);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, newSession: any) => {
      setSession(newSession);
      setAuthChecking(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // FITUR LOGIN UTAMA
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSentNotice(null);
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });

      if (error) {
        setAuthError(`Gagal Masuk: ${error.message}`);
      } else if (data?.session) {
        setSession(data.session);
      }
    } catch (err: any) {
      setAuthError(`Terjadi kesalahan: ${err?.message || 'Unknown error'}`);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchCsvData();
    }
  }, [session]);

  const handleResetPassword = async () => {
    if (!emailInput.trim()) {
      alert('Ketik email Anda terlebih dahulu di kolom atas.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      await supabase.auth.resetPasswordForEmail(emailInput.trim());
      setResetSentNotice(`Tautan reset password terkirim ke ${emailInput.trim()}`);
    } catch {
      setResetSentNotice(`Gagal mengirim reset password.`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setParticipants([]);
    setSelectedIndices(new Set());
  };

  const processAndSetSignature = async (file: File, signerIndex: number, colorOverride?: 'black' | 'blue') => {
    const colorToUse = colorOverride || signatureInkColor;
    if (signerIndex === 0) rawSigFile1Ref.current = file;
    else rawSigFile2Ref.current = file;

    const setLoader = signerIndex === 0 ? setIsProcessingSig1 : setIsProcessingSig2;
    setLoader(true);

    try {
      const transparentDataUrl = await cleanSignatureBackground(file, colorToUse);
      setSignatories((prev) => {
        const next = [...prev];
        next[signerIndex] = { ...next[signerIndex], signatureImage: transparentDataUrl };
        return next;
      });
    } catch (err) {
      console.error(err);
      alert('Gagal memproses gambar tanda tangan.');
    } finally {
      setLoader(false);
    }
  };

  const handleChangeInkColor = (newColor: 'black' | 'blue') => {
    setSignatureInkColor(newColor);
    if (rawSigFile1Ref.current) processAndSetSignature(rawSigFile1Ref.current, 0, newColor);
    if (rawSigFile2Ref.current) processAndSetSignature(rawSigFile2Ref.current, 1, newColor);
  };

  const cleanSignatureBackground = (file: File, inkColor: 'black' | 'blue' = 'black'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDimension = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;

          const totalPixels = width * height;
          const lum = new Float32Array(totalPixels);
          let globalMaxLum = 0;

          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const l = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
            lum[i] = l;
            if (l > globalMaxLum) globalMaxLum = l;
          }

          const gridCols = 16;
          const gridRows = 16;
          const cellW = width / gridCols;
          const cellH = height / gridRows;
          const bgGrid = new Float32Array(gridCols * gridRows);

          for (let gy = 0; gy < gridRows; gy++) {
            for (let gx = 0; gx < gridCols; gx++) {
              const startX = Math.floor(gx * cellW);
              const endX = Math.floor((gx + 1) * cellW);
              const startY = Math.floor(gy * cellH);
              const endY = Math.floor((gy + 1) * cellH);

              let maxCellLum = 0;
              for (let y = startY; y < endY; y += 2) {
                for (let x = startX; x < endX; x += 2) {
                  const val = lum[y * width + x];
                  if (val > maxCellLum) maxCellLum = val;
                }
              }
              bgGrid[gy * gridCols + gx] = maxCellLum > 40 ? maxCellLum : globalMaxLum;
            }
          }

          const targetInkR = inkColor === 'blue' ? 29 : 15;
          const targetInkG = inkColor === 'blue' ? 78 : 23;
          const targetInkB = inkColor === 'blue' ? 216 : 42;

          let minX = width;
          let minY = height;
          let maxX = 0;
          let maxY = 0;
          let hasInk = false;

          for (let y = 0; y < height; y++) {
            const gy = Math.min(gridRows - 1, Math.floor(y / cellH));
            for (let x = 0; x < width; x++) {
              const gx = Math.min(gridCols - 1, Math.floor(x / cellW));
              const localBg = bgGrid[gy * gridCols + gx];
              const pLum = lum[y * width + x];
              const diff = localBg - pLum;

              const i = (y * width + x) * 4;

              if (diff < 18) {
                d[i + 3] = 0;
              } else {
                hasInk = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;

                const alphaFactor = Math.min(1, (diff - 18) / 26);
                d[i] = targetInkR;
                d[i + 1] = targetInkG;
                d[i + 2] = targetInkB;
                d[i + 3] = Math.round(alphaFactor * 255);
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);

          if (hasInk && maxX > minX && maxY > minY) {
            const pad = 14;
            const cropX = Math.max(0, minX - pad);
            const cropY = Math.max(0, minY - pad);
            const cropW = Math.min(width - cropX, maxX - minX + pad * 2);
            const cropH = Math.min(height - cropY, maxY - minY + pad * 2);

            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = cropW;
            croppedCanvas.height = cropH;
            const croppedCtx = croppedCanvas.getContext('2d');
            if (croppedCtx) {
              croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              resolve(croppedCanvas.toDataURL('image/png'));
              return;
            }
          }

          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = rawUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const resetSignatureToDefault = (signerIndex: number) => {
    setSignatories((prev) => {
      const next = [...prev];
      next[signerIndex] = { ...next[signerIndex], signatureImage: '' };
      if (!next[0].signatureImage && !next[1].signatureImage) {
        localStorage.removeItem('hmp_signatories');
      }
      return next;
    });
  };

  const sizeSigPadCanvas = () => {
    const canvas = sigPadCanvasRef.current;
    if (!canvas || !sigPadOpen) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000000';
    }
  };

  useEffect(() => {
    if (sigPadOpen) {
      setSigPadHasInk(false);
      const t = setTimeout(sizeSigPadCanvas, 50);
      return () => clearTimeout(t);
    }
  }, [sigPadOpen]);

  const sigPadPos = (e: React.PointerEvent) => {
    const canvas = sigPadCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY, t: performance.now() };
  };

  const sigPadDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    sigPadDrawingRef.current = true;
    sigPadLastRef.current = sigPadPos(e);
    sigPadWidthRef.current = 3.0;
    setSigPadHasInk(true);
  };

  const sigPadMove = (e: React.PointerEvent) => {
    if (!sigPadDrawingRef.current) return;
    e.preventDefault();
    const canvas = sigPadCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const p1 = sigPadLastRef.current;
    if (!canvas || !ctx || !p1) return;
    const p2 = sigPadPos(e);

    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const dt = Math.max(p2.t - p1.t, 1);
    const speed = dist / dt;
    const target = Math.min(5.0, Math.max(2.0, 5.0 - speed * 2.0));
    sigPadWidthRef.current = sigPadWidthRef.current * 0.7 + target * 0.3;

    ctx.lineWidth = sigPadWidthRef.current;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    sigPadLastRef.current = p2;
  };

  const sigPadUp = (e: React.PointerEvent) => {
    sigPadDrawingRef.current = false;
    sigPadLastRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const sigPadClear = () => {
    const canvas = sigPadCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigPadHasInk(false);
  };

  const sigPadSave = () => {
    const canvas = sigPadCanvasRef.current;
    if (!canvas || !sigPadHasInk) return;

    const outputCanvas = document.createElement('canvas');
    const scale = 1.5;
    outputCanvas.width = canvas.width * scale;
    outputCanvas.height = canvas.height * scale;
    const outputCtx = outputCanvas.getContext('2d');
    if (outputCtx) {
      outputCtx.imageSmoothingEnabled = true;
      outputCtx.imageSmoothingQuality = 'high';
      outputCtx.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height);
    }

    const dataUrl = outputCanvas.toDataURL('image/png');
    setSignatories((prev) => {
      const next = [...prev];
      next[sigPadTarget] = { ...next[sigPadTarget], signatureImage: dataUrl };
      return next;
    });
    sigPadClear();
    setSigPadOpen(false);
  };

  const fetchCsvData = (file?: File) => {
    setDataLoading(true);

    if (file) {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          processCsvResults(results.data, `File Lokal: ${file.name}`);
        },
        error: () => {
          setDataLoading(false);
          alert('Gagal membaca file CSV.');
        },
      });
      return;
    }

    const savedUrl = localStorage.getItem('hmp_csv_url');
    const url = (savedUrl && savedUrl.trim()) || CONFIG.csvUrl.trim() || CONFIG.fallbackCsvUrl;
    const isFallback = url === CONFIG.fallbackCsvUrl;

    Papa.parse<Record<string, string>>(url, {
      download: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          if (!isFallback && CONFIG.fallbackCsvUrl) {
            fetchCsvDataFallback();
          } else {
            setDataLoading(false);
            setDataSourceName('Data Kosong');
          }
          return;
        }
        processCsvResults(
          results.data,
          isFallback ? 'Data Sampel Demo (data-dummy-sertifikat-v3.csv)' : 'Google Sheets Tab Final'
        );
      },
      error: () => {
        if (!isFallback && CONFIG.fallbackCsvUrl) {
          fetchCsvDataFallback();
        } else {
          setDataLoading(false);
          alert('Gagal memuat link CSV Google Sheets.');
        }
      },
    });
  };

  const fetchCsvDataFallback = () => {
    Papa.parse<Record<string, string>>(CONFIG.fallbackCsvUrl, {
      download: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        processCsvResults(results.data, 'Data Sampel Demo (data-dummy-sertifikat-v3.csv)');
      },
      error: () => {
        setDataLoading(false);
        alert('Gagal memuat CSV cadangan.');
      },
    });
  };

  const processCsvResults = (rows: Record<string, string>[], sourceName: string) => {
    setDataLoading(false);
    setDataSourceName(sourceName);

    const normalized: Participant[] = [];
    rows.forEach((row) => {
      const p = normalizeRow(row);
      if (p.nama && p.nim && (p.seminar || p.kegiatan)) {
        normalized.push(p);
      }
    });

    setParticipants(normalized);
    setSelectedIndices(new Set());
  };

  const normalizeRow = (row: Record<string, string>): Participant => {
    const res: Participant = {
      nama: '',
      nim: '',
      email: '',
      jenis: 'peserta',
      desain: 'klasik',
      kegiatan: '',
      seminar: '',
      tanggal: '',
      nomor_sertifikat: '',
      metode: 'cetak',
    };

    for (const [k, v] of Object.entries(row)) {
      if (!k || v === undefined) continue;
      const key = k.trim().toLowerCase().replace(/[\s_-]+/g, '');
      const val = String(v).trim();

      if (key === 'nama' || key === 'namalengkap' || key === 'namapeserta') res.nama = val;
      else if (key === 'nim' || key === 'nomorindukmahasiswa' || key === 'nomhs') res.nim = val;
      else if (key === 'email' || key === 'surel' || key === 'alamatemail') res.email = val;
      else if (key === 'jenis' || key === 'peran' || key === 'role') res.jenis = normalizeJenis(val);
      else if (key === 'desain' || key === 'tema' || key === 'design') res.desain = normalizeDesignId(val);
      else if (
        key === 'seminar' ||
        key === 'namaseminar' ||
        key === 'judulseminar' ||
        key === 'kegiatan' ||
        key === 'jeniskegiatan' ||
        key === 'namakegiatan' ||
        key === 'judulkegiatan' ||
        key === 'acara'
      ) {
        res.seminar = val;
        res.kegiatan = val;
      } else if (key === 'tanggal' || key === 'tgl' || key === 'date') res.tanggal = val;
      else if (key === 'nomorsertifikat' || key === 'nosertifikat' || key === 'nosertif') res.nomor_sertifikat = val;
      else if (key === 'metode') res.metode = val.toLowerCase();
    }

    if (!res.seminar && res.kegiatan) res.seminar = res.kegiatan;
    if (!res.kegiatan && res.seminar) res.kegiatan = res.seminar;
    if (!res.seminar && !res.kegiatan) {
      res.seminar = CONFIG.defaultKegiatan || 'seminar akademik';
      res.kegiatan = CONFIG.defaultKegiatan || 'seminar akademik';
    }

    return res;
  };

  const seminarsList = useMemo(() => {
    return Array.from(new Set(participants.map((p) => p.kegiatan || p.seminar || ''))).filter(Boolean);
  }, [participants]);

  useEffect(() => {
    if (seminarsList.length > 0 && !filterSeminar) {
      setFilterSeminar(seminarsList[0]);
    }
  }, [seminarsList, filterSeminar]);

  const filteredParticipants = useMemo(() => {
    const cleanSearchNim = searchNimManual.trim().toLowerCase();

    return participants
      .filter((p) => {
        const itemEvent = p.kegiatan || p.seminar || '';
        if (filterSeminar !== 'semua' && itemEvent !== filterSeminar) return false;
        if (filterJenis !== 'semua' && p.jenis !== filterJenis) return false;

        const met = (p.metode || '').toLowerCase();
        if (filterMetode === 'cetak') {
          if (met !== 'cetak' && met !== '') return false;
        } else if (filterMetode === 'digital') {
          if (met !== 'digital') return false;
        } else if (filterMetode === 'kosong') {
          if (met !== '') return false;
        }

        if (cleanSearchNim) {
          if (!p.nim.toLowerCase().includes(cleanSearchNim)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortBy] || '';
        let valB = b[sortBy] || '';
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
  }, [participants, filterSeminar, filterJenis, filterMetode, searchNimManual, sortBy, sortAsc]);

  const toggleSelect = (originalIndex: number) => {
    const next = new Set(selectedIndices);
    if (next.has(originalIndex)) {
      next.delete(originalIndex);
    } else {
      if (next.size >= 50) {
        alert('Maksimal 50 sertifikat per kelompok cetak.');
        return;
      }
      next.add(originalIndex);
    }
    setSelectedIndices(next);
  };

  const selectBatch = (startIndex: number, count: number = 50) => {
    const next = new Set<number>();
    const slice = filteredParticipants.slice(startIndex, startIndex + count);
    slice.forEach((p) => {
      const idx = participants.indexOf(p);
      if (idx !== -1) next.add(idx);
    });
    setSelectedIndices(next);
  };

  const selectAllFiltered = () => {
    const next = new Set<number>();
    const maxItems = Math.min(filteredParticipants.length, 50);
    filteredParticipants.slice(0, maxItems).forEach((p) => {
      const idx = participants.indexOf(p);
      if (idx !== -1) next.add(idx);
    });
    setSelectedIndices(next);
  };

  const clearSelection = () => {
    setSelectedIndices(new Set());
  };

  const selectedParticipants = useMemo(() => {
    return Array.from(selectedIndices)
      .map((i) => participants[i])
      .filter(Boolean);
  }, [selectedIndices, participants]);

  const handleAddManualParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.nama || !manualForm.nim || (!manualForm.seminar && !manualForm.kegiatan)) {
      alert('Nama, NIM, dan Seminar/Kegiatan wajib diisi.');
      return;
    }

    const eventName = manualForm.kegiatan || manualForm.seminar || CONFIG.defaultKegiatan;
    const newP: Participant = {
      ...manualForm,
      kegiatan: eventName,
      seminar: eventName,
      desain: normalizeDesignId(manualForm.desain),
      jenis: normalizeJenis(manualForm.jenis),
      nomor_sertifikat: manualForm.nomor_sertifikat || `MANUAL-${Date.now().toString().slice(-4)}`,
    };

    setParticipants((prev) => [newP, ...prev]);
    setShowAddManualModal(false);
    alert(`Peserta "${newP.nama}" berhasil ditambahkan!`);
  };

  const handleBulkPrint = async () => {
    if (selectedParticipants.length === 0) {
      alert('Pilih minimal satu sertifikat.');
      return;
    }

    if (selectedParticipants.length > 50) {
      alert('Maksimal cetak 50 lembar per kelompok.');
      return;
    }

    setIsPrinting(true);
    document.body.classList.add('printing-bulk');

    await new Promise((resolve) => setTimeout(resolve, 300));
    const imgs = document.querySelectorAll('#print-portal-root img');
    await Promise.all(
      Array.from(imgs).map((img) => (img as HTMLImageElement).decode?.().catch(() => null))
    );

    window.print();

    const cleanup = () => {
      document.body.classList.remove('printing-bulk');
      setIsPrinting(false);
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-800 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Memeriksa sesi panitia...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-100">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-slate-200 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-3">
              <img src={Logo} alt="logo-hmi" className="w-12 h-12 object-contain" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900">Masuk Akun Panitia</h2>
            <p className="text-xs text-slate-600 mt-1">
              Gunakan akun panitia untuk mengelola cetak massal.
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {authError}
            </div>
          )}

          {resetSentNotice && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              {resetSentNotice}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1.5">Email Panitia</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="panitia@hmi.org"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    // SVG Ikon Mata Terbuka (Show)
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    // SVG Ikon Mata Dicoret / Tertutup (Hide)
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmailInput('panitia@hmi.org');
                  setPasswordInput('hmi2026');
                }}
                className="text-emerald-700 hover:underline font-semibold cursor-pointer"
              >
                Isi Akun Cepat
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={authLoading}
                className="text-slate-600 hover:underline font-semibold cursor-pointer"
              >
                Lupa password?
              </button>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {authLoading ? 'Menghubungkan ke Supabase...' : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <a href="/" className="text-xs text-slate-500 hover:underline">
              ← Kembali ke Halaman Peserta
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 bg-slate-50">
      <header className="bg-white border-b border-slate-200 py-3.5 shadow-xs mb-6 no-print">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold">
              <img src={Logo} alt="logo-hmi" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-emerald-900">Alat Cetak Massal & TTD Digital</h1>
              <p className="text-xs text-slate-500">Divisi Panitia HMI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              Login: <strong>{session?.user?.email || 'panitia@hmi.org'}</strong>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-xs font-bold transition-all cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 no-print space-y-6">
        <section className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#031d10] to-[#08301c] px-6 py-4 text-emerald-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold">✍️</div>
              <div>
                <h2 className="text-sm font-bold">Pengaturan Pejabat & Tanda Tangan Digital Otomatis</h2>
                <p className="text-[11px] text-emerald-200">Ganti nama ketua, jabatan, dan upload tanda tangan.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSignerSettings(!showSignerSettings)}
              className="px-3 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold cursor-pointer"
            >
              {showSignerSettings ? 'Sembunyikan ▲' : 'Buka ▼'}
            </button>
          </div>

          {showSignerSettings && (
            <div className="p-6 bg-slate-50/50">
              <div className="mb-5 bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-800">Warna Tinta:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleChangeInkColor('black')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        signatureInkColor === 'black' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Hitam
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeInkColor('blue')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        signatureInkColor === 'blue' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Biru
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {signatories.map((signer, index) => (
                  <div key={index} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-emerald-900 uppercase">
                          Penandatangan #{index + 1}
                        </span>
                        {signer.signatureImage && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ TTD Aktif
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jabatan</label>
                        <input
                          type="text"
                          value={signer.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSignatories((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], title: val };
                              return next;
                            });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Lengkap</label>
                        <input
                          type="text"
                          value={signer.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSignatories((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], name: val };
                              return next;
                            });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">NIM / NIP</label>
                        <input
                          type="text"
                          value={signer.idNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSignatories((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], idNumber: val };
                              return next;
                            });
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono"
                        />
                      </div>

                      <div className="pt-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanda Tangan:</label>
                        <div className="h-24 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center relative overflow-hidden">
                          {signer.signatureImage ? (
                            <img src={signer.signatureImage} alt="TTD" className="max-h-20 max-w-[85%] object-contain" />
                          ) : (
                            <span className="text-xs text-slate-400">Belum ada tanda tangan</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <input
                        type="file"
                        ref={index === 0 ? sigInputRef1 : sigInputRef2}
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            processAndSetSignature(e.target.files[0], index);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => (index === 0 ? sigInputRef1 : sigInputRef2).current?.click()}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                      >
                        Upload Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSigPadTarget(index as 0 | 1);
                          setSigPadOpen(true);
                        }}
                        className="py-1.5 px-3 rounded-lg border border-emerald-700 text-emerald-900 text-xs font-bold cursor-pointer"
                      >
                        TTD Layar
                      </button>
                      {signer.signatureImage && (
                        <button
                          type="button"
                          onClick={() => resetSignatureToDefault(index)}
                          className="py-1.5 px-2.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Sumber Data:</span>
            <strong className="text-xs text-slate-900">{dataSourceName}</strong>
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              {participants.length} data
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const currentUrl = localStorage.getItem('hmp_csv_url') || CONFIG.csvUrl;
                const newUrl = prompt('Masukkan URL CSV Google Sheets:', currentUrl);
                if (newUrl !== null) {
                  localStorage.setItem('hmp_csv_url', newUrl.trim());
                  fetchCsvData();
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 text-xs font-bold cursor-pointer"
            >
              Ganti URL Google Sheets
            </button>
            <button
              type="button"
              onClick={() => setShowAddManualModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-bold cursor-pointer"
            >
              + Tambah Manual
            </button>
            <button
              type="button"
              onClick={() => fetchCsvData()}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
            >
              Muat Ulang
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Kegiatan / Seminar</label>
              <select
                value={filterSeminar}
                onChange={(e) => setFilterSeminar(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="semua">Semua Kegiatan</option>
                {seminarsList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Peran</label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="semua">Semua Peran</option>
                <option value="peserta">Peserta</option>
                <option value="panitia">Panitia</option>
                <option value="pemateri">Pemateri</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Metode</label>
              <select
                value={filterMetode}
                onChange={(e) => setFilterMetode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="cetak">Cetak</option>
                <option value="digital">Digital</option>
                <option value="semua">Semua</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Cari NIM</label>
              <input
                type="text"
                value={searchNimManual}
                onChange={(e) => setSearchNimManual(e.target.value)}
                placeholder="Ketik NIM..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">TTD Basah</label>
              <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={isWetSignature}
                  onChange={(e) => setIsWetSignature(e.target.checked)}
                  className="w-4 h-4 text-emerald-800 rounded"
                />
                <span className="text-[11px] text-slate-700 font-semibold">
                  {isWetSignature ? 'Aktif' : 'Nonaktif'}
                </span>
              </label>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Terpilih: <strong className="text-emerald-800">{selectedParticipants.length}</strong>
            </span>
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
            >
              Pilih 50 Pertama
            </button>
            {selectedParticipants.length > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
              >
                Batal Pilih
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleBulkPrint}
            disabled={selectedParticipants.length === 0 || isPrinting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer disabled:opacity-50"
          >
            <span>{isPrinting ? 'Menyiapkan Cetak...' : `Cetak Massal (${selectedParticipants.length})`}</span>
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[11px]">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.length > 0 && selectedParticipants.length === Math.min(filteredParticipants.length, 50)}
                      onChange={(e) => (e.target.checked ? selectAllFiltered() : clearSelection())}
                      className="w-4 h-4 text-emerald-800 rounded"
                    />
                  </th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">NIM</th>
                  <th className="p-3">Peran</th>
                  <th className="p-3">Kegiatan</th>
                  <th className="p-3">Desain</th>
                  <th className="p-3">No. Sertifikat</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">Tidak ada data.</td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => {
                    const originalIdx = participants.indexOf(p);
                    const isSelected = selectedIndices.has(originalIdx);
                    return (
                      <tr key={originalIdx} className={`hover:bg-slate-50 ${isSelected ? 'bg-emerald-50/60' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(originalIdx)}
                            className="w-4 h-4 text-emerald-800 rounded"
                          />
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{p.nama}</td>
                        <td className="p-3 font-mono">{p.nim}</td>
                        <td className="p-3 capitalize">{p.jenis}</td>
                        <td className="p-3 text-[11px] text-slate-600 truncate max-w-[200px]">{p.kegiatan}</td>
                        <td className="p-3 font-mono text-[11px]">{p.desain}</td>
                        <td className="p-3 font-mono text-[11px]">{p.nomor_sertifikat}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setPreviewSample(p)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                          >
                            Preview
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL PREVIEW */}
      {previewSample && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewSample(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between pb-3 border-b mb-4">
              <h3 className="font-bold">Preview: {previewSample.nama}</h3>
              <button onClick={() => setPreviewSample(null)} className="font-bold cursor-pointer">×</button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 rounded-xl flex items-center justify-center">
              <div className="transform scale-[0.75]">
                <CertificateCanvas data={previewSample} isWetSignature={isWetSignature} signatoriesOverride={signatories} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TTD LAYAR */}
      {sigPadOpen && (
        <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4" onClick={() => setSigPadOpen(false)}>
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-bold">Goreskan Tanda Tangan</h3>
              <span className={`text-xs font-bold ${sigPadHasInk ? 'text-emerald-600' : 'text-amber-600'}`}>
                {sigPadHasInk ? '● Ada Goresan' : '○ Kosong'}
              </span>
            </div>
            <div className="relative flex-1 min-h-[300px] bg-white">
              <canvas
                ref={sigPadCanvasRef}
                className="absolute inset-0 cursor-crosshair touch-none select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={sigPadDown}
                onPointerMove={sigPadMove}
                onPointerUp={sigPadUp}
                onPointerCancel={sigPadUp}
              />
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 flex justify-between">
              <button type="button" onClick={sigPadClear} className="px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer">Bersihkan</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSigPadOpen(false)} className="px-4 py-2 text-xs font-semibold cursor-pointer">Tutup</button>
                <button type="button" onClick={sigPadSave} disabled={!sigPadHasInk} className="px-5 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40">Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PORTAL */}
      {isPrinting && selectedParticipants.load && selectedParticipants.length > 0 && (
        <PrintPortal>
          <div className="print-portal-container">
            {selectedParticipants.map((p, idx) => (
              <div key={idx} className="print-page-sheet">
                <CertificateCanvas data={p} isWetSignature={isWetSignature} signatoriesOverride={signatories} />
              </div>
            ))}
          </div>
        </PrintPortal>
      )}
    </div>
  );
};