import { create } from 'zustand';

const TOUCH_KEY = 'pdv.touchMode';
const SUCCESS_ENABLED_KEY = 'pdv.successEnabled';
const SUCCESS_AUTOCLOSE_KEY = 'pdv.successAutoClose';
const IDLE_TIMEOUT_KEY = 'pdv.idleTimeoutMin';

function readBool(key: string, defaultValue: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return defaultValue;
    return v === '1';
  } catch {
    return defaultValue;
  }
}

function readNumber(key: string, defaultValue: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return defaultValue;
    const n = Number(v);
    return Number.isFinite(n) ? n : defaultValue;
  } catch {
    return defaultValue;
  }
}

type PrefsState = {
  touchMode: boolean;
  successEnabled: boolean;
  /** seconds until auto-close; 0 = manual only */
  successAutoClose: number;
  /** minutes of inactivity in PDV before auto-logout; 0 = disabled */
  pdvIdleTimeoutMin: number;
  setTouchMode: (v: boolean) => void;
  setSuccessEnabled: (v: boolean) => void;
  setSuccessAutoClose: (v: number) => void;
  setPdvIdleTimeoutMin: (v: number) => void;
};

export const usePrefs = create<PrefsState>((set) => ({
  touchMode: readBool(TOUCH_KEY, false),
  successEnabled: readBool(SUCCESS_ENABLED_KEY, true),
  successAutoClose: readNumber(SUCCESS_AUTOCLOSE_KEY, 0),
  pdvIdleTimeoutMin: readNumber(IDLE_TIMEOUT_KEY, 0),
  setTouchMode: (v) => {
    try { localStorage.setItem(TOUCH_KEY, v ? '1' : '0'); } catch { /* ignore */ }
    set({ touchMode: v });
  },
  setSuccessEnabled: (v) => {
    try { localStorage.setItem(SUCCESS_ENABLED_KEY, v ? '1' : '0'); } catch { /* ignore */ }
    set({ successEnabled: v });
  },
  setSuccessAutoClose: (v) => {
    try { localStorage.setItem(SUCCESS_AUTOCLOSE_KEY, String(v)); } catch { /* ignore */ }
    set({ successAutoClose: v });
  },
  setPdvIdleTimeoutMin: (v) => {
    try { localStorage.setItem(IDLE_TIMEOUT_KEY, String(v)); } catch { /* ignore */ }
    set({ pdvIdleTimeoutMin: v });
  },
}));
