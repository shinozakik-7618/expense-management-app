import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, auth } from './firebase';
import { getUserInfo } from './utils/userPermissions';

interface Transaction {
  id: string; transactionDate: any; amount: number; merchantName: string;
  categoryId?: string; memo?: string; status: string; receiptCount: number;
  userId?: string; userName?: string;
}
interface Receipt {
  id: string; fileName: string; downloadURL: string; storagePath: string; fileSize: number;
}

const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' as const };

export default function TransactionDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('user');

  useEffect(() => {
    if (id) { loadTransaction(id); loadReceipts(id); }
    const currentUser = auth.currentUser;
    if (currentUser) {
      getUserInfo(currentUser.uid).then(info => { if (info) setUserRole(info.role); });
    }
  }, [id]);

  const loadTransaction = async (transactionId: string) => {
    try {
      setLoading(true);
      const docRef = doc(db, 'transactions', transactionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const txData = { id: docSnap.id, ...docSnap.data() } as Transaction;
        setTransaction(txData);
        // 使用者の表示名を取得
        if (txData.userId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', txData.userId));
            if (userSnap.exists()) {
              setUserDisplayName(userSnap.data().displayName || userSnap.data().email || txData.userId);
            } else {
              setUserDisplayName('⚠️ 未登録ユーザー');
            }
          } catch { setUserDisplayName(txData.userName || txData.userId || '-'); }
        }
      } else {
        alert('取引が見つかりません'); navigate('/transactions');
      }
    } catch (error) {
      console.error('取引の取得に失敗:', error); alert('取引の取得に失敗しました');
    } finally { setLoading(false); }
  };

  const loadReceipts = async (transactionId: string) => {
    try {
      const q = query(collection(db, 'receipts'), where('transactionId', '==', transactionId));
      const snapshot = await getDocs(q);
      const data: Receipt[] = [];
      snapshot.forEach((doc) => { data.push({ id: doc.id, ...doc.data() } as Receipt); });
      setReceipts(data);
    } catch (error) { console.error('証憑の取得に失敗:', error); }
  };

  const handleDeleteReceipt = async (receipt: Receipt) => {
    if (!window.confirm('この証憑を削除しますか？')) return;
    try {
      await deleteObject(ref(storage, receipt.storagePath));
      await deleteDoc(doc(db, 'receipts', receipt.id));
      if (id) await updateDoc(doc(db, 'transactions', id), { receiptCount: receipts.length - 1, updatedAt: Timestamp.now() });
      alert('証憑を削除しました'); loadReceipts(id!); loadTransaction(id!);
    } catch (error) { console.error('証憑の削除に失敗:', error); alert('証憑の削除に失敗しました'); }
  };

  const handleApprove = async () => {
    if (!id || !window.confirm('この取引を承認しますか？')) return;
    try {
      await updateDoc(doc(db, 'transactions', id), { status: 'approved', approvedAt: Timestamp.now(), updatedAt: Timestamp.now() });
      alert('取引を承認しました'); navigate('/transactions');
    } catch (error) { console.error('承認に失敗:', error); alert('承認に失敗しました'); }
  };

  const handleReject = async () => {
    const comment = window.prompt('差戻し理由を入力してください：');
    if (!id || !comment) return;
    try {
      await updateDoc(doc(db, 'transactions', id), { status: 'rejected', updatedAt: Timestamp.now() });
      alert('取引を差戻しました'); navigate('/transactions');
    } catch (error) { console.error('差戻しに失敗:', error); alert('差戻しに失敗しました'); }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; border: string; text: string }> = {
      pending:   { bg:'rgba(102,126,234,0.15)', color:'#a5b4fc', border:'rgba(102,126,234,0.4)', text:'未処理' },
      submitted: { bg:'rgba(240,147,251,0.15)', color:'#f0abfc', border:'rgba(240,147,251,0.4)', text:'申請中' },
      rejected:  { bg:'rgba(250,112,154,0.15)', color:'#fda4af', border:'rgba(250,112,154,0.4)', text:'差戻し' },
      approved:  { bg:'rgba(79,172,254,0.15)',  color:'#7dd3fc', border:'rgba(79,172,254,0.4)',  text:'承認済' }
    };
    const s = map[status] || map.pending;
    return <span style={{ padding:'6px 16px', borderRadius:'12px', fontSize:'14px', fontWeight:'bold', background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.text}</span>;
  };

  const labelStyle = { display:'block', marginBottom:'6px', color:'rgba(255,255,255,0.55)', fontSize:'13px', fontWeight:'500' as const };
  const valueStyle = { fontSize:'15px', color:'white', fontWeight:'500' as const };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  if (!transaction) return null;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' }}>
      <div style={{ maxWidth:'800px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>📄 取引詳細</h1>
            <div style={{ display:'flex', gap:'0.6rem' }}>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
            </div>
          </div>
        </div>

        {/* 詳細カード */}
        <div style={{ ...card, padding:'2rem' }}>
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>ステータス</label>
            {getStatusBadge(transaction.status)}
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>取引日</label>
            <div style={valueStyle}>{transaction.transactionDate?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}</div>
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>金額</label>
            <div style={{ fontSize:'28px', fontWeight:'800', color:'#c4b5fd' }}>¥{transaction.amount.toLocaleString()}</div>
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>加盟店名</label>
            <div style={valueStyle}>{transaction.merchantName}</div>
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>メモ</label>
            <div style={{ ...valueStyle, color:'rgba(255,255,255,0.7)' }}>{transaction.memo || '-'}</div>
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>使用者</label>
            <div style={valueStyle}>{userDisplayName || '-'}</div>
          </div>

          {/* 証憑 */}
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>証憑画像（{receipts.length}件）</label>
            {receipts.length > 0 ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'10px' }}>
                {receipts.map((receipt) => (
                  <div key={receipt.id} style={{ position:'relative' }}>
                    <img src={receipt.downloadURL} alt={receipt.fileName}
                      onClick={() => setSelectedImage(receipt.downloadURL)}
                      style={{ width:'100%', height:'140px', objectFit:'cover', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer' }} />
                    <button onClick={() => handleDeleteReceipt(receipt)}
                      style={{ position:'absolute', top:'5px', right:'5px', background:'rgba(220,38,38,0.85)', color:'white', border:'none', borderRadius:'50%', width:'24px', height:'24px', cursor:'pointer', fontSize:'14px', lineHeight:'1', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:'14px' }}>証憑画像がありません</div>
            )}
          </div>

          {/* ステータス変更ボタン（管理者・マネージャーのみ） */}
          {['admin','block_manager','region_manager','base_manager'].includes(userRole) && (
            <div style={{ marginTop:'24px' }}>
              <label style={labelStyle}>ステータス変更</label>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                {transaction.status !== 'approved' && (
                  <button onClick={handleApprove} style={{ padding:'10px 20px', fontSize:'14px', fontWeight:'bold', color:'white', background:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)', border:'none', borderRadius:'8px', cursor:'pointer', boxShadow:'0 4px 12px rgba(79,172,254,0.3)' }}>✅ 承認</button>
                )}
                {transaction.status !== 'rejected' && (
                  <button onClick={handleReject} style={{ padding:'10px 20px', fontSize:'14px', fontWeight:'bold', color:'white', background:'linear-gradient(135deg,#fa709a 0%,#fee140 100%)', border:'none', borderRadius:'8px', cursor:'pointer', boxShadow:'0 4px 12px rgba(250,112,154,0.3)' }}>⚠️ 差戻し</button>
                )}
                {transaction.status !== 'pending' && (
                  <button onClick={async () => { if (!id || !window.confirm('未処理に戻しますか？')) return; try { await updateDoc(doc(db, 'transactions', id), { status:'pending', updatedAt: Timestamp.now() }); alert('未処理に戻しました'); loadTransaction(id); } catch(e) { alert('更新に失敗しました'); } }} style={{ padding:'10px 20px', fontSize:'14px', fontWeight:'bold', color:'rgba(255,255,255,0.7)', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'8px', cursor:'pointer' }}>↩️ 未処理に戻す</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 画像拡大モーダル */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)}
          style={{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, cursor:'pointer' }}>
          <img src={selectedImage} alt="拡大表示" style={{ maxWidth:'90%', maxHeight:'90%', objectFit:'contain', borderRadius:'8px' }} />
        </div>
      )}
    </div>
  );
}