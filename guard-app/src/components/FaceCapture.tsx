// FaceCapture - Camera + face-api.js face descriptor extraction
import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { X, Camera, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const MODEL_URL = '/models';

let modelsLoaded = false;

async function ensureModelsLoaded() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

interface FaceCaptureProps {
  title?: string;
  instruction?: string;
  onCapture: (descriptor: number[]) => void;
  onCancel: () => void;
}

export default function FaceCapture({ title, instruction, onCapture, onCancel }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<'loading' | 'scanning' | 'capturing' | 'error'>('loading');
  const [msg, setMsg] = useState('Loading models…');
  const [faceReady, setFaceReady] = useState(false);

  const stopAll = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  const startCamera = useCallback(async () => {
    setPhase('loading');
    setMsg('Loading models…');
    setFaceReady(false);
    try {
      await ensureModelsLoaded();
      setMsg('Starting camera…');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Sync canvas size to video
      const sync = () => {
        if (videoRef.current && canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
      };
      videoRef.current.addEventListener('loadedmetadata', sync);

      setPhase('scanning');
      setMsg('Position your face in the oval');

      // Detection loop (every 400ms)
      loopRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true);

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (detection) {
          const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
          const resized = faceapi.resizeResults(detection, dims);
          faceapi.draw.drawDetections(canvasRef.current, [resized]);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, [resized]);
          setFaceReady(true);
          setMsg('Face detected — tap Capture');
        } else {
          setFaceReady(false);
          setMsg('Position your face in the oval');
        }
      }, 400);
    } catch (err: any) {
      setPhase('error');
      setMsg(err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access and retry.'
        : err?.message || 'Failed to start camera');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopAll();
  }, [startCamera, stopAll]);

  const handleCapture = async () => {
    if (!videoRef.current || !faceReady || phase !== 'scanning') return;
    setPhase('capturing');
    setMsg('Analyzing face…');

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        setPhase('scanning');
        setMsg('No face detected — try again');
        return;
      }

      stopAll();
      onCapture(Array.from(detection.descriptor));
    } catch {
      setPhase('scanning');
      setMsg('Capture failed — try again');
    }
  };

  const handleCancel = () => {
    stopAll();
    onCancel();
  };

  const handleRetry = () => {
    stopAll();
    startCamera();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
        <h2 className="text-white font-semibold">{title || 'Face Verification'}</h2>
        <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-700 text-gray-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera */}
      <div className="relative flex-1 overflow-hidden bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }} // mirror for selfie
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Oval face guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-52 h-68 rounded-full border-4 transition-colors duration-300 ${
              faceReady ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'border-white/50'
            }`}
            style={{ height: '68%', width: '55%', maxWidth: '240px', maxHeight: '320px' }}
          />
        </div>

        {/* Loading overlay */}
        {phase === 'loading' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin border-[3px]" />
            <p className="text-white text-sm">{msg}</p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-900 px-6 py-5 space-y-3">
        {/* Status */}
        <div className={`flex items-center justify-center gap-2 text-sm ${
          phase === 'error' ? 'text-red-400' : faceReady ? 'text-green-400' : 'text-gray-300'
        }`}>
          {phase === 'error' ? <AlertCircle className="w-4 h-4" /> :
           faceReady ? <CheckCircle className="w-4 h-4" /> :
           <Camera className="w-4 h-4" />}
          <span>{msg}</span>
        </div>

        {/* Action buttons */}
        {phase === 'error' ? (
          <button
            onClick={handleRetry}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" /> Retry
          </button>
        ) : (
          <button
            onClick={handleCapture}
            disabled={!faceReady || phase !== 'scanning'}
            className={`w-full py-4 rounded-2xl font-bold text-white transition-all ${
              faceReady && phase === 'scanning'
                ? 'bg-green-600 hover:bg-green-700 shadow-lg'
                : 'bg-gray-700 opacity-50 cursor-not-allowed'
            }`}
          >
            {phase === 'capturing' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing…
              </span>
            ) : 'Capture Face'}
          </button>
        )}

        {instruction && (
          <p className="text-center text-xs text-gray-500">{instruction}</p>
        )}
      </div>
    </div>
  );
}
