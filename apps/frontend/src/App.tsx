import { useState, useEffect } from 'react';
import { Layout, Menu, Tag, Button, Spin, Dropdown } from 'antd';
import {
  DashboardOutlined, TeamOutlined, UploadOutlined, FileTextOutlined,
  ScissorOutlined, UserOutlined, LogoutOutlined, DollarOutlined, BarChartOutlined,
  ThunderboltOutlined, SettingOutlined, ToolOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ticketsApi } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import DashboardPage from './features/dashboard/DashboardPage';
import ClientsPage from './features/clients/ClientsPage';
import ImportPage from './features/import/ImportPage';
import DocumentsPage from './features/documents/DocumentsPage';
import CortePage from './features/corte/CortePage';
import LoginPage from './features/auth/LoginPage';
import UsersPage from './features/users/UsersPage';
import PlansPage from './features/plans/PlansPage';
import ReportesPage from './features/reports/ReportesPage';
import PromotionsPage from './features/promotions/PromotionsPage';
import ComprobantesPage from './features/fiscal/ComprobantesPage';
import FiscalConfigPage from './features/fiscal/FiscalConfigPage';
import EquipmentPage from './features/equipment/EquipmentPage';
import TicketsPage from './features/tickets/TicketsPage';

const { Sider, Content, Header } = Layout;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [ticketsAbiertos, setTicketsAbiertos] = useState(0);

  useEffect(() => {
    if (!hasRole('ADMIN', 'OPERADOR')) return;
    const load = () => ticketsApi.getStats().then((s: any) => setTicketsAbiertos(s.abiertos || 0)).catch(() => {});
    load();
    const interval = setInterval(load, 120_000); // cada 2 min
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    // Operación diaria
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/clients', icon: <TeamOutlined />, label: 'Clientes' },
    { key: '/corte', icon: <ScissorOutlined />, label: 'Para Corte' },
    ...(hasRole('ADMIN', 'OPERADOR') ? [{ key: '/tickets', icon: <ExclamationCircleOutlined />, label: ticketsAbiertos > 0 ? `Tickets (${ticketsAbiertos})` : 'Tickets' }] : []),
    ...(hasRole('ADMIN', 'OPERADOR') ? [{ key: '/equipment', icon: <ToolOutlined />, label: 'Equipos' }] : []),
    // Consultas
    { key: '/documents', icon: <FileTextOutlined />, label: 'Documentos' },
    ...(hasRole('ADMIN', 'OPERADOR') ? [{ key: '/comprobantes', icon: <FileTextOutlined />, label: 'Comprobantes' }] : []),
    ...(hasRole('ADMIN', 'OPERADOR') ? [{ key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes' }] : []),
    // Configuración
    ...(hasRole('ADMIN') ? [{ key: '/plans', icon: <DollarOutlined />, label: 'Planes' }] : []),
    ...(hasRole('ADMIN', 'OPERADOR') ? [{ key: '/promotions', icon: <ThunderboltOutlined />, label: 'Promociones' }] : []),
    // Admin
    ...(hasRole('ADMIN') ? [{ key: '/import', icon: <UploadOutlined />, label: 'Importaciones' }] : []),
    ...(hasRole('ADMIN') ? [{ key: '/fiscal', icon: <SettingOutlined />, label: 'Config Fiscal' }] : []),
    ...(hasRole('ADMIN') ? [{ key: '/users', icon: <UserOutlined />, label: 'Usuarios' }] : []),
  ];

  const currentKey =
    menuItems.find((i) => location.pathname.startsWith(i.key) && i.key !== '/')
      ?.key || '/';

  const ROLE_COLORS = { ADMIN: 'red', OPERADOR: 'blue', VISOR: 'default' } as const;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <a href="#main-content" style={{ position: 'absolute', top: -40, left: 0, zIndex: 1000, background: '#1677ff', color: '#fff', padding: '8px 16px', transition: 'top 0.2s' }} onFocus={(e) => { e.currentTarget.style.top = '0'; }} onBlur={(e) => { e.currentTarget.style.top = '-40px'; }}>Ir al contenido</a>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg" role="navigation" aria-label="Menú principal" style={{ background: '#001529', overflow: 'auto', height: '100vh', position: 'sticky', top: 0, left: 0 }}>
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: collapsed ? 14 : 16, whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          {collapsed ? 'CT' : 'Cable Tracking'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
        {!collapsed && user && (
          <div style={{ position: 'absolute', bottom: 48, left: 0, right: 0, padding: '8px 16px', borderTop: '1px solid #ffffff20' }}>
            <div style={{ color: '#ffffffcc', fontSize: 12, marginBottom: 4 }}>{user.name}</div>
            <Tag color={ROLE_COLORS[user.role]} style={{ fontSize: 10 }}>{user.role}</Tag>
          </div>
        )}
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff', padding: '0 16px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          overflow: 'hidden',
        }}>
          <span style={{ fontWeight: 600, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Cable Tracking</span>
          {user && (
            <Dropdown menu={{
              items: [
                { key: 'user', label: `${user.name} (${user.role})`, disabled: true },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Cerrar sesión', onClick: logout },
              ],
            }}>
              <Button type="text" icon={<UserOutlined />} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</Button>
            </Dropdown>
          )}
        </Header>
        <Content id="main-content" role="main" style={{ margin: '16px 12px' }}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<Navigate to="/clients" replace />} />
              {hasRole('ADMIN') && <Route path="/import" element={<ImportPage />} />}
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/corte" element={<CortePage />} />
              {hasRole('ADMIN', 'OPERADOR') && <Route path="/reportes" element={<ReportesPage />} />}
              {hasRole('ADMIN') && <Route path="/plans" element={<PlansPage />} />}
              {hasRole('ADMIN', 'OPERADOR') && <Route path="/promotions" element={<PromotionsPage />} />}
              {hasRole('ADMIN', 'OPERADOR') && <Route path="/comprobantes" element={<ComprobantesPage />} />}
              {hasRole('ADMIN', 'OPERADOR') && <Route path="/equipment" element={<EquipmentPage />} />}
              {hasRole('ADMIN', 'OPERADOR') && <Route path="/tickets" element={<TicketsPage />} />}
              {hasRole('ADMIN') && <Route path="/fiscal" element={<FiscalConfigPage />} />}
              {hasRole('ADMIN') && <Route path="/users" element={<UsersPage />} />}
            </Routes>
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      } />
    </Routes>
  );
}
