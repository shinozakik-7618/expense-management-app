import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, getDocs } from 'firebase/firestore';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  blockId?: string;
  blockName?: string;
  regionId?: string;
  baseId?: string;
  organizationId: string;
  organizationType: string;
  status: string;
  createdAt: any;
  inviteToken?: string;
  tokenCreatedAt?: any;
}

interface Block {
  id: string;
  name: string;
}

interface Region {
  id: string;
  name: string;
  blockId: string;
  blockName: string;
}

interface Base {
  id: string;
  name: string;
  regionId: string;
  blockId: string;
  blockName: string;
}

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    role: 'user',
    blockId: '',
    regionId: '',
    baseId: ''
  });

  useEffect(() => {
    loadUsers();
    loadOrganizations();
  }, []);

  const loadUsers = () => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  };

  const loadOrganizations = async () => {
    try {
      const blocksSnapshot = await getDocs(collection(db, 'blocks'));
      const blocksData = blocksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Block));
      setBlocks(blocksData);

      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      const regionsData = regionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Region));
      setRegions(regionsData);

      const basesSnapshot = await getDocs(collection(db, 'bases'));
      const basesData = basesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Base));
      setBases(basesData);
    } catch (error) {
      console.error('組織データ取得エラー:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.displayName) {
      alert('メールアドレスと表示名を入力してください');
      return;
    }

    try {
      const token = Math.random().toString(36).substring(2, 15);
      const block = blocks.find(b => b.id === formData.blockId);
      
      await addDoc(collection(db, 'users'), {
        email: formData.email,
        displayName: formData.displayName,
        role: formData.role,
        blockId: formData.blockId || null,
        blockName: block?.name || null,
        regionId: formData.regionId || null,
        baseId: formData.baseId || null,
        organizationId: 'org001',
        organizationType: 'regional',
        status: 'pending',
        inviteToken: token,
        tokenCreatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const url = `${window.location.origin}/invite?token=${token}`;
      setInviteUrl(url);
      
      setFormData({
        email: '',
        displayName: '',
        role: 'user',
        blockId: '',
        regionId: '',
        baseId: ''
      });
      
      alert('ユーザーを追加しました');
    } catch (error) {
      console.error('ユーザー追加エラー:', error);
      alert('ユーザーの追加に失敗しました');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const getRoleBadge = (role: string) => {
    const styles: { [key: string]: { bg: string; text: string; label: string } } = {
      admin: { bg: '#F3E5F5', text: '#7B1FA2', label: '管理者' },
      block_manager: { bg: '#E8EAF6', text: '#3F51B5', label: 'ブロック責任者' },
      region_manager: { bg: '#E3F2FD', text: '#1976D2', label: '地域責任者' },
      base_manager: { bg: '#E0F2F1', text: '#00796B', label: '拠点責任者' },
      user: { bg: '#F5F5F5', text: '#616161', label: '一般ユーザー' }
    };
    const style = styles[role] || styles.user;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        background: style.bg,
        color: style.text
      }}>
        {style.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: { bg: string; text: string; label: string } } = {
      active: { bg: '#E8F5E9', text: '#2E7D32', label: '🟢 有効' },
      pending: { bg: '#FFF3E0', text: '#E65100', label: '🟡 初回ログイン待ち' },
      inactive: { bg: '#FFEBEE', text: '#C62828', label: '🔴 無効' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        background: style.bg,
        color: style.text
      }}>
        {style.label}
      </span>
    );
  };

  const getOrganizationName = (user: User) => {
    if (user.role === 'admin') return '全組織';
    
    const block = blocks.find(b => b.id === user.blockId);
    const region = regions.find(r => r.id === user.regionId);
    const base = bases.find(b => b.id === user.baseId);
    
    if (user.role === 'block_manager' && block) return block.name;
    if (user.role === 'region_manager' && region) return `${block?.name || user.blockName || ''} > ${region.name}`;
    if (user.role === 'base_manager' && base) return `${region?.name || ''} > ${base.name}`;
    if (base) return base.name;
    
    return user.blockName || '-';
  };

  const filteredRegions = formData.blockId 
    ? regions.filter(r => r.blockId === formData.blockId)
    : [];

  const filteredBases = formData.regionId
    ? bases.filter(b => b.regionId === formData.regionId)
    : [];

  if (loading) {
    return <div style={{ padding: '20px' }}>読み込み中...</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>ユーザー管理</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '10px 20px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {showForm ? '閉じる' : '+ ユーザー追加'}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 20px',
              background: '#9E9E9E',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ダッシュボードに戻る
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              background: '#f44336',
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

      {showForm && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2>新規ユーザー追加</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                メールアドレス *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                表示名 *
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                権限 *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="user">一般ユーザー</option>
                <option value="base_manager">拠点責任者</option>
                <option value="region_manager">地域責任者</option>
                <option value="block_manager">ブロック責任者</option>
                <option value="admin">管理者</option>
              </select>
            </div>

            {formData.role !== 'admin' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    ブロック *
                  </label>
                  <select
                    value={formData.blockId}
                    onChange={(e) => setFormData({ ...formData, blockId: e.target.value, regionId: '', baseId: '' })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                    required
                  >
                    <option value="">選択してください</option>
                    {blocks.map(block => (
                      <option key={block.id} value={block.id}>
                        {block.name}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.role !== 'block_manager' && formData.blockId && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                      地域 *
                    </label>
                    <select
                      value={formData.regionId}
                      onChange={(e) => setFormData({ ...formData, regionId: e.target.value, baseId: '' })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                      required
                    >
                      <option value="">選択してください</option>
                      {filteredRegions.map(region => (
                        <option key={region.id} value={region.id}>
                          {region.id} - {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.role !== 'block_manager' && formData.role !== 'region_manager' && formData.regionId && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                      拠点 *
                    </label>
                    <select
                      value={formData.baseId}
                      onChange={(e) => setFormData({ ...formData, baseId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                      required
                    >
                      <option value="">選択してください</option>
                      {filteredBases.map(base => (
                        <option key={base.id} value={base.id}>
                          {base.id} - {base.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: '#4CAF50',
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

          {inviteUrl && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#E8F5E9', borderRadius: '4px' }}>
              <h3>✅ 招待リンクが生成されました</h3>
              <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                以下のURLをユーザーに送信してください：
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #4CAF50',
                    borderRadius: '4px',
                    background: 'white'
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    alert('URLをコピーしました');
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  コピー
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #E3F2FD' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#1976D2' }}>
          ℹ️ ユーザーは「初回ログイン待ち」状態で登録されます。招待URLから初回ログインすると「有効」になります。
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>表示名</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>メールアドレス</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>権限</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>所属</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>ステータス</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>登録日</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>{user.displayName}</td>
                <td style={{ padding: '12px' }}>{user.email}</td>
                <td style={{ padding: '12px' }}>{getRoleBadge(user.role)}</td>
                <td style={{ padding: '12px', fontSize: '14px' }}>{getOrganizationName(user)}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(user.status)}</td>
                <td style={{ padding: '12px' }}>
                  {user.createdAt?.toDate?.()?.toLocaleDateString('ja-JP') || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserManagement;
