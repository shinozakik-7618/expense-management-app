import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pending: 0,
    submitted: 0,
    rejected: 0,
    approved: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'transactions'));
      
      const newStats = {
        pending: 0,
        submitted: 0,
        rejected: 0,
        approved: 0,
      };

      snapshot.forEach((doc) => {
        const data = doc.data();
        const status = data.status;
        if (status in newStats) {
          newStats[status as keyof typeof newStats]++;
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error('統計データの取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px' 
      }}>
        <h1>ダッシュボード</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#fff3cd', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>未処理</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#856404' }}>
            {stats.pending}
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: '#d1ecf1', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>申請中</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#0c5460' }}>
            {stats.submitted}
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8d7da', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#721c24' }}>差戻し</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#721c24' }}>
            {stats.rejected}
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: '#d4edda', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#155724' }}>承認済</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#155724' }}>
            {stats.approved}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => navigate('/transactions')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          取引一覧
        </button>

        <button 
          onClick={() => navigate('/categories')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          用途マスタ管理
        </button>

        <button 
          onClick={() => navigate('/users')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ユーザー管理
        </button>
      </div>
    </div>
  );
}
