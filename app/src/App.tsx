import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { Toaster } from 'sonner';
import { useAuthStore } from './store/authStore';

// Layouts - Unified System
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import ResponsiveLayout from './layouts/ResponsiveLayout';
import AdminLayout from './pages/admin/AdminLayout';
import HomeRedirect from './components/HomeRedirect';

// Pages
import Home from './pages/Home';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Artists from './pages/Artists';
import ArtistDetail from './pages/ArtistDetail';
import Vendors from './pages/Vendors';
import VendorDetail from './pages/VendorDetail';
import PublicProfile from './pages/PublicProfile';
import CityGuide from './pages/CityGuide';
import Food from './pages/Food';
import Community from './pages/Community';
import About from './pages/About';
import Contact from './pages/Contact';
import Scanner from './pages/organizer/Scanner';

// Legal Pages
import Press from './pages/Press';
import Careers from './pages/Careers';
import Help from './pages/Help';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import RefundPolicy from './pages/RefundPolicy';
import UserAgreement from './pages/UserAgreement';
import OrganizerAgreement from './pages/OrganizerAgreement';
import CrossBorderConsent from './pages/CrossBorderConsent';
import VerificationPolicy from './pages/VerificationPolicy';
import Validate from './pages/Validate';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyOTP from './pages/auth/VerifyOTP';
import EmailVerification from './pages/auth/EmailVerification';

// User Pages
import Profile from './pages/user/Profile';
import Tickets from './pages/user/Tickets';
import TableBookings from './pages/user/TableBookings';
import Favorites from './pages/user/Favorites';
import Followers from './pages/user/Followers';
import Settings from './pages/user/Settings';
import UserDashboard from './pages/user/Dashboard';

// Business Pages
import BusinessDashboard from './pages/business/Dashboard';
import BusinessStaff from './pages/business/Staff';
import BusinessFollowers from './pages/business/Followers';
import BusinessPayouts from './pages/business/Payouts';
import BusinessProfile from './pages/business/Profile';
import BusinessCommunity from './pages/business/Community';

// Vendor Pages
import VendorDashboard from './pages/vendor/Dashboard';
import VendorProducts from './pages/vendor/Products';
import VendorOrders from './pages/vendor/Orders';
import VendorEvents from './pages/vendor/Events';
import VendorEarnings from './pages/vendor/Earnings';
import VendorProfile from './pages/vendor/Profile';
import VendorCommunity from './pages/vendor/Community';

// Artist Pages
import ArtistDashboard from './pages/artist/Dashboard';
import ArtistBookings from './pages/artist/Bookings';
import ArtistPerformances from './pages/artist/Performances';
import ArtistAnalytics from './pages/artist/Analytics';
import ArtistRecaps from './pages/artist/Recaps';
import ArtistCommunity from './pages/artist/Community';

// Organizer Pages
import CreateEvent from './pages/organizer/CreateEvent';
import EditEvent from './pages/organizer/EditEvent';
import ManageEvents from './pages/organizer/ManageEvents';
import Analytics from './pages/organizer/Analytics';
import OrganizerRecaps from './pages/organizer/Recaps';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import ManageUsers from './pages/admin/ManageUsers';
import ManageArtists from './pages/admin/ManageArtists';
import ManageVendors from './pages/admin/ManageVendors';
import ManageBusinesses from './pages/admin/ManageBusinesses';
import AdminManageEvents from './pages/admin/ManageEvents';
import ManageBookings from './pages/admin/ManageBookings';
import ManageRecaps from './pages/admin/ManageRecaps';
import FinancialControl from './pages/admin/FinancialControl';
import WithdrawalRequests from './pages/admin/WithdrawalRequests';
import ReportsModeration from './pages/admin/ReportsModeration';
import CMSContent from './pages/admin/CMSContent';
import NotificationCenter from './pages/admin/NotificationCenter';
import RolePermissions from './pages/admin/RolePermissions';
import SystemSettings from './pages/admin/SystemSettings';
import SecurityLogs from './pages/admin/SecurityLogs';
import APIIntegrations from './pages/admin/APIIntegrations';
import AdsManager from './pages/admin/AdsManager';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import AdminAnalytics from './pages/admin/Analytics';
import VerificationCenter from './pages/admin/VerificationCenter';
import CommunityMetrics from './pages/admin/CommunityMetrics';
import ManageCommunitySections from './pages/admin/ManageCommunitySections';
import ManageCommunityPosts from './pages/admin/ManageCommunityPosts';
import ManageCommunityComments from './pages/admin/ManageCommunityComments';
import Subscriptions from './pages/Subscriptions';
import BusinessTableReservations from './pages/business/TableReservations';
import BusinessTicketOrders from './pages/business/TicketOrders';

// Payment
import Checkout from './pages/payment/Checkout';
import PaymentSuccess from './pages/payment/PaymentSuccess';
import Cart from './pages/Cart';

// Components
import LoadingScreen from './components/LoadingScreen';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Device Detection Hook

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const initialize = useAuthStore((state) => state.initialize);
  const profile = useAuthStore((state) => state.profile);

  useEffect(() => {
    // Initialize auth state
    initialize();

    const checkMaintenance = () => {
      fetch('/api/v1/system/status')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setMaintenanceMode(!!(data && data.maintenance_mode));
        })
        .catch(() => {
          // Silent fail — don't block app if status endpoint is unreachable
        });
    };

    // Check maintenance mode immediately
    checkMaintenance();

    // Re-check when window regains focus (important for mobile)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkMaintenance();
      }
    };

    // Re-check periodically (every 30s) to catch toggles while app is open
    const interval = setInterval(checkMaintenance, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkMaintenance);

    // Simulate initial loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkMaintenance);
    };
  }, [initialize]);

  const isAdminUser = profile?.role_type === 'admin' || profile?.role_type === 'super_admin' || profile?.role === 'admin' || profile?.role === 'super_admin';

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (maintenanceMode && !isAdminUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-[#d3da0c]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#d3da0c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Under Maintenance</h1>
          <p className="text-gray-400 mb-8">We are currently performing scheduled maintenance. Please check back soon.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111111',
            color: '#FFFFFF',
            border: '1px solid rgba(211, 218, 12, 0.3)',
          },
        }}
      />
      <Routes>
          {/* Public Routes */}
          <Route element={<MainLayout />}>
            <Route
              path="/"
              element={
                <HomeRedirect>
                  <Home />
                </HomeRedirect>
              }
            />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/artists" element={<Artists />} />
            <Route path="/artists/:id" element={<ArtistDetail />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/vendors/:id" element={<VendorDetail />} />
            <Route path="/profiles/:id" element={<PublicProfile />} />
            <Route path="/city-guide" element={<CityGuide />} />
            <Route path="/discovery" element={<CityGuide />} />
            <Route path="/food" element={<Food />} />
            <Route path="/community" element={<Community />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/press" element={<Press />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/help" element={<Help />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/user-agreement" element={<UserAgreement />} />
            <Route path="/organizer-agreement" element={<OrganizerAgreement />} />
            <Route path="/cross-border-consent" element={<CrossBorderConsent />} />
            <Route path="/verification-policy" element={<VerificationPolicy />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout/:eventId" element={<Checkout />} />
          </Route>

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/verify-email" element={<EmailVerification />} />
          </Route>

          {/* Protected User Routes - Public Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/dashboard/user" element={<UserDashboard />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/table-bookings" element={<TableBookings />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/followers" element={<Followers />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
            </Route>

            {/* Scan Page - Ticket scanner for organizers */}
            <Route path="/scan" element={<Scanner />} />
            <Route path="/organizer/scanner" element={<Scanner />} />

            {/* Validate Page - QR code validation route */}
            <Route path="/validate/:token" element={<Validate />} />

            {/* 
              Dashboard Routes - Auto-switch between Mobile and Desktop layouts
              Mobile: Uses MobileLayout (Mini Program style with bottom nav)
              Desktop: Uses DashboardLayout (Full sidebar)
            */}

            {/* Business Routes */}
            <Route path="/dashboard/business" element={
              <ResponsiveLayout>
                <BusinessDashboard />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/create-event" element={
              <ResponsiveLayout>
                <CreateEvent />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/events" element={
              <ResponsiveLayout>
                <ManageEvents />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/events/:id/edit" element={
              <ResponsiveLayout>
                <EditEvent />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/analytics" element={
              <ResponsiveLayout>
                <Analytics />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/staff" element={
              <ResponsiveLayout>
                <BusinessStaff />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/followers" element={
              <ResponsiveLayout>
                <BusinessFollowers />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/payouts" element={
              <ResponsiveLayout>
                <BusinessPayouts />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/profile" element={
              <ResponsiveLayout>
                <BusinessProfile />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/recaps" element={
              <ResponsiveLayout>
                <OrganizerRecaps />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/tables" element={
              <ResponsiveLayout>
                <BusinessTableReservations />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/ticket-orders" element={
              <ResponsiveLayout>
                <BusinessTicketOrders />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/community" element={
              <ResponsiveLayout>
                <BusinessCommunity />
              </ResponsiveLayout>
            } />

            {/* Vendor Routes */}
            <Route path="/dashboard/vendor" element={
              <ResponsiveLayout>
                <VendorDashboard />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/products" element={
              <ResponsiveLayout>
                <VendorProducts />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/orders" element={
              <ResponsiveLayout>
                <VendorOrders />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/events" element={
              <ResponsiveLayout>
                <VendorEvents />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/earnings" element={
              <ResponsiveLayout>
                <VendorEarnings />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/profile" element={
              <ResponsiveLayout>
                <VendorProfile />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/community" element={
              <ResponsiveLayout>
                <VendorCommunity />
              </ResponsiveLayout>
            } />

            {/* Artist Routes */}
            <Route path="/dashboard/artist" element={
              <ResponsiveLayout>
                <ArtistDashboard />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/bookings" element={
              <ResponsiveLayout>
                <ArtistBookings />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/performances" element={
              <ResponsiveLayout>
                <ArtistPerformances />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/analytics" element={
              <ResponsiveLayout>
                <ArtistAnalytics />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/recaps" element={
              <ResponsiveLayout>
                <ArtistRecaps />
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/community" element={
              <ResponsiveLayout>
                <ArtistCommunity />
              </ResponsiveLayout>
            } />

            {/* Subscription Route */}
            <Route path="/subscriptions" element={
              <ResponsiveLayout>
                <Subscriptions />
              </ResponsiveLayout>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ErrorBoundary>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ErrorBoundary>
            } />
            <Route path="/admin/users" element={
              <AdminLayout>
                <ManageUsers />
              </AdminLayout>
            } />
            <Route path="/admin/artists" element={
              <AdminLayout>
                <ManageArtists />
              </AdminLayout>
            } />
            <Route path="/admin/vendors" element={
              <AdminLayout>
                <ManageVendors />
              </AdminLayout>
            } />
            <Route path="/admin/businesses" element={
              <AdminLayout>
                <ManageBusinesses />
              </AdminLayout>
            } />
            <Route path="/admin/events" element={
              <AdminLayout>
                <AdminManageEvents />
              </AdminLayout>
            } />
            <Route path="/admin/bookings" element={
              <AdminLayout>
                <ManageBookings />
              </AdminLayout>
            } />
            <Route path="/admin/financial" element={
              <AdminLayout>
                <FinancialControl />
              </AdminLayout>
            } />
            <Route path="/admin/withdrawals" element={
              <AdminLayout>
                <WithdrawalRequests />
              </AdminLayout>
            } />
            <Route path="/admin/reports" element={
              <AdminLayout>
                <ReportsModeration />
              </AdminLayout>
            } />
            <Route path="/admin/recaps" element={
              <AdminLayout>
                <ManageRecaps />
              </AdminLayout>
            } />
            <Route path="/admin/cms" element={
              <AdminLayout>
                <CMSContent />
              </AdminLayout>
            } />
            <Route path="/admin/analytics" element={
              <AdminLayout>
                <AdminAnalytics />
              </AdminLayout>
            } />
            <Route path="/admin/notifications" element={
              <AdminLayout>
                <NotificationCenter />
              </AdminLayout>
            } />
            <Route path="/admin/roles" element={
              <AdminLayout>
                <RolePermissions />
              </AdminLayout>
            } />
            <Route path="/admin/settings" element={
              <AdminLayout>
                <SystemSettings />
              </AdminLayout>
            } />
            <Route path="/admin/logs" element={
              <AdminLayout>
                <SecurityLogs />
              </AdminLayout>
            } />
            <Route path="/admin/api" element={
              <AdminLayout>
                <APIIntegrations />
              </AdminLayout>
            } />
            <Route path="/admin/ads" element={
              <AdminLayout>
                <AdsManager />
              </AdminLayout>
            } />
            <Route path="/admin/subscriptions" element={
              <AdminLayout>
                <AdminSubscriptions />
              </AdminLayout>
            } />
            <Route path="/admin/verification-center" element={
              <AdminLayout>
                <VerificationCenter />
              </AdminLayout>
            } />
            <Route path="/admin/community" element={
              <AdminLayout>
                <CommunityMetrics />
              </AdminLayout>
            } />
            <Route path="/admin/community/sections" element={
              <AdminLayout>
                <ManageCommunitySections />
              </AdminLayout>
            } />
            <Route path="/admin/community/posts" element={
              <AdminLayout>
                <ManageCommunityPosts />
              </AdminLayout>
            } />
            <Route path="/admin/community/comments" element={
              <AdminLayout>
                <ManageCommunityComments />
              </AdminLayout>
            } />

            {/* Legacy redirects */}
            <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/payments" element={<Navigate to="/admin/financial" replace />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      <PWAInstallPrompt />
    </Router>
  );
}

export default App;
