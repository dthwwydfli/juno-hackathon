import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
} from '@zxing/library';
import { useNavigate, useParams } from 'react-router-dom';
import { PhoneFrame, StatusBar, SubHeader, Sheet } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import { iconForRoute } from '../../components/icon-route';
import { SelectField, ChipGroup } from '../../components/form/Form';
import { TextField } from '../../components/form/Form';
import { useStore } from '../../data/store';
import { interactionsForAsync, InteractionCheckIncompleteError, markInteractionCheckFresh } from '../../lib/interactions';
import { cabinetWithPending } from '../../lib/sync-cabinet';
import { getInteractionById } from '../../lib/interactions';
import { ApiError, apiBaseUrl, apiFetch, formatApiReachabilityError } from '../../lib/api';
import { gtinFromScan, lookupBarcode } from '../../lib/dmd-map';
import { fmtDate, todayISO, addDays } from '../../lib/dates';
import type { Category, DoseRow, Interaction, MedForm, Medication } from '../../data/types';
import { AddClearCheck } from './AddClearCheck';
import { AddInteractionResult } from './AddInteractionResult';
import './add.css';

type Mode = 'manual' | 'camera' | 'scan' | 'filled';
type CameraFacing = 'environment' | 'user';
type ApiScanStatus = 'checking' | 'ok' | 'error';

const SCAN_HINT = 'Point at the pack barcode — anywhere on screen is fine.';
/** After a failed lookup, ignore repeat decodes of the same GTIN while the pack stays in frame. */
const LOOKUP_FAIL_COOLDOWN_MS = 2_500;

/** The formats UK medicine packs actually carry. EAN/UPC covers retail packs; FMD packs
 *  print a 2D GS1 DataMatrix, and dispensing packs often carry GS1-128 or ITF-14 instead
 *  of a scannable EAN. Restricting to EAN/UPC made those packs undecodable outright. */
const PACK_CODE_HINTS = new Map<DecodeHintType, BarcodeFormat[]>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.CODE_128,
      BarcodeFormat.ITF,
    ],
  ],
]);

function apiHostLabel(): string {
  try {
    return new URL(apiBaseUrl()).host;
  } catch {
    return 'API';
  }
}

const ROUTES = ['Oral', 'Topical', 'Inhaled', 'Injection', 'Sublingual', 'Other'];
const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'NHS', label: 'NHS' },
  { value: 'Private', label: 'Private' },
  { value: 'OTC', label: 'OTC' },
];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINS = ['00', '15', '30', '45'];
const DURATIONS = ['Ongoing', '1 week', '2 weeks', '4 weeks', '8 weeks', '3 months'];
const DURATION_DAYS: Record<string, number | null> = {
  Ongoing: null, '1 week': 7, '2 weeks': 14, '4 weeks': 28, '8 weeks': 56, '3 months': 90,
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'med';
}
/** "24 Jul 2026" → "2026-07-24" (for prefilling native date inputs when editing). */
function displayToISO(s?: string): string {
  if (!s) return todayISO();
  const m = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(s);
  if (!m) return todayISO();
  const mi = MONTHS.indexOf(m[2]);
  if (mi < 0) return todayISO();
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function scheduleFromTimes(times: string[]) {
  const clean = times.filter(Boolean);
  if (clean.length === 0) return 'As needed';
  if (clean.some((t) => /as needed/i.test(t))) return 'As needed';
  if (clean.length === 1) return 'Once daily';
  if (clean.length === 2) return 'Twice daily';
  if (clean.length === 3) return 'Three times daily';
  return `${clean.length} times daily`;
}
function parseTime(t: string): { h: string; m: string; ap: string } {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(t || '');
  if (match) return { h: String(Number(match[1])), m: match[2], ap: match[3].toUpperCase() };
  return { h: '10', m: '30', ap: 'AM' };
}

interface WarnData { newMed: Medication; existing?: Medication; interaction: Interaction; isEdit?: boolean; extraCount?: number }
interface ClearCheckData { med: Medication; isEdit?: boolean; cabinetCount: number }

// Optional dev aid: /add?state=camera|scan|filled|time|warning to preview internal states.
function readInitial(): string | null {
  try { return new URLSearchParams(window.location.search).get('state'); } catch { return null; }
}

const SAMPLE = { name: 'Atorvastatin', brand: 'Lipitor', dose: '20 mg', route: 'Oral', form: 'tablet' as MedForm };

export function Add() {
  const nav = useNavigate();
  const store = useStore();
  const { state } = store;
  const { id } = useParams();
  const editMed = id ? state.medications.find((m) => m.id === id) : undefined;
  const editing = Boolean(editMed);

  const initial = readInitial();
  const preFilled = !editing && (initial === 'filled' || initial === 'time');

  const [mode, setMode] = useState<Mode>(
    editing ? 'manual' : initial === 'camera' ? 'camera' : initial === 'scan' ? 'scan' : preFilled ? 'filled' : 'manual',
  );
  const [scanned, setScanned] = useState(preFilled);

  const [name, setName] = useState(editMed?.name ?? (preFilled ? SAMPLE.name : ''));
  const [brand, setBrand] = useState(editMed?.brand ?? (preFilled ? SAMPLE.brand : ''));
  const [form, setForm] = useState<MedForm>(editMed?.form ?? (preFilled ? SAMPLE.form : 'tablet'));
  const [category, setCategory] = useState<Category>(editMed?.category ?? 'NHS');
  const [rows, setRows] = useState<DoseRow[]>(
    editMed?.regimen?.length ? editMed.regimen.map((r) => ({ ...r }))
      : preFilled ? [{ dose: SAMPLE.dose, route: SAMPLE.route, time: '10:30 AM' }]
        : [{ dose: '', route: 'Oral', time: '' }],
  );
  const [duration, setDuration] = useState<string>(
    editMed?.durationLabel ? editMed.durationLabel.replace(' course', '') : 'Ongoing',
  );
  const [dateAdded, setDateAdded] = useState(editMed ? displayToISO(editMed.dateAdded) : todayISO());
  const [startDate, setStartDate] = useState(editMed?.startDate ? displayToISO(editMed.startDate) : todayISO());

  // time picker sheet
  const [showTime, setShowTime] = useState(initial === 'time');
  const [activeRow, setActiveRow] = useState(0);
  const seed = parseTime(preFilled ? '10:30 AM' : '');
  const [th, setTh] = useState(seed.h);
  const [tm, setTm] = useState(seed.m);
  const [tap, setTap] = useState(seed.ap);

  const [warn, setWarn] = useState<WarnData | null>(() => {
    if (initial !== 'warning') return null;
    const interaction = getInteractionById('aspirin-ibuprofen');
    if (!interaction) return null;
    const sampleNew: Medication = {
      id: 'ibuprofen-preview', name: 'Ibuprofen', brand: 'Nurofen', category: 'OTC', form: 'tablet',
      regimen: [{ dose: '200 mg', route: 'Oral', time: 'As needed' }],
      dose: '200 mg', route: 'Oral', times: ['As needed'], scheduleLabel: 'As needed',
      dateAdded: fmtDate(todayISO()), status: 'active',
    };
    const existing = state.medications.find((m) => m.name.toLowerCase() === 'aspirin' && m.status === 'active');
    return { newMed: sampleNew, existing, interaction };
  });

  const [gtin, setGtin] = useState(editMed?.gtin ?? '');
  const [dmdDisplayName, setDmdDisplayName] = useState(editMed?.dmdDisplayName ?? '');
  const [dmdCodes, setDmdCodes] = useState(editMed?.dmdCodes);
  const [gtinInput, setGtinInput] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [saveChecking, setSaveChecking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [clearCheck, setClearCheck] = useState<ClearCheckData | null>(null);

  const [scanLine1, setScanLine1] = useState('Scanning…');
  const [scanLine2, setScanLine2] = useState('');
  const [scanLine3, setScanLine3] = useState(SCAN_HINT);
  const [dmdReady, setDmdReady] = useState(true);
  const [apiScanStatus, setApiScanStatus] = useState<ApiScanStatus>('checking');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [multiCamera, setMultiCamera] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scanLock = useRef(false);
  const lookupFailCooldownRef = useRef<{ code: string; until: number } | null>(null);
  const dmdReadyRef = useRef(true);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  dmdReadyRef.current = dmdReady;
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const applyLookupRef = useRef<(code: string) => Promise<void>>(async () => {});

  const stopScanStream = useCallback(() => {
    readerRef.current?.reset();
    readerRef.current = null;
    const stream = streamRef.current;
    stream?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  const applyLookup = useCallback(async (raw: string) => {
    // A DataMatrix hands back a full GS1 element string; show and store the GTIN from it.
    const code = gtinFromScan(raw);
    if (modeRef.current === 'scan') {
      const cd = lookupFailCooldownRef.current;
      if (cd && cd.code === code && Date.now() < cd.until) return;
    }
    if (scanLock.current) return;
    scanLock.current = true;
    // Deliberately no reader.reset() here: reset() nulls video.srcObject, which killed the
    // preview and left the scanner dead after the first code that missed dm+d. scanLock
    // alone suppresses repeat hits while the lookup is in flight.
    const fromScan = modeRef.current === 'scan';
    // Clear any error from an earlier misread, otherwise a stale "not in dm+d"
    // message sits under the success banner once a good scan lands.
    setLookupErr('');
    setScanLine1('Looking up…');
    setScanLine2(code);
    setScanLine3('NHS dm+d database');
    try {
      const fields = await lookupBarcode(code);
      lookupFailCooldownRef.current = null;
      setName(fields.name);
      setBrand(fields.brand);
      setForm(fields.form);
      setCategory(fields.category);
      if (fields.dose) {
        setRows((prev) => {
          const next = [...prev];
          next[0] = { ...next[0], dose: fields.dose, route: next[0]?.route || 'Oral' };
          return next;
        });
      }
      setGtin(fields.gtin || code);
      setDmdDisplayName(fields.dmdDisplayName || '');
      setDmdCodes(fields.dmdCodes);
      setScanLine1('Match found');
      setScanLine2(`${fields.name}${fields.dose ? ` ${fields.dose}` : ''}`);
      setScanLine3(`${fields.brand || 'dm+d'} · NHS database`);
      setLookupErr('');
      setScanned(true);
      setMode('filled');
    } catch (e) {
      if (fromScan) {
        lookupFailCooldownRef.current = {
          code,
          until: Date.now() + LOOKUP_FAIL_COOLDOWN_MS,
        };
      }
      if (e instanceof ApiError && e.status === 404 && !dmdReadyRef.current) {
        setScanLine1('Database loading');
        setScanLine2('Try again in a moment');
        setScanLine3('Code: ' + code);
        setLookupErr(
          "NHS dm+d database isn't loaded yet. Wait for sync or check backend logs.",
        );
      } else if (e instanceof ApiError && e.status === 404) {
        setScanLine1('Not in database');
        setScanLine2('Try manual entry');
        setScanLine3('Code: ' + code);
        setLookupErr('Barcode not in NHS dm+d. Try manual entry.');
      } else {
        setScanLine1("Can't reach API");
        setScanLine2('Lookup failed — check connection');
        setScanLine3('Code: ' + code);
        setLookupErr(formatApiReachabilityError(e));
      }
    } finally {
      scanLock.current = false;
    }
  }, []);
  applyLookupRef.current = applyLookup;

  const onManualLookup = () => {
    const code = gtinInput.trim();
    if (!code) return;
    setLookupErr('');
    void applyLookup(code);
  };

  const flipCamera = () => {
    setTorchOn(false);
    setCameraFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track?.applyConstraints) return;
    const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    if (!caps?.torch) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      try {
        await track.applyConstraints({ torch: next } as unknown as MediaTrackConstraints);
        setTorchOn(next);
      } catch {
        /* torch unsupported on this device/browser */
      }
    }
  };

  // Live barcode scan (ZXing + backend dm+d lookup).
  useEffect(() => {
    if (mode !== 'scan') return;
    setScanLine1('Scanning…');
    setScanLine2('');
    setScanLine3(SCAN_HINT);
    setLookupErr('');
    setApiScanStatus('checking');
    scanLock.current = false;
    lookupFailCooldownRef.current = null;
    setTorchOn(false);
    void apiFetch<{ dmd_ready?: boolean }>('/health', { timeoutMs: 8_000 })
      .then((h) => {
        const ready = Boolean(h.dmd_ready);
        dmdReadyRef.current = ready;
        setDmdReady(ready);
        setApiScanStatus('ok');
        setScanLine2((line) => (line === '' ? apiHostLabel() : line));
        setScanLine3((line) => {
          if (line !== SCAN_HINT && line !== 'Loading NHS dm+d database…') return line;
          return ready ? SCAN_HINT : 'Loading NHS dm+d database…';
        });
      })
      .catch((e) => {
        dmdReadyRef.current = false;
        setDmdReady(false);
        setApiScanStatus('error');
        const msg = formatApiReachabilityError(e);
        setScanLine1((line) => (line === 'Scanning…' ? "Can't reach medication lookup" : line));
        setScanLine2((line) => (line === '' ? apiHostLabel() : line));
        setScanLine3((line) =>
          line === SCAN_HINT || line === 'Loading NHS dm+d database…' ? msg : line,
        );
      });
    const reader = new BrowserMultiFormatReader(PACK_CODE_HINTS);
    readerRef.current = reader;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // Hand the raw stream to ZXing instead of setting srcObject and calling play()
        // ourselves. decodeFromStream waits on the video's `playing` event before it
        // starts the decode loop, and that event does not fire again for a video that is
        // already playing — so pre-playing left the loop parked behind a promise that
        // never settled and the scanner sat on "Scanning…" indefinitely.
        void reader.decodeFromStream(stream, videoRef.current, (result) => {
          if (!result || scanLock.current || modeRef.current !== 'scan') return;
          void applyLookupRef.current(result.getText());
        });
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setMultiCamera(devices.filter((d) => d.kind === 'videoinput').length > 1);
        } catch {
          setMultiCamera(false);
        }
      } catch {
        setScanLine1('Camera unavailable');
        setScanLine2('Use manual GTIN entry');
        setScanLine3('');
      }
    })();

    return () => {
      cancelled = true;
      stopScanStream();
    };
  }, [mode, cameraFacing, stopScanStream]);

  const isManualLike = mode === 'manual' || mode === 'filled';
  const canSave = name.trim().length > 0;

  const setRow = (i: number, patch: Partial<DoseRow>) =>
    setRows((arr) => arr.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((arr) => [...arr, { dose: '', route: 'Oral', time: '' }]);
  const removeRow = (i: number) => setRows((arr) => arr.filter((_, idx) => idx !== i));

  const openTime = (i: number) => {
    const p = parseTime(rows[i].time);
    setActiveRow(i); setTh(p.h); setTm(p.m); setTap(p.ap); setShowTime(true);
  };
  const confirmTime = () => {
    setRow(activeRow, { time: `${th}:${tm} ${tap}` });
    setShowTime(false);
  };

  const buildMed = (): Medication => {
    const cleanRows = rows.filter((r) => r.dose.trim() || r.time.trim());
    const regimen = cleanRows.length ? cleanRows : [{ dose: '', route: rows[0]?.route ?? 'Oral', time: '' }];
    const times = regimen.map((r) => r.time).filter(Boolean);
    const days = category === 'NHS' ? DURATION_DAYS[duration] : null;
    const endDate = days != null ? addDays(startDate, days) : undefined;
    const durationLabel = category === 'NHS' && duration !== 'Ongoing' ? `${duration} course` : undefined;
    return {
      id: editMed ? editMed.id : `${slug(name)}-${Date.now()}`,
      name: name.trim(), brand: brand.trim(), category, form,
      regimen,
      dose: regimen[0].dose.trim(),
      route: regimen[0].route,
      times: times.length ? times : ['As needed'],
      scheduleLabel: scheduleFromTimes(times),
      dateAdded: editMed ? editMed.dateAdded : fmtDate(dateAdded),
      startDate: fmtDate(startDate),
      endDate,
      durationLabel,
      status: editMed ? editMed.status : 'active',
      gtin: gtin || undefined,
      dmdDisplayName: dmdDisplayName || undefined,
      dmdCodes,
    };
  };

  const onSave = async () => {
    if (!canSave || saveChecking) return;
    const med = buildMed();
    const others = state.medications.filter((m) => m.id !== med.id && m.status === 'active');
    if (!others.length) {
      if (editing) store.updateMedication(med);
      else store.addMedication(med);
      nav('/home');
      return;
    }
    setSaveChecking(true);
    setSaveError(null);
    try {
      const found = await interactionsForAsync(med, state.medications);
      if (found.length) {
        const interaction = found[0];
        const otherName = interaction.a.toLowerCase() === med.name.toLowerCase() ? interaction.b : interaction.a;
        const existing = state.medications.find(
          (m) => m.name.toLowerCase() === otherName.toLowerCase() && m.status === 'active',
        );
        setClearCheck(null);
        setWarn({
          newMed: med,
          existing,
          interaction,
          isEdit: editing,
          extraCount: Math.max(0, found.length - 1),
        });
      } else {
        setWarn(null);
        const activeCount = state.medications.filter((m) => m.status === 'active').length;
        const cabinetCount = editing ? activeCount : activeCount + 1;
        setClearCheck({ med, isEdit: editing, cabinetCount });
      }
    } catch (e) {
      if (e instanceof InteractionCheckIncompleteError) {
        setSaveError(e.reason);
      } else {
        setSaveError(formatApiReachabilityError(e));
      }
    } finally {
      setSaveChecking(false);
    }
  };

  const goManual = () => setMode(scanned ? 'filled' : 'manual');
  const screenTitle = editing ? 'Edit medication' : 'Add medication';

  const persistWarnMed = (data: WarnData) => {
    if (data.isEdit) store.updateMedication(data.newMed);
    else store.addMedication(data.newMed);
  };

  if (warn) {
    return (
      <AddInteractionResult
        newMed={warn.newMed}
        existing={warn.existing}
        interaction={warn.interaction}
        extraCount={warn.extraCount}
        onBack={() => setWarn(null)}
        onReadMore={() => {
          persistWarnMed(warn);
          setWarn(null);
          nav(`/interactions/${warn.interaction.id}`);
        }}
        onAddAnyway={() => {
          persistWarnMed(warn);
          setWarn(null);
          nav('/home');
        }}
        onViewAll={
          warn.extraCount && warn.extraCount > 0
            ? () => {
                persistWarnMed(warn);
                setWarn(null);
                nav('/interactions');
              }
            : undefined
        }
      />
    );
  }

  // ---------------- SCAN (dark camera takeover) ----------------
  if (mode === 'scan') {
    return (
      <PhoneFrame label="Scan medication barcode">
        <div className="add-scan">
          <video
            ref={videoRef}
            id="add-scan-video"
            className="add-scan-video"
            playsInline
            muted
          />
          <div className="add-vignette" />
          <StatusBar dark />
          <div className="add-scan-top">
            <button className="add-scan-btn" aria-label="Close scanner" onClick={() => setMode('camera')}>
              <Icon name="close" size={20} strokeWidth={2} />
            </button>
            <div className="add-scan-title-wrap">
              <span className="title">Scan barcode</span>
              <span className="add-scan-facing" aria-live="polite">
                {cameraFacing === 'environment' ? 'Rear' : 'Front'}
              </span>
            </div>
            <div className="add-scan-actions">
              {multiCamera ? (
                <button type="button" className="add-scan-btn" aria-label="Switch camera" onClick={flipCamera}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" />
                    <path d="m8 7 3-3 3 3" />
                    <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
                    <path d="m16 17-3 3-3-3" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                className={`add-scan-btn${torchOn ? ' on' : ''}`}
                aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}
                aria-pressed={torchOn}
                onClick={() => void toggleTorch()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>
              </button>
            </div>
          </div>

          <div className="add-reticle-wrap">
            <div className={`add-reticle${scanLine1 === 'Match found' ? ' matched' : ''}`}>
              <div className="add-corner tl" /><div className="add-corner tr" />
              <div className="add-corner bl" /><div className="add-corner br" />
              {/* Expanding ring on a dm+d hit — the moment the scan pays off. */}
              <span className="add-ring" aria-hidden />
            </div>
            <div className="add-scan-hint">{SCAN_HINT}</div>
          </div>

          <div className={`add-match${apiScanStatus === 'error' ? ' add-match-warn' : ''}`}>
            <div className="dot"><Icon name="capsule" size={24} strokeWidth={1.6} /></div>
            <div className="mtext">
              <div className="mt1">{scanLine1}</div>
              <div className="mt2">{scanLine2 || ''}</div>
              <div className="mt3">{scanLine3}</div>
            </div>
            {scanLine1 === 'Scanning…' || scanLine1 === 'Looking up…' ? (
              <svg className="add-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 3a9 9 0 1 0 9 9" opacity=".9" /></svg>
            ) : null}
          </div>
          <div className="add-scan-ind" />
        </div>
      </PhoneFrame>
    );
  }

  // ---------------- MANUAL / FILLED / CAMERA ----------------
  return (
    <PhoneFrame label={screenTitle}>
      <StatusBar />
      <SubHeader
        title={screenTitle}
        onBack={() => nav('/home')}
        right={
          <button className="icon-btn" aria-label="Close" onClick={() => nav('/home')}>
            <Icon name="close" size={20} strokeWidth={2} />
          </button>
        }
      />

      {!editing && (
        <div className="segwrap">
          <div
            className="segment"
            role="tablist"
            style={{ '--seg-i': isManualLike ? 0 : 1, '--seg-n': 2 } as CSSProperties}
          >
            <button role="tab" aria-selected={isManualLike} onClick={goManual}>
              <Icon name="edit" size={17} /> Manual
            </button>
            <button role="tab" aria-selected={mode === 'camera'} onClick={() => setMode('camera')}>
              <Icon name="camera" size={17} /> Camera
            </button>
          </div>
        </div>
      )}

      {mode === 'camera' ? (
        <>
          <div className="screen-body">
            <div className="add-camreq">
              <div className="add-halo"><Icon name="camera" size={52} strokeWidth={1.6} /></div>
              <h2>Scan your medication</h2>
              <p>Point your camera at the barcode on the packaging. We’ll match it to a known database and fill in the details for you.</p>
              <div className="add-privacy">
                <Icon name="shield" size={14} strokeWidth={2} />
                Camera is used only for scanning. No images are stored.
              </div>
            </div>
          </div>
          <div className="add-footer">
            <button className="add-cta" onClick={() => {
              setCameraFacing('environment');
              setMode('scan');
            }}>Request camera access</button>
          </div>
        </>
      ) : (
        <>
          <div className="screen-body add-body">
            {mode === 'filled' && (
              <div className="add-filled-banner">
                <Icon name="check" size={18} strokeWidth={2} />
                Filled automatically from barcode scan. Check and confirm.
              </div>
            )}

            <div className="add-name-row">
              <div className={`add-photo filled`} title={rows[0]?.route}>
                <Icon name={iconForRoute(rows[0]?.route)} size={30} strokeWidth={1.6} />
              </div>
              <TextField
                label="Medication name"
                placeholder="e.g. Atorvastatin"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <TextField
              label="Brand name"
              placeholder="Lipitor"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />

            <div className="add-gtin-row">
              <TextField
                label="Pack barcode (optional)"
                placeholder="EAN-13 from packaging"
                value={gtinInput}
                onChange={(e) => setGtinInput(e.target.value)}
              />
              <button type="button" className="add-gtin-btn" onClick={onManualLookup}>
                Lookup
              </button>
            </div>
            {lookupErr && <p className="add-lookup-err">{lookupErr}</p>}

            <div className="add-dosecard">
              <div className="add-dosecard-head">
                <span className="field-label">Dose, route &amp; time</span>
                <span className="add-dose-count">{rows.length} {rows.length === 1 ? 'dose' : 'doses'} / day</span>
              </div>

              {rows.map((r, i) => (
                <div className={`add-regrow${i > 0 ? ' extra' : ''}`} key={i}>
                  {i > 0 && (
                    <div className="add-regrow-head">
                      <span>Dose {i + 1}</span>
                      <button type="button" className="add-removerow" onClick={() => removeRow(i)}>
                        <Icon name="close" size={13} strokeWidth={2} /> Remove
                      </button>
                    </div>
                  )}
                  <div className="add-dgrid">
                    {i === 0 && <><span className="add-ch">Dose</span><span className="add-ch">Route</span><span className="add-ch">Time</span></>}
                    <input
                      className="add-cell add-input"
                      placeholder="mg"
                      value={r.dose}
                      onChange={(e) => setRow(i, { dose: e.target.value })}
                    />
                    <SelectField options={ROUTES} value={r.route} onChange={(v) => setRow(i, { route: v })} />
                    <button
                      type="button"
                      className={`add-cell add-time${r.time ? '' : ' placeholder'}`}
                      onClick={() => openTime(i)}
                    >
                      <span>{r.time || 'Time'}</span>
                      <Icon name="clock" size={16} className="chev" />
                    </button>
                  </div>
                </div>
              ))}

              <button type="button" className="add-addrow" onClick={addRow}>
                <Icon name="plus" size={15} strokeWidth={2} /> Add another dose
              </button>
            </div>

            <div className="field add-cat">
              <span className="field-label">Category</span>
              <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} />
            </div>

            {category === 'NHS' && (
              <div className="field add-duration">
                <span className="field-label">Course length</span>
                <SelectField options={DURATIONS} value={duration} onChange={setDuration} />
                <span className="field-hint">
                  <Icon name="info" size={13} strokeWidth={2} />
                  Comes from your NHS record. Courses with an end date archive themselves automatically, so there is nothing for you to do.
                </span>
              </div>
            )}

            <div className="add-two">
              <label className="field">
                <span className="field-label">Date added</span>
                <input type="date" className="text-input add-date" value={dateAdded} onChange={(e) => setDateAdded(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Start date</span>
                <input type="date" className="text-input add-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="add-footer">
            {saveError && (
              <div className="add-save-err" role="alert">
                <Icon name="warning" size={18} strokeWidth={2} />
                <div>
                  <strong>Could not verify interactions</strong>
                  <p>{saveError}</p>
                </div>
              </div>
            )}
            <button
              className={`add-cta${canSave && !saveChecking ? '' : ' disabled'}`}
              onClick={() => void onSave()}
            >
              {saveChecking ? 'Checking interactions…' : editing ? 'Save changes' : 'Save medication'}
            </button>
          </div>
        </>
      )}

      {showTime && (
        <Sheet onClose={() => setShowTime(false)}>
          <div className="add-ts-head">
            <span className="add-ts-title">Set time</span>
            <button className="add-ts-done" onClick={confirmTime}>Done</button>
          </div>
          <div className="add-wheel">
            <div className="add-band" />
            <WheelCol options={HOURS} value={th} onChange={setTh} wrap />
            <div className="add-col colon"><span className="add-val sel">:</span></div>
            <WheelCol options={MINS} value={tm} onChange={setTm} wrap />
            <div className="add-col">
              <span className="add-val n2">&nbsp;</span>
              <span className="add-val n1">&nbsp;</span>
              <span className="add-val sel">{tap}</span>
              <button className="add-val n1" onClick={() => setTap(tap === 'AM' ? 'PM' : 'AM')}>{tap === 'AM' ? 'PM' : 'AM'}</button>
              <span className="add-val n2">&nbsp;</span>
            </div>
          </div>
          <div className="add-ts-hint">
            <Icon name="clock" size={14} strokeWidth={2} />
            Scroll to the nearest time · 15-minute steps
          </div>
        </Sheet>
      )}

      {clearCheck && (
        <AddClearCheck
          med={clearCheck.med}
          cabinetCount={clearCheck.cabinetCount}
          isEdit={clearCheck.isEdit}
          onClose={() => setClearCheck(null)}
          onConfirm={() => {
            if (clearCheck.isEdit) store.updateMedication(clearCheck.med);
            else store.addMedication(clearCheck.med);
            const cabinet = cabinetWithPending(state.medications, clearCheck.med);
            markInteractionCheckFresh(cabinet.filter((m) => m.status === 'active'));
            setClearCheck(null);
            nav('/home');
          }}
        />
      )}

    </PhoneFrame>
  );
}

/** A single wheel column: shows the selected value centred with two faded neighbours each side. */
function WheelCol({ options, value, onChange, wrap }: {
  options: string[]; value: string; onChange: (v: string) => void; wrap?: boolean;
}) {
  const idx = Math.max(0, options.indexOf(value));
  const at = (o: number): string | null => {
    let i = idx + o;
    if (wrap) i = ((i % options.length) + options.length) % options.length;
    return i >= 0 && i < options.length ? options[i] : null;
  };
  const cell = (o: number, cls: string) => {
    const v = at(o);
    if (v === null) return <span className={`add-val ${cls}`}>&nbsp;</span>;
    if (o === 0) return <span className="add-val sel">{v}</span>;
    return <button className={`add-val ${cls}`} onClick={() => onChange(v)}>{v}</button>;
  };
  return (
    <div className="add-col">
      {cell(-2, 'n2')}
      {cell(-1, 'n1')}
      {cell(0, 'sel')}
      {cell(1, 'n1')}
      {cell(2, 'n2')}
    </div>
  );
}
