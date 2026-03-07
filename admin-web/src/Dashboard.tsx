import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface Stats { pending: number; submitted: number; rejected: number; approved: number; }
interface RecentTransaction { id: string; transactionDate: string; amount: number; merchantName: string; status: string; }
interface UserStat { name: string; amount: number; count: number; pendingCount: number; }
interface CategoryStat { name: string; amount: number; count: number; }

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ pending: 0, submitted: 0, rejected: 0, approved: 0 });
  const [allStats, setAllStats] = useState<Stats>({ pending: 0, submitted: 0, rejected: 0, approved: 0 });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [thisMonthTotal, setThisMonthTotal] = useState<number>(0);
  const [lastMonthTotal, setLastMonthTotal] = useState<number>(0);
  const [thisMonthCount, setThisMonthCount] = useState<number>(0);
  const [lastMonthCount, setLastMonthCount] = useState<number>(0);

  useEffect(() => { loadDashboardData(); }, []);

  const formatDate = (date: any): string => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate().toISOString().split('T')[0];
    return String(date);
  };

  const loadDashboardData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) { navigate('/login'); return; }
    try {
      const userQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
      const userSnapshot = await getDocs(userQuery);
      let role = 'user';
      setUserName(currentUser.email || '');
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        role = userData.role || 'user';
        setUserRole(role);
        setUserName(userData.displayName || currentUser.email || currentUser.uid);
      }

      // 自分の取引
      const myQuery = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid));
      const mySnapshot = await getDocs(myQuery);
      const myStats: Stats = { pending: 0, submitted: 0, rejected: 0, approved: 0 };
      const myTxList: RecentTransaction[] = [];
      mySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'pending';
        if (status in myStats) myStats[status as keyof Stats]++;
        myTxList.push({ id: doc.id, transactionDate: formatDate(data.transactionDate), amount: data.amount || 0, merchantName: data.merchantName || '', status });
      });
      myTxList.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      setStats(myStats);
      setRecentTransactions(myTxList.slice(0, 5));

      // 管理者・マネージャー向け全体集計
      if (['admin','block_manager','region_manager','base_manager'].includes(role)) {
        const allSnapshot = await getDocs(collection(db, 'transactions'));
        const allTxList = allSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // 全体ステータス集計
        const aStats: Stats = { pending: 0, submitted: 0, rejected: 0, approved: 0 };
        allTxList.forEach(tx => { const s = tx.status || 'pending'; if (s in aStats) aStats[s as keyof Stats]++; });
        setAllStats(aStats);

        // 月別集計
        const now = new Date();
        const thisYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const lastDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const lastYM = `${lastDate.getFullYear()}-${String(lastDate.getMonth()+1).padStart(2,'0')}`;
        let tTotal = 0, tCount = 0, lTotal = 0, lCount = 0;
        allTxList.forEach(tx => {
          const d = tx.transactionDate?.toDate ? tx.transactionDate.toDate() : null;
          if (!d) return;
          const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          if (ym === thisYM) { tTotal += tx.amount||0; tCount++; }
          if (ym === lastYM) { lTotal += tx.amount||0; lCount++; }
        });
        setThisMonthTotal(tTotal); setThisMonthCount(tCount);
        setLastMonthTotal(lTotal); setLastMonthCount(lCount);

        // ユーザー別集計
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap = new Map(usersSnap.docs.map(d => [d.id, d.data().displayName || d.data().email || d.id]));
        const uMap = new Map<string, UserStat>();
        allTxList.forEach(tx => {
          if (!tx.userId) return;
          const name = String(userMap.get(tx.userId) || '⚠️ 未登録');
          const cur = uMap.get(tx.userId) || { name, amount: 0, count: 0, pendingCount: 0 };
          cur.amount += tx.amount || 0;
          cur.count++;
          if (tx.status === 'pending' || tx.status === 'submitted') cur.pendingCount++;
          uMap.set(tx.userId, cur);
        });
        const uList = Array.from(uMap.values()).sort((a,b) => b.amount - a.amount).slice(0, 10);
        setUserStats(uList);

        // カテゴリ別集計
        const catsSnap = await getDocs(collection(db, 'categories'));
        const catMap = new Map(catsSnap.docs.map(d => [d.id, d.data().name || d.id]));
        const cMap = new Map<string, CategoryStat>();
        allTxList.forEach(tx => {
          const catId = tx.categoryId || 'other';
          const catName = String(catMap.get(catId) || 'その他');
          const cur = cMap.get(catId) || { name: catName, amount: 0, count: 0 };
          cur.amount += tx.amount || 0;
          cur.count++;
          cMap.set(catId, cur);
        });
        const cList = Array.from(cMap.values()).sort((a,b) => b.amount - a.amount);
        setCategoryStats(cList);
      }

      const notifQuery = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('read', '==', false));
      setUnreadNotifications((await getDocs(notifQuery)).size);
    } catch (error) { console.error('データ読み込みエラー:', error); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/login'); } catch (error) { console.error(error); }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; bg: string; color: string } } = {
      pending:   { label: '未処理', bg: 'rgba(168,85,247,0.2)',  color: '#c084fc' },
      submitted: { label: '申請中', bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24' },
      rejected:  { label: '差戻し', bg: 'rgba(248,113,113,0.2)', color: '#f87171' },
      approved:  { label: '承認済', bg: 'rgba(52,211,153,0.2)',  color: '#34d399' },
    };
    const b = badges[status] || { label: status, bg: 'rgba(255,255,255,0.1)', color: '#fff' };
    return <span style={{ display: 'inline-block', padding: '4px 14px', fontSize: '0.78rem', fontWeight: '600', borderRadius: '20px', background: b.bg, color: b.color, border: `1px solid ${b.color}40` }}>{b.label}</span>;
  };

  const getRoleBadge = (role: string) => {
    const labels: { [key: string]: string } = { admin: '管理者', block_manager: 'ブロック・部署長', region_manager: '地域代表', base_manager: '経営管理・管理責任者', user: '一般ユーザー' };
    return <span style={{ display: 'inline-block', padding: '3px 12px', fontSize: '0.75rem', fontWeight: '600', borderRadius: '20px', background: 'rgba(168,85,247,0.25)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.4)' }}>{labels[role] || role}</span>;
  };

  const isManager = ['admin','block_manager','region_manager','base_manager'].includes(userRole);
  const nb: React.CSSProperties = { padding: '9px 18px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.88rem', transition: 'all 0.2s ease', whiteSpace: 'nowrap' as const };
  const cardStyle = { background:'rgba(255,255,255,0.06)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px' };
  const statCards = [
    { label: '未処理', value: isManager ? allStats.pending : stats.pending,   icon: '📋', accent: '#a855f7' },
    { label: '申請中', value: isManager ? allStats.submitted : stats.submitted, icon: '⏳', accent: '#fbbf24' },
    { label: '差戻し', value: isManager ? allStats.rejected : stats.rejected,   icon: '↩️', accent: '#f87171' },
    { label: '承認済', value: isManager ? allStats.approved : stats.approved,   icon: '✅', accent: '#34d399' },
  ];
  const totalCategoryAmount = categoryStats.reduce((s,c) => s+c.amount, 0);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #2d2b55 100%)', color: 'rgba(255,255,255,0.8)', fontSize: '1.2rem' }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #2d2b55 100%)', padding: '1.5rem 2rem', fontFamily: "'Segoe UI','Hiragino Sans','Yu Gothic',sans-serif" }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ ...cardStyle, padding: '1.4rem 2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c5cbf 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💳</div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>ダッシュボード</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '52px' }}>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem' }}>ようこそ、{userName}さん</span>
              {getRoleBadge(userRole)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const }}>
            <button onClick={() => navigate('/transactions/new')} style={{ ...nb, background: 'linear-gradient(135deg, #7c5cbf 0%, #a855f7 60%, #ec4899 100%)', border: 'none', color: '#fff', fontWeight: '600', boxShadow: '0 4px 16px rgba(168,85,247,0.35)' }}>＋ 新規取引</button>
            {[{l:'📌 用途管理',p:'/purpose-master'},{l:'📋 未報告',p:'/unreported'},{l:'📝 取引一覧',p:'/transactions'}].map(({l,p})=>(
              <button key={p} onClick={()=>navigate(p)} style={nb}>{l}</button>
            ))}
            {isManager&&<button onClick={()=>navigate('/monthly-report')} style={nb}>📊 月次レポート</button>}
              <button onClick={()=>navigate('/notifications')} style={{...nb,position:'relative'}}>
              🔔 通知
              {unreadNotifications>0&&<span style={{position:'absolute',top:'-7px',right:'-7px',background:'linear-gradient(135deg,#a855f7,#ec4899)',color:'#fff',fontSize:'0.68rem',fontWeight:'700',borderRadius:'50%',width:'20px',height:'20px',display:'flex',alignItems:'center',justifyContent:'center'}}>{unreadNotifications}</span>}
            </button>
            {userRole==='admin'&&<button onClick={()=>navigate('/user-management')} style={nb}>👥 ユーザー管理</button>}
            <button onClick={() => navigate('/manual')} style={nb}>📖 マニュアル</button>
            <button onClick={handleLogout} style={{...nb,background:'rgba(248,113,113,0.15)',border:'1px solid rgba(248,113,113,0.3)',color:'#fca5a5'}}>🔓 ログアウト</button>
          </div>
        </div>

        {/* 統計カード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {statCards.map(({label,value,icon,accent})=>(
            <div key={label} onClick={() => navigate('/transactions')} style={{ ...cardStyle, borderLeft:`3px solid ${accent}`, padding:'1.6rem 1.8rem', position:'relative', overflow:'hidden', cursor:'pointer' }}>
              <div style={{ position:'absolute', top:'-10px', right:'-10px', fontSize:'5rem', opacity:0.06, lineHeight:1 }}>{icon}</div>
              <p style={{ margin:'0 0 0.5rem 0', fontSize:'0.78rem', fontWeight:'600', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'1px' }}>{label}{isManager ? '（全体）' : ''}</p>
              <p style={{ margin:0, fontSize:'2.8rem', fontWeight:'800', color:accent, lineHeight:1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* 管理者向けサマリー */}
        {isManager && (
          <>
            {/* 月別推移 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
              <div style={{ ...cardStyle, padding:'1.5rem 2rem' }}>
                <p style={{ margin:'0 0 0.5rem', fontSize:'0.78rem', fontWeight:'600', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'1px' }}>📅 今月の合計</p>
                <p style={{ margin:'0 0 4px', fontSize:'2rem', fontWeight:'800', color:'#c4b5fd' }}>¥{thisMonthTotal.toLocaleString()}</p>
                <p style={{ margin:0, fontSize:'0.85rem', color:'rgba(255,255,255,0.45)' }}>{thisMonthCount}件</p>
              </div>
              <div style={{ ...cardStyle, padding:'1.5rem 2rem' }}>
                <p style={{ margin:'0 0 0.5rem', fontSize:'0.78rem', fontWeight:'600', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'1px' }}>📅 先月の合計</p>
                <p style={{ margin:'0 0 4px', fontSize:'2rem', fontWeight:'800', color:'rgba(255,255,255,0.6)' }}>¥{lastMonthTotal.toLocaleString()}</p>
                <p style={{ margin:0, fontSize:'0.85rem', color:'rgba(255,255,255,0.45)' }}>{lastMonthCount}件
                  {lastMonthTotal > 0 && <span style={{ marginLeft:'8px', color: thisMonthTotal >= lastMonthTotal ? '#f87171' : '#34d399', fontWeight:'600' }}>
                    {thisMonthTotal >= lastMonthTotal ? '▲' : '▼'}{Math.abs(Math.round((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100))}%
                  </span>}
                </p>
              </div>
            </div>

            {/* 使用者別集計 & カテゴリ別集計 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
              {/* 使用者別TOP10 */}
              <div style={{ ...cardStyle, overflow:'hidden' }}>
                <div style={{ padding:'1.2rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <h2 style={{ margin:0, fontSize:'1rem', fontWeight:'700', color:'#fff' }}>👤 使用者別集計 TOP10</h2>
                </div>
                <div style={{ padding:'0.5rem 0' }}>
                  {userStats.length === 0 ? (
                    <div style={{ padding:'2rem', textAlign:'center', color:'rgba(255,255,255,0.3)' }}>データがありません</div>
                  ) : userStats.map((u, i) => (
                    <div key={i} style={{ padding:'0.7rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ width:'24px', height:'24px', borderRadius:'50%', background: i<3 ? 'linear-gradient(135deg,#7c5cbf,#a855f7)' : 'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', color:'white', flexShrink:0 }}>{i+1}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'white', fontSize:'0.88rem', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                        <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.75rem' }}>{u.count}件 {u.pendingCount > 0 && <span style={{ color:'#fbbf24' }}>・未承認{u.pendingCount}件</span>}</div>
                      </div>
                      <div style={{ color:'#c4b5fd', fontWeight:'700', fontSize:'0.9rem', flexShrink:0 }}>¥{u.amount.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* カテゴリ別集計 */}
              <div style={{ ...cardStyle, overflow:'hidden' }}>
                <div style={{ padding:'1.2rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <h2 style={{ margin:0, fontSize:'1rem', fontWeight:'700', color:'#fff' }}>📊 カテゴリ別集計</h2>
                </div>
                <div style={{ padding:'0.5rem 0' }}>
                  {categoryStats.length === 0 ? (
                    <div style={{ padding:'2rem', textAlign:'center', color:'rgba(255,255,255,0.3)' }}>データがありません</div>
                  ) : categoryStats.map((c, i) => {
                    const pct = totalCategoryAmount > 0 ? Math.round(c.amount / totalCategoryAmount * 100) : 0;
                    const colors = ['#a855f7','#4facfe','#34d399','#fbbf24','#f87171','#f0abfc','#7dd3fc','#6ee7b7'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={i} style={{ padding:'0.7rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                          <span style={{ color:'white', fontSize:'0.88rem', fontWeight:'500' }}>{c.name}</span>
                          <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.82rem' }}>¥{c.amount.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div style={{ height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'2px' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:'2px', transition:'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* 最新の取引 */}
        <div style={{ ...cardStyle, overflow:'hidden' }}>
          <div style={{ padding:'1.4rem 2rem', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'1.1rem' }}>✨</span>
            <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:'700', color:'#fff' }}>最新の取引</h2>
          </div>
          {recentTransactions.length===0?(
            <div style={{ padding:'3rem', textAlign:'center', color:'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.8rem' }}>📭</div>
              <p style={{ margin:0 }}>取引データがありません</p>
            </div>
          ):(
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.04)' }}>
                    {['取引日','店舗名','金額','ステータス','操作'].map((h,i)=>(
                      <th key={h} style={{ padding:'0.9rem 1.5rem', textAlign: i===2?'right':i>=3?'center':'left', fontSize:'0.72rem', fontWeight:'700', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map(tx=>(
                    <tr key={tx.id} style={{ borderTop:'1px solid rgba(255,255,255,0.05)', transition:'background 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                      <td style={{ padding:'1.1rem 1.5rem', color:'rgba(255,255,255,0.7)', fontSize:'0.9rem' }}>{tx.transactionDate}</td>
                      <td style={{ padding:'1.1rem 1.5rem', color:'#fff', fontSize:'0.92rem', fontWeight:'500' }}>{tx.merchantName}</td>
                      <td style={{ padding:'1.1rem 1.5rem', textAlign:'right', color:'#fff', fontSize:'1rem', fontWeight:'700' }}>¥{tx.amount.toLocaleString()}</td>
                      <td style={{ padding:'1.1rem 1.5rem', textAlign:'center' }}>{getStatusBadge(tx.status)}</td>
                      <td style={{ padding:'1.1rem 1.5rem', textAlign:'center' }}>
                        <button onClick={()=>navigate('/transactions/'+tx.id)} style={{ padding:'7px 18px', background:'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color:'#fff', border:'none', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'0.82rem', boxShadow:'0 2px 8px rgba(168,85,247,0.3)' }}>詳細 →</button>
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
};

export default Dashboard;
