import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login          from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import SuperadminHeatmap from './pages/superadmin/Heatmap';
import NewProfile        from './pages/superadmin/NewProfile';
import UserSearch        from './pages/superadmin/UserSearch';
import AuthorityHeatmap        from './pages/authority/Heatmap';
import AuthorityReport          from './pages/authority/ReportDetail';
import AuthorityNotifications   from './pages/authority/Notifications';
import AuthorityHistory         from './pages/authority/History';
import AuthorityInProgress      from './pages/authority/InProgress';
import ReviewReports    from './pages/superadmin/ReviewReports';
import ReviewList       from './pages/superadmin/ReviewList';
import ReviewDetail     from './pages/superadmin/ReviewDetail';
import ReporteDetalle   from './pages/superadmin/ReporteDetalle';
import EditProfile      from './pages/superadmin/EditProfile';
import Notifications    from './pages/superadmin/Notifications';
import Reassign         from './pages/superadmin/Reassign';
import SuperadminProfile from './pages/superadmin/Profile';
import AuthorityProfile  from './pages/authority/Profile';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Público */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Cambio de contraseña — cualquier rol autenticado */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute roles={['superadmin', 'autoridad', 'ciudadano']}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* Superadmin */}
        <Route
          path="/superadmin/heatmap"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <SuperadminHeatmap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/new-profile"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <NewProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/users"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <UserSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/review"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <ReviewReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/review/:tipo"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <ReviewList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/review/:tipo/:reportId"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <ReviewDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/notifications"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/reassign"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <Reassign />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/edit-profile/:tipo/:id"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/profile"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <SuperadminProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/reporte/:reportId"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <ReporteDetalle />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/*"
          element={
            <ProtectedRoute roles={['superadmin']}>
              <Navigate to="/superadmin/heatmap" replace />
            </ProtectedRoute>
          }
        />

        {/* Autoridad */}
        <Route
          path="/authority/heatmap"
          element={
            <ProtectedRoute roles={['autoridad']}>
              <AuthorityHeatmap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/authority/notifications"
          element={
            <ProtectedRoute roles={['autoridad']}>
              <AuthorityNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/authority/history"
          element={
            <ProtectedRoute roles={['autoridad']}>
              <AuthorityHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/authority/in-progress"
          element={
            <ProtectedRoute roles={['autoridad']}>
              <AuthorityInProgress />
            </ProtectedRoute>
          }
        />
        <Route
          path="/authority/report/:id"
          element={
            <ProtectedRoute roles={['autoridad']}>
              <AuthorityReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/authority/profile"
          element={
            <ProtectedRoute roles={['autoridad']}>
              <AuthorityProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/authority/*"
          element={
            <ProtectedRoute roles={['autoridad']}>
              <Navigate to="/authority/heatmap" replace />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
