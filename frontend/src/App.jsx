import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import WorkspaceSelection from './pages/WorkspaceSelection';
import WorkspaceSettings from './pages/WorkspaceSettings';
import TeamManagement from './pages/TeamManagement';
import Projects from './pages/Projects';
import ProjectOverview from './pages/ProjectOverview';
import KanbanBoard from './pages/KanbanBoard';
import SprintManagement from './pages/SprintManagement';
import ProjectSettings from './pages/ProjectSettings';
import TaskDetails from './pages/TaskDetails';
import WorkflowSettings from './pages/WorkflowSettings';
import WorkspaceAuditLogs from './pages/WorkspaceAuditLogs';
import NotificationCenter from './pages/NotificationCenter';
import NotificationPreferences from './pages/NotificationPreferences';
import WebhookManagement from './pages/WebhookManagement';
import PricingPage from './pages/PricingPage';
import WorkspaceBilling from './pages/WorkspaceBilling';
import BillingSuccess from './pages/BillingSuccess';
import BillingCancel from './pages/BillingCancel';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/login"
                  element={
                    <GuestRoute>
                      <Login />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <GuestRoute>
                      <Register />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workspaces"
                  element={
                    <ProtectedRoute>
                      <WorkspaceSelection />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/workspace"
                  element={
                    <ProtectedRoute>
                      <WorkspaceSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/team"
                  element={
                    <ProtectedRoute>
                      <TeamManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <Projects />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:projectId"
                  element={
                    <ProtectedRoute>
                      <ProjectOverview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:projectId/board"
                  element={
                    <ProtectedRoute>
                      <KanbanBoard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:projectId/sprints"
                  element={
                    <ProtectedRoute>
                      <SprintManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:projectId/settings"
                  element={
                    <ProtectedRoute>
                      <ProjectSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:projectId/settings/workflow"
                  element={
                    <ProtectedRoute>
                      <WorkflowSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:projectId/issues/:issueId"
                  element={
                    <ProtectedRoute>
                      <TaskDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workspaces/:workspaceId/audit-logs"
                  element={
                    <ProtectedRoute>
                      <WorkspaceAuditLogs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workspaces/:workspaceId/settings/webhooks"
                  element={
                    <ProtectedRoute>
                      <WebhookManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationCenter />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationPreferences />
                    </ProtectedRoute>
                  }
                />
                <Route path="/pricing" element={<PricingPage />} />
                <Route
                  path="/settings/billing"
                  element={
                    <ProtectedRoute>
                      <WorkspaceBilling />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workspaces/:workspaceId/settings/billing"
                  element={
                    <ProtectedRoute>
                      <WorkspaceBilling />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing/success"
                  element={
                    <ProtectedRoute>
                      <BillingSuccess />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing/cancel"
                  element={
                    <ProtectedRoute>
                      <BillingCancel />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
          </div>
        </Router>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
