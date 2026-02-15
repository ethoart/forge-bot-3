export interface CustomerRequest {
  id: string;
  customerName: string;
  phoneNumber: string;
  videoName: string; // This is the key identifier
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string; // ISO Date string
}

export interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
}

export interface N8nConfig {
  apiBaseUrl: string; // For Netlify Functions (DB)
  n8nWebhookUrl: string; // For n8n (WhatsApp/Uploads)
  useMockMode: boolean;
}