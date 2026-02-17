import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { guardApi } from '@/services/api';
import { ArrowLeft, Eye, EyeOff, CheckCircle, Building2 } from 'lucide-react';

export default function EnrollmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgValidating, setOrgValidating] = useState(false);
  const [orgValidated, setOrgValidated] = useState(false);
  const [successOrgName, setSuccessOrgName] = useState('');

  const [form, setForm] = useState({
    orgCode: searchParams.get('org') || '',
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const update = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
    // Reset org validation if code changes
    if (field === 'orgCode') {
      setOrgValidated(false);
      setOrgName('');
    }
  };

  const validateOrgCode = async () => {
    if (!form.orgCode.trim()) {
      setError('Please enter an organization code');
      return;
    }
    setOrgValidating(true);
    setError('');
    try {
      const res = await guardApi.validateOrgCode(form.orgCode.trim());
      setOrgName(res.data.name);
      setOrgValidated(true);
    } catch (err: any) {
      setError(err.message || 'Invalid organization code');
      setOrgValidated(false);
    } finally {
      setOrgValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!/^\d{10}$/.test(form.phone)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      await guardApi.enroll({
        name: form.name,
        phone: form.phone,
        email: form.email,
        password: form.password,
        orgCode: form.orgCode.trim(),
      });
      setSuccessOrgName(orgName);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Enrollment failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 px-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Enrollment Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your enrollment to <strong>{successOrgName}</strong> is pending admin approval. You will be able to login once approved.
          </p>
          <button onClick={() => navigate('/login')}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-6 py-8">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/login" className="p-2 hover:bg-gray-800 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Guard Enrollment</h1>
            <p className="text-sm text-gray-400">Create your account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 space-y-4 shadow-xl">
          {/* Organization Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> Organization Code *</span>
            </label>
            <div className="flex gap-2">
              <input type="text" value={form.orgCode}
                onChange={(e) => update('orgCode', e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900 font-mono tracking-wider uppercase"
                placeholder="e.g. ACME-7X3K" required />
              <button type="button" onClick={validateOrgCode} disabled={orgValidating || orgValidated}
                className={`px-4 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${
                  orgValidated
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50'
                }`}>
                {orgValidating ? '...' : orgValidated ? '✓ Verified' : 'Verify'}
              </button>
            </div>
            {orgValidated && <p className="text-green-600 text-xs mt-1">Organization: <strong>{orgName}</strong></p>}
            <p className="text-gray-400 text-xs mt-1">Get this code from your employer</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Enter your full name" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="10-digit phone number" required maxLength={10} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="your@email.com" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'}
                value={form.password} onChange={(e) => update('password', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900 pr-12"
                placeholder="Minimum 6 characters" required minLength={6} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
            <input type="password" value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Re-enter password" required minLength={6} />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={loading || !orgValidated}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit Enrollment'}
          </button>
        </form>
      </div>
    </div>
  );
}
