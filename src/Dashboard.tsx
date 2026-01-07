import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

interface Stats {
  pending: number;
  submitted: number;
  rejected: number;
  approved: number;
}

interface RecentTransaction {
  id: string;
  transactionDate: any;
  merchantName: string;
  amount: number;
  status: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    submitted: 0,
    rejected: 0,
    approved: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadRecentTransactions();
  }, []);

  const loadStats = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'transactions'));
      const newStats = { pending: 0, submitted: 0, rejected: 0, approved: 0 };
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'pending') newStats.pending++;
        else if (data.status === 'submitted') newStats.submitted++;
        else if (data.status === 'rejected') newStats.rejected++;
        else if (data.status === 'approved') newStats.approved++;
      });
      
      setStats(newStats);
    } catch (error) {
      console.error('統計の取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      const q = query(
        collection(db, 'transactions'),
        orderBy('transactionDate', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RecentTransaction));
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('最新取引の取得に失敗:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('ログアウトに失敗:', error);
      alert('ログアウトに失敗しました');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { text: string; color: string } } = {
      pending: { text: '未処理', color: '#ffc107' },
      submitted: { text: '申請中', color: '#0dcaf0' },
      rejected: { text: '差戻し', color: '#dc3545' },
      approved: { text: '承認済', color: '#198754' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        backgroundColor: badge.color,
        color: status === 'pending' ? '#000' : 'white'
      }}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>ダッシュボード</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {auth.currentUser?.email}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', border: '2px solid #ffc107' }}>
          <div style={{ fontSize: '14px', color: '#856404', marginBottom: '8px' }}>未処理</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#856404' }}>{stats.pending}</div>
        </div>

        <div style={{ backgroundColor: '#cff4fc', padding: '20px', borderRadius: '8px', border: '2px solid #0dcaf0' }}>
          <div style={{ fontSize: '14px', color: '#055160', marginBottom: '8px' }}>申請中</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#055160' }}>{stats.submitted}</div>
        </div>

        <div style={{ backgroundColor: '#f8d7da', padding: '20px', borderRadius: '8px', border: '2px solid #dc3545' }}>
          <div style={{ fontSize: '14px', color: '#842029', marginBottom: '8px' }}>差戻し</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#842029' }}>{stats.rejected}</div>
        </div>

        <div style={{ backgroundColor: '#d1e7dd', padding: '20px', borderRadius: '8px', border: '2px solid #198754' }}>
          <div style={{ fontSize: '14px', color: '#0f5132', marginBottom: '8px' }}>承認済</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f5132' }}>{stats.approved}</div>
        </div>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>最新の取引</h2>
          <button
            onClick={() => navigate('/transactions')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0d6efd',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            すべて見る →
          </button>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {recentTransactions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
              取引データがありません
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>取引日</th>
                  <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>加盟店名</th>
                  <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>金額（税込・円）</th>
                  <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>ステータス</th>
                  <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '15px', fontSize: '14px' }}>
                      {transaction.transactionDate?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px' }}>{transaction.merchantName}</td>
                    <td style={{ padding: '15px', fontSize: '14px', textAlign: 'right', fontWeight: 'bold' }}>
                      ¥{transaction.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button
                        onClick={() => navigate(`/transactions/${transaction.id}`)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#0d6efd',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <button
          onClick={() => navigate('/transactions')}
          style={{
            padding: '20px',
            backgroundColor: '#0d6efd',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          📊 取引一覧
        </button>

        <button
          onClick={() => navigate('/categories')}
          style={{
            padding: '20px',
            backgroundColor: '#198754',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          📁 用途マスタ管理
        </button>

        <button
          onClick={() => navigate('/users')}
          style={{
            padding: '20px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          👥 ユーザー管理
        </button>
      </div>
    </div>
  );
}
