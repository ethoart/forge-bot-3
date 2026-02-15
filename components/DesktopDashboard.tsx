import React, { useState, useEffect, useCallback } from 'react';
import { UploadCloud, Clock, CheckCircle, RefreshCw, FileVideo, AlertCircle, Loader2, Search, ArrowLeft, Filter, Layers } from 'lucide-react';
import { CustomerRequest } from '../types';
import { getPendingRequests, uploadDocument } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { MOTIVATIONAL_QUOTES } from '../constants';
import { Link } from 'react-router-dom';

const DesktopDashboard: React.FC = () => {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Batch Upload States
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, successes: 0, skipped: 0 });
  const [lastBatchReport, setLastBatchReport] = useState<string | null>(null);

  const [motivation, setMotivation] = useState(MOTIVATIONAL_QUOTES[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    // Don't fetch if we are in the middle of a massive upload batch to avoid UI jitter
    if (isProcessingBatch) return;

    setIsLoading(true);
    const data = await getPendingRequests();
    setRequests(data);
    setIsLoading(false);
  }, [isProcessingBatch]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingBatch(true);
    setLastBatchReport(null);
    const fileList = Array.from(files) as File[];
    
    setBatchProgress({
      current: 0,
      total: fileList.length,
      successes: 0,
      skipped: 0
    });

    // We maintain a set of Request IDs used in this batch to prevent 
    // sending 2 duplicate files to the same customer in one go.
    const usedRequestIds = new Set<string>();
    
    let successes = 0;
    let skipped = 0;

    // SEQUENTIAL UPLOAD LOOP
    // We await each upload to protect the AWS T3 Small server from crashing due to 100 concurrent connections.
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));

      const rawFileName = file.name;
      const nameWithoutExt = rawFileName.substring(0, rawFileName.lastIndexOf('.')) || rawFileName;

      // Find the OLDEST pending request that matches this filename
      // and hasn't been fulfilled by a previous file in this specific batch.
      const match = requests.find(r => 
        !usedRequestIds.has(r.id) &&
        r.status === 'pending' && 
        (nameWithoutExt.toLowerCase().includes(r.videoName.toLowerCase()) || 
         r.videoName.toLowerCase() === nameWithoutExt.toLowerCase())
      );

      if (match) {
        usedRequestIds.add(match.id);
        const success = await uploadDocument(match.id, file, match.phoneNumber);
        
        if (success) {
          successes++;
          setBatchProgress(prev => ({ ...prev, successes: prev.successes + 1 }));
        } else {
          skipped++; // API failure count as skipped for now
          setBatchProgress(prev => ({ ...prev, skipped: prev.skipped + 1 }));
        }
      } else {
        skipped++;
        setBatchProgress(prev => ({ ...prev, skipped: prev.skipped + 1 }));
      }
    }

    // Batch Complete
    setLastBatchReport(`Batch Done: Sent ${successes} videos. Skipped ${skipped} (no match).`);
    setIsProcessingBatch(false);
    setMotivation(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
    
    // Refresh list immediately to show completed items gone
    const newData = await getPendingRequests();
    setRequests(newData);

    // Reset input
    e.target.value = '';
    
    // Clear report after 6 seconds
    setTimeout(() => {
      setLastBatchReport(null);
      setBatchProgress({ current: 0, total: 0, successes: 0, skipped: 0 });
    }, 6000);
  };

  const filteredRequests = requests.filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.videoName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900 overflow-hidden">
      
      {/* SIDEBAR - Minimal & Solid */}
      <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 bg-white">
            <Link to="/" className="mr-3 p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
               <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-bold text-lg tracking-tight">Queue</span>
            <div className="ml-auto bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">
              {requests.length}
            </div>
        </div>

        <div className="p-4 flex flex-col flex-1 overflow-hidden">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search request..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-shadow shadow-sm"
            />
          </div>
          
          <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar pr-1">
             {isLoading && requests.length === 0 && (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400"/></div>
             )}
             
             {!isLoading && filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No requests found</p>
                </div>
             ) : (
                filteredRequests.map((req) => (
                  <div key={req.id} className="group p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-default select-none relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-800 text-sm truncate pr-2">{req.customerName}</span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDistanceToNow(new Date(req.requestedAt))}</span>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                      <FileVideo className="w-3 h-3 mr-1.5 text-blue-500" />
                      <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 truncate max-w-[180px]">{req.videoName}</span>
                    </div>
                  </div>
                ))
             )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
           <button onClick={() => fetchData()} disabled={isProcessingBatch} className="flex items-center justify-center w-full py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-600 transition-all shadow-sm disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
           </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col relative bg-white">
        
        {/* Top Navigation Bar */}
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-sm z-10 sticky top-0">
           <h1 className="font-bold text-xl text-slate-900 flex items-center gap-2">
             <Layers className="w-5 h-5 text-blue-500" />
             Batch Upload Center
           </h1>
           
           <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-500 italic hidden md:block">"{motivation}"</div>
              <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                ONLINE
              </div>
           </div>
        </header>

        {/* Upload Zone */}
        <main className="flex-1 p-8 flex flex-col items-center justify-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
           
           <div className="w-full max-w-3xl">
              <div className="relative group">
                {/* Decorative shadow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-purple-100 rounded-[2rem] blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                
                <div className={`relative aspect-[2/1] bg-white rounded-[1.8rem] border-2 border-dashed ${isProcessingBatch ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/10'} transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden shadow-xl shadow-slate-200/50`}>
                  <input 
                    type="file" 
                    multiple 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50 disabled:cursor-not-allowed"
                    onChange={handleFileChange}
                    disabled={isProcessingBatch}
                    accept="video/*,application/pdf,image/*"
                  />
                  
                  {isProcessingBatch ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                       <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                       <h3 className="text-2xl font-bold text-slate-800 mb-2">Processing Batch...</h3>
                       <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                          />
                       </div>
                       <p className="text-slate-500 mt-3 font-mono text-sm">
                         {batchProgress.current} / {batchProgress.total} Files
                       </p>
                       <p className="text-xs text-green-600 mt-1 font-bold">
                         {batchProgress.successes} Sent
                       </p>
                    </div>
                  ) : lastBatchReport ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                       <div className="bg-green-50 p-6 rounded-full mb-4">
                         <CheckCircle className="w-12 h-12 text-green-500" />
                       </div>
                       <h3 className="text-xl font-bold text-slate-800 mb-2">{lastBatchReport}</h3>
                       <p className="text-slate-400 text-sm">Ready for next batch</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 p-6 rounded-full mb-6 group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
                         <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">Drag & Drop Videos</h3>
                      <p className="text-slate-500 text-sm max-w-sm text-center px-4 leading-relaxed">
                        <span className="font-semibold text-blue-600">Bulk Upload Supported</span>. 
                        Files are automatically matched to the oldest pending customer by name.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Queue Size</p>
                      <p className="text-2xl font-bold text-slate-800">{requests.length}</p>
                    </div>
                    <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center">
                       <Clock className="w-5 h-5 text-blue-500" />
                    </div>
                 </div>
                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Batch Mode</p>
                      <p className="text-2xl font-bold text-green-600">Ready</p>
                    </div>
                    <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center">
                       <Layers className="w-5 h-5 text-green-500" />
                    </div>
                 </div>
              </div>
           </div>
        </main>
      </div>
    </div>
  );
};

export default DesktopDashboard;