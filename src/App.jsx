import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './components/auth/LoginPage'
import MainLayout from './components/layout/MainLayout'
import Dashboard from './components/dashboard/Dashboard'
import SaidaMaterial from './components/saida/SaidaMaterial'
import DevolucaoMaterial from './components/devolucao/DevolucaoMaterial'
import Transferencia from './components/transferencia/Transferencia'
import Estoque from './components/estoque/Estoque'
import EmBreve from './components/shared/EmBreve'
import RootRedirect from './components/shared/RootRedirect'
import { MODULOS } from './utils/permissions'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RootRedirect />} />

            <Route path="dashboard" element={
              <ProtectedRoute modulo={MODULOS.DASHBOARD}>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="saida" element={
              <ProtectedRoute modulo={MODULOS.SAIDA}>
                <SaidaMaterial />
              </ProtectedRoute>
            } />

            <Route path="devolucao" element={
              <ProtectedRoute modulo={MODULOS.DEVOLUCAO}>
                <DevolucaoMaterial />
              </ProtectedRoute>
            } />

            <Route path="transferencia" element={
              <ProtectedRoute modulo={MODULOS.TRANSFERENCIA}>
                <Transferencia />
              </ProtectedRoute>
            } />

            <Route path="estoque" element={
              <ProtectedRoute modulo={MODULOS.ESTOQUE}>
                <Estoque />
              </ProtectedRoute>
            } />

            <Route path="filtros" element={
              <ProtectedRoute modulo={MODULOS.FILTROS}>
                <EmBreve titulo="Filtros" descricao="Controle de filtros por potência de gerador. Disponível na Fase 2." fase="2" />
              </ProtectedRoute>
            } />

            <Route path="geradores" element={
              <ProtectedRoute modulo={MODULOS.GERADORES}>
                <EmBreve titulo="Patrimônio de Geradores" descricao="Painel completo da frota com 107 geradores. Disponível na Fase 2." fase="2" />
              </ProtectedRoute>
            } />

            <Route path="manutencao" element={
              <ProtectedRoute modulo={MODULOS.MANUTENCAO}>
                <EmBreve titulo="Manutenção" descricao="Ordens de serviço, preventivas e corretivas. Disponível na Fase 2." fase="2" />
              </ProtectedRoute>
            } />

            <Route path="agente" element={
              <ProtectedRoute modulo={MODULOS.AGENTE_IA}>
                <EmBreve titulo="Agente IA" descricao="Assistente inteligente treinado com a base de conhecimento da SOS Energia. Disponível na Fase 2." fase="2" />
              </ProtectedRoute>
            } />

            <Route path="relatorios" element={
              <ProtectedRoute modulo={MODULOS.RELATORIOS}>
                <EmBreve titulo="Relatórios" descricao="Relatórios operacionais completos. Disponível na Fase 3." fase="3" />
              </ProtectedRoute>
            } />

            <Route path="compras" element={
              <ProtectedRoute modulo={MODULOS.DASHBOARD_COMPRAS}>
                <EmBreve titulo="Dashboard de Compras" descricao="Painel de solicitações, fornecedores e gastos. Disponível na Fase 3." fase="3" />
              </ProtectedRoute>
            } />

            <Route path="solicitacoes" element={
              <ProtectedRoute modulo={MODULOS.FILA_SOLICITACOES}>
                <EmBreve titulo="Fila de Solicitações" descricao="Gestão de solicitações de compra. Disponível na Fase 3." fase="3" />
              </ProtectedRoute>
            } />

            <Route path="usuarios" element={
              <ProtectedRoute modulo={MODULOS.GESTAO_USUARIOS}>
                <EmBreve titulo="Gestão de Usuários" descricao="Cadastro e gerenciamento de usuários do sistema." fase="2" />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
