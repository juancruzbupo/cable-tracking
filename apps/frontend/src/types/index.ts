// ── Enums ────────────────────────────────────────────────────────────────────

export type ClientStatus = 'ACTIVO' | 'BAJA';
export type DocumentType = 'RAMITO' | 'FACTURA';
export type ServiceType = 'CABLE' | 'INTERNET';
export type DebtStatus = 'AL_DIA' | '1_MES' | '2_MESES' | 'MAS_2_MESES';
export type UserRole = 'ADMIN' | 'OPERADOR' | 'VISOR';

// ── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

// ── Client ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  codCli: string;
  nombreOriginal: string;
  nombreNormalizado: string;
  fechaAlta: string | null;
  estado: ClientStatus;
  calle: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionDebt {
  subscriptionId: string;
  tipo: ServiceType;
  fechaAlta: string;
  mesesObligatorios: string[];
  mesesPagados: string[];
  mesesAdeudados: string[];
  cantidadDeuda: number;
  requiereCorte: boolean;
}

export interface ClientDebtInfo {
  clientId: string;
  codCli: string;
  nombreNormalizado: string;
  estado: ClientStatus;
  fechaAlta: string | null;
  calle: string | null;
  mesesObligatorios: string[];
  mesesPagados: string[];
  mesesAdeudados: string[];
  cantidadDeuda: number;
  requiereCorte: boolean;
  subscriptions: SubscriptionDebt[];
  requiereCorteCable: boolean;
  requiereCorteInternet: boolean;
  deudaCable: number;
  deudaInternet: number;
}

export interface ClientWithDebt extends Client {
  debtInfo: ClientDebtInfo;
}

export interface ClientDetailResult extends ClientDebtInfo {
  nombreOriginal: string;
  documents: Array<{
    id: string;
    tipo: string;
    fechaDocumento: string | null;
    numeroDocumento: string | null;
    descripcionOriginal: string | null;
    paymentPeriods: Array<{ year: number; month: number }>;
  }>;
  docPagination: Pagination;
}

// ── Document ────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  clientId: string;
  codCli: string;
  tipo: DocumentType;
  fechaDocumento: string | null;
  numeroDocumento: string | null;
  descripcionOriginal: string | null;
  createdAt: string;
  client?: { codCli: string; nombreNormalizado: string };
  paymentPeriods?: PaymentPeriod[];
}

// ── PaymentPeriod ───────────────────────────────────────────────────────────

export interface PaymentPeriod {
  id: string;
  clientId: string;
  documentId: string;
  periodo: string;
  year: number;
  month: number;
  createdAt: string;
}

// ── Import ──────────────────────────────────────────────────────────────────

export interface ImportPreview {
  headers: string[];
  totalRows: number;
  sampleRows: Record<string, unknown>[];
  validRows: number;
  invalidRows: number;
  errors: ImportError[];
}

export interface ImportResult {
  success: boolean;
  tipo: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newClients: number;
  updatedClients: number;
  documentsCreated: number;
  periodsCreated: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  column?: string;
  message: string;
  value?: unknown;
}

export interface ImportLog {
  id: string;
  tipo: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newClients: number;
  updatedClients: number;
  errors: ImportError[] | null;
  status: string;
  executedAt: string;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  resumen: {
    totalClients: number;
    activeClients: number;
    bajaClients: number;
  };
  deuda: {
    total: number;
    alDia: number;
    unMes: number;
    dosMeses: number;
    masDosMeses: number;
    requierenCorte: number;
    tasaMorosidad: number;
    clientesParaCorte: string[];
  };
  documentos: {
    ramitos: number;
    facturas: number;
    periodosRegistrados: number;
  };
  ultimasImportaciones: ImportLog[];
}

// ── Pagination ──────────────────────────────────────────────────────────────

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}
