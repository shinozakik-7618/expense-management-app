import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getUserInfo } from './utils/userPermissions';

interface TxRow { id:string; userId:string; merchantName:string; amount:number; status:string; categoryId:string; transactionDate:any; memo:string; }
interface UserStat { uid:string; name:string; amount:number; count:number; approved:number; pending:number; rejected:number; }
interface CatStat  { name:string; amount:number; count:number; }

const card:React.CSSProperties = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btn:React.CSSProperties  = { padding:'9px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'0.88rem' };

export default function MonthlyReport() {
  const navigate = useNavigate();
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [loading, setLoading] = useState(true);
  const [scopeLabel, setScopeLabel] = useState('');
  const [total, setTotal]   = useState(0);
  const [count, setCount]   = useState(0);
  const [statusMap, setStatusMap] = useState<Record<string,number>>({});
  const [userStats, setUserStats]  = useState<UserStat[]>([]);
  const [catStats,  setCatStats]   = useState<CatStat[]>([]);
  const [txRows,    setTxRows]     = useState<TxRow[]>([]);
  const [catMap,    setCatMap]     = useState<Map<string,string>>(new Map());
  const [modalUser, setModalUser]  = useState<UserStat|null>(null);
  const [modalCats, setModalCats]  = useState<CatStat[]>([]);

  useEffect(() => { load(); }, [ym]);

  const load = async () => {
    setLoading(true);
    const cu = auth.currentUser;
    if (!cu) { navigate('/login'); return; }
    const info = await getUserInfo(cu.uid);
    const role = info?.role || 'user';
    const isManager = ['admin','block_manager','region_manager','base_manager'].includes(role);
    if (!isManager) { navigate('/dashboard'); return; }

    // スコープラベル設定
    if (role === 'admin') setScopeLabel('全社');
    else if (role === 'block_manager') setScopeLabel(`${info?.blockId || ''}ブロック`);
    else if (role === 'region_manager') setScopeLabel(`${info?.regionId || ''}地域`);
    else if (role === 'base_manager')   setScopeLabel(`${info?.baseId || ''}拠点`);

    // ロール別ユーザーフィルタ
    let allowedUids: Set<string> | null = null;
    if (role !== 'admin') {
      let filterField = '';
      let filterValue = '';
      if (role === 'block_manager'  && info?.blockId)  { filterField = 'blockId';  filterValue = info.blockId; }
      if (role === 'region_manager' && info?.regionId) { filterField = 'regionId'; filterValue = info.regionId; }
      if (role === 'base_manager'   && info?.regionId) { filterField = 'regionId'; filterValue = info.regionId; }
      if (filterField) {
        const uSnap = await getDocs(query(collection(db, 'users'), where(filterField, '==', filterValue)));
        allowedUids = new Set(uSnap.docs.map(d => d.id));
      }
    }

    // カテゴリマップ
    const catsSnap = await getDocs(collection(db, 'categories'));
    const cm = new Map(catsSnap.docs.map(d => [d.id, d.data().name || d.id]));
    setCatMap(cm);

    // ユーザーマップ
    const usersSnap = await getDocs(collection(db, 'users'));
    const userMap = new Map(usersSnap.docs.map(d => [d.id, d.data().displayName || d.data().email || d.id]));

    // 全取引取得
    const allSnap = await getDocs(collection(db, 'transactions'));
    const all = allSnap.docs.map(d => ({ id:d.id, ...d.data() })) as TxRow[];

    // 対象月 & ロールフィルター
    const rows = all.filter(tx => {
      if (allowedUids && !allowedUids.has(tx.userId)) return false;
      const d = tx.transactionDate?.toDate ? tx.transactionDate.toDate() : null;
      if (!d) return false;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === ym;
    });
    setTxRows(rows);
    setTotal(rows.reduce((s,r) => s+(r.amount||0), 0));
    setCount(rows.length);

    // ステータス別
    const sm: Record<string,number> = { pending:0, submitted:0, rejected:0, approved:0 };
    rows.forEach(r => { const s = r.status||'pending'; if(s in sm) sm[s]++; });
    setStatusMap(sm);

    // ユーザー別
    const um = new Map<string,UserStat>();
    rows.forEach(r => {
      if (!r.userId) return;
      const name = String(userMap.get(r.userId)||'未登録');
      const cur = um.get(r.userId)||{ uid:r.userId, name, amount:0, count:0, approved:0, pending:0, rejected:0 };
      cur.amount += r.amount||0; cur.count++;
      if (r.status==='approved') cur.approved++;
      else if (r.status==='rejected') cur.rejected++;
      else cur.pending++;
      um.set(r.userId, cur);
    });
    setUserStats(Array.from(um.values()).sort((a,b)=>b.amount-a.amount));

    // カテゴリ別
    const cMap = new Map<string,CatStat>();
    rows.forEach(r => {
      const cid = r.categoryId||'other';
      const cname = String(cm.get(cid)||'その他');
      const cur = cMap.get(cid)||{ name:cname, amount:0, count:0 };
      cur.amount += r.amount||0; cur.count++;
      cMap.set(cid, cur);
    });
    setCatStats(Array.from(cMap.values()).sort((a,b)=>b.amount-a.amount));
    setLoading(false);
  };

  const changeMonth = (delta:number) => {
    const [y,m] = ym.split('-').map(Number);
    const d = new Date(y, m-1+delta, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const handleCSV = () => {
    const header = '取引ID,取引日,加盟店名,金額,ステータス,メモ';
    const rows2 = txRows.map(r => {
      const d = r.transactionDate?.toDate ? r.transactionDate.toDate().toLocaleDateString('ja-JP') : '';
      const status = { pending:'未処理', submitted:'申請中', rejected:'差戻し', approved:'承認済' }[r.status]||r.status;
      return [r.id, d, `"${r.merchantName||''}"`, r.amount, status, `"${r.memo||''}"`].join(',');
    });
    const csv = [header, ...rows2].join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`report_${ym}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // 分析モーダルを開く
  const openModal = (u: UserStat) => {
    const userTxRows = txRows.filter(r => r.userId === u.uid);
    const cMap = new Map<string,CatStat>();
    userTxRows.forEach(r => {
      const cid = r.categoryId||'other';
      const cname = String(catMap.get(cid)||'その他');
      const cur = cMap.get(cid)||{ name:cname, amount:0, count:0 };
      cur.amount += r.amount||0; cur.count++;
      cMap.set(cid, cur);
    });
    setModalCats(Array.from(cMap.values()).sort((a,b)=>b.amount-a.amount));
    setModalUser(u);
  };

  const statusLabels: Record<string,{label:string;color:string}> = {
    pending:  { label:'未処理', color:'#a78bfa' },
    submitted:{ label:'申請中', color:'#fbbf24' },
    rejected: { label:'差戻し', color:'#f87171' },
    approved: { label:'承認済', color:'#34d399' },
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e,#2d2b55)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  const [year, month] = ym.split('-');
  const modalTotal = modalCats.reduce((s,c)=>s+c.amount,0);

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e,#2d2b55)', padding:'2rem' }}>
      <div style={{ maxWidth:'960px', margin:'0 auto' }}>

        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <h1 style={{ fontSize:'1.8rem', fontWeight:'800', color:'white', margin:0 }}>📊 月次レポート</h1>
              {scopeLabel && <span style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.5)', marginTop:'4px', display:'block' }}>表示範囲: {scopeLabel}</span>}
            </div>
            <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
              <button onClick={()=>navigate('/dashboard')} style={btn}>📋 ダッシュボード</button>
              <button onClick={()=>navigate('/transactions')} style={btn}>📝 取引一覧</button>
            </div>
          </div>
        </div>

        {/* 月選択 */}
        <div style={{ ...card, padding:'1.2rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
              <button onClick={()=>changeMonth(-1)} style={{ ...btn, padding:'8px 16px', fontSize:'1.2rem' }}>‹</button>
              <span style={{ fontSize:'1.6rem', fontWeight:'800', color:'white' }}>{year}年{month}月</span>
              <button onClick={()=>changeMonth(1)} style={{ ...btn, padding:'8px 16px', fontSize:'1.2rem' }}>›</button>
            </div>
            <button onClick={handleCSV} style={{ ...btn, background:'linear-gradient(135deg,#43e97b,#38f9d7)', color:'#0f2027', border:'none', fontWeight:'700' }}>
              📥 CSV出力
            </button>
          </div>
        </div>

        {/* サマリーカード */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
          <div style={{ ...card, padding:'1.4rem', textAlign:'center' }}>
            <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.55)', marginBottom:'8px' }}>合計金額</div>
            <div style={{ fontSize:'1.8rem', fontWeight:'800', color:'#c4b5fd' }}>¥{total.toLocaleString()}</div>
          </div>
          <div style={{ ...card, padding:'1.4rem', textAlign:'center' }}>
            <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.55)', marginBottom:'8px' }}>取引件数</div>
            <div style={{ fontSize:'1.8rem', fontWeight:'800', color:'#93c5fd' }}>{count}件</div>
          </div>
          {Object.entries(statusLabels).map(([k,v]) => (
            <div key={k} style={{ ...card, padding:'1.4rem', textAlign:'center' }}>
              <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.55)', marginBottom:'8px' }}>{v.label}</div>
              <div style={{ fontSize:'1.8rem', fontWeight:'800', color:v.color }}>{statusMap[k]||0}件</div>
            </div>
          ))}
        </div>

        {/* ユーザー別集計 */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <h2 style={{ fontSize:'1.2rem', fontWeight:'700', color:'white', marginBottom:'1rem' }}>👤 ユーザー別集計</h2>
          {userStats.length === 0 ? (
            <div style={{ color:'rgba(255,255,255,0.4)', textAlign:'center', padding:'2rem' }}>該当データなし</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.9rem' }}>
                <thead>
                  <tr>
                    {['使用者','合計金額','件数','承認済','申請中/未処理','差戻し',''].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', color:'rgba(255,255,255,0.5)', fontWeight:'600', borderBottom:'1px solid rgba(255,255,255,0.1)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userStats.map((u,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding:'10px 12px', color:'white', fontWeight:'600' }}>{u.name}</td>
                      <td style={{ padding:'10px 12px', color:'#c4b5fd', fontWeight:'700' }}>¥{u.amount.toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:'rgba(255,255,255,0.7)' }}>{u.count}件</td>
                      <td style={{ padding:'10px 12px', color:'#34d399' }}>{u.approved}件</td>
                      <td style={{ padding:'10px 12px', color:'#fbbf24' }}>{u.pending}件</td>
                      <td style={{ padding:'10px 12px', color:'#f87171' }}>{u.rejected}件</td>
                      <td style={{ padding:'10px 12px' }}>
                        <button onClick={()=>openModal(u)} style={{ padding:'5px 14px', fontSize:'0.8rem', fontWeight:'700', color:'white', background:'linear-gradient(135deg,#667eea,#764ba2)', border:'none', borderRadius:'6px', cursor:'pointer' }}>🔍 分析</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* カテゴリ別集計 */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <h2 style={{ fontSize:'1.2rem', fontWeight:'700', color:'white', marginBottom:'1rem' }}>🏷️ カテゴリ別集計（全体）</h2>
          {catStats.length === 0 ? (
            <div style={{ color:'rgba(255,255,255,0.4)', textAlign:'center', padding:'2rem' }}>該当データなし</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {catStats.map((c,i) => {
                const pct = total > 0 ? Math.round(c.amount/total*100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ color:'white', fontWeight:'600' }}>{c.name}</span>
                      <span style={{ color:'#c4b5fd', fontWeight:'700' }}>¥{c.amount.toLocaleString()} <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.85rem' }}>({pct}% / {c.count}件)</span></span>
                    </div>
                    <div style={{ height:'8px', background:'rgba(255,255,255,0.08)', borderRadius:'4px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#a855f7,#ec4899)', borderRadius:'4px', transition:'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ユーザー分析モーダル */}
      {modalUser && (
        <div onClick={()=>setModalUser(null)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
          <div onClick={e=>e.stopPropagation()} style={{ ...card, padding:'2rem', width:'100%', maxWidth:'560px', maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem' }}>
              <div>
                <h2 style={{ color:'white', fontWeight:'800', fontSize:'1.2rem', margin:0 }}>🔍 {modalUser.name} の分析</h2>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', marginTop:'4px' }}>{ym.replace('-','年')}月 ／ 合計 ¥{modalUser.amount.toLocaleString()}（{modalUser.count}件）</div>
              </div>
              <button onClick={()=>setModalUser(null)} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'white', borderRadius:'50%', width:'32px', height:'32px', cursor:'pointer', fontSize:'1.1rem' }}>×</button>
            </div>

            {/* ステータス内訳 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'1.4rem' }}>
              <div style={{ background:'rgba(52,211,153,0.1)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                <div style={{ fontSize:'0.75rem', color:'#34d399' }}>承認済</div>
                <div style={{ fontSize:'1.3rem', fontWeight:'800', color:'#34d399' }}>{modalUser.approved}件</div>
              </div>
              <div style={{ background:'rgba(251,191,36,0.1)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                <div style={{ fontSize:'0.75rem', color:'#fbbf24' }}>申請中/未処理</div>
                <div style={{ fontSize:'1.3rem', fontWeight:'800', color:'#fbbf24' }}>{modalUser.pending}件</div>
              </div>
              <div style={{ background:'rgba(248,113,113,0.1)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                <div style={{ fontSize:'0.75rem', color:'#f87171' }}>差戻し</div>
                <div style={{ fontSize:'1.3rem', fontWeight:'800', color:'#f87171' }}>{modalUser.rejected}件</div>
              </div>
            </div>

            {/* カテゴリ別内訳 */}
            <h3 style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.95rem', fontWeight:'700', marginBottom:'0.8rem' }}>🏷️ カテゴリ別内訳</h3>
            {modalCats.length === 0 ? (
              <div style={{ color:'rgba(255,255,255,0.4)', textAlign:'center', padding:'1rem' }}>データなし</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {modalCats.map((c,i) => {
                  const pct = modalTotal > 0 ? Math.round(c.amount/modalTotal*100) : 0;
                  const colors = ['#a855f7','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6'];
                  const color = colors[i % colors.length];
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                        <span style={{ color:'white', fontWeight:'600', fontSize:'0.9rem' }}>{c.name}</span>
                        <span style={{ fontWeight:'700', fontSize:'0.9rem', color }}>¥{c.amount.toLocaleString()} <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.8rem' }}>({pct}% / {c.count}件)</span></span>
                      </div>
                      <div style={{ height:'7px', background:'rgba(255,255,255,0.08)', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:'4px', transition:'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
