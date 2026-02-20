import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { guardApi } from '@/services/api';
import { startLocationTracking, stopLocationTracking } from '@/services/LocationService';
import { startFaceCheckPolling, stopFaceCheckPolling } from '@/services/FaceCheckService';
import FaceCapture from '@/components/FaceCapture';
import { Clock, LogIn, LogOut, MapPin, AlertCircle, CheckCircle, Wifi, WifiOff, XCircle } from 'lucide-react';

export default function DashboardPage() {
  const { user, refreshUser, updateUser } = useAuth();
  const [clockLoading, setClockLoading] = useState(false);
  const [error, setError] = useState('');
  const [clockedIn, setClockedIn] = useState(user?.clocked_in || false);
  const [clockInTime, setClockInTime] = useState(user?.clock_in_time || '');
  const [faceCheckDue, setFaceCheckDue] = useState<any[]>([]);
  const [faceCheckOpen, setFaceCheckOpen] = useState(false);
  const [faceCheckResult, setFaceCheckResult] = useState<'passed' | 'failed' | null>(null);
  const [activeFaceCheckId, setActiveFaceCheckId] = useState<number | null>(null);

  // Refresh user data on mount
  useEffect(() => {
    refreshUser();
  }, []);

  // Sync clocked_in state from user
  useEffect(() => {
    if (user) {
      setClockedIn(!!user.clocked_in);
      setClockInTime(user.clock_in_time || '');
    }
  }, [user]);

  // Start/stop services when clock status changes
  useEffect(() => {
    if (clockedIn && user) {
      startLocationTracking(30); // Every 30 minutes
      startFaceCheckPolling(user.id, (checks) => {
        setFaceCheckDue(checks);
        setFaceCheckOpen(true);
      });
    } else {
      stopLocationTracking();
      stopFaceCheckPolling();
    }

    return () => {
      stopLocationTracking();
      stopFaceCheckPolling();
    };
  }, [clockedIn, user?.id]);

  const handleClockIn = async () => {
    setClockLoading(true);
    setError('');
    try {
      // Get current location
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* Location optional */ }

      const res = await guardApi.clockIn(lat, lng);
      setClockedIn(true);
      setClockInTime(res.data.clockIn);
      updateUser({ clocked_in: true, clock_in_time: res.data.clockIn });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!confirm('Are you sure you want to clock out?')) return;
    setClockLoading(true);
    setError('');
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* Location optional */ }

      await guardApi.clockOut(lat, lng);
      setClockedIn(false);
      setClockInTime('');
      updateUser({ clocked_in: false, clock_in_time: undefined });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClockLoading(false);
    }
  };

  const openFaceCheck = () => {
    if (faceCheckDue.length === 0) return;
    setActiveFaceCheckId(faceCheckDue[0].id);
    setFaceCheckResult(null);
    setFaceCheckOpen(true);
  };

  const handleFaceCaptured = async (descriptor: number[]) => {
    setFaceCheckOpen(false);
    if (!activeFaceCheckId) return;
    try {
      const res = await guardApi.submitFaceCheckResult(activeFaceCheckId, descriptor);
      const passed = res.data?.passed;
      setFaceCheckResult(passed ? 'passed' : 'failed');
      if (passed) {
        setFaceCheckDue(prev => prev.filter(c => c.id !== activeFaceCheckId));
      }
    } catch (err: any) {
      setError(err.message);
    }
    setActiveFaceCheckId(null);
  };

  const handleFaceCheckSubmit = async (checkId: number) => {
    // kept for legacy; openFaceCheck() is the new entry point
    setActiveFaceCheckId(checkId);
    setFaceCheckResult(null);
    setFaceCheckOpen(true);
  };

  const elapsed = clockInTime
    ? Math.floor((Date.now() - new Date(clockInTime).getTime()) / (1000 * 60))
    : 0;
  const elapsedHours = Math.floor(elapsed / 60);
  const elapsedMins = elapsed % 60;

  return (
    <div className="px-4 pt-6 safe-top">
      {/* Face Capture Overlay */}
      {faceCheckOpen && (
        <FaceCapture
          title="Identity Verification"
          instruction="This check confirms you are on duty at your post"
          onCapture={handleFaceCaptured}
          onCancel={() => { setFaceCheckOpen(false); setActiveFaceCheckId(null); }}
        />
      )}

      {/* Face Check Result Toast */}
      {faceCheckResult && (
        <div className={`fixed top-4 left-4 right-4 z-40 rounded-xl p-4 flex items-center gap-3 shadow-lg ${
          faceCheckResult === 'passed' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {faceCheckResult === 'passed'
            ? <CheckCircle className="w-6 h-6 flex-shrink-0" />
            : <XCircle className="w-6 h-6 flex-shrink-0" />}
          <div className="flex-1">
            <p className="font-semibold">{faceCheckResult === 'passed' ? 'Verification Passed' : 'Verification Failed'}</p>
            <p className="text-sm opacity-90">{faceCheckResult === 'passed' ? 'Identity confirmed.' : 'Face did not match. An alert has been logged.'}</p>
          </div>
          <button onClick={() => setFaceCheckResult(null)} className="opacity-70 hover:opacity-100"><XCircle className="w-5 h-5" /></button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">Good {getGreeting()},</p>
        <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.siteName || 'No site assigned'} {user?.shiftLabel ? `• ${user.shiftLabel}` : ''}
        </p>
      </div>

      {/* Status Card */}
      <div className={`rounded-2xl p-6 mb-4 ${clockedIn ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-100'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {clockedIn ? <Wifi className="w-5 h-5 text-green-600" /> : <WifiOff className="w-5 h-5 text-gray-400" />}
            <span className={`text-lg font-bold ${clockedIn ? 'text-green-700' : 'text-gray-600'}`}>
              {clockedIn ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          {clockedIn && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Time elapsed</p>
              <p className="text-lg font-bold text-gray-900">{elapsedHours}h {elapsedMins}m</p>
            </div>
          )}
        </div>

        {/* Clock In/Out Button */}
        <button
          onClick={clockedIn ? handleClockOut : handleClockIn}
          disabled={clockLoading}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors disabled:opacity-50 ${
            clockedIn
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {clockLoading ? (
            <span>Processing...</span>
          ) : clockedIn ? (
            <><LogOut className="w-5 h-5" /> Clock Out</>
          ) : (
            <><LogIn className="w-5 h-5" /> Clock In</>
          )}
        </button>

        {clockedIn && (
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>Location tracking active (every 30 mins)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Daily Rate</p>
          <p className="text-lg font-bold text-gray-900">₹{user?.daily_rate || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Employee ID</p>
          <p className="text-lg font-bold text-gray-900">{user?.employee_id || '—'}</p>
        </div>
      </div>

      {/* Face Check Alert */}
      {faceCheckDue.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-800">Face Verification Required</span>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            Please complete your face verification check to confirm your presence.
          </p>
          <button
            onClick={openFaceCheck}
            className="w-full bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700"
          >
            Complete Face Check
          </button>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
