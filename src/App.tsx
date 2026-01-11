import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './Login';
import Dashboard from './Dashboard';
import TransactionList from './TransactionList';
import TransactionCreate from './TransactionCreate';
import TransactionEdit from './TransactionEdit';
import TransactionDetail from './TransactionDetail';
import TransactionImport from './TransactionImport';
import CategoryManagement from './CategoryManagement';
import UserManagement from './UserManagement';
import InviteAccept from './InviteAccept';
import UnreportedTransactions from './UnreportedTransactions';
import CardReconciliation from './CardReconciliation';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/invite" element={<InviteAccept />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <TransactionList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/create"
          element={
            <ProtectedRoute>
              <TransactionCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/import"
          element={
            <ProtectedRoute>
              <TransactionImport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/:id/edit"
          element={
            <ProtectedRoute>
              <TransactionEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/:id"
          element={
            <ProtectedRoute>
              <TransactionDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/unreported"
          element={
            <ProtectedRoute>
              <UnreportedTransactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reconciliation/card"
          element={
            <ProtectedRoute>
              <CardReconciliation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <CategoryManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
