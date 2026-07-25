import QRCode from 'qrcode';

/** Render a QR code to a data URL for <img src>. Theme-aware colours via args. */
export async function qrDataUrl(text: string, opts?: { dark?: string; light?: string; size?: number }): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: opts?.size ?? 320,
    color: { dark: opts?.dark ?? '#1A1A17', light: opts?.light ?? '#FFFFFF' },
  });
}
