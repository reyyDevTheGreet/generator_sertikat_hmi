import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import Logo from '../assets/logo-hmi.png';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { CONFIG, normalizeDesignId, normalizeJenis, normalizeKegiatan } from '../config';
import { Participant, RoleType, SignerInfo } from '../types';
import { CertificateCanvas } from '../components/CertificateCanvas';

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
  // Inject meta robots noindex,nofollow
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
  const [filterMetode, setFilterMetode] = useState<string>('semua'); // Tampilkan semua peserta secara bawaan
  const [searchNimManual, setSearchNimManual] = useState<string>(''); // Pencarian NIM Manual

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'nama' | 'nim' | 'nomor_sertifikat'>('nim');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // -------------------------------------------------------------------------
  // PENGATURAN KUSTOM PENANDATANGAN & TTD DIGITAL OTOMATIS
  // -------------------------------------------------------------------------
  const [signatories, setSignatories] = useState<SignerInfo[]>(() => {
    // Load dari localStorage saat mount
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

  // Settings
  const [isWetSignature, setIsWetSignature] = useState<boolean>(false);
  const [previewSample, setPreviewSample] = useState<Participant | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // TTD LANGSUNG DI LAYAR (tanpa backend, hasil masuk ke signatories)
  // -------------------------------------------------------------------------
  const [sigPadOpen, setSigPadOpen] = useState<boolean>(false);
  const [sigPadTarget, setSigPadTarget] = useState<0 | 1>(0);
  const [sigPadHasInk, setSigPadHasInk] = useState<boolean>(false);
  const sigPadCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadDrawingRef = useRef<boolean>(false);
  const sigPadLastRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const sigPadWidthRef = useRef<number>(2.5);

  // Modal Tambah Peserta Manual
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

  // Simpan signatories ke localStorage setiap kali berubah
  useEffect(() => {
    localStorage.setItem('hmp_signatories', JSON.stringify(signatories));
  }, [signatories]);

  // Simpan warna tinta ke localStorage
  useEffect(() => {
    localStorage.setItem('hmp_signature_ink_color', signatureInkColor);
  }, [signatureInkColor]);

  // Check Supabase session with local / demo fallback support
// ✅ 1. Sesi diawali dengan NULL jika tidak ada Supabase / belum login
useEffect(() => {
  if (!isSupabaseConfigured || !supabase) {
    const savedSession = localStorage.getItem('hmp_panitia_session');
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch {
        setSession(null);
      }
    } else {
      setSession(null); // FIX: Wajibkan login, jangan auto-set panitia@hmi.org
    }
    setAuthChecking(false);
    return;
  }

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

// ✅ 2. Handle Login ketat menggunakan Supabase Auth asli
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setAuthError(null);
  setResetSentNotice(null);
  setAuthLoading(true);

  if (!isSupabaseConfigured || !supabase) {
    setAuthError('Koneksi Supabase belum terpasang di server. Cek Variabel Environment (VITE_SUPABASE_URL).');
    setAuthLoading(false);
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.trim(),
    password: passwordInput,
  });

  setAuthLoading(false);

  if (error) {
    setAuthError('Email atau password salah / Belum dikonfirmasi.');
  }
};

  // Fetch CSV ONLY after session is authenticated
  useEffect(() => {
    if (session) {
      fetchCsvData();
    }
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSentNotice(null);
    setAuthLoading(true);

    if (!supabase) {
      if (emailInput.trim()) {
        const demoSession = { user: { email: emailInput.trim() } };
        localStorage.setItem('hmp_panitia_session', JSON.stringify(demoSession));
        setSession(demoSession);
      } else {
        setAuthError('Email wajib diisi.');
      }
      setAuthLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passwordInput,
    });

    setAuthLoading(false);

    if (error) {
      setAuthError('Email atau password salah');
    }
  };

  const handleResetPassword = async () => {
    if (!supabase) {
      setResetSentNotice('Dalam mode lokal/demo, Anda dapat langsung login dengan email panitia.');
      return;
    }
    if (!emailInput.trim()) {
      alert('Silakan ketik email Anda pada kolom di atas terlebih dahulu.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      await supabase.auth.resetPasswordForEmail(emailInput.trim());
      setResetSentNotice(`Tautan reset password telah dikirim ke ${emailInput.trim()} (cek folder Spam/Inbox).`);
    } catch {
      setResetSentNotice(`Jika email terdaftar, tautan reset password akan dikirim.`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('hmp_panitia_session');
    setSession(null);
    setParticipants([]);
    setSelectedIndices(new Set());
  };

  // -------------------------------------------------------------------------
  // PROSES SCAN GAMBAR TTD OTOMATIS (MENGHAPUS BACKGROUND KERTAS SECARA ADAPTIF)
  // -------------------------------------------------------------------------
  const processAndSetSignature = async (
    file: File,
    signerIndex: number,
    colorOverride?: 'black' | 'blue'
  ) => {
    const colorToUse = colorOverride || signatureInkColor;
    if (signerIndex === 0) rawSigFile1Ref.current = file;
    else rawSigFile2Ref.current = file;

    const setLoader = signerIndex === 0 ? setIsProcessingSig1 : setIsProcessingSig2;
    setLoader(true);

    try {
      const transparentDataUrl = await cleanSignatureBackground(file, colorToUse);
      setSignatories((prev) => {
        const next = [...prev];
        next[signerIndex] = {
          ...next[signerIndex],
          signatureImage: transparentDataUrl,
        };
        return next;
      });
    } catch (err) {
      console.error('Gagal memproses gambar tanda tangan:', err);
      alert('Gagal memproses gambar tanda tangan. Pastikan format gambar berupa JPG, PNG, atau WEBP.');
    } finally {
      setLoader(false);
    }
  };

  const handleChangeInkColor = (newColor: 'black' | 'blue') => {
    setSignatureInkColor(newColor);
    if (rawSigFile1Ref.current) {
      processAndSetSignature(rawSigFile1Ref.current, 0, newColor);
    }
    if (rawSigFile2Ref.current) {
      processAndSetSignature(rawSigFile2Ref.current, 1, newColor);
    }
  };

  const cleanSignatureBackground = (
    file: File,
    inkColor: 'black' | 'blue' = 'black'
  ): Promise<string> => {
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
      next[signerIndex] = {
        ...next[signerIndex],
        signatureImage: '',
      };
      return next;
    });
    const updated = [...signatories];
    updated[signerIndex] = { ...updated[signerIndex], signatureImage: '' };
    if (!updated[0].signatureImage && !updated[1].signatureImage) {
      localStorage.removeItem('hmp_signatories');
    }
  };

  // -------------------------------------------------------------------------
  // KANVAS TTD LANGSUNG
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // CSV FETCHING & DATA PROCESSING (DENGAN SINKRONISASI KEGIATAN / SEMINAR)
  // -------------------------------------------------------------------------
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
          alert('Gagal memuat link CSV Google Sheets. Silakan gunakan tombol "Pilih file CSV Lokal" atau cek URL Google Sheets.');
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
      // Validasi fleksibel: nama & nim wajib, serta kegiatan atau seminar terisi
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

    // Pastikan seminar dan kegiatan saling sinkron agar filter dan canvas tidak kosong
    if (!res.seminar && res.kegiatan) res.seminar = res.kegiatan;
    if (!res.kegiatan && res.seminar) res.kegiatan = res.seminar;
    if (!res.seminar && !res.kegiatan) {
      res.seminar = CONFIG.defaultKegiatan || 'seminar akademik';
      res.kegiatan = CONFIG.defaultKegiatan || 'seminar akademik';
    }

    return res;
  };

  // Daftar kegiatan/seminar unik untuk filter dropdown
  const seminarsList = useMemo(() => {
    return Array.from(new Set(participants.map((p) => p.kegiatan || p.seminar || ''))).filter(Boolean);
  }, [participants]);

  // Set default filter seminar jika belum dipilih
  useEffect(() => {
    if (seminarsList.length > 0 && !filterSeminar) {
      setFilterSeminar(seminarsList[0]);
    }
  }, [seminarsList, filterSeminar]);

  // Filtered participants list (termasuk filter pencarian NIM manual)
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

        // Pencarian NIM Manual
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

  // Selection handlers
  const toggleSelect = (originalIndex: number) => {
    const next = new Set(selectedIndices);
    if (next.has(originalIndex)) {
      next.delete(originalIndex);
    } else {
      if (next.size >= 50) {
        alert('Maksimal 50 sertifikat per kelompok cetak untuk menjaga performa cetak browser.');
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

  // Selected participant objects for print
  const selectedParticipants = useMemo(() => {
    return Array.from(selectedIndices)
      .map((i) => participants[i])
      .filter(Boolean);
  }, [selectedIndices, participants]);

  // Tambah Peserta Manual ke Tabel
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
    alert(`Peserta "${newP.nama}" berhasil ditambahkan ke tabel!`);
  };

  // Trigger Bulk Print Langsung tanpa merusak atau menggeser UI layar
  const handleBulkPrint = async () => {
    if (selectedParticipants.length === 0) {
      alert('Pilih minimal satu sertifikat pada tabel sebelum mencetak.');
      return;
    }

    if (selectedParticipants.length > 50) {
      alert('Batas maksimal cetak adalah 50 lembar per kelompok. Silakan kurangi pilihan Anda.');
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

  // -------------------------------------------------------------------------
  // RENDER 1: LOADING CHECKING SESSION
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // RENDER 2: FORM LOGIN JIKA BELUM ADA SESI
  // -------------------------------------------------------------------------
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-100">
        <div className="w-full max-w-md mb-4 bg-[#052214] text-emerald-200 py-3 px-4 text-xs border border-[var(--gold-dark)] rounded-xl flex items-center gap-x-4 shadow-lg no-print">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="font-medium">Halaman panitia. Khusus pengguna yang sudah login.</span>
        </div>

        <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-slate-200 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-3">
              <img src={Logo} alt="logo-hmi" className="w-12 h-12 object-contain" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900">Masuk Akun Panitia</h2>
            <p className="text-xs text-slate-600 mt-1">
              Gunakan akun panitia HMI untuk mengelola cetak massal dan tanda tangan digital.
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{authError}</span>
            </div>
          )}

          {resetSentNotice && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              {resetSentNotice}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1.5">
                Email Panitia
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="panitia@hmi.org"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg focus:outline-none cursor-pointer transition-colors"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
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
              {authLoading ? 'Memeriksa kredensial...' : 'Masuk'}
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

  // -------------------------------------------------------------------------
  // RENDER 3: DASHBOARD ALAT CETAK MASSAL PANITIA (SESI AKTIF)
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen pb-16 bg-slate-50">
      {/* Banner Wajib Panitia */}
      <div className="bg-[#052214] text-emerald-200 py-3 px-4 text-xs border border-emerald-900 flex items-center gap-x-4 shadow-lg no-print">
        <div className="flex items-center gap-2 max-w-6xl mx-auto w-full">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="font-bold">Halaman panitia. Khusus pengguna yang sudah login.</span>
        </div>
      </div>

      {/* Top Header Panitia */}
      <header className="bg-white border-b border-slate-200 py-3.5 shadow-xs mb-6 no-print">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold">
              <img src={Logo} alt="logo-hmi" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-emerald-900">Alat Cetak Massal & TTD Digital</h1>
              <p className="text-xs text-slate-500">Divisi Panitia HMI • Khusus Panitia Pelaksana</p>
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
        {/* ================================================================= */}
        {/* PANEL KUSTOMISASI PENANDATANGAN & SCAN TTD DIGITAL OTOMATIS */}
        {/* ================================================================= */}
        <section className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#031d10] to-[#08301c] px-6 py-4 text-emerald-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold">
                ✍️
              </div>
              <div>
                <h2 className="text-sm font-bold">Pengaturan Pejabat & Tanda Tangan Digital Otomatis</h2>
                <p className="text-[11px] text-emerald-200">
                  Ganti nama ketua, jabatan, NIM/NIP, dan upload scan tanda tangan tanpa perlu edit kodingan!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSignerSettings(!showSignerSettings)}
              className="px-3 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold cursor-pointer transition-all"
            >
              {showSignerSettings ? 'Sembunyikan Panel ▲' : 'Buka Pengaturan ▼'}
            </button>
          </div>

          {showSignerSettings && (
            <div className="p-6 bg-slate-50/50">
              {/* Pilihan Warna Tinta Digital */}
              <div className="mb-5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-800">Warna Tinta Digital:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleChangeInkColor('black')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                        signatureInkColor === 'black'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-black inline-block border border-white/50" />
                      Hitam Pekat Resmi
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeInkColor('blue')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                        signatureInkColor === 'blue'
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block border border-white/50" />
                      Biru Pulpen Asli
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Goresan tanda tangan otomatis diwarnai sesuai pilihan.
                </p>
              </div>

              {/* Grid 2 Pejabat Penandatangan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {signatories.map((signer, index) => (
                  <div
                    key={index}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                          Penandatangan #{index + 1} ({index === 0 ? 'Sisi Kiri' : 'Sisi Kanan'})
                        </span>
                        {signer.signatureImage && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ TTD Aktif
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Jabatan Organisasi
                        </label>
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
                          placeholder="Contoh: Ketua Panitia"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Nama Lengkap & Gelar
                        </label>
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
                          placeholder="Nama lengkap..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Nomor Identitas (NIM / NIP / NIDN)
                        </label>
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
                          placeholder="NIM. 2108561050"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono"
                        />
                      </div>

                      {/* Area Preview Goresan Tanda Tangan */}
                      <div className="pt-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Goresan Tanda Tangan Transparan:
                        </label>
                        <div className="h-24 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center relative overflow-hidden">
                          {signer.signatureImage ? (
                            <img
                              src={signer.signatureImage}
                              alt={`TTD ${signer.name}`}
                              className="max-h-20 max-w-[85%] object-contain filter drop-shadow-xs"
                            />
                          ) : (
                            <div className="text-center p-3">
                              <span className="text-xs text-slate-400 block">Belum ada tanda tangan</span>
                              <span className="text-[10px] text-slate-400">
                                Sertifikat akan tetap rapi (area kosong siap pulpen)
                              </span>
                            </div>
                          )}
                          {(index === 0 ? isProcessingSig1 : isProcessingSig2) && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs flex flex-col items-center justify-center gap-1 z-10">
                              <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                              <span className="text-[11px] font-semibold text-emerald-900">
                                Menghapus background kertas...
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tombol Aksi Upload Scan & TTD Langsung */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                      <input
                        type="file"
                        ref={index === 0 ? sigInputRef1 : sigInputRef2}
                        accept="image/png,image/jpeg,image/webp"
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
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>📷</span>
                        <span>Upload Foto Kertas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSigPadTarget(index as 0 | 1);
                          setSigPadOpen(true);
                        }}
                        className="py-1.5 px-3 rounded-lg border border-emerald-700 text-emerald-900 hover:bg-emerald-50 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>✍️</span>
                        <span>TTD di Layar</span>
                      </button>

                      {signer.signatureImage && (
                        <button
                          type="button"
                          onClick={() => resetSignatureToDefault(index)}
                          className="py-1.5 px-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all cursor-pointer"
                          title="Hapus tanda tangan"
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

        {/* Status Sumber Data & Integrasi Google Sheets / CSV */}
        <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Sumber Data Aktif:</span>
            <strong className="text-xs text-slate-900">{dataSourceName}</strong>
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              {participants.length} data dimuat
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const currentUrl = localStorage.getItem('hmp_csv_url') || CONFIG.csvUrl;
                const newUrl = prompt(
                  'Masukkan URL CSV Google Sheets (File > Bagikan > Publikasikan ke web > format CSV):',
                  currentUrl
                );
                if (newUrl !== null) {
                  localStorage.setItem('hmp_csv_url', newUrl.trim());
                  fetchCsvData();
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-bold cursor-pointer"
            >
              🔗 Ganti URL Google Sheets
            </button>

            <button
              type="button"
              onClick={() => {
                setManualForm({
                  nama: '',
                  nim: '',
                  email: '',
                  jenis: 'peserta',
                  desain: 'klasik',
                  kegiatan: filterSeminar || seminarsList[0] || CONFIG.defaultKegiatan,
                  seminar: filterSeminar || seminarsList[0] || CONFIG.defaultKegiatan,
                  tanggal: '12 November 2026',
                  nomor_sertifikat: '',
                  metode: 'cetak',
                });
                setShowAddManualModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <span>+ Tambah Peserta Manual</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  fetchCsvData(e.target.files[0]);
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
            >
              Pilih file CSV Lokal
            </button>
            <button
              type="button"
              onClick={() => fetchCsvData()}
              disabled={dataLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {dataLoading ? 'Memuat...' : 'Muat Ulang'}
            </button>
          </div>
        </section>

        {/* Filter Controls, Search NIM Manual, & Wet Signature Switch */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Filter Kegiatan / Seminar */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kegiatan / Seminar ({seminarsList.length})
              </label>
              <select
                value={filterSeminar}
                onChange={(e) => {
                  setFilterSeminar(e.target.value);
                  setSelectedIndices(new Set());
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="semua">Semua Kegiatan</option>
                {seminarsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Peran / Jenis */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Peran</label>
              <select
                value={filterJenis}
                onChange={(e) => {
                  setFilterJenis(e.target.value);
                  setSelectedIndices(new Set());
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="semua">Semua Peran</option>
                <option value="peserta">Peserta</option>
                <option value="panitia">Panitia</option>
                <option value="pemateri">Pemateri</option>
              </select>
            </div>

            {/* Filter Metode Cetak */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Metode Distribusi</label>
              <select
                value={filterMetode}
                onChange={(e) => {
                  setFilterMetode(e.target.value);
                  setSelectedIndices(new Set());
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="cetak">Hanya Cetak (Bawaan)</option>
                <option value="digital">Hanya Digital</option>
                <option value="kosong">Metode Kosong</option>
                <option value="semua">Semua Metode</option>
              </select>
            </div>

            {/* Input Pencarian NIM Manual */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Cari NIM Peserta</label>
              <input
                type="text"
                value={searchNimManual}
                onChange={(e) => setSearchNimManual(e.target.value)}
                placeholder="Ketik NIM peserta..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
              />
            </div>

            {/* Saklar TTD Basah */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Saklar TTD Basah</label>
              <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={isWetSignature}
                  onChange={(e) => setIsWetSignature(e.target.checked)}
                  className="w-4 h-4 text-emerald-800 rounded"
                />
                <span className="text-[11px] text-slate-700 font-semibold leading-tight">
                  {isWetSignature ? 'Aktif (Kosong untuk pulpen)' : 'Nonaktif (Pakai TTD Digital)'}
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Action Bar Cetak & Batching 50 */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Terpilih: <strong className="text-emerald-800">{selectedParticipants.length}</strong> dari{' '}
              {filteredParticipants.length} (Maks 50 per cetak)
            </span>

            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 cursor-pointer"
            >
              Pilih 50 Pertama
            </button>

            {filteredParticipants.length > 50 && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                <span className="px-1 text-slate-500 font-bold">Kelompok:</span>
                {Array.from({ length: Math.ceil(filteredParticipants.length / 50) }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectBatch(i * 50, 50)}
                    className="px-2 py-0.5 bg-white text-slate-700 hover:bg-emerald-800 hover:text-white rounded font-bold cursor-pointer transition-all"
                  >
                    {i * 50 + 1}-{Math.min((i + 1) * 50, filteredParticipants.length)}
                  </button>
                ))}
              </div>
            )}

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

          <div className="flex items-center gap-2">
            {isPrinting && (
              <button
                type="button"
                onClick={() => {
                  document.body.classList.remove('printing-bulk');
                  setIsPrinting(false);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Selesai Cetak
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkPrint}
              disabled={selectedParticipants.length === 0 || isPrinting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
              <span>{isPrinting ? 'Menyiapkan Lembar Cetak...' : `Cetak Massal (${selectedParticipants.length} A4)`}</span>
            </button>
          </div>
        </section>

        {/* Tabel Data Peserta dengan Checkbox */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedParticipants.length > 0 &&
                        selectedParticipants.length === Math.min(filteredParticipants.length, 50)
                      }
                      onChange={(e) => {
                        if (e.target.checked) selectAllFiltered();
                        else clearSelection();
                      }}
                      className="w-4 h-4 text-emerald-800 rounded"
                    />
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      setSortBy('nama');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    Nama Peserta {sortBy === 'nama' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      setSortBy('nim');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    NIM {sortBy === 'nim' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th className="p-3">Peran</th>
                  <th className="p-3">Kegiatan</th>
                  <th className="p-3">Desain</th>
                  <th
                    className="p-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      setSortBy('nomor_sertifikat');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    No. Sertifikat {sortBy === 'nomor_sertifikat' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th className="p-3">Metode</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      {searchNimManual
                        ? `Tidak ada peserta dengan NIM "${searchNimManual}".`
                        : 'Tidak ada peserta yang cocok dengan filter yang dipilih.'}
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => {
                    const originalIdx = participants.indexOf(p);
                    const isSelected = selectedIndices.has(originalIdx);

                    return (
                      <tr
                        key={originalIdx}
                        className={`hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-emerald-50/60' : ''
                        }`}
                      >
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
                        <td className="p-3">
                          <span className="capitalize px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">
                            {p.jenis}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600 max-w-[200px] truncate" title={p.kegiatan || p.seminar}>
                          {p.kegiatan || p.seminar}
                        </td>
                        <td className="p-3 font-mono text-[11px]">{p.desain}</td>
                        <td className="p-3 font-mono text-[11px]">{p.nomor_sertifikat}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              (p.metode || 'cetak') === 'cetak'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.metode || 'cetak'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setPreviewSample(p)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                          >
                            Lihat Contoh
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

      {/* MODAL PREVIEW CONTOH SERTIFIKAT */}
      {previewSample && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print"
          onClick={() => setPreviewSample(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Preview Sertifikat: {previewSample.nama}
                </h3>
                <p className="text-xs text-slate-500">
                  Desain: <strong>{previewSample.desain}</strong> • Peran: <strong>{previewSample.jenis}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSample(null)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4 rounded-xl flex items-center justify-center">
              <div className="transform scale-[0.6] sm:scale-[0.75] md:scale-[0.85] origin-center shadow-2xl">
                <CertificateCanvas
                  data={previewSample}
                  isWetSignature={isWetSignature}
                  signatoriesOverride={signatories}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewSample(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PESERTA MANUAL (TANPA CSV) */}
      {showAddManualModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print"
          onClick={() => setShowAddManualModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tambah Peserta Manual</h3>
                <p className="text-xs text-slate-500">Untuk peserta susulan atau tes cetak cepat</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddManualModal(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddManualParticipant} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  required
                  value={manualForm.nama}
                  onChange={(e) => setManualForm({ ...manualForm, nama: e.target.value })}
                  placeholder="Contoh: Budi Santoso, S.Kom."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIM Mahasiswa</label>
                  <input
                    type="text"
                    required
                    value={manualForm.nim}
                    onChange={(e) => setManualForm({ ...manualForm, nim: e.target.value })}
                    placeholder="Contoh: 2101001"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                    placeholder="budi@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kegiatan / Seminar</label>
                <input
                  type="text"
                  required
                  value={manualForm.kegiatan || manualForm.seminar || ''}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, kegiatan: e.target.value, seminar: e.target.value })
                  }
                  placeholder="Contoh: Seminar Akademik HMI"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Peran</label>
                  <select
                    value={manualForm.jenis}
                    onChange={(e) => setManualForm({ ...manualForm, jenis: e.target.value as RoleType })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="peserta">Peserta</option>
                    <option value="panitia">Panitia</option>
                    <option value="pemateri">Pemateri</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Desain Sertifikat</label>
                  <select
                    value={manualForm.desain}
                    onChange={(e) => setManualForm({ ...manualForm, desain: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    {CONFIG.designs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nama} ({d.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="text"
                    value={manualForm.tanggal}
                    onChange={(e) => setManualForm({ ...manualForm, tanggal: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Metode</label>
                  <select
                    value={manualForm.metode}
                    onChange={(e) => setManualForm({ ...manualForm, metode: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="cetak">Cetak</option>
                    <option value="digital">Digital</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Sertifikat (Opsional, kosongkan untuk otomatis)
                </label>
                <input
                  type="text"
                  value={manualForm.nomor_sertifikat}
                  onChange={(e) => setManualForm({ ...manualForm, nomor_sertifikat: e.target.value })}
                  placeholder="001/PST/SEM-AKD/XI/2026"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddManualModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Tambahkan ke Tabel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TANDA TANGAN LANGSUNG DI LAYAR (TOUCH / MOUSE) */}
      {sigPadOpen && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 no-print"
          onClick={() => setSigPadOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Goreskan Tanda Tangan: Penandatangan #{sigPadTarget + 1}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tanda tangani di area putih. Hasil otomatis jadi tinta transparan.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  sigPadHasInk
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {sigPadHasInk ? '● Ada Goresan' : '○ Masih Kosong'}
              </span>
            </div>

            {/* Kanvas */}
            <div className="relative flex-1 min-h-[300px] sm:min-h-[380px] bg-white">
              <canvas
                ref={sigPadCanvasRef}
                className="absolute inset-0 cursor-crosshair touch-none select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={sigPadDown}
                onPointerMove={sigPadMove}
                onPointerUp={sigPadUp}
                onPointerCancel={sigPadUp}
                onPointerLeave={sigPadUp}
              />
              {!sigPadHasInk && (
                <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-[28%]">
                  <span className="text-slate-300 text-xs italic font-serif">Tanda tangan di sini</span>
                </div>
              )}
              <div className="absolute left-[12%] right-[12%] bottom-[22%] pointer-events-none border-b-2 border-slate-200" />
            </div>

            {/* Tombol aksi */}
            <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <button
                type="button"
                onClick={sigPadClear}
                disabled={!sigPadHasInk}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-all disabled:opacity-40 cursor-pointer"
              >
                🧹 Bersihkan
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSigPadOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={sigPadSave}
                  disabled={!sigPadHasInk}
                  className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition-all disabled:opacity-40 cursor-pointer"
                >
                  💾 Simpan TTD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PORTAL CETAK MASSAL */}
      {isPrinting && selectedParticipants.length > 0 && (
        <PrintPortal>
          <div className="print-portal-container">
            {selectedParticipants.map((p, idx) => (
              <div key={idx} className="print-page-sheet">
                <CertificateCanvas
                  data={p}
                  isWetSignature={isWetSignature}
                  signatoriesOverride={signatories}
                />
              </div>
            ))}
          </div>
        </PrintPortal>
      )}
    </div>
  );
};