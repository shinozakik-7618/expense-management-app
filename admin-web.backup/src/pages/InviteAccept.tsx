import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

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
    if (token) {
      verifyToken();
    } else {
      setError('招待リンクが無効です');
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('inviteToken', '==', token),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('招待リンクが無効または期限切れです');
        setLoading(false);
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      const tokenCreatedAt = userData.tokenCreatedAt?.toDate();
      if (tokenCreatedAt) {
        const now = new Date();
        const hoursPassed = (now.getTime() - tokenCreatedAt.getTime()) / (1000 * 60 * 60);
        if (hoursPassed > 24) {
          setError('招待リンクの有効期限が切れています');
          setLoading(false);
          return;
        }
      }

      setUserInfo({ id: userDoc.id, ...userData });
      setLoading(false);
    } catch (error) {
      console.error('トークン検証エラー:', error);
      setError('招待リンクの検証に失敗しました');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      alert('パスワードは6文字以上で設定してください');
      return;
    }

    if (password !== confirmPassword) {
      alert('パスワードが一致しません');
      return;
    }

    try {
      setLoading(true);

      await createUserWithEmailAndPassword(auth, userInfo.email, password);

      await updateDoc(doc(db, 'users', userInfo.id), {
        status: 'active',
        inviteToken: null,
        tokenCreatedAt: null,
        updatedAt: new Date()
      });

      alert('アカウントが有効化されました！');
      await auth.signOut();
      navigate('/');
    } catch (error: any) {
      console.error('アカウント作成エラー:', error);
      alert('アカウントの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
          <h2 style={{ color: '#dc3545', marginBottom: '20px' }}>エラー</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            ログイン画面へ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '8px', maxWidth: '500px', width: '100%' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>アカウント設定</h1>
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '6px', marginBottom: '30px' }}>
          <div><strong>表示名:</strong> {userInfo.displayName}</div>
          <div><strong>メールアドレス:</strong> {userInfo.email}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>パスワード *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>パスワード（確認） *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '14px', backgroundColor: loading ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {loading ? '設定中...' : 'アカウントを有効化'}
          </button>
        </form>
      </div>
    </div>
  );
}
