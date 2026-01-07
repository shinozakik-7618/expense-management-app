import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

interface Transaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  categoryId?: string;
  memo?: string;
  status: string;
}

export default function TransactionDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTransaction(id);
    }
  }, [id]);

  const loadTransaction = async (transactionId: string) => {
    try {
      setLoading(true);
      const docRef = doc(db, 'transactions', transactionId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setTransaction({ id: docSnap.id, ...docSnap.data() } as Transaction);
      } else {
        alert('取引が見つかりません');
        navigate('/transactions');
      }
    } catch (error) {
      console.error('取引の取得に失敗:', error);
      alert('取引の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id || !window.confirm('この取引を承認しますか？')) return;

    try {
      const docRef = doc(db, 'transactions', id);
      await updateDoc(docRef, {
        status: 'approved',
        approvedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      alert('取引を承認しました');
      navigate('/transactions');
    } catch (error) {
      console.error('承認に失敗:', error);
      alert('承認に失敗しました');
    }
  };

  const handleReject = async () => {
    const comment = window.prompt('差戻し理由を入力してください：');
    if (!id || !comment) return;

    try {
      const docRef = doc(db, 'transactions', id);
      await updateDoc(docRef, {
        status: 'rejected',
        updatedAt: Timestamp.now()
      });
      alert('取引を差戻しました');
      navigate('/transactions');
    } catch (error) {
      console.error('差戻しに失敗:', error);
      alert('差戻しに失敗しました');
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
        padding: '6px 16px',
        borderRadius: '12px',
        fontSize: '14px',
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

  if (!transaction) {
    return null;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>取引詳細</h1>
        <button 
          onClick={() => navigate('/transactions')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          一覧に戻る
        </button>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
            ステータス
          </label>
          {getStatusBadge(transaction.status)}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
            取引日
          </label>
          <div style={{ fontSize: '16px' }}>
            {transaction.transactionDate?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
            金額
          </label>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
            ¥{transaction.amount.toLocaleString()}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
            加盟店名
          </label>
          <div style={{ fontSize: '16px' }}>
            {transaction.merchantName}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
            メモ
          </label>
          <div style={{ fontSize: '16px' }}>
            {transaction.memo || '-'}
          </div>
        </div>

        {transaction.status === 'pending' && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
            <button
              onClick={handleApprove}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: '#28a745',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              承認
            </button>
            <button
              onClick={handleReject}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: '#dc3545',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              差戻し
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
