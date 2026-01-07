import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

interface Transaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  status: string;
  memo?: string;
  receiptCount: number;
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

  const handleDelete = async (id: string, merchantName: string) => {
    if (!window.confirm(`「${merchantName}」の取引を削除しますか？\n※この操作は取り消せません`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'transactions', id));
      alert('取引を削除しました');
      loadTransactions();
    } catch (error) {
      console.error('削除に失敗:', error);
      alert('削除に失敗しました');
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('エクスポートするデータがありません');
      return;
    }

    const headers = ['取引日', '加盟店名', '金額（税込・円）', 'ステータス', '証憑件数', 'メモ'];
    
    const rows = transactions.map((t) => {
      const date = t.transactionDate?.toDate?.()?.toLocaleDateString('ja-JP') || '';
      const statusText = {
        pending: '未処理',
        submitted: '申請中',
        rejected: '差戻し',
        approved: '承認済'
      }[t.status] || t.status;
      
      return [
        date,
        t.merchantName,
        t.amount,
        statusText,
        t.receiptCount || 0,
        t.memo || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `取引一覧_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('CSVファイルをダウンロードしました');
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
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: transactions.length === 0 ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            📊 CSV出力
          </button>
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
              <th style={{ padding: '12px', textAlign: 'right' }}>金額（税込・円）</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>証憑</th>
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
                  {transaction.receiptCount > 0 ? (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: '#d1ecf1',
                      color: '#0c5460',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      📎 {transaction.receiptCount}
                    </span>
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {getStatusBadge(transaction.status)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
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
                    <button
                      onClick={() => navigate(`/transactions/${transaction.id}/edit`)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ffc107',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id, transaction.merchantName)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
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
