import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

interface Transaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  status: string;
}

export default function TransactionList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'transactions'), orderBy('transactionDate', 'desc'));
      const snapshot = await getDocs(q);
      
      const data: Transaction[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      
      setTransactions(data);
    } catch (error) {
      console.error('取引の取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      pending: { bg: '#fff3cd', color: '#856404', text: '未処理' },
      submitted: { bg: '#d1ecf1', color: '#0c5460', text: '申請中' },
      rejected: { bg: '#f8d7da', color: '#721c24', text: '差戻し' },
      approved: { bg: '#d4edda', color: '#155724', text: '承認済' }
    };
    
    const style = styles[status] || styles.pending;
    
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        backgroundColor: style.bg,
        color: style.color
      }}>
        {style.text}
      </span>
    );
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>取引一覧</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => navigate('/transactions/create')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
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
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>取引日</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>加盟店名</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>金額</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>ステータス</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>
                  {transaction.transactionDate?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}
                </td>
                <td style={{ padding: '12px' }}>{transaction.merchantName}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  ¥{transaction.amount.toLocaleString()}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {getStatusBadge(transaction.status)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => navigate(`/transactions/${transaction.id}`)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    詳細
                  </button>
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
