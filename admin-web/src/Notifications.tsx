import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';

interface Notification {
  id: string; userId: string; type: string; title: string; message: string;
  data: { transactionDate: string; amount: number; merchantName: string; mismatchType: string; };
  read: boolean; createdAt: any;
}

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav: React.CSSProperties = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' };

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all'|'unread'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) { navigate('/login'); return; }
    try {
      setLoading(true);
      const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const notifs: Notification[] = [];
      snapshot.forEach((doc) => { notifs.push({ id: doc.id, ...doc.data() } as Notification); });
      setNotifications(notifs);
    } catch (error) { console.error('通知読み込みエラー:', error); }
    finally { setLoading(false); }
  };

  const markAsRead = async (notificationId: string) => {
    try { await updateDoc(doc(db, 'notifications', notificationId), { read: true }); loadNotifications(); }
    catch (error) { console.error('既読エラー:', error); }
  };

  const markAllAsRead = async () => {
    try {
      for (const notif of notifications.filter(n => !n.read)) {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      }
      loadNotifications();
    } catch (error) { console.error('一括既読エラー:', error); }
  };

  const filteredNotifications = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  return (
    <div style={dark}>
      <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:'0 0 6px 0' }}>🔔 通知</h1>
              <p style={{ color:'rgba(255,255,255,0.5)', margin:0, fontSize:'0.9rem' }}>未読: {unreadCount}件 / 全体: {notifications.length}件</p>
            </div>
            <div style={{ display:'flex', gap:'0.6rem' }}>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
            </div>
          </div>
        </div>

        {/* フィルター */}
        <div style={{ ...card, padding:'1.2rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.8rem' }}>
            <div style={{ display:'flex', gap:'0.6rem' }}>
              {(['all','unread'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding:'8px 18px', borderRadius:'8px', fontWeight:'600', fontSize:'0.88rem', cursor:'pointer', border:'1px solid', borderColor: filter===f ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.15)', background: filter===f ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', color: filter===f ? '#c4b5fd' : 'rgba(255,255,255,0.6)' }}>
                  {f==='all' ? '全て' : '未読のみ'}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead}
                style={{ padding:'8px 16px', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', cursor:'pointer', fontSize:'0.85rem', fontWeight:'600' }}>
                ✅ すべて既読にする
              </button>
            )}
          </div>
        </div>

        {/* 通知一覧 */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ ...card, padding:'3rem', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:'1.1rem' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.8rem', opacity:0.4 }}>🔕</div>
              通知はありません
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div key={notification.id}
                style={{ ...card, padding:'1.4rem 1.8rem', borderLeft: !notification.read ? '3px solid #a855f7' : '3px solid transparent' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', flexWrap:'wrap' }}>
                      <h3 style={{ color:'white', fontWeight:'700', fontSize:'1rem', margin:0 }}>{notification.title}</h3>
                      {!notification.read && (
                        <span style={{ padding:'3px 10px', fontSize:'0.75rem', fontWeight:'700', borderRadius:'20px', background:'rgba(168,85,247,0.2)', color:'#c4b5fd', border:'1px solid rgba(168,85,247,0.4)' }}>未読</span>
                      )}
                    </div>
                    <p style={{ color:'rgba(255,255,255,0.65)', marginBottom:'8px', fontSize:'0.9rem', margin:'0 0 8px 0' }}>{notification.message}</p>
                    <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.35)' }}>
                      {notification.createdAt?.toDate?.()?.toLocaleString('ja-JP') || ''}
                    </div>
                  </div>
                  {!notification.read && (
                    <button onClick={() => markAsRead(notification.id)}
                      style={{ padding:'7px 14px', background:'rgba(168,85,247,0.15)', color:'#c4b5fd', border:'1px solid rgba(168,85,247,0.35)', borderRadius:'8px', cursor:'pointer', fontSize:'0.82rem', fontWeight:'600', whiteSpace:'nowrap' }}>
                      既読にする
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
export default Notifications;