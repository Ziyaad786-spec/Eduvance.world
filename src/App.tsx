import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import InvoiceList from './pages/invoices/InvoiceList';
import InvoiceForm from './pages/invoices/InvoiceForm';
import CreditNoteList from './pages/credit-notes/CreditNoteList';
import CreditNoteForm from './pages/credit-notes/CreditNoteForm';
import ClientList from './pages/clients/ClientList';
import Statement from './pages/Statement';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AuthPage from './pages/auth/AuthPage';
import StudentList from './pages/students/StudentList';
import ReportCardList from './pages/reports/ReportCardList';
import ReportCardForm from './pages/reports/ReportCardForm';
import ReportCardView from './pages/reports/ReportCardView';
import { useAuthStore } from './store/auth';
import { supabase } from './lib/supabase';

function App() {
  const { user, setUser } = useAuthStore();

  // Set up auth state listener
  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
          });
        }
      } catch (err) {
        console.error('Error checking session:', err);
      }
    };

    void checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error handling auth change:', err);
      }
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route 
          path="/auth" 
          element={user ? <Navigate to="/" /> : <AuthPage />} 
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={user ? <DashboardLayout /> : <Navigate to="/auth" />}
        >
          <Route index element={<Dashboard />} />
          
          {/* Invoice routes */}
          <Route path="invoices">
            <Route index element={<InvoiceList />} />
            <Route path="new" element={<InvoiceForm />} />
            <Route path=":id/edit" element={<InvoiceForm />} />
          </Route>

          {/* Credit note routes */}
          <Route path="credit-notes">
            <Route index element={<CreditNoteList />} />
            <Route path="new" element={<CreditNoteForm />} />
            <Route path=":id/edit" element={<CreditNoteForm />} />
          </Route>

          {/* Student routes */}
          <Route path="students">
            <Route index element={<StudentList />} />
          </Route>

          {/* Report card routes */}
          <Route path="report-cards">
            <Route index element={<ReportCardList />} />
            <Route path="new" element={<ReportCardForm />} />
            <Route path=":id/edit" element={<ReportCardForm />} />
            <Route path=":id" element={<ReportCardView />} />
          </Route>

          {/* Other routes */}
          <Route path="clients" element={<ClientList />} />
          <Route path="statement" element={<Statement />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;