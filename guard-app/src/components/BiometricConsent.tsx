import { useState } from 'react';
import { ScanFace, ShieldCheck } from 'lucide-react';

interface BiometricConsentProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function BiometricConsent({ onAccept, onDecline }: BiometricConsentProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <ScanFace className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Face Data Consent</h3>
        </div>

        <div className="space-y-3 text-sm text-gray-700 mb-5">
          <p>
            GuardSync uses facial recognition to verify your identity during clock-in
            and periodic duty checks. Before proceeding, please review the following:
          </p>

          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p><strong>What we collect:</strong> A mathematical face descriptor (a numeric template), not a photo or image of your face.</p>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p><strong>How it's used:</strong> Solely to verify your identity during clock-in and random on-duty face checks.</p>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p><strong>Storage:</strong> Your face descriptor is stored securely on our servers and is never shared with third parties.</p>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p><strong>Deletion:</strong> You can delete your face data and entire account at any time from your Profile page.</p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Face processing is performed on your device. Only the computed numeric descriptor is transmitted to our server. No raw images are stored or sent.
          </p>
        </div>

        <label className="flex items-start gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            I understand and consent to the collection and use of my face data for identity verification as described above.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 font-semibold text-sm text-gray-700 hover:bg-gray-50"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={!agreed}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
