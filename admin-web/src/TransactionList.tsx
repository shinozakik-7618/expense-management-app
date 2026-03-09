import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
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
  userId?: string;
  userName?: string;
}

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' as const };
const btnPrimary = { padding:'10px 18px', background:'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600' as const };
const btnDanger = { padding:'10px 18px', background:'rgba(239,68,68,0.15)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' as const };
const selectStyle = {
  padding:'8px 16px', borderRadius:'8px', cursor:'pointer', fontWeight:'600' as const, fontSize:'0.9rem',
  background:'rgba(255,255,255,0.08)', color:'white', border:'1px solid rgba(255,255,255,0.2)',
  outline:'none', minWidth:'180px'
};

export default function TransactionList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [userList, setUserList] = useState<{uid:string, name:string}[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchWord, setSearchWord] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => { loadTransactions(); }, []);
  useEffect(() => { setCurrentPage(1); }, [selectedMonth, selectedUser, selectedStatus, searchWord]);

  const loadTransactions = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const userInfo = await getUserInfo(currentUser.uid);
      if (userInfo) setUserRole(userInfo.role);
      const queryCondition = buildTransactionQuery(userInfo!);
      const transactionsRef = collection(db, 'transactions');
      let q;
      if (queryCondition.field && queryCondition.value) {
        q = query(transactionsRef, where(queryCondition.field, '==', queryCondition.value));
      } else {
        q = query(transactionsRef);
      }
      onSnapshot(q, async (snapshot) => {
        const txList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction)
          .sort((a, b) => {
            const dateA = a.transactionDate?.toDate() || new Date(0);
            const dateB = b.transactionDate?.toDate() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
        setTransactions(txList);
        // 使用者一覧（50音順）
        const userMap = new Map<string, string>();
        const usersSnap = await getDocs(collection(db, 'users')); const usersData = new Map(usersSnap.docs.map(d => [d.id, d.data().displayName || d.data().email || d.id])); txList.forEach(t => { if (t.userId) userMap.set(t.userId, usersData.get(t.userId) || '⚠️ 未登録ユーザー'); });
        const users = Array.from(userMap.entries())
          .map(([uid, name]) => ({ uid, name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setUserList(users);
        setLoading(false);
      });
    } catch (error) {
      console.error('取引一覧読み込みエラー:', error);
      setLoading(false);
    }
  };

  // フィルター適用
  const filteredTransactions = transactions.filter(tx => {
    if (selectedMonth !== 'all') {
      const date = tx.transactionDate?.toDate();
      if (!date) return false;
      const ym = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
      if (ym !== selectedMonth) return false;
    }
    if (selectedUser !== 'all' && tx.userId !== selectedUser) return false;
    if (selectedStatus !== 'all' && tx.status !== selectedStatus) return false;
    if (searchWord) {
      const word = searchWord.toLowerCase();
      const matchMerchant = (tx.merchantName || '').toLowerCase().includes(word);
      const matchMemo = (tx.memo || '').toLowerCase().includes(word);
      if (!matchMerchant && !matchMemo) return false;
    }
    return true;
  });

  // ページネーション
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const pagedTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // 月一覧（最新順）
  const monthList = Array.from(new Set(transactions.map(tx => {
    const date = tx.transactionDate?.toDate();
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  }).filter(Boolean))).sort().reverse() as string[];

  // 月ごとの件数（現在の使用者・ステータスフィルター考慮）
  const countByMonth = (ym: string) => transactions.filter(tx => {
    const d = tx.transactionDate?.toDate();
    if (!d) return false;
    const txYm = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const inUser = selectedUser === 'all' || tx.userId === selectedUser;
    const inStatus = selectedStatus === 'all' || tx.status === selectedStatus;
    return txYm === ym && inUser && inStatus;
  }).length;

  // 使用者ごとの件数（現在の月・ステータスフィルター考慮）
  const countByUser = (uid: string) => transactions.filter(tx => {
    const inMonth = selectedMonth === 'all' || (() => {
      const d = tx.transactionDate?.toDate();
      if (!d) return false;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === selectedMonth;
    })();
    const inStatus = selectedStatus === 'all' || tx.status === selectedStatus;
    return tx.userId === uid && inMonth && inStatus;
  }).length;

  // ステータス件数
  const countByStatus = (status: string) => transactions.filter(tx => {
    const inMonth = selectedMonth === 'all' || (() => {
      const d = tx.transactionDate?.toDate();
      if (!d) return false;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === selectedMonth;
    })();
    const inUser = selectedUser === 'all' || tx.userId === selectedUser;
    return inMonth && inUser && tx.status === status;
  }).length;

  // 全取引件数（月・使用者フィルター考慮）
  const countAll = transactions.filter(tx => {
    const inMonth = selectedMonth === 'all' || (() => {
      const d = tx.transactionDate?.toDate();
      if (!d) return false;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === selectedMonth;
    })();
    const inUser = selectedUser === 'all' || tx.userId === selectedUser;
    return inMonth && inUser;
  }).length;

  // CSVエクスポート
  const handleExport = () => {
    const headers = ['取引日','店舗名','金額','ステータス','メモ','使用者'];
    const statusLabel: {[k:string]:string} = { pending:'未処理', submitted:'申請中', rejected:'差戻し', approved:'承認済' };
    const rows = filteredTransactions.map(tx => [
      tx.transactionDate?.toDate().toLocaleDateString('ja-JP') || '',
      tx.merchantName || '',
      tx.amount || 0,
      statusLabel[tx.status] || tx.status,
      tx.memo || '',
      tx.userName || tx.userId || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `取引一覧_${selectedMonth !== 'all' ? selectedMonth : '全期間'}_${new Date().toLocaleDateString('ja-JP').replace(/\//g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/'); } catch (error) { console.error('ログアウトエラー:', error); }
  };

  // チェックボックス操作
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(tx => tx.id)));
    }
  };

  // 一括ステータス更新
  const handleBulkUpdate = async (status: string) => {
    if (selectedIds.size === 0) { alert('取引を選択してください'); return; }
    const statusLabel: {[k:string]:string} = { approved:'承認済', rejected:'差戻し', pending:'未処理' };
    if (!confirm(`選択した${selectedIds.size}件を「${statusLabel[status]}」に変更しますか？`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'transactions', id), { status, updatedAt: new Date() });
      });
      await batch.commit();
      setSelectedIds(new Set());
      alert(`✅ ${selectedIds.size}件を${statusLabel[status]}に変更しました`);
    } catch (error) {
      console.error('一括更新エラー:', error);
      alert('更新に失敗しました');
    }
  };

  const handleDelete = async (transactionId: string, status: string, userId: string) => {
    const isAdmin = userRole === 'admin';
    const isOwner = auth.currentUser?.uid === userId;
    const isPending = status === 'pending';

    if (!isAdmin && !isPending) {
      alert('未処理以外の取引は管理者のみ削除できます');
      return;
    }
    if (!isAdmin && !isOwner) {
      alert('他のユーザーの取引は削除できません');
      return;
    }
    if (!confirm('この取引を削除しますか？')) return;
    try { await deleteDoc(doc(db, 'transactions', transactionId)); alert('削除しました'); }
    catch (error) { console.error('削除エラー:', error); alert('削除に失敗しました'); }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { gradient: string; label: string } } = {
      pending:   { gradient:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', label:'未処理' },
      submitted: { gradient:'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)', label:'申請中' },
      rejected:  { gradient:'linear-gradient(135deg,#fa709a 0%,#fee140 100%)', label:'差戻し' },
      approved:  { gradient:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)', label:'承認済' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span style={{ padding:'5px 14px', fontSize:'0.8rem', fontWeight:'700', borderRadius:'20px', background:badge.gradient, color:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
        {badge.label}
      </span>
    );
  };

  const btnFilter = (active: boolean) => ({
    padding:'8px 16px', borderRadius:'20px', cursor:'pointer', fontWeight:'600' as const, fontSize:'0.85rem',
    background: active ? 'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)' : 'rgba(255,255,255,0.08)',
    color: active ? 'white' : 'rgba(255,255,255,0.7)',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.15)'
  });

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
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>📝 取引一覧</h1>
            <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/reconciliation/card')} style={btnNav}>💳 カード請求突合</button>
              <button onClick={() => navigate('/unreported')} style={btnNav}>📋 未報告取引</button>
              <button onClick={() => navigate('/transactions/import')} style={btnNav}>📥 CSVインポート</button>
              <button onClick={() => navigate('/transactions/new')} style={btnPrimary}>➕ 新規登録</button>
              <button onClick={handleLogout} style={btnDanger}>🔓 ログアウト</button>
            </div>
          </div>
        </div>

        {/* フィルターパネル */}
        <div style={{ ...card, padding:'1.2rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', alignItems:'flex-end' }}>

            {/* 取引月プルダウン */}
            <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.4rem' }}>
              <label style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.78rem', fontWeight:'600', letterSpacing:'0.05em' }}>📅 取引月</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={selectStyle}>
                <option value="all">全期間（{transactions.length}件）</option>
                {monthList.map(m => {
                  const [y, mo] = m.split('-');
                  return (
                    <option key={m} value={m}>
                      {y}年{parseInt(mo)}月（{countByMonth(m)}件）
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 使用者プルダウン */}
            <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.4rem' }}>
              <label style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.78rem', fontWeight:'600', letterSpacing:'0.05em' }}>👤 使用者</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={selectStyle}>
                <option value="all">全員（{transactions.filter(tx => {
                  const inMonth = selectedMonth === 'all' || (() => { const d = tx.transactionDate?.toDate(); if(!d) return false; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === selectedMonth; })();
                  const inStatus = selectedStatus === 'all' || tx.status === selectedStatus;
                  return inMonth && inStatus;
                }).length}件）</option>
                {userList.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.name}（{countByUser(u.uid)}件）
                  </option>
                ))}
              </select>
            </div>

            {/* ステータスボタン */}
            <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.4rem' }}>
              <label style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.78rem', fontWeight:'600', letterSpacing:'0.05em' }}>🔖 ステータス</label>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                <button onClick={() => setSelectedStatus('all')} style={btnFilter(selectedStatus==='all')}>全て（{countAll}件）</button>
                <button onClick={() => setSelectedStatus('approved')} style={btnFilter(selectedStatus==='approved')}>✅ 承認済（{countByStatus('approved')}件）</button>
                <button onClick={() => setSelectedStatus('pending')} style={btnFilter(selectedStatus==='pending')}>⏳ 未処理（{countByStatus('pending')}件）</button>
                <button onClick={() => setSelectedStatus('rejected')} style={btnFilter(selectedStatus==='rejected')}>⚠️ 差戻し（{countByStatus('rejected')}件）</button>
                <button onClick={() => setSelectedStatus('submitted')} style={btnFilter(selectedStatus==='submitted')}>📤 申請中（{countByStatus('submitted')}件）</button>
              </div>
            </div>

            {/* フリーワード検索 */}
            <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.4rem' }}>
              <label style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.78rem', fontWeight:'600', letterSpacing:'0.05em' }}>🔍 フリーワード検索</label>
              <input
                type='text'
                value={searchWord}
                onChange={e => setSearchWord(e.target.value)}
                placeholder='店舗名・メモで検索...'
                style={{ padding:'8px 16px', borderRadius:'8px', cursor:'text', fontWeight:'600', fontSize:'0.9rem', background:'rgba(255,255,255,0.08)', color:'white', border:'1px solid rgba(255,255,255,0.2)', outline:'none', minWidth:'220px' }}
              />
            </div>

          </div>
        </div>

        {/* 取引一覧テーブル */}
        <div style={{ ...card, padding:'1.5rem 2rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem' }}>
            <h2 style={{ fontSize:'1.25rem', fontWeight:'700', color:'white', margin:0 }}>
              表示中（{filteredTransactions.length}件）
            </h2>
<div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
              {selectedIds.size > 0 && (
                <>
                  <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.85rem' }}>{selectedIds.size}件選択中</span>
                  <button onClick={() => handleBulkUpdate('approved')} style={{ padding:'8px 14px', background:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'0.85rem' }}>✅ 一括承認</button>
                  <button onClick={() => handleBulkUpdate('rejected')} style={{ padding:'8px 14px', background:'linear-gradient(135deg,#fa709a 0%,#fee140 100%)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'0.85rem' }}>⚠️ 一括差戻し</button>
                  <button onClick={() => handleBulkUpdate('pending')} style={{ padding:'8px 14px', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'0.85rem' }}>↩️ 未処理に戻す</button>
                  <button onClick={() => setSelectedIds(new Set())} style={{ padding:'8px 14px', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', cursor:'pointer', fontSize:'0.85rem' }}>✕ 選択解除</button>
                </>
              )}
              <button onClick={handleExport} style={{ ...btnPrimary, padding:'8px 16px', fontSize:'0.85rem' }}>
                📤 CSVエクスポート
              </button>
            </div>
          </div>
          {filteredTransactions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'rgba(255,255,255,0.4)', fontSize:'1.1rem' }}>📭 取引データがありません</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.05)' }}>
                    {['','取引日','店舗（会社）名','金額','領収書','ステータス','操作'].map(h => (
                      <th key={h} style={{ padding:'0.9rem 1rem', textAlign: h==='金額' ? 'right' : h==='操作'||h==='領収書'||h==='ステータス'||h==='' ? 'center' : 'left', fontSize:'0.75rem', fontWeight:'700', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h==='' ? <input type='checkbox' onChange={toggleSelectAll} checked={selectedIds.size===filteredTransactions.length && filteredTransactions.length>0} style={{ cursor:'pointer', width:'16px', height:'16px' }} /> : h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedTransactions.map((tx) => (
                    <tr key={tx.id}
                      style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', transition:'background 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}><input type='checkbox' checked={selectedIds.has(tx.id)} onChange={() => toggleSelect(tx.id)} style={{ cursor:'pointer', width:'16px', height:'16px' }} /></td>
                      <td style={{ padding:'0.9rem 1rem', color:'rgba(255,255,255,0.7)', fontSize:'0.9rem' }}>
                        {tx.transactionDate?.toDate().toLocaleDateString('ja-JP')}
                      </td>
                      <td style={{ padding:'0.9rem 1rem', color:'white', fontWeight:'600' }}>{tx.merchantName}</td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'right', color:'white', fontWeight:'700' }}>¥{tx.amount.toLocaleString()}</td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}>
                        <span style={{ padding:'3px 10px', background: tx.receiptCount > 0 ? 'rgba(79,172,254,0.2)' : 'rgba(255,255,255,0.06)', color: tx.receiptCount > 0 ? '#7dd3fc' : 'rgba(255,255,255,0.35)', border: tx.receiptCount > 0 ? '1px solid rgba(79,172,254,0.4)' : '1px solid rgba(255,255,255,0.1)', borderRadius:'10px', fontSize:'0.82rem', fontWeight:'600' }}>
                          {tx.receiptCount > 0 ? `📎 ${tx.receiptCount}` : '－'}
                        </span>
                      </td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}>{getStatusBadge(tx.status)}</td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:'0.4rem', justifyContent:'center' }}>
                          <button onClick={() => navigate(`/transactions/${tx.id}`)} style={{ padding:'6px 12px', background:'rgba(124,92,191,0.3)', color:'#c4b5fd', border:'1px solid rgba(124,92,191,0.5)', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'0.8rem' }}>👁️ 詳細</button>
                          <button onClick={() => navigate(`/transactions/${tx.id}/edit`)} style={{ padding:'6px 12px', background:'rgba(240,147,251,0.2)', color:'#f0abfc', border:'1px solid rgba(240,147,251,0.4)', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'0.8rem' }}>✏️ 編集</button>
                          {(userRole === 'admin' || (auth.currentUser?.uid === tx.userId && tx.status === 'pending')) && (
                            <button onClick={() => handleDelete(tx.id, tx.status, tx.userId || '')} style={{ padding:'6px 12px', background:'rgba(239,68,68,0.15)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'0.8rem' }}>🗑️ 削除</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* ページネーション */}
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'0.6rem', marginTop:'1.5rem', flexWrap:'wrap' }}>
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding:'6px 12px', background: currentPage===1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)', color: currentPage===1 ? 'rgba(255,255,255,0.3)' : 'white', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'6px', cursor: currentPage===1 ? 'default' : 'pointer', fontWeight:'600' }}>«</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} style={{ padding:'6px 12px', background: currentPage===1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)', color: currentPage===1 ? 'rgba(255,255,255,0.3)' : 'white', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'6px', cursor: currentPage===1 ? 'default' : 'pointer', fontWeight:'600' }}>‹ 前へ</button>
              <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.9rem', padding:'0 0.5rem' }}>{currentPage} / {totalPages} ページ（全{filteredTransactions.length}件）</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} style={{ padding:'6px 12px', background: currentPage===totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)', color: currentPage===totalPages ? 'rgba(255,255,255,0.3)' : 'white', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'6px', cursor: currentPage===totalPages ? 'default' : 'pointer', fontWeight:'600' }}>次へ ›</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding:'6px 12px', background: currentPage===totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)', color: currentPage===totalPages ? 'rgba(255,255,255,0.3)' : 'white', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'6px', cursor: currentPage===totalPages ? 'default' : 'pointer', fontWeight:'600' }}>»</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
