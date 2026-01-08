import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { signOut } from 'firebase/auth';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  organizationId: string;
  status: string;
  inviteToken?: string;
  createdAt: any;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    role: 'user'
  });
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersData);
    } catch (error) {
      console.error('ユーザーの取得に失敗:', error);
      alert('ユーザーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.displayName) {
      alert('メールアドレスと表示名を入力してください');
      return;
    }

    try {
      setLoading(true);

      const token = generateToken();
      const baseUrl = window.location.origin;
      const fullInviteUrl = `${baseUrl}/invite?token=${token}`;

      await addDoc(collection(db, 'users'), {
        email: formData.email,
        displayName: formData.displayName,
        role: formData.role,
        organizationId: 'org001',
        organizationType: 'regional',
        status: 'pending',
        inviteToken: token,
        tokenCreatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      setInviteUrl(fullInviteUrl);
      setFormData({ email: '', displayName: '', role: 'user' });
      setShowForm(false);
      loadUsers();
    } catch (error) {
      console.error('ユーザーの登録に失敗:', error);
      alert('ユーザーの登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    alert('招待URLをコピーしました');
  };

  const getRoleBadge = (role: string) => {
    const badges: { [key: string]: { text: string; color: string } } = {
      admin: { text: '管理者', color: '#dc3545' },
      cfo: { text: 'CFO', color: '#6f42c1' },
      department_head: { text: '本部長', color: '#fd7e14' },
      regional_manager: { text: '地域マネージャー', color: '#0dcaf0' },
      user: { text: '一般ユーザー', color: '#6c757d' }
    };
    const badge = badges[role] || badges.user;
    return (
      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: badge.color, color: 'white' }}>
        {badge.text}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { text: string; color: string } } = {
      active: { text: '有効', color: '#198754' },
      pending: { text: '初回ログイン待ち', color: '#ffc107' },
      inactive: { text: '無効', color: '#6c757d' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: badge.color, color: status === 'pending' ? '#000' : 'white' }}>
        {badge.text}
      </span>
    );
  };

  if (loading && users.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>ユーザー管理</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
            {showForm ? 'キャンセル' : '+ ユーザー追加'}
          </button>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            ダッシュボードに戻る
          </button>
        </div>
      </div>

      {inviteUrl && (
        <div style={{ backgroundColor: '#d1e7dd', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #badbcc' }}>
          <h3 style={{ marginBottom: '15px', color: '#0f5132' }}>✅ ユーザーを登録しました</h3>
          <p style={{ marginBottom: '10px', fontSize: '14px', color: '#0f5132' }}>以下の招待URLをユーザーに送信してください：</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" value={inviteUrl} readOnly style={{ flex: 1, padding: '10px', border: '1px solid #badbcc', borderRadius: '4px', fontSize: '14px' }} />
            <button onClick={copyInviteUrl} style={{ padding: '10px 20px', backgroundColor: '#198754', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              コピー
            </button>
          </div>
          <p style={{ marginTop: '10px', fontSize: '12px', color: '#0f5132' }}>※ このURLは24時間有効です</p>
          <button onClick={() => setInviteUrl('')} style={{ marginTop: '15px', padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            閉じる
          </button>
        </div>
      )}

      {showForm && (
        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #dee2e6' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', color: '#333' }}>新規ユーザー追加</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>メールアドレス *</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid #ced4da', borderRadius: '4px' }} />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>表示名 *</label>
              <input type="text" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} required style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid #ced4da', borderRadius: '4px' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>権限</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid #ced4da', borderRadius: '4px' }}>
                <option value="user">一般ユーザー</option>
                <option value="regional_manager">地域マネージャー</option>
                <option value="department_head">本部長</option>
                <option value="cfo">CFO</option>
                <option value="admin">管理者</option>
              </select>
            </div>

            <button type="submit" disabled={loading} style={{ padding: '12px 24px', backgroundColor: loading ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
              {loading ? '登録中...' : '追加'}
            </button>
          </form>
        </div>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>表示名</th>
              <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>メールアドレス</th>
              <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>権限</th>
              <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>ステータス</th>
              <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>登録日</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>ユーザーが登録されていません</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '15px', fontSize: '14px' }}>{user.displayName}</td>
                  <td style={{ padding: '15px', fontSize: '14px' }}>{user.email}</td>
                  <td style={{ padding: '15px' }}>{getRoleBadge(user.role)}</td>
                  <td style={{ padding: '15px' }}>{getStatusBadge(user.status)}</td>
                  <td style={{ padding: '15px', fontSize: '14px' }}>{user.createdAt?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
