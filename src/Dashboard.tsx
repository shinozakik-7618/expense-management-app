import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface Stats {
  pending: number;
  submitted: number;
  rejected: number;
  approved: number;
}

interface RecentTransaction {
  id: string;
  transactionDate: string;
  amount: number;
  merchantName: string;
  status: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ pending: 0, submitted: 0, rejected: 0, approved: 0 });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatDate = (date: any): string => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    if (date.toDate && typeof date.toDate === 'function') {
      return date.toDate().toISOString().split('T')[0];
    }
    return String(date);
  };

  const loadDashboardData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);

      const userQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const userSnapshot = await getDocs(userQuery);
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        setUserRole(userData.role || 'user');
        setUserName(userData.displayName || currentUser.email || 'ユーザー');
      }

      const notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        where('read', '==', false)
      );
      const notifSnapshot = await getDocs(notifQuery);
      setUnreadNotifications(notifSnapshot.size);

      const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
      const pending = transactionsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
      const submitted = transactionsSnapshot.docs.filter(doc => doc.data().status === 'submitted').length;
      const rejected = transactionsSnapshot.docs.filter(doc => doc.data().status === 'rejected').length;
      const approved = transactionsSnapshot.docs.filter(doc => doc.data().status === 'approved').length;

      setStats({ pending, submitted, rejected, approved });

      const allTransactions = transactionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          transactionDate: formatDate(data.transactionDate),
          amount: data.amount || 0,
          merchantName: data.merchantName || '',
          status: data.status || 'pending'
        };
      });

      allTransactions.sort((a, b) => {
        if (a.transactionDate > b.transactionDate) return -1;
        if (a.transactionDate < b.transactionDate) return 1;
        return 0;
      });

      const recent = allTransactions.slice(0, 5);
      setRecentTransactions(recent);

    } catch (error) {
      console.error('データ読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      pending: { label: '未処理', className: 'bg-blue-100 text-blue-800' },
      submitted: { label: '申請中', className: 'bg-yellow-100 text-yellow-800' },
      rejected: { label: '差戻し', className: 'bg-red-100 text-red-800' },
      approved: { label: '承認済', className: 'bg-green-100 text-green-800' }
    };
    const badge = badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      admin: { label: '管理者', className: 'bg-purple-100 text-purple-800' },
      user: { label: '一般', className: 'bg-blue-100 text-blue-800' },
      approver: { label: '承認者', className: 'bg-green-100 text-green-800' }
    };
    const badge = badges[role] || { label: role, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ fontSize: '1.25rem' }}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        {/* ヘッダー */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>ダッシュボード</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <p style={{ color: '#4b5563' }}>ようこそ、{userName}さん</p>
                {getRoleBadge(userRole)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => navigate('/notifications')}
                style={{ position: 'relative', padding: '0.5rem 1rem', color: '#4b5563', cursor: 'pointer', border: 'none', background: 'none' }}
              >
                🔔 通知
                {unreadNotifications > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-0.25rem',
                    right: '-0.25rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    borderRadius: '9999px',
                    height: '1.25rem',
                    width: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadNotifications}
                  </span>
                )}
              </button>
              <button onClick={() => navigate('/unreported')} style={{ padding: '0.5rem 1rem', color: '#4b5563', cursor: 'pointer', border: 'none', background: 'none' }}>
                📋 未報告取引
              </button>
              <button onClick={() => navigate('/transactions')} style={{ padding: '0.5rem 1rem', color: '#4b5563', cursor: 'pointer', border: 'none', background: 'none' }}>
                📝 取引一覧
              </button>
              <button onClick={() => navigate('/purpose-master')} style={{ padding: '0.5rem 1rem', color: '#4b5563', cursor: 'pointer', border: 'none', background: 'none' }}>
                🏷️ 用途マスタ管理
              </button>
              {userRole === 'admin' && (
                <button onClick={() => navigate('/user-management')} style={{ padding: '0.5rem 1rem', color: '#4b5563', cursor: 'pointer', border: 'none', background: 'none' }}>
                  👥 ユーザー管理
                </button>
              )}
              <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', color: '#dc2626', cursor: 'pointer', border: 'none', background: 'none' }}>
                🔓 ログアウト
              </button>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* 未処理 */}
          <div style={{
            background: 'linear-gradient(to bottom right, #dbeafe, #bfdbfe)',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            padding: '1.5rem',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#2563eb' }}>未処理</p>
                <p style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1e3a8a' }}>{stats.pending}</p>
              </div>
              <div style={{ fontSize: '2.25rem' }}>📋</div>
            </div>
          </div>

          {/* 申請中 */}
          <div style={{
            background: 'linear-gradient(to bottom right, #fef3c7, #fde68a)',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            padding: '1.5rem',
            borderLeft: '4px solid #eab308'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#ca8a04' }}>申請中</p>
                <p style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#713f12' }}>{stats.submitted}</p>
              </div>
              <div style={{ fontSize: '2.25rem' }}>⏳</div>
            </div>
          </div>

          {/* 差戻し */}
          <div style={{
            background: 'linear-gradient(to bottom right, #fee2e2, #fecaca)',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            padding: '1.5rem',
            borderLeft: '4px solid #ef4444'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#dc2626' }}>差戻し</p>
                <p style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#7f1d1d' }}>{stats.rejected}</p>
              </div>
              <div style={{ fontSize: '2.25rem' }}>↩️</div>
            </div>
          </div>

          {/* 承認済 */}
          <div style={{
            background: 'linear-gradient(to bottom right, #dcfce7, #bbf7d0)',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            padding: '1.5rem',
            borderLeft: '4px solid #22c55e'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#16a34a' }}>承認済</p>
                <p style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#14532d' }}>{stats.approved}</p>
              </div>
              <div style={{ fontSize: '2.25rem' }}>✅</div>
            </div>
          </div>
        </div>

        {/* 最新取引 */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>最新の取引</h2>
          </div>
          {recentTransactions.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
              取引データがありません
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase' }}>取引日</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase' }}>加盟店名</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase' }}>金額</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase' }}>ステータス</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase' }}>操作</th>
                </tr>
              </thead>
              <tbody style={{ backgroundColor: 'white' }}>
                {recentTransactions.map((transaction, index) => (
                  <tr key={transaction.id} style={{ borderTop: index > 0 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap', fontSize: '0.875rem', color: '#111827' }}>
                      {transaction.transactionDate}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#111827' }}>
                      {transaction.merchantName}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap', fontSize: '0.875rem', color: '#111827' }}>
                      ¥{transaction.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                      <button
                        onClick={() => navigate("/transactions/" + transaction.id)}
                        style={{ color: '#2563eb', cursor: 'pointer', border: 'none', background: 'none', textDecoration: 'none' }}
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
