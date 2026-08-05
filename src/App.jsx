import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './components/auth/LoginPage'
import MainLayout from './components/layout/MainLayout'
import Dashboard from './components/dashboard/Dashboard'
import SaidaMaterial from './components/saida/SaidaMaterial'
import DevolucaoMaterial from './components/devolucao/DevolucaoMaterial'
import UsoInternoView from './components/usointerno/UsoInternoView'
import Transferencia from './components/transferencia/Transferencia'
import Estoque from './components/estoque/Estoque'
import Filtros from './components/filtros/Filtros'
import Patrimonio from './components/patrimonio/Patrimonio'
import DetalheGG from './components/patrimonio/DetalheGG'
import Caminhoes from './components/caminhoes/Caminhoes'
import DetalheCaminhao from './components/caminhoes/DetalheCaminhao'
import Manutencao from './components/manutencao/Manutencao'
import NovaOS from './components/manutencao/NovaOS'
import DetalheOS from './components/manutencao/DetalheOS'
import AgenteIA from './components/agente/AgenteIA'
import Usuarios from './components/usuarios/Usuarios'
import ComprasDashboard from './components/compras/ComprasDashboard'
import FilaSolicitacoes from './components/compras/FilaSolicitacoes'
import Relatorios from './components/relatorios/Relatorios'
import Eventos from './components/eventos/Eventos'
import RootRedirect from './components/shared/RootRedirect'
import AssinaturaPublica from './components/saida/AssinaturaPublica'
import { MODULOS } from './utils/permissions'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/assinar/:token" element={<AssinaturaPublica />} />

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
              <ProtectedRoute modulo={MODULOS.DASHBOARD}><Dashboard /></ProtectedRoute>
            } />
            <Route path="saida" element={
              <ProtectedRoute modulo={MODULOS.SAIDA}><SaidaMaterial /></ProtectedRoute>
            } />
            <Route path="eventos" element={
              <ProtectedRoute modulo={MODULOS.EVENTOS}><Eventos /></ProtectedRoute>
            } />
            <Route path="devolucao" element={
              <ProtectedRoute modulo={MODULOS.DEVOLUCAO}><DevolucaoMaterial /></ProtectedRoute>
            } />
            <Route path="uso-interno" element={
              <ProtectedRoute modulo={MODULOS.USO_INTERNO}><UsoInternoView /></ProtectedRoute>
            } />
            <Route path="transferencia" element={
              <ProtectedRoute modulo={MODULOS.TRANSFERENCIA}><Transferencia /></ProtectedRoute>
            } />
            <Route path="estoque" element={
              <ProtectedRoute modulo={MODULOS.ESTOQUE}><Estoque /></ProtectedRoute>
            } />
            <Route path="filtros" element={
              <ProtectedRoute modulo={MODULOS.FILTROS}><Filtros /></ProtectedRoute>
            } />
            <Route path="geradores" element={
              <ProtectedRoute modulo={MODULOS.GERADORES}><Patrimonio /></ProtectedRoute>
            } />
            <Route path="geradores/:id" element={
              <ProtectedRoute modulo={MODULOS.GERADORES}><DetalheGG /></ProtectedRoute>
            } />
            <Route path="caminhoes" element={
              <ProtectedRoute modulo={MODULOS.CAMINHOES}><Caminhoes /></ProtectedRoute>
            } />
            <Route path="caminhoes/:id" element={
              <ProtectedRoute modulo={MODULOS.CAMINHOES}><DetalheCaminhao /></ProtectedRoute>
            } />
            <Route path="manutencao" element={
              <ProtectedRoute modulo={MODULOS.MANUTENCAO}><Manutencao /></ProtectedRoute>
            } />
            <Route path="manutencao/nova" element={
              <ProtectedRoute modulo={MODULOS.MANUTENCAO}><NovaOS /></ProtectedRoute>
            } />
            <Route path="manutencao/:id" element={
              <ProtectedRoute modulo={MODULOS.MANUTENCAO}><DetalheOS /></ProtectedRoute>
            } />
            <Route path="agente" element={
              <ProtectedRoute modulo={MODULOS.AGENTE_IA}><AgenteIA /></ProtectedRoute>
            } />
            <Route path="relatorios" element={
              <ProtectedRoute modulo={MODULOS.RELATORIOS}><Relatorios /></ProtectedRoute>
            } />
            <Route path="compras" element={
              <ProtectedRoute modulo={MODULOS.DASHBOARD_COMPRAS}><ComprasDashboard /></ProtectedRoute>
            } />
            <Route path="solicitacoes" element={
              <ProtectedRoute modulo={MODULOS.FILA_SOLICITACOES}><FilaSolicitacoes /></ProtectedRoute>
            } />
            <Route path="usuarios" element={
              <ProtectedRoute modulo={MODULOS.GESTAO_USUARIOS}><Usuarios /></ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
