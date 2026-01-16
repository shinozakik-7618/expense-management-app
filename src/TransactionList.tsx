import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { getUserInfo, buildTransactionQuery } from './utils/userPermissions';

interface Transaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  categoryId: string;
  memo: string;
  status: string;
  receiptCount: number;
}

export default function TransactionList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userInfo = await getUserInfo(currentUser.uid);
      if (userInfo) {
        setUserRole(userInfo.role);
      }

      const queryCondition = buildTransactionQuery(userInfo!);
      const transactionsRef = collection(db, 'transactions');
      
      let q;
      if (queryCondition.field && queryCondition.value) {
        q = query(transactionsRef, where(queryCondition.field, '==', queryCondition.value));
      } else {
        q = query(transactionsRef);
      }

      onSnapshot(q, (snapshot) => {
        const txList = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }) as Transaction)
          .sort((a, b) => {
            const dateA = a.transactionDate?.toDate() || new Date(0);
            const dateB = b.transactionDate?.toDate() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

        setTransactions(txList);
        setLoading(false);
      });
    } catch (error) {
      console.error('取引一覧読み込みエラー:', error);
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

  const handleDelete = async (transactionId: string) => {
    if (!confirm('この取引を削除しますか？')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'transactions', transactionId));
      alert('削除しました');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { gradient: string; label: string } } = {
      pending: { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', label: '未処理' },
      submitted: { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', label: '申請中' },
      rejected: { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', label: '差戻し' },
      approved: { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', label: '承認済' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span style={{
        padding: '6px 16px',
        fontSize: '0.875rem',
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
      <div style={{ maxWidth: '90rem', margin: '0 auto' }}>
        {/* ヘッダー */}
        <div className="glass-card" style={{
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h1 className="gradient-text" style={{
              fontSize: '2.5rem',
              marginBottom: '0.5rem',
              fontWeight: '800',
              color: 'white',
              textShadow: '0 0 30px rgba(255, 255, 255, 0.5)'
            }}>
              📝 取引一覧
            </h1>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/dashboard')}
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
                📊 ダッシュボード
              </button>
              <button
                onClick={() => navigate('/reconciliation/card')}
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
                💳 カード請求突合
              </button>
              <button
                onClick={() => navigate('/unreported')}
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
                📋 未報告取引
              </button>
              <button
                onClick={() => navigate('/transactions/import')}
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
                📥 CSVインポート
              </button>
              <button
                onClick={() => navigate('/transactions/new')}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                ➕ 新規登録
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: '600',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                🔓 ログアウト
              </button>
            </div>
          </div>
        </div>

        {/* 取引一覧テーブル */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '1.5rem'
          }}>
            全取引（{transactions.length}件）
          </h2>
          
          {transactions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#64748b',
              fontSize: '1.1rem'
            }}>
              📭 取引データがありません
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '700', color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>取引日</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '700', color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>店舗（会社）名</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>金額</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '700', color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>領収書</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '700', color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>ステータス</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '700', color: '#1e293b', fontSize: '0.875rem', textTransform: 'uppercase' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(102, 126, 234, 0.05)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '1rem', color: '#475569' }}>
                        {tx.transactionDate?.toDate().toLocaleDateString('ja-JP')}
                      </td>
                      <td style={{ padding: '1rem', color: '#1e293b', fontWeight: '600' }}>
                        {tx.merchantName}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#1e293b', fontWeight: '700' }}>
                        ¥{tx.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          background: tx.receiptCount > 0 ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' : '#e2e8f0',
                          color: tx.receiptCount > 0 ? 'white' : '#64748b',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          {tx.receiptCount > 0 ? `📎 ${tx.receiptCount}` : '－'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {getStatusBadge(tx.status)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => navigate(`/transactions/${tx.id}`)}
                            style={{
                              padding: '8px 16px',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            👁️ 詳細
                          </button>
                          <button
                            onClick={() => navigate(`/transactions/${tx.id}/edit`)}
                            style={{
                              padding: '8px 16px',
                              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            ✏️ 編集
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            style={{
                              padding: '8px 16px',
                              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            🗑️ 削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
