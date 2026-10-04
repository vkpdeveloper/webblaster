export type ContentToBackground = { type: 'capture' };

export type CaptureResponse = { ok: true; dataUrl: string } | { ok: false; error: string };
