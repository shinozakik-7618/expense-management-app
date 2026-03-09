import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePasswordReset = async () => {
    if (!email) { alert('メールアドレスを入力してください'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('パスワード変更メールを送信しました。メールをご確認ください。');
    } catch (e) {
      alert('送信に失敗しました。メールアドレスを確認してください。');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await userCredential.user.getIdToken(true);
      navigate('/dashboard');
    } catch (err: any) {
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #2d2b55 100%)',
      width: '100%',
      fontFamily: "'Segoe UI', 'Hiragino Sans', 'Yu Gothic', sans-serif",
    }}>

      {/* ロゴ＋タイトル */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #7c5cbf 0%, #a855f7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px',
          margin: '0 auto 1.2rem auto',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.4)',
        }}>
          💳
        </div>
        <h1 style={{
          color: '#ffffff',
          fontSize: '1.4rem',
          fontWeight: '700',
          margin: '0 0 0.4rem 0',
          letterSpacing: '0.02em',
        }}>
          法人カード経費管理システム
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.9rem',
          margin: 0,
        }}>
          PC DEPOT Corp.
        </p>
      </div>

      {/* ログインカード */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)',
      }}>
        <form onSubmit={handleLogin}>

          {/* メールアドレス */}
          <div style={{ marginBottom: '1.4rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'rgba(255,255,255,0.75)',
              fontSize: '0.9rem',
              fontWeight: '500',
            }}>
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@pcdepot.co.jp"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                outline: 'none',
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(168, 85, 247, 0.7)';
                e.target.style.background = 'rgba(255, 255, 255, 0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.target.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
            />
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: '1.8rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'rgba(255,255,255,0.75)',
              fontSize: '0.9rem',
              fontWeight: '500',
            }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                outline: 'none',
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(168, 85, 247, 0.7)';
                e.target.style.background = 'rgba(255, 255, 255, 0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.target.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
            />
          </div>

          {/* エラー */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              borderRadius: '10px',
              marginBottom: '1.4rem',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ログインボタン */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#ffffff',
              background: loading
                ? 'rgba(168, 85, 247, 0.5)'
                : 'linear-gradient(135deg, #7c5cbf 0%, #a855f7 60%, #ec4899 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s ease, transform 0.1s ease',
              letterSpacing: '0.04em',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(168, 85, 247, 0.4)',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.opacity = '1';
            }}
          >
            {loading ? 'ログイン中...' : 'ログイン →'}
          </button>

          {/* パスワード変更リンク */}
          <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
            <button
              type="button"
              onClick={handlePasswordReset}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(168,85,247,0.8)', fontSize: '0.85rem',
                textDecoration: 'underline', padding: 0,
              }}
            >パスワードの変更はこちら</button>
          </div>

        </form>
      </div>

      {/* フッター */}
      <p style={{
        marginTop: '2rem',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.8rem',
      }}>
        © 2026 PC DEPOT Corp. All rights reserved.
      </p>

    </div>
  );
}
