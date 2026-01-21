import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
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
      console.log('ログイン中のemail:', currentUser.email);

      // ユーザー情報を取得
      const userQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
      const userSnapshot = await getDocs(userQuery);
      
      setUserName(currentUser.email || "");

      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        setUserRole(userData.role || 'user');
        setUserName(userData.displayName || currentUser.email || currentUser.uid);
      }

      // 統計情報を取得
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);

      const statsData: Stats = {
        pending: 0,
        submitted: 0,
        rejected: 0,
        approved: 0
      };

      const transactions: RecentTransaction[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'pending';

        if (status in statsData) {
          statsData[status as keyof Stats]++;
        }

        transactions.push({
          id: doc.id,
          transactionDate: formatDate(data.transactionDate),
          amount: data.amount || 0,
          merchantName: data.merchantName || '',
          status: status
        });
      });

      transactions.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

      setStats(statsData);
      setRecentTransactions(transactions.slice(0, 5));

      // 未読通知を取得
      const notificationsRef = collection(db, 'notifications');
      const notifQuery = query(notificationsRef, where('userId', '==', currentUser.uid), where('read', '==', false));
      const notifSnapshot = await getDocs(notifQuery);
      setUnreadNotifications(notifSnapshot.size);

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
    const badges: { [key: string]: { label: string; gradient: string } } = {
      pending: { label: '未処理', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      submitted: { label: '申請中', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
      rejected: { label: '差戻し', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
      approved: { label: '承認済', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
    };
    const badge = badges[status] || { label: status, gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' };
    return (
      <span style={{
        display: 'inline-block',
        padding: '6px 16px',
        fontSize: '0.75rem',
        fontWeight: '700',
        borderRadius: '20px',
        background: badge.gradient,
        color: 'white',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {badge.label}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const badges: { [key: string]: { label: string; gradient: string } } = {
      admin: { label: '管理者', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      block_manager: { label: 'ブロック・部署長', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
      region_manager: { label: '地域代表', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
      base_manager: { label: '経営管理・管理責任者', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
      user: { label: '一般ユーザー', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
    };
    const badge = badges[role] || { label: role, gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' };
    return (
      <span style={{
        display: 'inline-block',
        padding: '6px 16px',
        fontSize: '0.75rem',
        fontWeight: '700',
        borderRadius: '20px',
        background: badge.gradient,
        color: 'white',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: 'white',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          ✨ 読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '90rem', margin: '0 auto' }} className="animate-fade-in-up">
        {/* ヘッダー */}
        <div className="glass-card" style={{
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                ダッシュボード
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                <p style={{ color: '#111827', fontSize: '1.1rem' }}>ようこそ、{userName}さん</p>
                {getRoleBadge(userRole)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate("/transactions/new")}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                ➕ 新規取引
              </button>
              <button
                onClick={() => navigate('/purpose-master')}
                style={{
                  padding: '12px 20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: '600'
                }}
              >
                📌 用途管理
              </button>

              <button
                onClick={() => navigate('/notifications')}
                style={{
                  position: 'relative',
                  padding: '12px 20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: '600'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                🔔 通知
                {unreadNotifications > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    height: '24px',
                    width: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}>
                    {unreadNotifications}
                  </span>
                )}
              </button>
              <button onClick={() => navigate('/unreported')} style={{ padding: '12px 20px', background: 'rgba(255, 255, 255, 0.1)', color: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: '600' }}>📋 未報告</button>
              <button onClick={() => navigate('/transactions')} style={{ padding: '12px 20px', background: 'rgba(255, 255, 255, 0.1)', color: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: '600' }}>📝 取引一覧</button>
              {userRole === 'admin' && (
                <button onClick={() => navigate('/user-management')} style={{ padding: '12px 20px', background: 'rgba(255, 255, 255, 0.1)', color: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: '600' }}>👥 ユーザー管理</button>
              )}
              <button onClick={handleLogout} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: '600', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>🔓 ログアウト</button>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* 未処理 */}
          <div className="glass-card" style={{
            padding: '2rem',
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            borderLeft: '4px solid #667eea',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '6rem', opacity: 0.1 }}>📋</div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>未処理</p>
              <p style={{ fontSize: '3rem', fontWeight: '800', color: '#1e3a8a' }}>{stats.pending}</p>
            </div>
          </div>

          {/* 申請中 */}
          <div className="glass-card" style={{
            padding: '2rem',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderLeft: '4px solid #f093fb',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '6rem', opacity: 0.1 }}>⏳</div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#713f12', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>申請中</p>
              <p style={{ fontSize: '3rem', fontWeight: '800', color: '#713f12' }}>{stats.submitted}</p>
            </div>
          </div>

          {/* 差戻し */}
          <div className="glass-card" style={{
            padding: '2rem',
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            borderLeft: '4px solid #fa709a',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '6rem', opacity: 0.1 }}>↩️</div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>差戻し</p>
              <p style={{ fontSize: '3rem', fontWeight: '800', color: '#7f1d1d' }}>{stats.rejected}</p>
            </div>
          </div>

          {/* 承認済 */}
          <div className="glass-card" style={{
            padding: '2rem',
            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            borderLeft: '4px solid #4facfe',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '6rem', opacity: 0.1 }}>✅</div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#14532d', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>承認済</p>
              <p style={{ fontSize: '3rem', fontWeight: '800', color: '#14532d' }}>{stats.approved}</p>
            </div>
          </div>
        </div>

        {/* 最新取引 */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>✨ 最新の取引</h2>
          </div>
          {recentTransactions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }}>📭</div>
              <p style={{ fontSize: '1.1rem' }}>取引データがありません</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>取引日</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>店舗名</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>金額</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>ステータス</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      style={{
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {transaction.transactionDate}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {transaction.merchantName}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                        ¥{transaction.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        {getStatusBadge(transaction.status)}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => navigate("/transactions/" + transaction.id)}
                          style={{
                            padding: '8px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                          }}
                        >
                          詳細 →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
