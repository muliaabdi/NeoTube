// Web fallback only; native platforms resolve toast.android.ts / toast.ios.ts.
// ponytail: web target went away with the desktop workspace — restore the
// react-hot-toast implementation here if web ever comes back.
export function showToast(_msg: string) {}
