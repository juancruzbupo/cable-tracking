import axios from 'axios';
import type {
  ImportPreview,
  ImportResult,
  ImportLog,
  DashboardMetrics,
  ClientWithDebt,
  ClientDebtInfo,
  ClientDetailResult,
  ClientNote,
  AuditLogEntry,
  ServicePlan,
  Promotion,
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

let onTokenRefreshed: ((newToken: string) => void) | null = null;
export function setOnTokenRefreshed(callback: (newToken: string) => void) {
  onTokenRefreshed = callback;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (token) prom.resolve(token);
    else prom.reject(error);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh on login or refresh requests
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        const newToken: string = data.accessToken;
        setAuthToken(newToken);
        if (onTokenRefreshed) onTokenRefreshed(newToken);
        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

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
    zona?: string;
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

  create: async (body: {
    nombreOriginal: string;
    codigoOriginal?: string;
    calle?: string;
    subscriptions: Array<{ tipo: 'CABLE' | 'INTERNET'; fechaAlta: string }>;
  }) => {
    const { data } = await api.post('/clients', body);
    return data;
  },

  deactivate: async (id: string) => {
    const { data } = await api.patch(`/clients/${id}/deactivate`);
    return data;
  },

  reactivate: async (id: string) => {
    const { data } = await api.patch(`/clients/${id}/reactivate`);
    return data;
  },

  deactivateSub: async (clientId: string, subId: string) => {
    const { data } = await api.patch(`/clients/${clientId}/subscriptions/${subId}/deactivate`);
    return data;
  },

  updateSubPlan: async (clientId: string, subId: string, planId: string) => {
    const { data } = await api.patch(`/clients/${clientId}/subscriptions/${subId}/plan`, { planId });
    return data;
  },

  reactivateSub: async (clientId: string, subId: string) => {
    const { data } = await api.patch(`/clients/${clientId}/subscriptions/${subId}/reactivate`);
    return data;
  },

  createPayment: async (clientId: string, subId: string, year: number, month: number) => {
    const { data } = await api.post(`/clients/${clientId}/subscriptions/${subId}/payments`, { year, month });
    return data;
  },

  deletePayment: async (clientId: string, subId: string, periodId: string) => {
    await api.delete(`/clients/${clientId}/subscriptions/${subId}/payments/${periodId}`);
  },

  getNotes: async (clientId: string): Promise<ClientNote[]> => {
    const { data } = await api.get(`/clients/${clientId}/notes`);
    return data.data ?? data;
  },

  createNote: async (clientId: string, content: string): Promise<ClientNote> => {
    const { data } = await api.post(`/clients/${clientId}/notes`, { content });
    return data;
  },

  deleteNote: async (clientId: string, noteId: string) => {
    await api.delete(`/clients/${clientId}/notes/${noteId}`);
  },

  getHistory: async (clientId: string): Promise<AuditLogEntry[]> => {
    const { data } = await api.get(`/clients/${clientId}/history`);
    return data;
  },
  logWhatsApp: async (clientId: string) => { const { data } = await api.post(`/clients/${clientId}/whatsapp-log`); return data; },
  getLastWhatsApp: async (clientId: string) => { const { data } = await api.get(`/clients/${clientId}/whatsapp-last`); return data; },
  updateComprobanteConfig: async (clientId: string, body: { tipoComprobante: string }) => {
    const { data } = await api.patch(`/clients/${clientId}/comprobante-config`, body);
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
  getTendencia: async () => { const { data } = await api.get('/dashboard/tendencia'); return data; },
  getMrr: async () => { const { data } = await api.get('/dashboard/mrr'); return data; },
  getRiesgo: async () => { const { data } = await api.get('/dashboard/riesgo'); return data; },
  getCrecimiento: async () => { const { data } = await api.get('/dashboard/crecimiento'); return data; },
  getZonas: async () => { const { data } = await api.get('/dashboard/zonas'); return data; },
  getTickets: async () => { const { data } = await api.get('/dashboard/tickets'); return data; },
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
  refresh: async (): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/refresh');
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

// ── Plans ─────────────────────────────────────────────────────────────────

export const plansApi = {
  getActive: async (tipo?: string): Promise<ServicePlan[]> => {
    const { data } = await api.get('/plans', { params: tipo ? { tipo } : {} });
    return data;
  },
  getAll: async (): Promise<ServicePlan[]> => {
    const { data } = await api.get('/plans/all');
    return data;
  },
  create: async (plan: { nombre: string; tipo: string; precio: number; descripcion?: string }): Promise<ServicePlan> => {
    const { data } = await api.post('/plans', plan);
    return data;
  },
  update: async (id: string, updates: Partial<ServicePlan>): Promise<ServicePlan> => {
    const { data } = await api.patch(`/plans/${id}`, updates);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/plans/${id}`);
  },
};

// ── Promotions ────────────────────────────────────────────────────────────

export const promotionsApi = {
  getAll: async (params?: Record<string, string>): Promise<Promotion[]> => {
    const { data } = await api.get('/promotions', { params });
    return data;
  },
  getActive: async (): Promise<Promotion[]> => {
    const { data } = await api.get('/promotions/active');
    return data;
  },
  getOne: async (id: string): Promise<Promotion> => {
    const { data } = await api.get(`/promotions/${id}`);
    return data;
  },
  create: async (promo: any): Promise<Promotion> => {
    const { data } = await api.post('/promotions', promo);
    return data;
  },
  update: async (id: string, updates: any): Promise<Promotion> => {
    const { data } = await api.patch(`/promotions/${id}`, updates);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/promotions/${id}`);
  },
  assignToSub: async (clientId: string, subId: string, promotionId: string) => {
    const { data } = await api.post(`/clients/${clientId}/subscriptions/${subId}/promotions`, { promotionId });
    return data;
  },
  removeFromSub: async (clientId: string, subId: string, promoId: string) => {
    await api.delete(`/clients/${clientId}/subscriptions/${subId}/promotions/${promoId}`);
  },
  getClientPromos: async (clientId: string) => {
    const { data } = await api.get(`/clients/${clientId}/promotions`);
    return data;
  },
};

// ── Billing ───────────────────────────────────────────────────────────────

export const billingApi = {
  downloadInvoice: (clientId: string, month: number, year: number) =>
    downloadFile(`/billing/invoice/${clientId}?month=${month}&year=${year}`, `factura_${month}_${year}.pdf`),

  downloadBatchInvoices: async (month: number, year: number) => {
    const response = await api.post('/billing/invoices/batch', { month, year }, { responseType: 'blob', timeout: 300000 });
    const blob = new Blob([response.data]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `facturas_${month}_${year}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },

  getReport: async (month: number, year: number) => {
    const { data } = await api.get('/billing/report', { params: { month, year } });
    return data;
  },

  downloadCortePdf: () => downloadFile('/billing/corte/print', 'corte.pdf'),
};

// ── Fiscal ────────────────────────────────────────────────────────────────

export const fiscalApi = {
  getConfig: async () => { const { data } = await api.get('/fiscal/config'); return data; },
  testConnection: async () => { const { data } = await api.get('/fiscal/config/test'); return data; },
  updateConfig: async (updates: any) => { const { data } = await api.patch('/fiscal/config', updates); return data; },
  getComprobantes: async (params?: any) => { const { data } = await api.get('/fiscal/comprobantes', { params }); return data; },
  getComprobante: async (id: string) => { const { data } = await api.get(`/fiscal/comprobantes/${id}`); return data; },
  downloadPdf: (id: string) => downloadFile(`/fiscal/comprobantes/${id}/pdf`, `comprobante_${id}.pdf`),
  emitirPorPago: async (ppId: string) => { const { data } = await api.post(`/fiscal/comprobantes/pago/${ppId}`); return data; },
  emitirBatch: async (month: number, year: number) => { const { data } = await api.post('/fiscal/comprobantes/batch', { month, year }); return data; },
  anular: async (id: string) => { const { data } = await api.patch(`/fiscal/comprobantes/${id}/anular`); return data; },
  updateClientFiscal: async (clientId: string, data: any) => { const { data: res } = await api.patch(`/clients/${clientId}/fiscal`, data); return res; },
};

// ── Equipment ─────────────────────────────────────────────────────────────

export const equipmentApi = {
  getAll: async (params?: Record<string, string>) => { const { data } = await api.get('/equipment', { params }); return data; },
  getStats: async () => { const { data } = await api.get('/equipment/stats'); return data; },
  getOne: async (id: string) => { const { data } = await api.get(`/equipment/${id}`); return data; },
  create: async (body: { tipo: string; marca?: string; modelo?: string; numeroSerie?: string }) => { const { data } = await api.post('/equipment', body); return data; },
  update: async (id: string, body: { tipo?: string; marca?: string; modelo?: string; notas?: string; estado?: string }) => { const { data } = await api.patch(`/equipment/${id}`, body); return data; },
  getClientEquipment: async (clientId: string) => { const { data } = await api.get(`/clients/${clientId}/equipment`); return data; },
  assign: async (clientId: string, equipmentId: string) => { const { data } = await api.post(`/clients/${clientId}/equipment`, { equipmentId }); return data; },
  retire: async (clientId: string, assignmentId: string) => { const { data } = await api.patch(`/clients/${clientId}/equipment/${assignmentId}/retirar`); return data; },
};

// ── Tickets ───────────────────────────────────────────────────────────────

export const ticketsApi = {
  getAll: async (params?: Record<string, string>) => { const { data } = await api.get('/tickets', { params }); return data; },
  getStats: async () => { const { data } = await api.get('/tickets/stats'); return data; },
  getClientTickets: async (clientId: string) => { const { data } = await api.get(`/clients/${clientId}/tickets`); return data; },
  create: async (clientId: string, tipo: string, descripcion?: string) => { const { data } = await api.post(`/clients/${clientId}/tickets`, { tipo, descripcion }); return data; },
  resolve: async (ticketId: string, notas?: string) => { const { data } = await api.patch(`/tickets/${ticketId}/resolver`, { notas }); return data; },
};

// ── Scheduler ────────────────────────────────────────────────────────────

export const schedulerApi = {
  getStatus: async () => { const { data } = await api.get('/scheduler/status'); return data; },
};

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

export default api;
