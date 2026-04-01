// ══════════════════════════════════════════════════════════════
// @cable-tracking/shared-types
// Single source of truth for types shared between frontend/backend
// ══════════════════════════════════════════════════════════════

// ── Enums ────────────────────────────────────────────────────

export type ClientStatus = 'ACTIVO' | 'BAJA';
export type DocumentType = 'RAMITO' | 'FACTURA';
export type ServiceType = 'CABLE' | 'INTERNET';
export type DebtStatus = 'AL_DIA' | '1_MES' | '2_MESES' | 'MAS_2_MESES';
export type UserRole = 'ADMIN' | 'OPERADOR' | 'VISOR';
export type PromoType = 'PORCENTAJE' | 'MONTO_FIJO' | 'MESES_GRATIS' | 'PRECIO_FIJO';
export type PromoScope = 'PLAN' | 'CLIENTE';
export type TipoDocumento = 'CUIT' | 'CUIL' | 'DNI' | 'CONSUMIDOR_FINAL';
export type CondicionFiscal = 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTISTA' | 'CONSUMIDOR_FINAL' | 'EXENTO';
export type TipoComprobante = 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'RECIBO_X';
export type EstadoComprobante = 'PENDIENTE' | 'EMITIDO' | 'ANULADO' | 'ERROR';
export type EquipmentStatus = 'EN_DEPOSITO' | 'ASIGNADO' | 'EN_REPARACION' | 'DE_BAJA';
export type TicketStatus = 'ABIERTO' | 'RESUELTO';
export type TicketType = 'SIN_SENIAL' | 'LENTITUD_INTERNET' | 'RECONEXION' | 'INSTALACION' | 'CAMBIO_EQUIPO' | 'OTRO';

// ── Auth ─────────────────────────────────────────────────────

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

// ── Client ───────────────────────────────────────────────────

export interface Client {
  id: string;
  codCli: string;
  nombreOriginal: string;
  nombreNormalizado: string;
  fechaAlta: string | null;
  estado: ClientStatus;
  calle: string | null;
  // Location (ARCA)
  codigoPostal?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  zona?: string | null;
  // Fiscal
  tipoDocumento?: TipoDocumento | null;
  numeroDocFiscal?: string | null;
  condicionFiscal?: CondicionFiscal;
  razonSocial?: string | null;
  telefono?: string | null;
  email?: string | null;
  tipoComprobante?: TipoComprobante;
  createdAt: string;
  updatedAt: string;
}

// ── Subscription ────────────────────────────────────────────

export interface Subscription {
  id: string;
  clientId: string;
  tipo: ServiceType;
  fechaAlta: string;
  estado: ClientStatus;
  planId: string | null;
  deudaCalculada: number;
  requiereCorte: boolean;
  ultimoCalculo: string | null;
  plan?: ServicePlan | null;
  createdAt: string;
  updatedAt: string;
}

// ── Subscription & Debt ──────────────────────────────────────

export interface SubscriptionDebt {
  subscriptionId: string;
  tipo: ServiceType;
  fechaAlta: string;
  mesesObligatorios: string[];
  mesesPagados: string[];
  mesesAdeudados: string[];
  mesesConPromoGratis: string[];
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
    formaPago?: string | null;
    paymentPeriods: Array<{ year: number; month: number }>;
  }>;
  docPagination: Pagination;
}

// ── Document ─────────────────────────────────────────────────

export interface Document {
  id: string;
  clientId: string;
  codCli: string;
  tipo: DocumentType;
  fechaDocumento: string | null;
  numeroDocumento: string | null;
  descripcionOriginal: string | null;
  formaPago?: string | null;
  createdAt: string;
  client?: { codCli: string; nombreNormalizado: string };
  paymentPeriods?: PaymentPeriod[];
}

// ── PaymentPeriod ────────────────────────────────────────────

export interface PaymentPeriod {
  id: string;
  clientId: string;
  documentId: string;
  periodo: string;
  year: number;
  month: number;
  createdAt: string;
}

// ── Plans ────────────────────────────────────────────────────

export interface ServicePlan {
  id: string;
  nombre: string;
  tipo: ServiceType;
  precio: number;
  descripcion: string | null;
  activo: boolean;
  _count?: { subscriptions: number };
}

// ── Promotions ───────────────────────────────────────────────

export interface Promotion {
  id: string;
  nombre: string;
  tipo: PromoType;
  valor: number;
  scope: PromoScope;
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
  descripcion: string | null;
  planId: string | null;
  plan?: { nombre: string; tipo: string } | null;
  _count?: { clientPromotions: number };
}

// ── Notes & Audit ────────────────────────────────────────────

export interface ClientNote {
  id: string;
  clientId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { name: string };
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { name: string };
}

// ── Import ───────────────────────────────────────────────────

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

// ── Dashboard ────────────────────────────────────────────────

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

// ── Pagination ───────────────────────────────────────────────

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

// ── Equipment ───────────────────────────────────────────────

export interface Equipment {
  id: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  estado: EquipmentStatus;
  notas: string | null;
  assignments?: EquipmentAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  clientId: string;
  fechaInstalacion: string;
  fechaRetiro: string | null;
  notas: string | null;
  equipment?: Equipment;
  client?: { id: string; nombreNormalizado: string; codCli: string };
  createdAt: string;
}

// ── Tickets ─────────────────────────────────────────────────

export interface Ticket {
  id: string;
  clientId: string;
  tipo: TicketType;
  descripcion: string | null;
  estado: TicketStatus;
  notas: string | null;
  creadoPor: string;
  resuelto: string | null;
  client?: { id: string; nombreNormalizado: string; codCli: string };
  createdAt: string;
  updatedAt: string;
}

// ── EmpresaConfig ───────────────────────────────────────────

export interface EmpresaConfig {
  id: string;
  cuit: string;
  razonSocial: string;
  condicionFiscal: string;
  domicilio: string | null;
  puntoVenta: number;
  providerName: string;
  umbralCorte: number;
  tfUsertoken: string | null;
  tfApikey: string | null;
  tfApitoken: string | null;
}
