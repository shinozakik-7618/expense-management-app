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
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  
  // フィルター・検索
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // 現在のユーザー情報
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter, cardFilter]);

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

  // フィルタリング処理
  const filterUsers = () => {
    let filtered = [...users];

    // 検索フィルター
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.employeeId && user.employeeId.includes(searchTerm))
      );
    }

    // 役割フィルター
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // 状態フィルター
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    // カード登録状況フィルター
    if (cardFilter === 'registered') {
      filtered = filtered.filter(user => user.cardNumber && user.cardNumber.length > 0);
    } else if (cardFilter === 'unregistered') {
      filtered = filtered.filter(user => !user.cardNumber || user.cardNumber.length === 0);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1); // フィルター変更時は1ページ目に戻る
  };

  // ページネーション処理
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // 編集権限チェック
  const canEdit = (user: User): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.uid === user.uid;
  };

  // 削除権限チェック
  const canDelete = (user: User): boolean => {
    if (!currentUser) return false;
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

  const handleBlockChange = (blockId: string) => {
    setSelectedBlockId(blockId);
    setSelectedRegionId('');
    if (editingUser) {
      setEditingUser({ ...editingUser, blockId, regionId: '', baseId: '' });
    }
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    if (editingUser) {
      setEditingUser({ ...editingUser, regionId, baseId: '' });
    }
  };

  const filteredRegions = selectedBlockId
    ? regions.filter(r => r.blockId === selectedBlockId)
    : [];

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
              <p className="text-gray-600 mt-1">
                総ユーザー数: {users.length}名 / 表示中: {filteredUsers.length}名
              </p>
            </div>
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
        </div>

        {/* フィルター・検索エリア */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 検索ボックス */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔍 検索
              </label>
              <input
                type="text"
                placeholder="名前・メール・従業員ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 役割フィルター */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 役割
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全て</option>
                <option value="admin">管理者</option>
                <option value="user">一般</option>
                <option value="approver">承認者</option>
              </select>
            </div>

            {/* 状態フィルター */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ✓ 状態
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全て</option>
                <option value="active">有効</option>
                <option value="inactive">無効</option>
              </select>
            </div>

            {/* カード登録状況フィルター */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💳 カード登録
              </label>
              <select
                value={cardFilter}
                onChange={(e) => setCardFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全て</option>
                <option value="registered">登録済み</option>
                <option value="unregistered">未登録</option>
              </select>
            </div>
          </div>

          {/* フィルターリセットボタン */}
          {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all' || cardFilter !== 'all') && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setCardFilter('all');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
              >
                🔄 フィルターをリセット
              </button>
            </div>
          )}
        </div>

        {/* ユーザー一覧テーブル */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メール
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    表示名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役割
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    カード
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    従業員ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    組織
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {user.displayName || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {user.cardNumber ? (
                        <span className="text-green-600">●●●●{user.cardNumber}</span>
                      ) : (
                        <span className="text-gray-400">未登録</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {user.employeeId || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="text-xs">
                        {user.blockName && <div>📍 {user.blockName}</div>}
                        {user.regionName && <div className="text-gray-500">└ {user.regionName}</div>}
                        {user.baseName && <div className="text-gray-500 ml-2">└ {user.baseName}</div>}
                        {!user.blockName && !user.regionName && !user.baseName && '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {canEdit(user) && (
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            ✏️
                          </button>
                        )}
                        {canDelete(user) && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-600 hover:text-red-900"
                          >
                            🗑️
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

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  前へ
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{startIndex + 1}</span>
                    {' '}〜{' '}
                    <span className="font-medium">{Math.min(endIndex, filteredUsers.length)}</span>
                    {' '}件 / 全{' '}
                    <span className="font-medium">{filteredUsers.length}</span>
                    {' '}件
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      前へ
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      次へ
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 編集モーダル */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">ユーザー情報を編集</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    disabled
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">表示名</label>
                  <input
                    type="text"
                    value={editingUser.displayName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  />
                </div>

                {currentUser?.role === 'admin' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">役割</label>
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700">状態</label>
                      <select
                        value={editingUser.status}
                        onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                      >
                        <option value="active">有効</option>
                        <option value="inactive">無効</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">カード番号（下4桁）</label>
                  <input
                    type="text"
                    value={editingUser.cardNumber || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, cardNumber: e.target.value })}
                    placeholder="例: 1234"
                    maxLength={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">従業員ID</label>
                  <input
                    type="text"
                    value={editingUser.employeeId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, employeeId: e.target.value })}
                    placeholder="例: 100029"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">ブロック</label>
                  <select
                    value={selectedBlockId}
                    onChange={(e) => handleBlockChange(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
                  >
                    <option value="">選択してください</option>
                    {blocks.map((block) => (
                      <option key={block.id} value={block.id}>{block.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">地域</label>
                  <select
                    value={selectedRegionId}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    disabled={!selectedBlockId}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border disabled:bg-gray-100"
                  >
                    <option value="">選択してください</option>
                    {filteredRegions.map((region) => (
                      <option key={region.id} value={region.id}>{region.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">拠点</label>
                  <select
                    value={editingUser.baseId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, baseId: e.target.value })}
                    disabled={!selectedRegionId}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border disabled:bg-gray-100"
                  >
                    <option value="">選択してください</option>
                    {filteredBases.map((base) => (
                      <option key={base.id} value={base.id}>{base.name}</option>
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
