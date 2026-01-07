import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

interface Transaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  categoryId?: string;
  memo?: string;
  status: string;
  receiptCount: number;
}

interface Receipt {
  id: string;
  fileName: string;
  downloadURL: string;
  storagePath: string;
  fileSize: number;
}

export default function TransactionDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadTransaction(id);
      loadReceipts(id);
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

  const loadReceipts = async (transactionId: string) => {
    try {
      const q = query(collection(db, 'receipts'), where('transactionId', '==', transactionId));
      const snapshot = await getDocs(q);
      
      const data: Receipt[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Receipt);
      });
      
      setReceipts(data);
    } catch (error) {
      console.error('証憑の取得に失敗:', error);
    }
  };

  const handleDeleteReceipt = async (receipt: Receipt) => {
    if (!window.confirm('この証憑を削除しますか？')) return;

    try {
      // Storageから削除
      const storageRef = ref(storage, receipt.storagePath);
      await deleteObject(storageRef);

      // Firestoreから削除
      await deleteDoc(doc(db, 'receipts', receipt.id));

      // 取引のreceiptCountを更新
      if (id) {
        const transactionRef = doc(db, 'transactions', id);
        await updateDoc(transactionRef, {
          receiptCount: receipts.length - 1,
          updatedAt: Timestamp.now()
        });
      }

      alert('証憑を削除しました');
      loadReceipts(id!);
      loadTransaction(id!);
    } catch (error) {
      console.error('証憑の削除に失敗:', error);
      alert('証憑の削除に失敗しました');
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

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', color: '#666', fontSize: '14px' }}>
            証憑画像（{receipts.length}件）
          </label>
          {receipts.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {receipts.map((receipt) => (
                <div key={receipt.id} style={{ position: 'relative' }}>
                  <img 
                    src={receipt.downloadURL} 
                    alt={receipt.fileName}
                    onClick={() => setSelectedImage(receipt.downloadURL)}
                    style={{ 
                      width: '100%', 
                      height: '150px', 
                      objectFit: 'cover', 
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      cursor: 'pointer'
                    }} 
                  />
                  <button
                    onClick={() => handleDeleteReceipt(receipt)}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      backgroundColor: 'rgba(220, 53, 69, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      lineHeight: '1'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: '14px' }}>
              証憑画像がありません
            </div>
          )}
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

      {/* 画像拡大モーダル */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer'
          }}
        >
          <img 
            src={selectedImage} 
            alt="拡大表示"
            style={{ 
              maxWidth: '90%', 
              maxHeight: '90%',
              objectFit: 'contain'
            }} 
          />
        </div>
      )}
    </div>
  );
}
