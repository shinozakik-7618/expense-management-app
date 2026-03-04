import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface User { uid: string; email: string; displayName?: string; role: string; status: string; cardNumber?: string; employeeId?: string; blockId?: string; blockName?: string; regionId?: string; regionName?: string; baseId?: string; baseName?: string; createdAt?: any; updatedAt?: any; }
interface Block { id: string; name: string; }
interface Region { id: string; name: string; blockId: string; }
interface Base { id: string; name: string; regionId: string; }

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav: React.CSSProperties = { padding:'9px 16px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'0.88rem' };
const btnPrimary: React.CSSProperties = { padding:'9px 18px', background:'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'0.88rem' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'white', fontSize:'14px', boxSizing:'border-box' };
const labelStyle: React.CSSProperties = { display:'block', marginBottom:'6px', color:'rgba(255,255,255,0.65)', fontSize:'13px', fontWeight:'600' };

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
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const keepPageRef = useRef<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { filterUsers(); }, [users, searchTerm, roleFilter, statusFilter, cardFilter]);

  const loadData = async () => {
    try {
      const currentUserAuth = await new Promise<any>((resolve) => { const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); }); });
      if (currentUserAuth) {
        const userRef = doc(db, 'users', currentUserAuth.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) { setCurrentUser({ uid: currentUserAuth.uid, ...(userSnap.data() as any) } as User); }
        else {
          const userQuery = query(collection(db, 'users'), where('uid', '==', currentUserAuth.uid));
          const userDoc = await getDocs(userQuery);
          if (!userDoc.empty) setCurrentUser({ uid: currentUserAuth.uid, ...(userDoc.docs[0].data() as any) } as User);
        }
      }
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];
      usersSnapshot.forEach((doc) => { usersData.push({ uid: doc.id, ...doc.data() } as User); });
      setUsers(usersData);
      const blocksSnapshot = await getDocs(collection(db, 'blocks'));
      setBlocks(blocksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Block));
      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      setRegions(regionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Region));
      const basesSnapshot = await getDocs(collection(db, 'bases'));
      setBases(basesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Base));
    } catch (error) { console.error('データ読み込みエラー:', error); }
    finally { setLoading(false); }
  };

  const filterUsers = () => {
    let filtered = [...users];
    if (searchTerm) filtered = filtered.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) || (u.employeeId && u.employeeId.includes(searchTerm)));
    if (roleFilter !== 'all') filtered = filtered.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(u => u.status === statusFilter);
    if (cardFilter === 'registered') filtered = filtered.filter(u => u.cardNumber && u.cardNumber.length > 0);
    else if (cardFilter === 'unregistered') filtered = filtered.filter(u => !u.cardNumber || u.cardNumber.length === 0);
    setFilteredUsers(filtered);
    if (keepPageRef.current != null) { setCurrentPage(keepPageRef.current); keepPageRef.current = null; } else { setCurrentPage(1); }
  };

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const canEdit = (user: User) => !!(currentUser && (currentUser.role === 'admin' || currentUser.uid === user.uid));
  const canDelete = (user: User) => !!(currentUser && currentUser.role === 'admin');

  const handleEdit = (user: User) => {
    if (!canEdit(user)) { alert('このユーザーを編集する権限がありません'); return; }
    setEditingUser({ ...user });
    setSelectedBlockId(user.blockId || '');
    setSelectedRegionId(user.regionId || '');
  };

  const handleCreateInvite = async () => {
    try {
      if (!currentUser || currentUser.role !== 'admin') { alert('管理者のみ実行できます'); return; }
      const email = createEmail.trim();
      if (!email) { alert('メールアドレスを入力してください'); return; }
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) { alert('このメールは既に登録されています'); return; }
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const uid = 'invite_' + token.slice(0, 20);
      await setDoc(doc(db, 'users', uid), { uid, email, role:'user', status:'pending', inviteToken:token, tokenCreatedAt:Timestamp.now(), createdAt:Timestamp.now(), updatedAt:Timestamp.now() });
      const url = 'https://expense-management-pcdepot.web.app/invite-accept?token=' + token;
      setInviteUrl(url);
      alert('招待リンクを発行しました');
    } catch (e) { console.error(e); alert('招待リンクの発行に失敗しました'); }
    keepPageRef.current = currentPage;
  };

  const handleSave = async () => {
    if (!editingUser) return;
    if (!canEdit(editingUser)) { alert('このユーザーを編集する権限がありません'); return; }
    try {
      const blockName = blocks.find(b => b.id === editingUser.blockId)?.name || '';
      const regionName = regions.find(r => r.id === editingUser.regionId)?.name || '';
      const baseName = bases.find(b => b.id === editingUser.baseId)?.name || '';
      await updateDoc(doc(db, 'users', editingUser.uid), { displayName:editingUser.displayName, role:editingUser.role, status:editingUser.status, cardNumber:editingUser.cardNumber||'', employeeId:editingUser.employeeId||'', blockId:editingUser.blockId||'', blockName, regionId:editingUser.regionId||'', regionName, baseId:editingUser.baseId||'', baseName, updatedAt:new Date() });
      alert('ユーザー情報を更新しました'); setEditingUser(null); loadData();
    } catch (error) { console.error('更新エラー:', error); alert('更新に失敗しました'); }
  };

  const handleDelete = async (user: User) => {
    if (!canDelete(user)) { alert('このユーザーを削除する権限がありません'); return; }
    if (!window.confirm(`${user.displayName || user.email} を削除しますか？`)) return;
    try { await deleteDoc(doc(db, 'users', user.uid)); alert('ユーザーを削除しました'); loadData(); }
    catch (error) { console.error('削除エラー:', error); alert('削除に失敗しました'); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/login'); } catch (error) { console.error('ログアウトエラー:', error); }
  };

  const handleBlockChange = (blockId: string) => {
    setSelectedBlockId(blockId); setSelectedRegionId('');
    if (editingUser) setEditingUser({ ...editingUser, blockId, regionId:'', baseId:'' });
  };
  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    if (editingUser) setEditingUser({ ...editingUser, regionId, baseId:'' });
  };

  const filteredRegions = selectedBlockId ? regions.filter(r => r.blockId === selectedBlockId) : [];
  const filteredBases = selectedRegionId ? bases.filter(b => b.regionId === selectedRegionId) : [];

  const getRoleBadge = (role: string) => {
    const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
      admin:          { label:'管理者',          bg:'rgba(168,85,247,0.15)', color:'#c4b5fd', border:'rgba(168,85,247,0.4)' },
      block_manager:  { label:'ブロック・部署長', bg:'rgba(251,191,36,0.15)', color:'#fcd34d', border:'rgba(251,191,36,0.4)' },
      region_manager: { label:'地域代表',         bg:'rgba(52,211,153,0.15)', color:'#6ee7b7', border:'rgba(52,211,153,0.4)' },
      base_manager:   { label:'経営管理・管理責任者', bg:'rgba(129,140,248,0.15)', color:'#a5b4fc', border:'rgba(129,140,248,0.4)' },
      user:           { label:'一般ユーザー',      bg:'rgba(79,172,254,0.15)', color:'#7dd3fc', border:'rgba(79,172,254,0.4)' },
    };
    const b = map[role] || { label:role, bg:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', border:'rgba(255,255,255,0.2)' };
    return <span style={{ padding:'3px 10px', fontSize:'0.75rem', fontWeight:'700', borderRadius:'20px', background:b.bg, color:b.color, border:`1px solid ${b.border}`, whiteSpace:'nowrap' }}>{b.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
      active:   { label:'有効', bg:'rgba(52,211,153,0.15)', color:'#6ee7b7', border:'rgba(52,211,153,0.4)' },
      inactive: { label:'無効', bg:'rgba(239,68,68,0.15)',  color:'#fca5a5', border:'rgba(239,68,68,0.35)' },
      pending:  { label:'招待中', bg:'rgba(251,191,36,0.15)', color:'#fcd34d', border:'rgba(251,191,36,0.35)' },
    };
    const b = map[status] || { label:status, bg:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', border:'rgba(255,255,255,0.2)' };
    return <span style={{ padding:'3px 10px', fontSize:'0.75rem', fontWeight:'700', borderRadius:'20px', background:b.bg, color:b.color, border:`1px solid ${b.border}` }}>{b.label}</span>;
  };

  const modalCard: React.CSSProperties = { background:'#1e1b3a', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'560px', maxHeight:'88vh', overflowY:'auto', position:'relative' };
  const modalInputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'white', fontSize:'14px', boxSizing:'border-box', marginTop:'6px' };
  const modalLabelStyle: React.CSSProperties = { display:'block', color:'rgba(255,255,255,0.65)', fontSize:'13px', fontWeight:'600' };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  return (
    <div style={dark}>
      <div style={{ maxWidth:'1400px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <div>
              <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:'0 0 4px 0' }}>👥 ユーザー管理</h1>
              <p style={{ color:'rgba(255,255,255,0.45)', margin:0, fontSize:'0.88rem' }}>総ユーザー数: {users.length}名 / 表示中: {filteredUsers.length}名</p>
            </div>
            <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
              <button onClick={() => { setShowCreateModal(true); setInviteUrl(''); setCreateEmail(''); }} style={btnPrimary}>➕ 新規ユーザー登録</button>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
              <button onClick={handleLogout} style={{ ...btnNav, color:'#fca5a5', borderColor:'rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)' }}>🔓 ログアウト</button>
            </div>
          </div>
        </div>

        {/* フィルター */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1rem' }}>
            {[
              { label:'🔍 検索', type:'text', placeholder:'名前・メール・従業員ID', value:searchTerm, onChange:(v:string)=>setSearchTerm(v), options:null },
              { label:'👤 役割', type:'select', value:roleFilter, onChange:(v:string)=>setRoleFilter(v), options:[['all','全て'],['admin','管理者'],['block_manager','ブロック・部署長'],['region_manager','地域代表'],['base_manager','経営管理・管理責任者'],['user','一般ユーザー']] },
              { label:'✓ 状態', type:'select', value:statusFilter, onChange:(v:string)=>setStatusFilter(v), options:[['all','全て'],['active','有効'],['inactive','無効']] },
              { label:'💳 カード登録', type:'select', value:cardFilter, onChange:(v:string)=>setCardFilter(v), options:[['all','全て'],['registered','登録済み'],['unregistered','未登録']] },
            ].map((f,i) => (
              <div key={i}>
                <label style={labelStyle}>{f.label}</label>
                {f.type==='text' ? (
                  <input type="text" placeholder={f.placeholder} value={f.value} onChange={(e)=>f.onChange(e.target.value)} style={inputStyle} />
                ) : (
                  <select value={f.value} onChange={(e)=>f.onChange(e.target.value)} style={{ ...inputStyle, appearance:'none' }}>
                    {f.options!.map(([v,l])=><option key={v} value={v} style={{ background:'#1e1b4b' }}>{l}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
          {(searchTerm || roleFilter!=='all' || statusFilter!=='all' || cardFilter!=='all') && (
            <div style={{ marginTop:'12px' }}>
              <button onClick={() => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); setCardFilter('all'); }} style={{ ...btnNav, fontSize:'0.82rem', padding:'7px 14px' }}>🔄 フィルターをリセット</button>
            </div>
          )}
        </div>

        {/* テーブル */}
        <div style={{ ...card, overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'800px' }}>
            <thead>
              <tr style={{ background:'rgba(255,255,255,0.05)' }}>
                {['メール','表示名','役割','状態','カード','従業員ID','組織','操作'].map(h => (
                  <th key={h} style={{ padding:'0.9rem 1rem', textAlign:'left', fontSize:'0.72rem', fontWeight:'700', color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.08)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user) => (
                <tr key={user.uid} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', transition:'background 0.15s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding:'0.8rem 1rem', color:'rgba(255,255,255,0.75)', fontSize:'0.85rem' }}>{user.email}</td>
                  <td style={{ padding:'0.8rem 1rem', color:'white', fontSize:'0.88rem', fontWeight:'500' }}>{user.displayName || '-'}</td>
                  <td style={{ padding:'0.8rem 1rem' }}>{getRoleBadge(user.role)}</td>
                  <td style={{ padding:'0.8rem 1rem' }}>{getStatusBadge(user.status)}</td>
                  <td style={{ padding:'0.8rem 1rem', fontSize:'0.85rem' }}>
                    {user.cardNumber ? <span style={{ color:'#7dd3fc' }}>●●●●{user.cardNumber}</span> : <span style={{ color:'rgba(255,255,255,0.3)' }}>未登録</span>}
                  </td>
                  <td style={{ padding:'0.8rem 1rem', color:'rgba(255,255,255,0.6)', fontSize:'0.85rem' }}>{user.employeeId || '-'}</td>
                  <td style={{ padding:'0.8rem 1rem', fontSize:'0.8rem', color:'rgba(255,255,255,0.55)' }}>
                    {user.blockName && <div>📍 {user.blockName}</div>}
                    {user.regionName && <div style={{ color:'rgba(255,255,255,0.4)' }}>└ {user.regionName}</div>}
                    {user.baseName && <div style={{ color:'rgba(255,255,255,0.35)', paddingLeft:'8px' }}>└ {user.baseName}</div>}
                    {!user.blockName && !user.regionName && !user.baseName && '-'}
                  </td>
                  <td style={{ padding:'0.8rem 1rem' }}>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {canEdit(user) && <button onClick={() => handleEdit(user)} style={{ padding:'5px 10px', background:'rgba(124,92,191,0.25)', color:'#c4b5fd', border:'1px solid rgba(124,92,191,0.45)', borderRadius:'6px', cursor:'pointer', fontSize:'0.8rem' }}>✏️</button>}
                      {canDelete(user) && <button onClick={() => handleDelete(user)} style={{ padding:'5px 10px', background:'rgba(239,68,68,0.15)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', cursor:'pointer', fontSize:'0.8rem' }}>🗑️</button>}
                      {!canEdit(user) && !canDelete(user) && <span style={{ color:'rgba(255,255,255,0.25)' }}>-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.8rem' }}>
              <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem' }}>
                {startIndex+1}〜{Math.min(startIndex+itemsPerPage, filteredUsers.length)}件 / 全{filteredUsers.length}件
              </span>
              <div style={{ display:'flex', gap:'4px' }}>
                <button onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage===1} style={{ ...btnNav, padding:'6px 12px', opacity:currentPage===1?0.4:1 }}>前へ</button>
                {Array.from({ length: totalPages }, (_,i) => i+1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    style={{ padding:'6px 12px', borderRadius:'8px', fontWeight:'600', fontSize:'0.85rem', cursor:'pointer', border:'1px solid', borderColor: currentPage===page?'rgba(168,85,247,0.6)':'rgba(255,255,255,0.15)', background: currentPage===page?'rgba(168,85,247,0.25)':'rgba(255,255,255,0.05)', color: currentPage===page?'#c4b5fd':'rgba(255,255,255,0.6)' }}>
                    {page}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))} disabled={currentPage===totalPages} style={{ ...btnNav, padding:'6px 12px', opacity:currentPage===totalPages?0.4:1 }}>次へ</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 編集モーダル */}
      {editingUser && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'1rem' }}>
          <div style={modalCard}>
            <h2 style={{ color:'white', fontSize:'1.2rem', fontWeight:'700', marginTop:0, marginBottom:'1.2rem' }}>✏️ ユーザー情報を編集</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div><label style={modalLabelStyle}>メールアドレス</label><input type="email" value={editingUser.email} disabled style={{ ...modalInputStyle, opacity:0.5 }} /></div>
              <div><label style={modalLabelStyle}>表示名</label><input type="text" value={editingUser.displayName||''} onChange={(e)=>setEditingUser({...editingUser,displayName:e.target.value})} style={modalInputStyle} /></div>
              {currentUser?.role==='admin' && (
                <>
                  <div>
                    <label style={modalLabelStyle}>役割</label>
                    <select value={editingUser.role} onChange={(e)=>setEditingUser({...editingUser,role:e.target.value})} style={{ ...modalInputStyle, appearance:'none' }}>
                      {[['admin','管理者'],['block_manager','ブロック・部署長'],['region_manager','地域代表'],['base_manager','経営管理・管理責任者'],['user','一般ユーザー']].map(([v,l])=><option key={v} value={v} style={{background:'#1e1b3a'}}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={modalLabelStyle}>状態</label>
                    <select value={editingUser.status} onChange={(e)=>setEditingUser({...editingUser,status:e.target.value})} style={{ ...modalInputStyle, appearance:'none' }}>
                      <option value="active" style={{background:'#1e1b3a'}}>有効</option>
                      <option value="inactive" style={{background:'#1e1b3a'}}>無効</option>
                    </select>
                  </div>
                </>
              )}
              <div><label style={modalLabelStyle}>カード番号（下4桁）</label><input type="text" value={editingUser.cardNumber||''} onChange={(e)=>setEditingUser({...editingUser,cardNumber:e.target.value})} placeholder="例: 1234" maxLength={4} style={modalInputStyle} /></div>
              <div><label style={modalLabelStyle}>従業員ID</label><input type="text" value={editingUser.employeeId||''} onChange={(e)=>setEditingUser({...editingUser,employeeId:e.target.value})} placeholder="例: 100029" style={modalInputStyle} /></div>
              <div>
                <label style={modalLabelStyle}>ブロック</label>
                <select value={selectedBlockId} onChange={(e)=>handleBlockChange(e.target.value)} style={{ ...modalInputStyle, appearance:'none' }}>
                  <option value="" style={{background:'#1e1b3a'}}>選択してください</option>
                  {blocks.map(b=><option key={b.id} value={b.id} style={{background:'#1e1b3a'}}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={modalLabelStyle}>地域</label>
                <select value={selectedRegionId} onChange={(e)=>handleRegionChange(e.target.value)} disabled={!selectedBlockId} style={{ ...modalInputStyle, appearance:'none', opacity:!selectedBlockId?0.5:1 }}>
                  <option value="" style={{background:'#1e1b3a'}}>選択してください</option>
                  {filteredRegions.map(r=><option key={r.id} value={r.id} style={{background:'#1e1b3a'}}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={modalLabelStyle}>拠点</label>
                <select value={editingUser.baseId||''} onChange={(e)=>setEditingUser({...editingUser,baseId:e.target.value})} disabled={!selectedRegionId} style={{ ...modalInputStyle, appearance:'none', opacity:!selectedRegionId?0.5:1 }}>
                  <option value="" style={{background:'#1e1b3a'}}>選択してください</option>
                  {filteredBases.map(b=><option key={b.id} value={b.id} style={{background:'#1e1b3a'}}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'1.5rem' }}>
              <button onClick={()=>setEditingUser(null)} style={btnNav}>キャンセル</button>
              <button onClick={handleSave} style={btnPrimary}>💾 保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'1rem' }}>
          <div style={modalCard}>
            <h2 style={{ color:'white', fontSize:'1.2rem', fontWeight:'700', marginTop:0, marginBottom:'8px' }}>➕ 新規ユーザー招待</h2>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'13px', marginBottom:'18px' }}>メールアドレスを入力して招待リンクを発行します（本人がリンクからパスワード設定して有効化）。</p>
            <div style={{ marginBottom:'14px' }}>
              <label style={modalLabelStyle}>メールアドレス</label>
              <input type="email" value={createEmail} onChange={(e)=>setCreateEmail(e.target.value)} placeholder="user@example.com" style={modalInputStyle} />
            </div>
            {inviteUrl && (
              <div style={{ marginBottom:'14px', padding:'14px', background:'rgba(124,92,191,0.15)', border:'1px solid rgba(124,92,191,0.35)', borderRadius:'10px' }}>
                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', fontWeight:'600', marginBottom:'8px' }}>招待リンク</div>
                <div style={{ color:'#c4b5fd', fontSize:'12px', wordBreak:'break-all', marginBottom:'10px' }}>{inviteUrl}</div>
                <button onClick={()=>navigator.clipboard.writeText(inviteUrl)} style={{ padding:'6px 14px', background:'rgba(168,85,247,0.3)', color:'#c4b5fd', border:'1px solid rgba(168,85,247,0.5)', borderRadius:'6px', cursor:'pointer', fontSize:'0.82rem', fontWeight:'600' }}>📋 コピー</button>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'1.5rem' }}>
              <button onClick={()=>{ setShowCreateModal(false); setCreateEmail(''); setInviteUrl(''); }} style={btnNav}>閉じる</button>
              <button onClick={handleCreateInvite} style={btnPrimary}>📨 招待リンクを発行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagement;