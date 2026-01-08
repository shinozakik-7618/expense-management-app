import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { getUserInfo, buildTransactionQuery } from './utils/userPermissions';

interface Stats {
  pending: number;
  submitted: number;
  rejected: number;
  approved: number;
}

interface RecentTransaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  status: string;
}

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ pending: 0, submitted: 0, rejected: 0, approved: 0 });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      const userInfo = await getUserInfo(auth.currentUser.uid);
      if (!userInfo) {
        setLoading(false);
        return;
      }

      setUserRole(userInfo.role);
      setUserName(auth.currentUser.email || '');

      const queryFilter = buildTransactionQuery(userInfo);
      await Promise.all([
        loadStats(queryFilter),
        loadRecentTransactions(queryFilter)
      ]);

      setLoading(false);
    } catch (error) {
      console.error('ダッシュボードデータ取得エラー:', error);
      setLoading(false);
    }
  };

  const loadStats = async (queryFilter: { field: string | null; value: string | null }) => {
    try {
      let baseQuery;
      if (queryFilter.field && queryFilter.value) {
        baseQuery = query(collection(db, 'transactions'), where(queryFilter.field, '==', queryFilter.value));
      } else {
        baseQuery = query(collection(db, 'transactions'));
      }

      const snapshot = await getDocs(baseQuery);
      const transactions = snapshot.docs.map(doc => doc.data());

      const newStats = {
        pending: transactions.filter(t => t.status === 'pending').length,
        submitted: transactions.filter(t => t.status === 'submitted').length,
        rejected: transactions.filter(t => t.status === 'rejected').length,
        approved: transactions.filter(t => t.status === 'approved').length
      };

      setStats(newStats);
    } catch (error) {
      console.error('統計取得エラー:', error);
    }
  };

  const loadRecentTransactions = async (queryFilter: { field: string | null; value: string | null }) => {
    try {
      let q;
      if (queryFilter.field && queryFilter.value) {
        q = query(
          collection(db, 'transactions'),
          where(queryFilter.field, '==', queryFilter.value),
          orderBy('transactionDate', 'desc'),
          limit(5)
        );
      } else {
        q = query(
          collection(db, 'transactions'),
          orderBy('transactionDate', 'desc'),
          limit(5)
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as RecentTransaction));
        setRecentTransactions(data);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('最新取引取得エラー:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: { bg: string; text: string; label: string } } = {
      pending: { bg: '#FFF3E0', text: '#E65100', label: '未処理' },
      submitted: { bg: '#E3F2FD', text: '#1565C0', label: '申請中' },
      rejected: { bg: '#FFEBEE', text: '#C62828', label: '差戻し' },
      approved: { bg: '#E8F5E9', text: '#2E7D32', label: '承認済' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        background: style.bg,
        color: style.text
      }}>
        {style.label}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const labels: { [key: string]: string } = {
      admin: '👑 管理者',
      block_manager: '🏢 ブロック責任者',
      region_manager: '🏪 地域責任者',
      base_manager: '🏬 拠点責任者',
      user: '👤 一般ユーザー'
    };
    return labels[role] || '👤 一般ユーザー';
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>読み込み中...</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1>ダッシュボード</h1>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            {userName} ({getRoleBadge(userRole)})
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/transactions')}
            style={{
              padding: '10px 20px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            取引一覧
          </button>
          <button
            onClick={() => navigate('/categories')}
            style={{
              padding: '10px 20px',
              background: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            用途マスタ管理
          </button>
          <button
            onClick={() => navigate('/users')}
            style={{
              padding: '10px 20px',
              background: '#9C27B0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ユーザー管理
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #E65100' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>未処理</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#E65100' }}>{stats.pending}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #1565C0' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>申請中</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1565C0' }}>{stats.submitted}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #C62828' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>差戻し</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#C62828' }}>{stats.rejected}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #2E7D32' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>承認済</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2E7D32' }}>{stats.approved}</div>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>最新の取引</h2>
          <button
            onClick={() => navigate('/transactions')}
            style={{
              padding: '8px 16px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            すべて見る
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>取引日</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>加盟店名</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>金額</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>ステータス</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map(transaction => (
              <tr key={transaction.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>
                  {transaction.transactionDate?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}
                </td>
                <td style={{ padding: '12px' }}>{transaction.merchantName}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  ¥{transaction.amount?.toLocaleString() || 0}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {getStatusBadge(transaction.status)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => navigate(`/transactions/${transaction.id}`)}
                    style={{
                      padding: '6px 12px',
                      background: '#2196F3',
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
        {recentTransactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            取引データがありません
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
