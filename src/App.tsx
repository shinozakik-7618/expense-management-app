import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './Login';
import Dashboard from './Dashboard';
import TransactionList from './TransactionList';
import TransactionCreate from './TransactionCreate';
import TransactionEdit from './TransactionEdit';
import TransactionDetail from './TransactionDetail';
import CategoryManagement from './CategoryManagement';
import UserManagement from './UserManagement';
import InviteAccept from './InviteAccept';
import TransactionImport from './TransactionImport';

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
    return <div style={{ padding: '20px', textAlign: 'center' }}>読み込み中...</div>;
  }

  const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    if (!user) {
      return <Navigate to="/" />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/invite" element={<InviteAccept />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><TransactionList /></ProtectedRoute>} />
        <Route path="/transactions/create" element={<ProtectedRoute><TransactionCreate /></ProtectedRoute>} />
        <Route path="/transactions/import" element={<ProtectedRoute><TransactionImport /></ProtectedRoute>} />
        <Route path="/transactions/:id/edit" element={<ProtectedRoute><TransactionEdit /></ProtectedRoute>} />
        <Route path="/transactions/:id" element={<ProtectedRoute><TransactionDetail /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute><CategoryManagement /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
