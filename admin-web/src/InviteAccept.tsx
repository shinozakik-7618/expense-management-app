import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'white', fontSize:'15px', boxSizing:'border-box' };
const labelStyle: React.CSSProperties = { display:'block', marginBottom:'7px', color:'rgba(255,255,255,0.75)', fontWeight:'600', fontSize:'14px' };

export default function InviteAccept() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (token) { verifyToken(); }
    else { setError('招待リンクが無効です'); setLoading(false); }
  }, [token]);

  const verifyToken = async () => {
    try {
      const q = query(collection(db, 'users'), where('inviteToken', '==', token), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) { setError('招待リンクが無効または期限切れです'); setLoading(false); return; }
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const tokenCreatedAt = userData.tokenCreatedAt?.toDate();
      if (tokenCreatedAt) {
        const hoursPassed = (new Date().getTime() - tokenCreatedAt.getTime()) / (1000 * 60 * 60);
        if (hoursPassed > 24) { setError('招待リンクの有効期限が切れています'); setLoading(false); return; }
      }
      setUserInfo({ id: userDoc.id, ...userData });
      setLoading(false);
    } catch (error) { console.error('トークン検証エラー:', error); setError('招待リンクの検証に失敗しました'); setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { alert('パスワードは6文字以上で設定してください'); return; }
    if (password !== confirmPassword) { alert('パスワードが一致しません'); return; }
    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, userInfo.email, password);
      await updateDoc(doc(db, 'users', userInfo.id), { status:'active', inviteToken:null, tokenCreatedAt:null, updatedAt:new Date() });
      alert('アカウントが有効化されました！');
      await auth.signOut();
      navigate('/');
    } catch (error: any) { console.error('アカウント作成エラー:', error); alert('アカウントの作成に失敗しました'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  if (error) return (
    <div style={dark}>
      <div style={{ ...card, padding:'2.5rem', maxWidth:'420px', width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>⚠️</div>
        <h2 style={{ color:'#fca5a5', marginBottom:'16px', fontSize:'1.3rem' }}>エラー</h2>
        <p style={{ color:'rgba(255,255,255,0.65)', marginBottom:'24px' }}>{error}</p>
        <button onClick={() => navigate('/')} style={{ padding:'11px 28px', background:'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'15px' }}>
          ログイン画面へ
        </button>
      </div>
    </div>
  );

  return (
    <div style={dark}>
      {/* ロゴ */}
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ width:'64px', height:'64px', borderRadius:'18px', background:'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'30px', margin:'0 auto 1rem auto', boxShadow:'0 8px 24px rgba(168,85,247,0.4)' }}>💳</div>
        <h1 style={{ color:'white', fontSize:'1.5rem', fontWeight:'700', margin:'0 0 4px 0' }}>法人カード経費管理システム</h1>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.85rem', margin:0 }}>PC DEPOT Corp.</p>
      </div>

      {/* フォームカード */}
      <div style={{ ...card, padding:'2.5rem', maxWidth:'480px', width:'100%' }}>
        <h2 style={{ color:'white', fontSize:'1.4rem', fontWeight:'700', textAlign:'center', marginTop:0, marginBottom:'1.5rem' }}>アカウント設定</h2>

        {/* ユーザー情報 */}
        <div style={{ padding:'14px 18px', background:'rgba(124,92,191,0.12)', border:'1px solid rgba(124,92,191,0.3)', borderRadius:'10px', marginBottom:'24px' }}>
          <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px', marginBottom:'6px' }}><strong style={{ color:'rgba(255,255,255,0.5)' }}>表示名:</strong> {userInfo.displayName || '-'}</div>
          <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px' }}><strong style={{ color:'rgba(255,255,255,0.5)' }}>メールアドレス:</strong> {userInfo.email}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:'20px' }}>
            <label style={labelStyle}>パスワード <span style={{ color:'#f87171' }}>*</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} placeholder="6文字以上" />
          </div>
          <div style={{ marginBottom:'28px' }}>
            <label style={labelStyle}>パスワード（確認） <span style={{ color:'#f87171' }}>*</span></label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={inputStyle} placeholder="もう一度入力" />
          </div>
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'13px', fontSize:'15px', fontWeight:'700', color: loading?'rgba(255,255,255,0.4)':'white', background: loading?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', border:'none', borderRadius:'8px', cursor: loading?'not-allowed':'pointer', boxShadow: loading?'none':'0 4px 16px rgba(168,85,247,0.35)' }}>
            {loading ? '設定中...' : '✅ アカウントを有効化'}
          </button>
        </form>
      </div>

      <p style={{ marginTop:'1.5rem', color:'rgba(255,255,255,0.25)', fontSize:'0.78rem' }}>© 2026 PC DEPOT Corp. All rights reserved.</p>
    </div>
  );
}