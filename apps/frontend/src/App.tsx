import { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  UploadOutlined,
  FileTextOutlined,
  ScissorOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ImportPage from './pages/ImportPage';
import DocumentsPage from './pages/DocumentsPage';
import CortePage from './pages/CortePage';
import { ErrorBoundary } from './components/ErrorBoundary';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/clients', icon: <TeamOutlined />, label: 'Clientes' },
  { key: '/import', icon: <UploadOutlined />, label: 'Importaciones' },
  { key: '/documents', icon: <FileTextOutlined />, label: 'Documentos' },
  { key: '/corte', icon: <ScissorOutlined />, label: 'Para Corte' },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const currentKey =
    menuItems.find((i) => location.pathname.startsWith(i.key) && i.key !== '/')
      ?.key || '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        style={{ background: '#001529' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: collapsed ? 14 : 16,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {collapsed ? '📡' : '📡 Cable Track'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
            fontSize: 18,
          }}
        >
          Sistema de Seguimiento de Clientes
        </Header>
        <Content style={{ margin: 24 }}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/corte" element={<CortePage />} />
            </Routes>
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
