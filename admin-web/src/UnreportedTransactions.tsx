import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getUserInfo, buildTransactionQuery } from './utils/userPermissions';

interface Transaction {
  id: string; transactionDate: any; amount: number; merchantName: string;
  categoryId: string; memo: string; status: string; reportStatus: string;
  userId: string; receiptCount: number;
}

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav: React.CSSProperties = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' };

export default function UnreportedTransactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => { loadUnreportedTransactions(); }, []);

  const loadUnreportedTransactions = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const userInfo = await getUserInfo(currentUser.uid);
      if (userInfo) setUserRole(userInfo.role);
      const queryCondition = buildTransactionQuery(userInfo!);
      const transactionsRef = collection(db, 'transactions');
      let q;
      if (queryCondition.field && queryCondition.value) {
        q = query(transactionsRef, where(queryCondition.field, '==', queryCondition.value), where('reportStatus', '==', 'unreported'));
      } else {
        q = query(transactionsRef, where('reportStatus', '==', 'unreported'));
      }
      onSnapshot(q, (snapshot) => {
        const txList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction)
          .sort((a, b) => {
            const dateA = a.transactionDate?.toDate() || new Date(0);
            const dateB = b.transactionDate?.toDate() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
        setTransactions(txList);
        setLoading(false);
      });
    } catch (error) { console.error('未報告取引読み込みエラー:', error); setLoading(false); }
  };

  const handleMarkAsReported = async (transactionId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { alert('ログインしてください'); return; }
      if (!confirm('この取引を「報告済み」にしますか？')) return;
      await updateDoc(doc(db, 'transactions', transactionId), {
        reportStatus: 'reported', reportedAt: Timestamp.now(),
        reportedBy: currentUser.uid, updatedAt: Timestamp.now()
      });
      alert('報告済みにしました');
    } catch (error) { console.error('更新エラー:', error); alert('更新に失敗しました'); }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { gradient: string; label: string } } = {
      pending:   { gradient:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', label:'未処理' },
      submitted: { gradient:'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)', label:'申請中' },
      rejected:  { gradient:'linear-gradient(135deg,#fa709a 0%,#fee140 100%)', label:'差戻し' },
      approved:  { gradient:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)', label:'承認済' }
    };
    const badge = badges[status] || badges.pending;
    return <span style={{ padding:'5px 14px', fontSize:'0.8rem', fontWeight:'700', borderRadius:'20px', background:badge.gradient, color:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>{badge.label}</span>;
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  return (
    <div style={dark}>
      <div style={{ maxWidth:'90rem', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>📋 未報告取引</h1>
            <div style={{ display:'flex', gap:'0.6rem' }}>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
            </div>
          </div>
        </div>

        {/* テーブル */}
        <div style={{ ...card, padding:'1.5rem 2rem' }}>
          <h2 style={{ fontSize:'1.2rem', fontWeight:'700', color:'white', marginBottom:'1.2rem', marginTop:0 }}>未報告取引（{transactions.length}件）</h2>
          {transactions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'rgba(255,255,255,0.4)', fontSize:'1.1rem' }}>✅ 未報告の取引はありません</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.05)' }}>
                    {['取引日','店舗（会社）名','金額','領収書','ステータス','操作'].map(h => (
                      <th key={h} style={{ padding:'0.9rem 1rem', textAlign: h==='金額'?'right':h==='操作'||h==='領収書'||h==='ステータス'?'center':'left', fontSize:'0.75rem', fontWeight:'700', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', transition:'background 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding:'0.9rem 1rem', color:'rgba(255,255,255,0.7)', fontSize:'0.9rem' }}>{tx.transactionDate?.toDate().toLocaleDateString('ja-JP')}</td>
                      <td style={{ padding:'0.9rem 1rem', color:'white', fontWeight:'600' }}>{tx.merchantName}</td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'right', color:'white', fontWeight:'700' }}>¥{tx.amount.toLocaleString()}</td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}>
                        <span style={{ padding:'3px 10px', background: tx.receiptCount>0?'rgba(79,172,254,0.2)':'rgba(255,255,255,0.06)', color: tx.receiptCount>0?'#7dd3fc':'rgba(255,255,255,0.35)', border: tx.receiptCount>0?'1px solid rgba(79,172,254,0.4)':'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', fontSize:'0.82rem', fontWeight:'600' }}>
                          {tx.receiptCount>0 ? `📎 ${tx.receiptCount}` : '－'}
                        </span>
                      </td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}>{getStatusBadge(tx.status)}</td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:'0.4rem', justifyContent:'center' }}>
                          <button onClick={() => navigate(`/transactions/${tx.id}`)} style={{ padding:'6px 12px', background:'rgba(124,92,191,0.3)', color:'#c4b5fd', border:'1px solid rgba(124,92,191,0.5)', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'0.8rem' }}>👁️ 詳細</button>
                          <button onClick={() => handleMarkAsReported(tx.id)} style={{ padding:'6px 12px', background:'rgba(79,172,254,0.2)', color:'#7dd3fc', border:'1px solid rgba(79,172,254,0.4)', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'0.8rem' }}>✅ 報告済みにする</button>
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