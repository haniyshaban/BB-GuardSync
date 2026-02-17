// Face Check Service - Polls for pending face checks and prompts guard
import { guardApi } from './api';

let faceCheckInterval: ReturnType<typeof setInterval> | null = null;
let onFaceCheckDue: ((checks: any[]) => void) | null = null;

export function startFaceCheckPolling(guardId: number, callback: (checks: any[]) => void) {
  stopFaceCheckPolling();
  onFaceCheckDue = callback;

  // Check every 2 minutes for due face checks
  checkForFaceChecks(guardId);
  faceCheckInterval = setInterval(() => {
    checkForFaceChecks(guardId);
  }, 2 * 60 * 1000);

  console.log('[FaceCheckService] Polling started');
}

export function stopFaceCheckPolling() {
  if (faceCheckInterval) {
    clearInterval(faceCheckInterval);
    faceCheckInterval = null;
    onFaceCheckDue = null;
    console.log('[FaceCheckService] Polling stopped');
  }
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
