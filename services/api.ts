import { APP_CONFIG } from '../constants';
import { CustomerRequest } from '../types';

// Helper to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ServerFile {
  name: string;
  size: string;
  created: string;
}

// --- API METHODS ---

export const registerCustomer = async (
  name: string,
  phone: string,
  videoName: string
): Promise<boolean> => {
  if (APP_CONFIG.useMockMode) {
    await delay(800);
    return true;
  } else {
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/register-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, videoName }),
      });
      if (!response.ok) {
        console.error("Register Error:", await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error("Network Error", error);
      return false;
    }
  }
};

export const getPendingRequests = async (): Promise<CustomerRequest[]> => {
  if (APP_CONFIG.useMockMode) return [];
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/get-pending`);
    if (response.ok) return await response.json();
    return [];
  } catch (error) {
    console.error("API Error", error);
    return [];
  }
};

export const getFailedRequests = async (): Promise<CustomerRequest[]> => {
  if (APP_CONFIG.useMockMode) return [];
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/get-failed`);
    if (response.ok) return await response.json();
    return [];
  } catch (error) {
    console.error("API Error", error);
    return [];
  }
};

export const uploadDocument = async (
  requestId: string,
  file: File,
  phoneNumber: string
): Promise<boolean> => {
  if (APP_CONFIG.useMockMode) return true;

  if (!requestId || !file || !phoneNumber) {
    console.error("Upload aborted: Missing required fields.", { requestId, phoneNumber, fileName: file?.name });
    return false;
  }

  const formData = new FormData();
  // Order matters for some parsers: Simple fields first, File last.
  formData.append('requestId', requestId);
  formData.append('phoneNumber', phoneNumber);
  formData.append('videoName', file.name);
  formData.append('file', file);

  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/upload-document`, {
      method: 'POST',
      body: formData, 
    });
    
    if (!response.ok) {
      console.error("Upload Error:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Upload Network Error", error);
    return false;
  }
};

// --- STORAGE API ---

export const getServerFiles = async (): Promise<ServerFile[]> => {
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/server-files`);
    if (response.ok) return await response.json();
    return [];
  } catch (error) {
    return [];
  }
};

export const deleteServerFile = async (filename: string): Promise<boolean> => {
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/server-files/${filename}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const retryServerFile = async (filename: string): Promise<{success: boolean, message?: string}> => {
  const formData = new FormData();
  formData.append('filename', filename);
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/retry-file`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (response.ok) return { success: true, message: data.message };
    return { success: false, message: data.detail || "Failed" };
  } catch (error) {
    return { success: false, message: "Network error" };
  }
};
