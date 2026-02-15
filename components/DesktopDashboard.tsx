import React, { useState, useEffect, useCallback } from 'react';
import { UploadCloud, Clock, CheckCircle, RefreshCw, FileVideo, Loader2, Search, ArrowLeft, Filter, Layers, AlertTriangle, AlertCircle, HardDrive, Trash2, Send } from 'lucide-react';
import { CustomerRequest } from '../types';
import { getPendingRequests, getFailedRequests, uploadDocument, getServerFiles, deleteServerFile, retryServerFile, ServerFile } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { MOTIVATIONAL_QUOTES } from '../constants';
import { Link } from 'react-router-dom';

type TabView = 'queue' | 'issues' | 'storage';

const DesktopDashboard: React.FC = () => {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [failedRequests, setFailedRequests] = useState<CustomerRequest[]>([]);
  const [serverFiles, setServerFiles] = useState<ServerFile[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('queue');
  
  // Batch Upload States
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, successes: 0, failed: 0, unmatched: 0 });
  const [lastBatchReport, setLastBatchReport] = useState<{ message: string, type: 'success' | 'warning' } | null>(null);

  const [motivation, setMotivation] = useState(MOTIVATIONAL_QUOTES[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    // Don't fetch if we are in the middle of a massive upload batch to avoid UI jitter
    if (isProcessingBatch) return;

    setIsLoading(true);
    const pendingData = await getPendingRequests();
    setRequests(pendingData);
    
    // Also fetch failed to show issues
    const failedData = await getFailedRequests();
    setFailedRequests(failedData);

    // Fetch storage
    const files = await getServerFiles();
    setServerFiles(files);
    
    setIsLoading(false);
  }, [isProcessingBatch]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Helper: Fuzzy match string (removes special chars, spaces, and lowercase)
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

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
      failed: 0,
      unmatched: 0
    });

    const usedRequestIds = new Set<string>();
    
    let successes = 0;
    let failed = 0;
    let unmatched = 0;

    // SEQUENTIAL UPLOAD LOOP
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));

      const rawFileName = file.name;
      const nameWithoutExt = rawFileName.substring(0, rawFileName.lastIndexOf('.')) || rawFileName;
      const normFileName = normalize(nameWithoutExt);

      const match = requests.find(r => {
        if (usedRequestIds.has(r.id) || r.status !== 'pending') return false;
        const normVideoName = normalize(r.videoName);
        return normFileName.includes(normVideoName) || normVideoName.includes(normFileName);
      });

      if (match) {
        usedRequestIds.add(match.id);
        const success = await uploadDocument(match.id, file, match.phoneNumber);
        
        if (success) {
          successes++;
          setBatchProgress(prev => ({ ...prev, successes: prev.successes + 1 }));
        } else {
          failed++; 
          setBatchProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
        }
      } else {
        unmatched++;
        setBatchProgress(prev => ({ ...prev, unmatched: prev.unmatched + 1 }));
      }
    }

    const message = `Queued: ${successes} | Unmatched: ${unmatched} | Errors: ${failed}`;
    const type = (failed > 0 || unmatched > 0) ? 'warning' : 'success';
    
    setLastBatchReport({ message, type });
    setIsProcessingBatch(false);
    setMotivation(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
    
    // Refresh list immediately
    fetchData();

    // Reset input
    e.target.value = '';
    
    setTimeout(() => {
      setLastBatchReport(null);
      setBatchProgress({ current: 0, total: 0, successes: 0, failed: 0, unmatched: 0 });
    }, 10000);
  };

  const handleRetryFile = async (filename: string) => {
    if(!confirm(`Retry sending ${filename}?`)) return;
    const res = await retryServerFile(filename);
    if(res.success) {
      alert("Queued for retry: " + res.message);
      fetchData();
    } else {
      alert("Failed to retry: " + res.message);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if(!confirm(`Permanently delete ${filename} from server?`)) return;
    const success = await deleteServerFile(filename);
    if(success) fetchData();
  };

  const filteredRequests = (activeTab === 'queue' ? requests : failedRequests).filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.videoName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900 overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 bg-white">
            <Link to="/" className="mr-3 p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
               <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-bold text-lg tracking-tight">Dashboard</span>
        </div>

        {/* TABS */}
        <div className="flex p-2 gap-1 bg-slate-50 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'queue' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Queue <span className="bg-slate-100 px-1.5 rounded-full text-[10px] text-slate-600 border border-slate-200">{requests.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('issues')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'issues' ? 'bg-red-50 shadow-sm text-red-600 border border-red-100' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Issues <span className={`px-1.5 rounded-full text-[10px] border ${failedRequests.length > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{failedRequests.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('storage')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all ${activeTab === 'storage' ? 'bg-indigo-50 shadow-sm text-indigo-600 border border-indigo-100' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Storage <span className="bg-slate-100 px-1.5 rounded-full text-[10px] text-slate-600 border border-slate-200">{serverFiles.length}</span>
          </button>
        </div>

        <div className="p-4 flex flex-col flex-1 overflow-hidden">
          
          {/* SEARCH (Hidden for storage tab for simplicity, or shared) */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-shadow shadow-sm"
            />
          </div>
          
          <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar pr-1">
             {/* --- STORAGE TAB --- */}
             {activeTab === 'storage' ? (
                 serverFiles.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Storage Empty</p>
                      <p className="text-xs">Files are deleted after sending.</p>
                    </div>
                 ) : (
                    serverFiles.map((file, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white border border-indigo-100 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-slate-700 text-xs truncate max-w-[150px]">{file.name}</span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 rounded">{file.size}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 mb-2">{new Date(file.created).toLocaleTimeString()}</div>
                        <div className="flex gap-2">
                          <button onClick={() => handleRetryFile(file.name)} className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1">
                             <Send className="w-3 h-3" /> Retry
                          </button>
                          <button onClick={() => handleDeleteFile(file.name)} className="py-1.5 px-2.5 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                             <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                 )
             ) : (
             /* --- QUEUE / ISSUES TAB --- */
                isLoading && filteredRequests.length === 0 ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400"/></div>
                ) : !isLoading && filteredRequests.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No items found</p>
                    </div>
                ) : (
                    filteredRequests.map((req) => (
                      <div key={req.id} className={`group p-4 rounded-xl bg-white border shadow-sm hover:shadow-md transition-all cursor-default select-none relative overflow-hidden ${activeTab === 'issues' ? 'border-red-100 hover:border-red-200' : 'border-slate-100 hover:border-blue-200'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity ${activeTab === 'issues' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                        
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-slate-800 text-sm truncate pr-2">{req.customerName}</span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">{req.requestedAt ? formatDistanceToNow(new Date(req.requestedAt)) : 'Unknown'}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <FileVideo className={`w-3 h-3 mr-1.5 ${activeTab === 'issues' ? 'text-red-400' : 'text-blue-500'}`} />
                          <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 truncate max-w-[180px]">{req.videoName}</span>
                        </div>

                        {/* ERROR MESSAGE FOR ISSUES TAB */}
                        {activeTab === 'issues' && (req as any).error && (
                          <div className="mt-2 pt-2 border-t border-red-50 flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50/50 p-1.5 rounded">
                            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="break-words leading-tight">{(req as any).error}</span>
                          </div>
                        )}
                      </div>
                    ))
                )
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
                          <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                       </div>
                       <p className="text-slate-500 mt-3 font-mono text-sm">{batchProgress.current} / {batchProgress.total} Files</p>
                    </div>
                  ) : lastBatchReport ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                       <div className={`p-6 rounded-full mb-4 ${lastBatchReport.type === 'success' ? 'bg-green-50' : 'bg-orange-50'}`}>
                         {lastBatchReport.type === 'success' ? <CheckCircle className="w-12 h-12 text-green-500" /> : <AlertTriangle className="w-12 h-12 text-orange-500" />}
                       </div>
                       <h3 className="text-xl font-bold text-slate-800 mb-2">{lastBatchReport.message}</h3>
                       <p className="text-slate-400 text-sm">{lastBatchReport.type === 'success' ? 'All files queued.' : 'Check Issues tab for errors.'}</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 p-6 rounded-full mb-6 group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
                         <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">Drag & Drop Videos</h3>
                      <p className="text-slate-500 text-sm max-w-sm text-center px-4 leading-relaxed">
                        Files are matched automatically. <br/>Check <b>Issues</b> tab if delivery fails.
                      </p>
                    </>
                  )}
                </div>
              </div>
           </div>
        </main>
      </div>
    </div>
  );
};

export default DesktopDashboard;