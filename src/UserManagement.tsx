import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: any;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'user'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const data: User[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as User);
      });
      
      setUsers(data);
    } catch (error) {
      console.error('ユーザーの取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.displayName) {
      alert('全ての項目を入力してください');
      return;
    }

    // 現在のユーザー情報を保存
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('ログインしてください');
      return;
    }
    const currentEmail = currentUser.email;

    try {
      // 新規ユーザー作成
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Firestoreにユーザー情報を保存
      await addDoc(collection(db, 'users'), {
        uid: userCredential.user.uid,
        email: formData.email,
        displayName: formData.displayName,
        role: formData.role,
        organizationId: 'org001',
        organizationType: 'regional',
        cardNumber: '',
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // 元のユーザーに再ログイン
      // 注意: パスワードの再入力が必要です
      const password = prompt('管理者アカウントに戻るため、あなたのパスワードを入力してください：');
      if (password && currentEmail) {
        await signInWithEmailAndPassword(auth, currentEmail, password);
        alert('ユーザーを追加しました');
        setShowForm(false);
        setFormData({ email: '', password: '', displayName: '', role: 'user' });
        loadUsers();
      } else {
        alert('ユーザーは追加されましたが、ログアウトされました。再度ログインしてください。');
        navigate('/');
      }
    } catch (error: any) {
      console.error('ユーザーの追加に失敗:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('このメールアドレスは既に使用されています');
      } else if (error.code === 'auth/wrong-password') {
        alert('パスワードが間違っています。ログアウトされました。');
        navigate('/');
      } else {
        alert('ユーザーの追加に失敗しました');
      }
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      admin: { bg: '#dc3545', color: 'white', text: '管理者' },
      cfo: { bg: '#6f42c1', color: 'white', text: 'CFO' },
      department_head: { bg: '#fd7e14', color: 'white', text: '本部長' },
      regional_manager: { bg: '#20c997', color: 'white', text: '地域管理者' },
      user: { bg: '#6c757d', color: 'white', text: '一般' }
    };
    
    const style = styles[role] || styles.user;
    
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        backgroundColor: style.bg,
        color: style.color
      }}>
        {style.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>ユーザー管理</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '8px 16px',
              backgroundColor: showForm ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {showForm ? 'キャンセル' : '+ ユーザー追加'}
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0 }}>新規ユーザー追加</h3>
          
          <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '15px', fontSize: '14px' }}>
            ⚠️ ユーザー追加後、あなたのパスワードを再入力してログインを維持します
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              メールアドレス <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              パスワード <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              表示名 <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              権限 <span style={{ color: 'red' }}>*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            >
              <option value="user">一般ユーザー</option>
              <option value="regional_manager">地域管理者</option>
              <option value="department_head">本部長</option>
              <option value="cfo">CFO</option>
              <option value="admin">管理者</option>
            </select>
          </div>

          <button
            type="submit"
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            追加
          </button>
        </form>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>表示名</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>メールアドレス</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>権限</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>ステータス</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>登録日</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{user.displayName}</td>
                <td style={{ padding: '12px' }}>{user.email}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {getRoleBadge(user.role)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: user.status === 'active' ? '#d4edda' : '#f8d7da',
                    color: user.status === 'active' ? '#155724' : '#721c24'
                  }}>
                    {user.status === 'active' ? '有効' : '無効'}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  {user.createdAt?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          ユーザーが登録されていません
        </div>
      )}
    </div>
  );
}
