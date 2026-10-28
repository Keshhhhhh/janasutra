import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ReportPage } from './pages/ReportPage';
import { TrackPage } from './pages/TrackPage';
import { MyComplaintsPage } from './pages/MyComplaintsPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { DashcamPage } from './pages/DashcamPage';

// Each route fades in; scroll resets on navigation like a native app
function AnimatedRoutes() {
  const location = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [location.pathname]);
  return (
    <div className="page" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<ReportPage />} />
        <Route path="/scan" element={<DashcamPage />} />
        <Route path="/dashcam" element={<DashcamPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/track/:ticketId" element={<TrackPage />} />
        <Route path="/my-complaints" element={<MyComplaintsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="main">
          <AnimatedRoutes />
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
