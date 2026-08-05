import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    // Log the missing route for debugging (not exposed to UI)
    console.error(`404 Error: User attempted to access non-existent route: ${location.pathname}`);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 md:p-12 max-w-lg w-full text-center">
        <h1 className="text-6xl font-bold text-[#d3da0c] mb-4">404</h1>
        <h2 className="text-2xl font-bold text-white mb-3">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="px-6 py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-colors"
          >
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-white/20 text-white font-bold rounded-lg hover:bg-white/5 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
