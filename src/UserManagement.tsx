import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { auth } from './firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  status: string;
  cardNumber?: string;
  employeeId?: string;
  blockId?: string;
  blockName?: string;
  regionId?: string;
  regionName?: string;
  baseId?: string;
  baseName?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface Block {
  id: string;
  name: string;
}

interface Region {
  id: string;
  name: string;
  blockId: string;
}

interface Base {
  id: string;
  name: string;
  regionId: string;
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  
  // 現在のユーザー情報
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 現在のユーザー情報を取得
      const currentUserAuth = auth.currentUser;
      if (currentUserAuth) {
        const userQuery = query(collection(db, 'users'), where('uid', '==', currentUserAuth.uid));
        const userDoc = await getDocs(userQuery);
        if (!userDoc.empty) {
          setCurrentUser({ uid: currentUserAuth.uid, ...userDoc.docs[0].data() } as User);
        }
      }

      // ユーザー一覧を取得
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];
      usersSnapshot.forEach((doc) => {
        usersData.push({ uid: doc.id, ...doc.data() } as User);
      });
      setUsers(usersData);

      // 組織情報を取得
      const blocksSnapshot = await getDocs(collection(db, 'blocks'));
      const blocksData: Block[] = [];
      blocksSnapshot.forEach((doc) => {
        blocksData.push({ id: doc.id, ...doc.data() } as Block);
      });
      setBlocks(blocksData);

      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      const regionsData: Region[] = [];
      regionsSnapshot.forEach((doc) => {
        regionsData.push({ id: doc.id, ...doc.data() } as Region);
      });
      setRegions(regionsData);

      const basesSnapshot = await getDocs(collection(db, 'bases'));
      const basesData: Base[] = [];
      basesSnapshot.forEach((doc) => {
        basesData.push({ id: doc.id, ...doc.data() } as Base);
      });
      setBases(basesData);

    } catch (error) {
      console.error('データ読み込みエラー:', error);
      alert('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 編集権限チェック
  const canEdit = (user: User): boolean => {
    if (!currentUser) return false;
    // 管理者は全員編集可能
    if (currentUser.role === 'admin') return true;
    // 一般ユーザーは自分自身のみ編集可能
    return currentUser.uid === user.uid;
  };

  // 削除権限チェック
  const canDelete = (user: User): boolean => {
    if (!currentUser) return false;
    // 管理者のみ削除可能
    return currentUser.role === 'admin';
  };

  const handleEdit = (user: User) => {
    if (!canEdit(user)) {
      alert('このユーザーを編集する権限がありません');
      return;
    }
    setEditingUser({ ...user });
    setSelectedBlockId(user.blockId || '');
    setSelectedRegionId(user.regionId || '');
  };

  const handleSave = async () => {
    if (!editingUser) return;

    if (!canEdit(editingUser)) {
      alert('このユーザーを編集する権限がありません');
      return;
    }

    try {
      // 組織名を設定
      const blockName = blocks.find(b => b.id === editingUser.blockId)?.name || '';
      const regionName = regions.find(r => r.id === editingUser.regionId)?.name || '';
      const baseName = bases.find(b => b.id === editingUser.baseId)?.name || '';

      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: editingUser.displayName,
        role: editingUser.role,
        status: editingUser.status,
        cardNumber: editingUser.cardNumber || '',
        employeeId: editingUser.employeeId || '',
        blockId: editingUser.blockId || '',
        blockName: blockName,
        regionId: editingUser.regionId || '',
        regionName: regionName,
        baseId: editingUser.baseId || '',
        baseName: baseName,
        updatedAt: new Date()
      });

      alert('ユーザー情報を更新しました');
      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました');
    }
  };

  const handleDelete = async (user: User) => {
    if (!canDelete(user)) {
      alert('このユーザーを削除する権限がありません');
      return;
    }

    if (!window.confirm(`${user.displayName || user.email} を削除しますか？`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid));
      alert('ユーザーを削除しました');
      loadData();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const getRoleBadge = (role: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      admin: { label: '管理者', className: 'bg-purple-100 text-purple-800' },
      user: { label: '一般', className: 'bg-blue-100 text-blue-800' },
      approver: { label: '承認者', className: 'bg-green-100 text-green-800' }
    };
    const badge = badges[role] || { label: role, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      active: { label: '有効', className: 'bg-green-100 text-green-800' },
      inactive: { label: '無効', className: 'bg-red-100 text-red-800' }
    };
    const badge = badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  // ブロック選択時
  const handleBlockChange = (blockId: string) => {
    setSelectedBlockId(blockId);
    setSelectedRegionId('');
    if (editingUser) {
      setEditingUser({ ...editingUser, blockId, regionId: '', baseId: '' });
    }
  };

  // 地域選択時
  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    if (editingUser) {
      setEditingUser({ ...editingUser, regionId, baseId: '' });
    }
  };

  // フィルタリングされた地域一覧
  const filteredRegions = selectedBlockId
    ? regions.filter(r => r.blockId === selectedBlockId)
    : [];

  // フィルタリングされた拠点一覧
  const filteredBases = selectedRegionId
    ? bases.filter(b => b.regionId === selectedRegionId)
    : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                📊 ダッシュボード
              </button>
              <button
                onClick={() => navigate('/transactions')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                📝 取引一覧
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-red-600 hover:text-red-900"
              >
                ログアウト
              </button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">総ユーザー数: {users.length}名</p>
        </div>

        {/* ユーザー一覧 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  メールアドレス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  表示名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  役割
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  カード番号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  従業員ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ブロック
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  地域
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  拠点
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.uid}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.displayName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(user.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.cardNumber || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.employeeId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.blockName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.regionName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.baseName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {canEdit(user) && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          ✏️ 修正
                        </button>
                      )}
                      {canDelete(user) && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-red-600 hover:text-red-900"
                        >
                          🗑️ 削除
                        </button>
                      )}
                      {!canEdit(user) && !canDelete(user) && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 編集モーダル */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">ユーザー情報を編集</h2>
              
              <div className="space-y-4">
                {/* メールアドレス（読み取り専用） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={editingUser.email}
                    disabled
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 px-3 py-2"
                  />
                </div>

                {/* 表示名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    表示名
                  </label>
                  <input
                    type="text"
                    value={editingUser.displayName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  />
                </div>

                {/* 役割（管理者のみ変更可能） */}
                {currentUser?.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      役割
                    </label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                    >
                      <option value="admin">管理者</option>
                      <option value="user">一般</option>
                      <option value="approver">承認者</option>
                    </select>
                  </div>
                )}

                {/* 状態（管理者のみ変更可能） */}
                {currentUser?.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      状態
                    </label>
                    <select
                      value={editingUser.status}
                      onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                    >
                      <option value="active">有効</option>
                      <option value="inactive">無効</option>
                    </select>
                  </div>
                )}

                {/* カード番号下4桁 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    カード番号（下4桁）
                  </label>
                  <input
                    type="text"
                    value={editingUser.cardNumber || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, cardNumber: e.target.value })}
                    placeholder="例: 1234"
                    maxLength={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  />
                </div>

                {/* 従業員ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    従業員ID
                  </label>
                  <input
                    type="text"
                    value={editingUser.employeeId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, employeeId: e.target.value })}
                    placeholder="例: 100029"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  />
                </div>

                {/* ブロック */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ブロック
                  </label>
                  <select
                    value={selectedBlockId}
                    onChange={(e) => handleBlockChange(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  >
                    <option value="">選択してください</option>
                    {blocks.map((block) => (
                      <option key={block.id} value={block.id}>
                        {block.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 地域 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    地域
                  </label>
                  <select
                    value={selectedRegionId}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    disabled={!selectedBlockId}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border disabled:bg-gray-100"
                  >
                    <option value="">選択してください</option>
                    {filteredRegions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 拠点 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    拠点
                  </label>
                  <select
                    value={editingUser.baseId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, baseId: e.target.value })}
                    disabled={!selectedRegionId}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border disabled:bg-gray-100"
                  >
                    <option value="">選択してください</option>
                    {filteredBases.map((base) => (
                      <option key={base.id} value={base.id}>
                        {base.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
