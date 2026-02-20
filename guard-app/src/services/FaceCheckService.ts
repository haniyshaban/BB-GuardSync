// Face Check Service - Polls for pending face checks and prompts guard
import { guardApi } from './api';

let faceCheckInterval: ReturnType<typeof setInterval> | null = null;
let initialDelayTimer: ReturnType<typeof setTimeout> | null = null;
let onFaceCheckDue: ((checks: any[]) => void) | null = null;

// Wait 2 minutes after clock-in before the first poll — prevents
// immediately re-opening the camera right after the clock-in face scan.
const INITIAL_DELAY_MS = 2 * 60 * 1000;
const POLL_INTERVAL_MS = 2 * 60 * 1000;

export function startFaceCheckPolling(guardId: number, callback: (checks: any[]) => void) {
  stopFaceCheckPolling();
  onFaceCheckDue = callback;

  // Grace period: start polling 2 minutes after clock-in
  initialDelayTimer = setTimeout(() => {
    checkForFaceChecks(guardId);
    faceCheckInterval = setInterval(() => {
      checkForFaceChecks(guardId);
    }, POLL_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log('[FaceCheckService] Polling scheduled (starts in 2 min)');
}

export function stopFaceCheckPolling() {
  if (initialDelayTimer) {
    clearTimeout(initialDelayTimer);
    initialDelayTimer = null;
  }
  if (faceCheckInterval) {
    clearInterval(faceCheckInterval);
    faceCheckInterval = null;
    onFaceCheckDue = null;
    console.log('[FaceCheckService] Polling stopped');
  }
  onFaceCheckDue = null;
}

async function checkForFaceChecks(guardId: number) {
  try {
    const res = await guardApi.getPendingFaceChecks(guardId);
    if (res.data && res.data.length > 0 && onFaceCheckDue) {
      onFaceCheckDue(res.data);
    }
  } catch (err) {
    console.error('[FaceCheckService] Check failed:', err);
  }
}
