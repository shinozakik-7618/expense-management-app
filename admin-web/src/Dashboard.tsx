import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface Stats {
  pending: number;
  submitted: number;
  rejected: number;
  approved: number;
}

interface RecentTransaction {
  id: string;
  transactionDate: string;
  amount: number;
  merchantName: string;
  status: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ pending: 0, submitted: 0, rejected: 0, approved: 0 });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

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
      console.log('ログイン中のemail:', currentUser.email);
      const userQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
      const userSnapshot = await getDocs(userQuery);
      setUserName(currentUser.email || '');
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        setUserRole(userData.role || 'user');
        setUserName(userData.displayName || currentUser.email || currentUser.uid);
      }
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const statsData: Stats = { pending: 0, submitted: 0, rejected: 0, approved: 0 };
      const transactions: RecentTransaction[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'pending';
        if (status in statsData) statsData[status as keyof Stats]++;
        transactions.push({ id: doc.id, transactionDate: formatDate(data.transactionDate), amount: data.amount || 0, merchantName: data.merchantName || '', status });
      });
      transactions.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      setStats(statsData);
      setRecentTransactions(transactions.slice(0, 5));
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

  const nb: React.CSSProperties = { padding: '9px 18px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.88rem', transition: 'all 0.2s ease', whiteSpace: 'nowrap' as const };
  const statCards = [
    { label: '未処理', value: stats.pending,   icon: '📋', accent: '#a855f7' },
    { label: '申請中', value: stats.submitted,  icon: '⏳', accent: '#fbbf24' },
    { label: '差戻し', value: stats.rejected,   icon: '↩️', accent: '#f87171' },
    { label: '承認済', value: stats.approved,   icon: '✅', accent: '#34d399' },
  ];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #2d2b55 100%)', color: 'rgba(255,255,255,0.8)', fontSize: '1.2rem' }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #2d2b55 100%)', padding: '1.5rem 2rem', fontFamily: "'Segoe UI','Hiragino Sans','Yu Gothic',sans-serif" }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.4rem 2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '1rem' }}>
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
            <button onClick={() => navigate('/transactions/new')} style={{ ...nb, background: 'linear-gradient(135deg, #7c5cbf 0%, #a855f7 60%, #ec4899 100%)', border: 'none', color: '#fff', fontWeight: '600', boxShadow: '0 4px 16px rgba(168,85,247,0.35)' }} onMouseEnter={e => (e.currentTarget.style.opacity='0.9')} onMouseLeave={e => (e.currentTarget.style.opacity='1')}>＋ 新規取引</button>
            {[{l:'📌 用途管理',p:'/purpose-master'},{l:'📋 未報告',p:'/unreported'},{l:'📝 取引一覧',p:'/transactions'}].map(({l,p})=>(
              <button key={p} onClick={()=>navigate(p)} style={nb} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.13)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)'}}>{l}</button>
            ))}
            <button onClick={()=>navigate('/notifications')} style={{...nb,position:'relative'}} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.13)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)'}}>
              🔔 通知
              {unreadNotifications>0&&<span style={{position:'absolute',top:'-7px',right:'-7px',background:'linear-gradient(135deg,#a855f7,#ec4899)',color:'#fff',fontSize:'0.68rem',fontWeight:'700',borderRadius:'50%',width:'20px',height:'20px',display:'flex',alignItems:'center',justifyContent:'center'}}>{unreadNotifications}</span>}
            </button>
            {userRole==='admin'&&<button onClick={()=>navigate('/user-management')} style={nb} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.13)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)'}}>👥 ユーザー管理</button>}
            <button onClick={() => navigate('/manual')} style={nb} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.13)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)'}}>📖 マニュアル</button>
            <button onClick={handleLogout} style={{...nb,background:'rgba(248,113,113,0.15)',border:'1px solid rgba(248,113,113,0.3)',color:'#fca5a5'}} onMouseEnter={e=>{e.currentTarget.style.background='rgba(248,113,113,0.25)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(248,113,113,0.15)'}}>🔓 ログアウト</button>
          </div>
        </div>

        {/* 統計カード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {statCards.map(({label,value,icon,accent})=>(
            <div key={label} style={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.1)', borderLeft:`3px solid ${accent}`, borderRadius:'14px', padding:'1.6rem 1.8rem', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'-10px', right:'-10px', fontSize:'5rem', opacity:0.06, lineHeight:1 }}>{icon}</div>
              <p style={{ margin:'0 0 0.5rem 0', fontSize:'0.78rem', fontWeight:'600', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'1px' }}>{label}</p>
              <p style={{ margin:0, fontSize:'2.8rem', fontWeight:'800', color:accent, lineHeight:1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* 最新の取引 */}
        <div style={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', overflow:'hidden' }}>
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
                        <button onClick={()=>navigate('/transactions/'+tx.id)} style={{ padding:'7px 18px', background:'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color:'#fff', border:'none', borderRadius:'20px', cursor:'pointer', fontWeight:'600', fontSize:'0.82rem', boxShadow:'0 2px 8px rgba(168,85,247,0.3)', transition:'opacity 0.2s' }} onMouseEnter={e=>{e.currentTarget.style.opacity='0.85'}} onMouseLeave={e=>{e.currentTarget.style.opacity='1'}}>詳細 →</button>
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
