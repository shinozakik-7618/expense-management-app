import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px' 
      }}>
        <h1>ダッシュボード</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {auth.currentUser?.email}
          </span>
          <button 
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      <div style={{ 
        backgroundColor: '#d4edda', 
        padding: '20px', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#155724', margin: '0 0 10px 0' }}>
          🎉 ログイン成功！
        </h2>
        <p style={{ color: '#155724', margin: 0 }}>
          法人カード経費精算システムへようこそ
        </p>
      </div>
    </div>
  );
}
