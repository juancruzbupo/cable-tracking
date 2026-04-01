import axios from 'axios';
import type {
  ImportPreview,
  ImportResult,
  ImportLog,
  DashboardMetrics,
  ClientWithDebt,
  ClientDebtInfo,
  ClientDetailResult,
  PaginatedResponse,
  ClientStatus,
  DebtStatus,
  Document,
  User,
  LoginResponse,
  UserRole,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
});

// ── Auth interceptor ───────────────────────────────────────────────────────

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

// ── Import ──────────────────────────────────────────────────────────────────

export const importApi = {
  preview: async (
    file: File,
    tipo: 'clientes' | 'ramitos' | 'facturas',
  ): Promise<ImportPreview> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(`/import/preview/${tipo}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  execute: async (
    file: File,
    tipo: 'clientes' | 'ramitos' | 'facturas',
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(`/import/${tipo}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getLogs: async (limit = 20): Promise<ImportLog[]> => {
    const { data } = await api.get('/import/logs', { params: { limit } });
    return data;
  },
};

// ── Clients ─────────────────────────────────────────────────────────────────

export const clientsApi = {
  getAll: async (params: {
    search?: string;
    estado?: ClientStatus;
    debtStatus?: DebtStatus;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ClientWithDebt>> => {
    const { data } = await api.get('/clients', { params });
    return data;
  },

  getOne: async (id: string): Promise<ClientDetailResult> => {
    const { data } = await api.get(`/clients/${id}`);
    return data;
  },

  getStats: async () => {
    const { data } = await api.get('/clients/stats');
    return data;
  },
};

// ── Documents ───────────────────────────────────────────────────────────────

export const documentsApi = {
  getAll: async (params: {
    tipo?: string;
    clientId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Document>> => {
    const { data } = await api.get('/documents', { params });
    return data;
  },
};

// ── Dashboard ───────────────────────────────────────────────────────────────

export const dashboardApi = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    const { data } = await api.get('/dashboard');
    return data;
  },

  getClientesParaCorte: async (): Promise<ClientDebtInfo[]> => {
    const { data } = await api.get('/dashboard/corte');
    return data;
  },
};

// ── Export ──────────────────────────────────────────────────────────────────

export const exportApi = {
  downloadCorte: () =>
    downloadFile('/export/corte', 'corte.xlsx'),

  downloadClients: () =>
    downloadFile('/export/clients', 'clientes.xlsx'),

  downloadResumen: () =>
    downloadFile('/export/resumen', 'resumen.xlsx'),
};

async function downloadFile(url: string, fallbackName: string) {
  const response = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data]);

  // Extract filename from Content-Disposition header if available
  const disposition = response.headers['content-disposition'];
  let filename = fallbackName;
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) {
      filename = (match[1].split(/[\\/]/).pop() || fallbackName)
        .replace(/[^a-zA-Z0-9._\-\s]/g, '_');
    }
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// ── Users (admin) ─────────────────────────────────────────────────────────

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get('/auth/users');
    return data;
  },
  create: async (user: { name: string; email: string; password: string; role?: UserRole }): Promise<User> => {
    const { data } = await api.post('/auth/users', user);
    return data;
  },
  update: async (id: string, updates: { name?: string; role?: UserRole; isActive?: boolean }): Promise<User> => {
    const { data } = await api.patch(`/auth/users/${id}`, updates);
    return data;
  },
};

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

export default api;
