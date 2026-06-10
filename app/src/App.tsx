import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { Toaster } from 'sonner';
import { useAuthStore } from './store/authStore';

// Layouts - Unified System
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import ResponsiveLayout from './layouts/ResponsiveLayout';
import AdminLayout from './pages/admin/AdminLayout';
import HomeRedirect from './components/HomeRedirect';

// Public Pages (eager — most visited)
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
import Scan from './pages/Scan';

// Auth Pages (eager — entry points)
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyOTP from './pages/auth/VerifyOTP';
import EmailVerification from './pages/auth/EmailVerification';

// Components
import LoadingScreen from './components/LoadingScreen';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import CookieConsent from './components/CookieConsent';

// ── Lazy-loaded pages (code-split by route) ──

// Legal Pages
const Press = lazy(() => import('./pages/Press'));
const Careers = lazy(() => import('./pages/Careers'));
const Help = lazy(() => import('./pages/Help'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const UserAgreement = lazy(() => import('./pages/UserAgreement'));
const OrganizerAgreement = lazy(() => import('./pages/OrganizerAgreement'));
const CrossBorderConsent = lazy(() => import('./pages/CrossBorderConsent'));
const VerificationPolicy = lazy(() => import('./pages/VerificationPolicy'));
const Validate = lazy(() => import('./pages/Validate'));

// User Dashboard
const Profile = lazy(() => import('./pages/user/Profile'));
const Tickets = lazy(() => import('./pages/user/Tickets'));
const TableBookings = lazy(() => import('./pages/user/TableBookings'));
const Favorites = lazy(() => import('./pages/user/Favorites'));
const Followers = lazy(() => import('./pages/user/Followers'));
const Settings = lazy(() => import('./pages/user/Settings'));
const UserDashboard = lazy(() => import('./pages/user/Dashboard'));

// Business Dashboard
const BusinessDashboard = lazy(() => import('./pages/business/Dashboard'));
const BusinessStaff = lazy(() => import('./pages/business/Staff'));
const BusinessFollowers = lazy(() => import('./pages/business/Followers'));
const BusinessPayouts = lazy(() => import('./pages/business/Payouts'));
const BusinessPromoters = lazy(() => import('./pages/business/Promoters'));
const BusinessProfile = lazy(() => import('./pages/business/Profile'));
const BusinessCommunity = lazy(() => import('./pages/business/Community'));
const BusinessTableReservations = lazy(() => import('./pages/business/TableReservations'));
const BusinessTicketOrders = lazy(() => import('./pages/business/TicketOrders'));

// Vendor Dashboard
const VendorDashboard = lazy(() => import('./pages/vendor/Dashboard'));
const VendorProducts = lazy(() => import('./pages/vendor/Products'));
const VendorOrders = lazy(() => import('./pages/vendor/Orders'));
const VendorEvents = lazy(() => import('./pages/vendor/Events'));
const VendorEarnings = lazy(() => import('./pages/vendor/Earnings'));
const VendorProfile = lazy(() => import('./pages/vendor/Profile'));
const VendorCommunity = lazy(() => import('./pages/vendor/Community'));
const VendorPaymentSettings = lazy(() => import('./pages/vendor/PaymentSettings'));
const VendorMenuImport = lazy(() => import('./pages/vendor/MenuImport'));
const VendorAnalytics = lazy(() => import('./pages/vendor/Analytics'));

// Artist Dashboard
const ArtistDashboard = lazy(() => import('./pages/artist/Dashboard'));
const ArtistBookings = lazy(() => import('./pages/artist/Bookings'));
const ArtistPerformances = lazy(() => import('./pages/artist/Performances'));
const ArtistAnalytics = lazy(() => import('./pages/artist/Analytics'));
const ArtistRecaps = lazy(() => import('./pages/artist/Recaps'));
const ArtistCommunity = lazy(() => import('./pages/artist/Community'));
const ArtistMessages = lazy(() => import('./pages/artist/Messages'));

// Organizer Pages
const CreateEvent = lazy(() => import('./pages/organizer/CreateEvent'));
const EditEvent = lazy(() => import('./pages/organizer/EditEvent'));
const ManageEvents = lazy(() => import('./pages/organizer/ManageEvents'));
const EventPromoters = lazy(() => import('./pages/organizer/EventPromoters'));
const Analytics = lazy(() => import('./pages/business/Analytics'));
const OrganizerRecaps = lazy(() => import('./pages/organizer/Recaps'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageArtists = lazy(() => import('./pages/admin/ManageArtists'));
const ManageVendors = lazy(() => import('./pages/admin/ManageVendors'));
const ManageBusinesses = lazy(() => import('./pages/admin/ManageBusinesses'));
const AdminManageEvents = lazy(() => import('./pages/admin/ManageEvents'));
const ManageBookings = lazy(() => import('./pages/admin/ManageBookings'));
const ManageRecaps = lazy(() => import('./pages/admin/ManageRecaps'));
const FinancialControl = lazy(() => import('./pages/admin/FinancialControl'));
const WithdrawalRequests = lazy(() => import('./pages/admin/WithdrawalRequests'));
const ReportsModeration = lazy(() => import('./pages/admin/ReportsModeration'));
const CMSContent = lazy(() => import('./pages/admin/CMSContent'));
const NotificationCenter = lazy(() => import('./pages/admin/NotificationCenter'));
const RolePermissions = lazy(() => import('./pages/admin/RolePermissions'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const SecurityLogs = lazy(() => import('./pages/admin/SecurityLogs'));
const APIIntegrations = lazy(() => import('./pages/admin/APIIntegrations'));
const AdsManager = lazy(() => import('./pages/admin/AdsManager'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const PlatformAnalytics = lazy(() => import('./pages/admin/Analytics'));
const VerificationCenter = lazy(() => import('./pages/admin/VerificationCenter'));
const CommunityMetrics = lazy(() => import('./pages/admin/CommunityMetrics'));
const ManageCommunitySections = lazy(() => import('./pages/admin/ManageCommunitySections'));
const ManageCommunityPosts = lazy(() => import('./pages/admin/ManageCommunityPosts'));
const ManageCommunityComments = lazy(() => import('./pages/admin/ManageCommunityComments'));

// Payment & Subscriptions
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Checkout = lazy(() => import('./pages/payment/Checkout'));
const PaymentSuccess = lazy(() => import('./pages/payment/PaymentSuccess'));
const Cart = lazy(() => import('./pages/Cart'));

// Simple inline fallback while lazy chunks load
const PageLoader = () => (
  <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
  </div>
);

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
            <Route path="/press" element={<Suspense fallback={<PageLoader />}><Press /></Suspense>} />
            <Route path="/careers" element={<Suspense fallback={<PageLoader />}><Careers /></Suspense>} />
            <Route path="/help" element={<Suspense fallback={<PageLoader />}><Help /></Suspense>} />
            <Route path="/terms" element={<Suspense fallback={<PageLoader />}><Terms /></Suspense>} />
            <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><Privacy /></Suspense>} />
            <Route path="/refund-policy" element={<Suspense fallback={<PageLoader />}><RefundPolicy /></Suspense>} />
            <Route path="/user-agreement" element={<Suspense fallback={<PageLoader />}><UserAgreement /></Suspense>} />
            <Route path="/organizer-agreement" element={<Suspense fallback={<PageLoader />}><OrganizerAgreement /></Suspense>} />
            <Route path="/cross-border-consent" element={<Suspense fallback={<PageLoader />}><CrossBorderConsent /></Suspense>} />
            <Route path="/verification-policy" element={<Suspense fallback={<PageLoader />}><VerificationPolicy /></Suspense>} />
            <Route path="/cart" element={<Suspense fallback={<PageLoader />}><Cart /></Suspense>} />
            <Route path="/checkout/:eventId" element={<Suspense fallback={<PageLoader />}><Checkout /></Suspense>} />
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
              <Route path="/profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
              <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><UserDashboard /></Suspense>} />
              <Route path="/dashboard/user" element={<Suspense fallback={<PageLoader />}><UserDashboard /></Suspense>} />
              <Route path="/tickets" element={<Suspense fallback={<PageLoader />}><Tickets /></Suspense>} />
              <Route path="/table-bookings" element={<Suspense fallback={<PageLoader />}><TableBookings /></Suspense>} />
              <Route path="/favorites" element={<Suspense fallback={<PageLoader />}><Favorites /></Suspense>} />
              <Route path="/followers" element={<Suspense fallback={<PageLoader />}><Followers /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              <Route path="/payment/success" element={<Suspense fallback={<PageLoader />}><PaymentSuccess /></Suspense>} />
            </Route>

            {/* Scan Page - Works on all devices */}
            <Route path="/scan" element={<Scan />} />

            {/* Validate Page - QR code validation route */}
            <Route path="/validate/:token" element={<Suspense fallback={<PageLoader />}><Validate /></Suspense>} />

            {/* Dashboard Routes - Auto-switch between Mobile and Desktop layouts */}

            {/* Business Routes */}
            <Route path="/dashboard/business" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessDashboard /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/create-event" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><CreateEvent /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/events" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ManageEvents /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/events/:id/edit" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><EditEvent /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/events/:id/promoters" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><EventPromoters /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/promoters" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessPromoters /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/analytics" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><Analytics /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/staff" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessStaff /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/followers" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessFollowers /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/payouts" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessPayouts /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/profile" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessProfile /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/recaps" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><OrganizerRecaps /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/tables" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessTableReservations /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/ticket-orders" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessTicketOrders /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/business/community" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><BusinessCommunity /></Suspense>
              </ResponsiveLayout>
            } />

            {/* Vendor Routes */}
            <Route path="/dashboard/vendor" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorDashboard /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/products" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorProducts /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/orders" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorOrders /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/events" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorEvents /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/earnings" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorEarnings /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/profile" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorProfile /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/community" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorCommunity /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/messages" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistMessages /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/payment-settings" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorPaymentSettings /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/menu-import" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorMenuImport /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/vendor/analytics" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><VendorAnalytics /></Suspense>
              </ResponsiveLayout>
            } />

            {/* Artist Routes */}
            <Route path="/dashboard/artist" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistDashboard /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/bookings" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistBookings /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/messages" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistMessages /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/performances" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistPerformances /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/analytics" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistAnalytics /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/recaps" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistRecaps /></Suspense>
              </ResponsiveLayout>
            } />
            <Route path="/dashboard/artist/community" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><ArtistCommunity /></Suspense>
              </ResponsiveLayout>
            } />

            {/* Subscription Route */}
            <Route path="/subscriptions" element={
              <ResponsiveLayout>
                <Suspense fallback={<PageLoader />}><Subscriptions /></Suspense>
              </ResponsiveLayout>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ErrorBoundary>
                <AdminLayout>
                  <Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>
                </AdminLayout>
              </ErrorBoundary>
            } />
            <Route path="/admin/analytics" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><PlatformAnalytics /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/users" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageUsers /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/artists" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageArtists /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/vendors" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageVendors /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/businesses" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageBusinesses /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/events" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><AdminManageEvents /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/bookings" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageBookings /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/financial" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><FinancialControl /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/withdrawals" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><WithdrawalRequests /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/reports" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ReportsModeration /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/recaps" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageRecaps /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/cms" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><CMSContent /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/notifications" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><NotificationCenter /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/roles" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><RolePermissions /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/settings" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><SystemSettings /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/logs" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><SecurityLogs /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/api" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><APIIntegrations /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/ads" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><AdsManager /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/subscriptions" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><AdminSubscriptions /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/verification-center" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><VerificationCenter /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/community" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><CommunityMetrics /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/community/sections" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageCommunitySections /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/community/posts" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageCommunityPosts /></Suspense>
              </AdminLayout>
            } />
            <Route path="/admin/community/comments" element={
              <AdminLayout>
                <Suspense fallback={<PageLoader />}><ManageCommunityComments /></Suspense>
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
      <CookieConsent />
    </Router>
  );
}

export default App;
