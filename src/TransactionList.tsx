import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where, getDocs } from 'firebase/firestore';
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
  userId: string;
  blockId?: string;
  regionId?: string;
  baseId?: string;
}

function TransactionList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
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
      const queryFilter = buildTransactionQuery(userInfo);

      let q;
      if (queryFilter.field && queryFilter.value) {
        q = query(
          collection(db, 'transactions'),
          where(queryFilter.field, '==', queryFilter.value),
          orderBy('transactionDate', 'desc')
        );
      } else {
        q = query(collection(db, 'transactions'), orderBy('transactionDate', 'desc'));
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Transaction));
        setTransactions(data);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('取引一覧取得エラー:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('この取引を削除しますか？')) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
        alert('削除しました');
      } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました');
      }
    }
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
          <h1>取引一覧</h1>
          {userRole && (
            <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
              {getRoleBadge(userRole)} として表示中
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/transactions/import')}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📥 CSVインポート
          </button>
          <button
            onClick={() => navigate('/transactions/create')}
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
            + 新規登録
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 20px',
              background: '#9E9E9E',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ダッシュボードに戻る
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

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>取引日</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>金額</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>加盟店名</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>メモ</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>証憑</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>ステータス</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => (
              <tr key={transaction.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>
                  {transaction.transactionDate?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  ¥{transaction.amount?.toLocaleString() || 0}
                </td>
                <td style={{ padding: '12px' }}>{transaction.merchantName}</td>
                <td style={{ padding: '12px' }}>{transaction.memo || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {transaction.receiptCount > 0 && (
                    <span style={{
                      background: '#E3F2FD',
                      color: '#1976D2',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      📎 {transaction.receiptCount}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {getStatusBadge(transaction.status)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
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
                    <button
                      onClick={() => navigate(`/transactions/${transaction.id}/edit`)}
                      style={{
                        padding: '6px 12px',
                        background: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          取引データがありません
        </div>
      )}
    </div>
  );
}

export default TransactionList;
