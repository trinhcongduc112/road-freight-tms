import { createBrowserRouter, Navigate } from "react-router-dom";
import AcceptInvitationPage from "./features/auth/AcceptInvitationPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import ResetPasswordPage from "./features/auth/ResetPasswordPage";
import VerifyEmailPage from "./features/auth/VerifyEmailPage";
import SupportReplyPage from "./features/support/SupportReplyPage";
import TrackingPage from "./features/tracking/TrackingPage";
import AdminPage from "./features/admin/AdminPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import MasterDataPage from "./features/master-data/MasterDataPage";
import MonitoringPage from "./features/monitoring/MonitoringPage";
import OrdersPage from "./features/orders/OrdersPage";
import PlanningPage from "./features/planning/PlanningPage";
import ReportingPage from "./features/reporting/ReportingPage";
import DriverAppPage from "./features/driver/DriverAppPage";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./utils/RequireAuth";
import { isTrackSubdomain } from "./utils/trackingUrl";

// Track subdomain (track.<domain>) = public tracking only — không có login, admin, etc.
// / → search form; /<orderCode> → auto load đơn.
const trackSubdomainRoutes = [
  { path: "/", element: <TrackingPage /> },
  { path: "/:orderCode", element: <TrackingPage /> },
  { path: "*", element: <Navigate to="/" replace /> }
];

const mainRoutes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/accept-invitation", element: <AcceptInvitationPage /> },
  { path: "/support/reply", element: <SupportReplyPage /> },
  { path: "/track", element: <TrackingPage /> },
  { path: "/track/:orderCode", element: <TrackingPage /> },
  { path: "/driver", element: <RequireAuth><DriverAppPage /></RequireAuth> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "admin", element: <AdminPage /> },          // Organizations + User Groups + Users
      { path: "master-data", element: <MasterDataPage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "planning", element: <PlanningPage /> },
      { path: "monitoring", element: <MonitoringPage /> },
      { path: "reports", element: <ReportingPage /> },
      // Legacy redirects (giữ backward compat)
      { path: "organizations", element: <Navigate to="/admin?tab=organizations" replace /> },
      { path: "role-groups",   element: <Navigate to="/admin?tab=user-groups" replace /> },
      { path: "users",         element: <Navigate to="/admin?tab=users" replace /> }
    ]
  },
  { path: "*", element: <Navigate to="/" replace /> }
];

export const router = createBrowserRouter(isTrackSubdomain() ? trackSubdomainRoutes : mainRoutes);
