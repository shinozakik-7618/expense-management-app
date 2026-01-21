import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TransactionList from './pages/TransactionList';
import UnreportedTransactions from './pages/UnreportedTransactions';
import TransactionEdit from './pages/TransactionEdit';
import TransactionCreate from './pages/TransactionCreate';
import TransactionDetail from './pages/TransactionDetail';
import CategoryManagement from './pages/CategoryManagement';
import UserManagement from './pages/UserManagement';
import CardReconciliation from './pages/CardReconciliation';
import Notifications from './pages/Notifications';
import InviteAccept from "./InviteAccept";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<TransactionList />} />
        <Route path="/transactions/new" element={<TransactionCreate />} />
        <Route path="/transactions/:id" element={<TransactionDetail />} />
        <Route path="/transactions/:id/edit" element={<TransactionEdit />} />
        <Route path="/unreported" element={<UnreportedTransactions />} />
        <Route path="/purpose-master" element={<CategoryManagement />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/reconciliation/card" element={<CardReconciliation />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/invite-accept" element={<InviteAccept />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
