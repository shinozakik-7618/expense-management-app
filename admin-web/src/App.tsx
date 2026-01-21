import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import TransactionList from './TransactionList';
import UnreportedTransactions from './UnreportedTransactions';
import TransactionEdit from './TransactionEdit';
import TransactionCreate from './TransactionCreate';
import TransactionDetail from './TransactionDetail';
import CategoryManagement from './CategoryManagement';
import UserManagement from './UserManagement';
import CardReconciliation from './CardReconciliation';
import Notifications from './Notifications';
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
