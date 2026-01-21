import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { auth } from '../firebase';
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
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
  const keepPageRef = useRef<number | null>(null);

  
  // 現在のユーザー情報
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter, cardFilter]);

  const loadData = async () => {

    try {

      
      // 現在のユーザー情報を取得
      const currentUserAuth = await new Promise<any>((resolve) => { const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); }); });
      if (currentUserAuth) {
        const userRef = doc(db, 'users', currentUserAuth.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setCurrentUser({ uid: currentUserAuth.uid, ...(userSnap.data() as any) } as User);
        } else {
          const userQuery = query(collection(db, 'users'), where('uid', '==', currentUserAuth.uid));
          const userDoc = await getDocs(userQuery);
          if (!userDoc.empty) {
            setCurrentUser({ uid: currentUserAuth.uid, ...(userDoc.docs[0].data() as any) } as User);
          }
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
    if (keepPageRef.current != null) { setCurrentPage(keepPageRef.current); keepPageRef.current = null; } else { setCurrentPage(1); } // フィルター変更時は1ページ目に戻る
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
    setTimeout(() => {
      const el = Array.from(document.querySelectorAll("h2")).find(h => h.textContent?.includes("ユーザー情報を編集"));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);

    setSelectedBlockId(user.blockId || '');
    setSelectedRegionId(user.regionId || '');
  };


  // 招待（InviteAccept）用：新規ユーザーを pending で作り、招待URLを発行
  const [createEmail, setCreateEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const handleCreateInvite = async () => {
    try {
      if (!currentUser || currentUser.role !== "admin") {
        alert("管理者のみ実行できます");
        return;
      }
      const email = createEmail.trim();
      if (!email) {
        alert("メールアドレスを入力してください");
        return;
      }

      // 既存チェック（email が既に users にある場合は作らない）
      const q = query(collection(db, "users"), where("email", "==", email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        alert("このメールは既に登録されています");
        return;
      }

      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const uid = "invite_" + token.slice(0, 20);

      await setDoc(doc(db, "users", uid), {
        uid,
        email,
        role: "user",
        status: "pending",
        inviteToken: token,
        tokenCreatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const url = "https://expense-management-pcdepot.web.app/invite-accept?token=" + token;
      setInviteUrl(url);
      alert("招待リンクを発行しました");
    } catch (e) {
      console.error(e);
      alert("招待リンクの発行に失敗しました");
    }
  };
    keepPageRef.current = currentPage;


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
      block_manager: { label: 'ブロック・部署長', className: 'bg-amber-100 text-amber-800' },
      region_manager: { label: '地域代表', className: 'bg-green-100 text-green-800' },
      base_manager: { label: '経営管理・管理責任者', className: 'bg-indigo-100 text-indigo-800' },
      user: { label: '一般ユーザー', className: 'bg-blue-100 text-blue-800' }
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', animation: 'pulse 2s ease-in-out infinite' }}>✨ 読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* ヘッダー */}
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥 ユーザー管理</h1>
              <p className="text-gray-600 mt-1">
                総ユーザー数: {users.length}名 / 表示中: {filteredUsers.length}名
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => { console.log("open create modal"); setShowCreateModal(true); setTimeout(() => { const el = Array.from(document.querySelectorAll("h2")).find(h => h.textContent?.includes("新規ユーザー招待")); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 0); }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ➕ 新規ユーザー登録
              </button>
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
                🔓 ログアウト
              </button>
            </div>
          </div>
        </div>

        {/* フィルター・検索エリア */}
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
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
                <option value="block_manager">ブロック・部署長</option>
                <option value="region_manager">地域代表</option>
                <option value="base_manager">経営管理・管理責任者</option>
                <option value="user">一般ユーザー</option>
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
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メール
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    表示名
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役割
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">
                    カード
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">
                    従業員ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">
                    組織
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {currentUsers.map((user, index) => (
                  <tr key={user.uid} style={{ backgroundColor: index % 2 === 0 ? "white" : "#f3f4f6" }} className="hover:bg-gray-50 border-b border-gray-300">
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
                      {user.cardNumber ? (
                        <span className="text-green-600">●●●●{user.cardNumber}</span>
                      ) : (
                        <span className="text-gray-400">未登録</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.employeeId || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="text-xs">
                        {user.blockName && <div>📍 {user.blockName}</div>}
                        {user.regionName && <div className="text-gray-500">└ {user.regionName}</div>}
                        {user.baseName && <div className="text-gray-500 ml-2">└ {user.baseName}</div>}
                        {!user.blockName && !user.regionName && !user.baseName && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999]">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto fixed top-[10%] mx-auto shadow-2xl ring-4 ring-indigo-300 ring-opacity-60 shadow-2xl ring-4 ring-indigo-300 ring-opacity-60">
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
                        <option value="block_manager">ブロック・部署長</option>
                        <option value="region_manager">地域代表</option>
                        <option value="base_manager">経営管理・管理責任者</option>
                        <option value="user">一般ユーザー</option>
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

        {/* 新規作成モーダル */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto fixed top-[10%] mx-auto shadow-2xl ring-4 ring-blue-300 ring-opacity-60">
              <h2 className="text-xl font-bold mb-4">新規ユーザー招待</h2>
              <p className="text-sm text-gray-600 mb-4">メールアドレスを入力して招待リンクを発行します（本人がリンクからパスワード設定して有効化）。</p>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {inviteUrl && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-sm font-medium text-blue-900 mb-2">招待リンク</div>
                  <div className="text-xs break-all text-blue-800">{inviteUrl}</div>
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteUrl)}
                    className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    コピー
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => { setShowCreateModal(false); setCreateEmail(""); setInviteUrl(""); }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  閉じる
                </button>
                <button
                  onClick={handleCreateInvite}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  招待リンクを発行
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
