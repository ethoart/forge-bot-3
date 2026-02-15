import React, { useState } from 'react';
import { User, Phone, Video, Check, Loader2, ChevronLeft } from 'lucide-react';
import { registerCustomer } from '../services/api';
import { Link } from 'react-router-dom';

const MobileRegister: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', phone: '', videoName: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.videoName) return;

    setStatus('submitting');
    const success = await registerCustomer(formData.name, formData.phone, formData.videoName);
    
    if (success) {
      setStatus('success');
      setTimeout(() => {
        setFormData({ name: '', phone: '', videoName: '' });
        setStatus('idle');
      }, 3000);
    } else {
      alert("Failed to register. Please try again.");
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="bg-white/10 border border-white/20 p-8 rounded-full shadow-2xl mb-8 scale-110">
          <Check className="w-16 h-16 text-green-400 drop-shadow-lg" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Registered!</h2>
        <p className="text-slate-300 text-lg max-w-xs mx-auto leading-relaxed">
          We'll send <strong>{formData.videoName}</strong> to {formData.name} soon.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      
      {/* iOS Header */}
      <div className="pt-12 pb-4 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200/50">
        <Link to="/" className="p-2 -ml-2 text-blue-500 font-medium flex items-center">
           <ChevronLeft className="w-5 h-5 mr-1" /> Back
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 absolute left-1/2 transform -translate-x-1/2">
          New Customer
        </h1>
        <div className="w-12"></div> {/* Spacer for centering */}
      </div>

      <div className="flex-1 p-6 pb-12">
        <div className="max-w-md mx-auto space-y-8">
          
          <div className="text-center mt-4">
             <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-2xl mx-auto shadow-xl flex items-center justify-center mb-6">
                <User className="w-10 h-10 text-white" />
             </div>
             <p className="text-gray-500">Enter customer details below.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Input Group */}
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-12 pr-4 py-4 bg-white border-0 ring-1 ring-gray-200 rounded-2xl text-lg placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:outline-none shadow-sm transition-all"
                  placeholder="Customer Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="tel"
                  required
                  className="block w-full pl-12 pr-4 py-4 bg-white border-0 ring-1 ring-gray-200 rounded-2xl text-lg placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:outline-none shadow-sm transition-all"
                  placeholder="WhatsApp Number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Video className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-12 pr-4 py-4 bg-white border-0 ring-1 ring-gray-200 rounded-2xl text-lg placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:outline-none shadow-sm transition-all"
                  placeholder="Video ID / Name"
                  value={formData.videoName}
                  onChange={(e) => setFormData({ ...formData, videoName: e.target.value })}
                />
                <p className="mt-2 text-xs text-gray-400 px-2 text-right">
                  Matches file name exactly
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full mt-8 py-4 px-6 rounded-2xl shadow-lg shadow-blue-500/30 text-lg font-semibold text-white bg-blue-600 active:scale-[0.98] disabled:opacity-70 disabled:scale-100 transition-all flex items-center justify-center"
            >
              {status === 'submitting' ? (
                <Loader2 className="animate-spin h-6 w-6" />
              ) : (
                "Save Customer"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MobileRegister;