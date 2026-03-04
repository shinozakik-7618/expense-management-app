import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';

interface CardTransaction {
  transactionDate: string; amount: number; merchantName: string; cardNumber: string;
  accountHolderLastName: string; accountHolderFirstName: string; employeeId: string;
}
interface SystemTransaction { id: string; transactionDate: string; amount: number; merchantName: string; userId: string; }
interface Mismatch { type: 'not_registered'|'date_mismatch'|'amount_mismatch'; cardTransaction: CardTransaction; systemTransaction?: SystemTransaction; }

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav: React.CSSProperties = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' };

const CardReconciliation: React.FC = () => {
  const navigate = useNavigate();
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciled, setReconciled] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { const text = e.target?.result as string; parseCSV(text); };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const transactions: CardTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const separator = line.includes('\t') ? '\t' : ',';
      const columns = line.split(separator);
      if (columns.length < 10) continue;
      const transactionDate = columns[2]?.trim();
      const amountStr = columns[36]?.trim();
      const merchantName = columns[12]?.trim();
      const cardNumber = columns[3]?.trim();
      const accountHolderLastName = columns[7]?.trim();
      const accountHolderFirstName = columns[8]?.trim();
      const employeeId = columns[9]?.trim();
      const amount = parseFloat(amountStr?.replace(/[^0-9.-]/g, '') || '0');
      if (!transactionDate || !amount || !merchantName) continue;
      transactions.push({ transactionDate, amount, merchantName, cardNumber: cardNumber||'', accountHolderLastName: accountHolderLastName||'', accountHolderFirstName: accountHolderFirstName||'', employeeId: employeeId||'' });
    }
    setCardTransactions(transactions);
  };

  const handleReconcile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) { alert('ログインしてください'); return; }
    if (cardTransactions.length === 0) { alert('カード取引データを読み込んでください'); return; }
    setLoading(true);
    try {
      const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
      const systemTransactions: SystemTransaction[] = [];
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        systemTransactions.push({ id: doc.id, transactionDate: data.transactionDate, amount: data.amount, merchantName: data.merchantName, userId: data.userId });
      });
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const employeeIdToUserId: { [key: string]: string } = {};
      usersSnapshot.forEach((doc) => { const data = doc.data(); if (data.employeeId) employeeIdToUserId[data.employeeId] = doc.id; });
      const newMismatches: Mismatch[] = [];
      const notificationsToCreate: any[] = [];
      for (const cardTx of cardTransactions) {
        const cardDate = cardTx.transactionDate.replace(/\//g, '-');
        const cardAmount = cardTx.amount;
        const perfectMatch = systemTransactions.find(sysTx => sysTx.transactionDate === cardDate && Math.abs(sysTx.amount - cardAmount) < 1);
        if (perfectMatch) continue;
        const dateMismatch = systemTransactions.find(sysTx => sysTx.transactionDate !== cardDate && Math.abs(sysTx.amount - cardAmount) < 1);
        if (dateMismatch) { newMismatches.push({ type:'date_mismatch', cardTransaction:cardTx, systemTransaction:dateMismatch }); continue; }
        const amountMismatch = systemTransactions.find(sysTx => sysTx.transactionDate === cardDate && Math.abs(sysTx.amount - cardAmount) >= 1);
        if (amountMismatch) { newMismatches.push({ type:'amount_mismatch', cardTransaction:cardTx, systemTransaction:amountMismatch }); continue; }
        newMismatches.push({ type:'not_registered', cardTransaction:cardTx });
        const userId = employeeIdToUserId[cardTx.employeeId];
        if (userId) {
          notificationsToCreate.push({ userId, type:'card_mismatch', title:'未登録の経費取引があります', message:`取引日: ${cardTx.transactionDate}, 金額: ${cardTx.amount.toLocaleString()}円, 加盟店: ${cardTx.merchantName}`, data:{ transactionDate:cardTx.transactionDate, amount:cardTx.amount, merchantName:cardTx.merchantName, mismatchType:'not_registered' }, read:false, createdAt:new Date() });
        }
      }
      for (const notification of notificationsToCreate) await addDoc(collection(db, 'notifications'), notification);
      setMismatches(newMismatches); setReconciled(true);
      alert(`突合完了\n不一致: ${newMismatches.length}件\n通知作成: ${notificationsToCreate.length}件`);
    } catch (error) { console.error('突合エラー:', error); alert('突合処理でエラーが発生しました'); }
    finally { setLoading(false); }
  };

  const getMismatchBadge = (type: string) => {
    const badges: { [key: string]: { label: string; bg: string; color: string; border: string } } = {
      not_registered: { label:'未登録', bg:'rgba(239,68,68,0.15)', color:'#fca5a5', border:'rgba(239,68,68,0.35)' },
      date_mismatch:  { label:'日付不一致', bg:'rgba(251,191,36,0.15)', color:'#fcd34d', border:'rgba(251,191,36,0.35)' },
      amount_mismatch:{ label:'金額不一致', bg:'rgba(251,146,60,0.15)', color:'#fdba74', border:'rgba(251,146,60,0.35)' }
    };
    const badge = badges[type] || badges.not_registered;
    return <span style={{ padding:'4px 12px', fontSize:'0.78rem', fontWeight:'700', borderRadius:'20px', background:badge.bg, color:badge.color, border:`1px solid ${badge.border}` }}>{badge.label}</span>;
  };

  return (
    <div style={dark}>
      <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>💳 カード請求突合</h1>
            <div style={{ display:'flex', gap:'0.6rem' }}>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
            </div>
          </div>
        </div>

        {/* CSVアップロード */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <h2 style={{ color:'white', fontSize:'1.1rem', fontWeight:'700', marginTop:0, marginBottom:'14px' }}>カード請求CSVをアップロード</h2>
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'13px', marginBottom:'6px' }}>💡 CSVファイル形式: TSV（タブ区切り）またはカンマ区切り</p>
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'13px', marginBottom:'16px' }}>必須列: 取引日付（列3）、金額 JPY（列37）、取引先（列13）、アカウント保有者の名前（列8,9）、従業員ID（列10）</p>
          <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload}
            style={{ display:'block', width:'100%', padding:'10px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'rgba(255,255,255,0.7)', cursor:'pointer', boxSizing:'border-box' }} />
          {cardTransactions.length > 0 && (
            <div style={{ marginTop:'14px', padding:'12px 16px', background:'rgba(79,172,254,0.12)', border:'1px solid rgba(79,172,254,0.3)', borderRadius:'8px', color:'#7dd3fc', fontWeight:'600' }}>
              ✅ {cardTransactions.length}件の取引を読み込みました
            </div>
          )}
        </div>

        {/* 突合実行ボタン */}
        {cardTransactions.length > 0 && !reconciled && (
          <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
            <div style={{ display:'flex', gap:'0.8rem' }}>
              <button onClick={handleReconcile} disabled={loading}
                style={{ padding:'12px 28px', background: loading?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color: loading?'rgba(255,255,255,0.4)':'white', border:'none', borderRadius:'8px', cursor: loading?'not-allowed':'pointer', fontWeight:'700', fontSize:'15px' }}>
                {loading ? '突合実行中...' : '🔍 突合を実行'}
              </button>
              <button onClick={() => { setCardTransactions([]); setMismatches([]); setReconciled(false); }} style={btnNav}>キャンセル</button>
            </div>
          </div>
        )}

        {/* 突合結果 */}
        {reconciled && (
          <div style={{ ...card, padding:'1.5rem 2rem' }}>
            <h2 style={{ fontSize:'1.1rem', fontWeight:'700', marginTop:0, marginBottom:'16px', color: mismatches.length===0?'#86efac':'#fca5a5' }}>
              {mismatches.length===0 ? '✅ 突合完了: 不一致なし' : `⚠️ 突合結果: ${mismatches.length}件の不一致`}
            </h2>
            {mismatches.length > 0 && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'rgba(255,255,255,0.05)' }}>
                      {['種類','取引日','金額','加盟店名','使用者','詳細'].map(h => (
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'0.75rem', fontWeight:'700', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mismatches.map((mismatch, index) => (
                      <tr key={index} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding:'10px 14px' }}>{getMismatchBadge(mismatch.type)}</td>
                        <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.8)', fontSize:'0.88rem' }}>{mismatch.cardTransaction.transactionDate}</td>
                        <td style={{ padding:'10px 14px', color:'white', fontWeight:'700', fontSize:'0.88rem' }}>¥{mismatch.cardTransaction.amount.toLocaleString()}</td>
                        <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.8)', fontSize:'0.88rem' }}>{mismatch.cardTransaction.merchantName}</td>
                        <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.7)', fontSize:'0.85rem' }}>
                          {mismatch.cardTransaction.accountHolderLastName} {mismatch.cardTransaction.accountHolderFirstName}
                          {mismatch.cardTransaction.employeeId && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.78rem' }}>ID: {mismatch.cardTransaction.employeeId}</div>}
                        </td>
                        <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.55)', fontSize:'0.82rem' }}>
                          {mismatch.systemTransaction && (
                            <div>
                              <div>システム: {mismatch.systemTransaction.transactionDate}</div>
                              <div>金額: ¥{mismatch.systemTransaction.amount.toLocaleString()}</div>
                              <div>加盟店: {mismatch.systemTransaction.merchantName}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default CardReconciliation;