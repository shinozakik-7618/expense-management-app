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
  const [createRole, setCreateRole] = useState('user');
  const [inviteUrl, setInviteUrl] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{displayName:string,email:string,role:string}[]>([]);
  const [csvResults, setCsvResults] = useState<{email:string,password:string,status:string}[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);

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

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    return Array.from({length:12}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  };

  const handleCreateInvite = async () => {
    try {
      if (!currentUser || currentUser.role !== 'admin') { alert('管理者のみ実行できます'); return; }
      const email = createEmail.trim();
      const displayName = createDisplayName.trim();
      if (!email) { alert('メールアドレスを入力してください'); return; }
      if (!displayName) { alert('表示名を入力してください'); return; }
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const existingData = snapshot.docs[0].data();
        const isAuthCreated = existingData.uid && !existingData.uid.startsWith('invite_') && existingData.uid.length > 10;
        if (isAuthCreated && existingData.status === 'active') {
          if (!window.confirm(`${email} は既に登録済みです。上書き登録しますか？`)) return;
        }
        for (const d of snapshot.docs) { await deleteDoc(doc(db, 'users', d.id)); }
      }
      const password = generatePassword();
      const { initializeApp: initApp, getApps, deleteApp } = await import('firebase/app');
      const { getAuth: getAuth2, createUserWithEmailAndPassword, signOut: signOut2 } = await import('firebase/auth');
      const fbConfig = { apiKey:'AIzaSyCK5ua2HWKuJPvTz3k1UeG9_P4J6gV9Q2M', authDomain:'expense-management-pcdepot.firebaseapp.com', projectId:'expense-management-pcdepot', storageBucket:'expense-management-pcdepot.firebasestorage.app', messagingSenderId:'748756390310', appId:'1:748756390310:web:e823a9976d4c1ec8bdbf67' };
      const appName = 'secondary_' + Date.now();
      const secApp = initApp(fbConfig, appName);
      const secAuth = getAuth2(secApp);
      const { user: newUser } = await createUserWithEmailAndPassword(secAuth, email, password);
      await signOut2(secAuth);
      await deleteApp(secApp);
      await setDoc(doc(db, 'users', newUser.uid), { uid:newUser.uid, email, displayName, role:createRole, status:'active', createdAt:Timestamp.now(), updatedAt:Timestamp.now() });
      setGeneratedPassword(password);
      loadData();
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/email-already-in-use') alert('このメールアドレスはFirebase Authに既に存在します。Firebaseコンソールからパスワードリセットしてください。');
      else alert('アカウント作成に失敗しました: ' + e.message);
    }
    keepPageRef.current = currentPage;
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const rows = lines.slice(1).map(line => {
        const parts = line.split(',').map((s:string) => s.trim());
        return { displayName: parts[0]||'', email: parts[1]||'', role: parts[2]||'user' };
      }).filter((r: {displayName:string,email:string,role:string}) => r.email);
      setCsvPreview(rows); setCsvResults([]);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleBulkCreate = async () => {
    if (!csvPreview.length) return;
    setCsvProcessing(true);
    const results: {email:string,password:string,status:string}[] = [];
    const { initializeApp: initApp2, deleteApp: delApp2 } = await import('firebase/app');
    const { getAuth: getAuth3, createUserWithEmailAndPassword: createUser2, signOut: signOut3 } = await import('firebase/auth');
    const fbConfig2 = { apiKey:'AIzaSyCK5ua2HWKuJPvTz3k1UeG9_P4J6gV9Q2M', authDomain:'expense-management-pcdepot.firebaseapp.com', projectId:'expense-management-pcdepot', storageBucket:'expense-management-pcdepot.firebasestorage.app', messagingSenderId:'748756390310', appId:'1:748756390310:web:e823a9976d4c1ec8bdbf67' };
    for (const row of csvPreview) {
      try {
        const q2 = query(collection(db,'users'),where('email','==',row.email));
        const snap2 = await getDocs(q2);
        for (const d of snap2.docs) { await deleteDoc(doc(db,'users',d.id)); }
        const pw = generatePassword();
        const appName2 = 'bulk_' + Date.now();
        const secApp2 = initApp2(fbConfig2, appName2);
        const secAuth2 = getAuth3(secApp2);
        const { user: newU } = await createUser2(secAuth2, row.email, pw);
        await signOut3(secAuth2);
        await delApp2(secApp2);
        await setDoc(doc(db,'users',newU.uid), { uid:newU.uid, email:row.email, displayName:row.displayName, role:row.role||'user', status:'active', createdAt:Timestamp.now(), updatedAt:Timestamp.now() });
        results.push({email:row.email, password:pw, status:'成功'});
      } catch(err) {
        const msg = err instanceof Error ? err.message : '不明なエラー';
        results.push({email:row.email, password:'', status:'失敗: '+msg});
      }
    }
    setCsvResults(results); setCsvProcessing(false); setCsvPreview([]); loadData();
  };

  const downloadCsvResults = () => {
    const header = 'email,password,status';
    const rows = csvResults.map(r => `${r.email},${r.password},${r.status}`);
    const blob = new Blob([header+'\n'+rows.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='initial_passwords.csv'; a.click();
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

  const handlePasswordReset = async (user: User) => {
    if (!user.email) { alert('メールアドレスが登録されていません'); return; }
    if (!window.confirm(`${user.displayName || user.email} にパスワードリセットメールを送信しますか？`)) return;
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, user.email);
      alert(`パスワードリセットメールを ${user.email} に送信しました`);
    } catch (error) { console.error(error); alert('メール送信に失敗しました'); }
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
              <button onClick={()=>{ setShowCsvModal(true); setCsvPreview([]); setCsvResults([]); }} style={{ ...btnPrimary, background:'linear-gradient(135deg,#f59e0b,#d97706)' }}>📥 CSV一括登録</button>
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
                      <button onClick={() => handlePasswordReset(user)} style={{ padding:'5px 10px', background:'rgba(251,191,36,0.15)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.3)', borderRadius:'6px', cursor:'pointer', fontSize:'0.8rem' }}>🔑</button>
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
          <div style={{ ...modalCard, width:'90%', maxWidth:'420px' }}>
            <h2 style={{ color:'white', fontSize:'1.2rem', fontWeight:'700', marginTop:0, marginBottom:'8px' }}>➕ 新規ユーザー登録</h2>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'13px', marginBottom:'18px' }}>入力するとアカウントを即座に作成します。初期パスワードは自動生成されます。</p>
            <div style={{ marginBottom:'14px' }}>
              <label style={modalLabelStyle}>表示名（氏名） *</label>
              <input type="text" value={createDisplayName} onChange={(e)=>setCreateDisplayName(e.target.value)} placeholder="山田 太郎" style={modalInputStyle} />
            </div>
            <div style={{ marginBottom:'14px' }}>
              <label style={modalLabelStyle}>メールアドレス *</label>
              <input type="email" value={createEmail} onChange={(e)=>setCreateEmail(e.target.value)} placeholder="user@pcdepot.co.jp" style={modalInputStyle} />
            </div>
            <div style={{ marginBottom:'14px' }}>
              <label style={modalLabelStyle}>役割</label>
              <select value={createRole} onChange={(e)=>setCreateRole(e.target.value)} style={{ ...modalInputStyle, appearance:'none', marginTop:'6px' }}>
                <option value="user" style={{background:'#1e1b3a'}}>一般ユーザー</option>
                <option value="admin" style={{background:'#1e1b3a'}}>管理者</option>
                <option value="block_manager" style={{background:'#1e1b3a'}}>ブロック・部署長</option>
                <option value="region_manager" style={{background:'#1e1b3a'}}>地域代表</option>
                <option value="base_manager" style={{background:'#1e1b3a'}}>経営管理・管理責任者</option>
              </select>
            </div>
            {generatedPassword && (
              <div style={{ marginBottom:'14px', padding:'16px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.35)', borderRadius:'10px' }}>
                <div style={{ color:'#6ee7b7', fontSize:'13px', fontWeight:'700', marginBottom:'8px' }}>✅ アカウント作成完了！</div>
                <div style={{ color:'rgba(255,255,255,0.6)', fontSize:'12px', marginBottom:'6px' }}>初期パスワード（ユーザーに伝えてください）：</div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <code style={{ color:'white', fontSize:'16px', fontWeight:'700', letterSpacing:'2px', background:'rgba(0,0,0,0.3)', padding:'8px 14px', borderRadius:'8px', flex:1 }}>{generatedPassword}</code>
                  <button onClick={()=>{ navigator.clipboard.writeText(generatedPassword); alert('コピーしました'); }} style={{ padding:'8px 14px', background:'rgba(52,211,153,0.3)', color:'#6ee7b7', border:'1px solid rgba(52,211,153,0.5)', borderRadius:'6px', cursor:'pointer', fontSize:'0.82rem', fontWeight:'700' }}>📋 コピー</button>
                </div>
                <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'11px', marginTop:'8px' }}>* ユーザーにはログイン後にパスワード変更を依頼してください</div>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'1.5rem' }}>
              <button onClick={()=>{ setShowCreateModal(false); setCreateEmail(''); setCreateDisplayName(''); setGeneratedPassword(''); setInviteUrl(''); setCreateRole('user'); }} style={btnNav}>閉じる</button>
              {!generatedPassword && <button onClick={handleCreateInvite} style={btnPrimary}>➕ アカウント作成</button>}
            </div>
          </div>
        </div>
      )}

      {/* CSV一括登録モーダル */}
      {showCsvModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'1rem' }}>
          <div style={{ ...modalCard, width:'100%', maxWidth:'560px', maxHeight:'85vh', overflowY:'auto' }}>
            <h2 style={{ color:'white', fontSize:'1.2rem', fontWeight:'700', marginTop:0, marginBottom:'8px' }}>📥 CSV一括ユーザー登録</h2>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'12px', marginBottom:'16px' }}>CSV形式: displayName,email,role （1行目はヘッダー）</p>
            {!csvResults.length && (
              <div style={{ marginBottom:'16px' }}>
                <input type='file' accept='.csv' onChange={handleCsvUpload} style={{ color:'rgba(255,255,255,0.8)', marginBottom:'12px', display:'block' }} />
                {csvPreview.length > 0 && (
                  <div>
                    <div style={{ color:'#a78bfa', fontSize:'13px', marginBottom:'8px' }}>プレビュー: {csvPreview.length}件</div>
                    <div style={{ maxHeight:'200px', overflowY:'auto', background:'rgba(0,0,0,0.3)', borderRadius:'8px', padding:'8px' }}>
                      {csvPreview.map((r,i) => (
                        <div key={i} style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
                          {r.displayName} | {r.email} | {r.role}
                        </div>
                      ))}
                    </div>
                    <button onClick={handleBulkCreate} disabled={csvProcessing} style={{ ...btnPrimary, marginTop:'12px', width:'100%', opacity:csvProcessing?0.6:1 }}>
                      {csvProcessing ? '登録中...' : `✅ ${csvPreview.length}件一括登録開始`}
                    </button>
                  </div>
                )}
              </div>
            )}
            {csvResults.length > 0 && (
              <div>
                <div style={{ color:'#6ee7b7', fontSize:'13px', fontWeight:'700', marginBottom:'8px' }}>登録完了！ 初期パスワード一覧をダウンロードしてください</div>
                <div style={{ maxHeight:'250px', overflowY:'auto', background:'rgba(0,0,0,0.3)', borderRadius:'8px', padding:'8px', marginBottom:'12px' }}>
                  {csvResults.map((r,i) => (
                    <div key={i} style={{ fontSize:'12px', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.1)', color: r.status==='成功'?'#6ee7b7':'#f87171' }}>
                      {r.email} {r.status==='成功' ? `| PW: ${r.password}` : `| ${r.status}`}
                    </div>
                  ))}
                </div>
                <button onClick={downloadCsvResults} style={{ ...btnPrimary, background:'linear-gradient(135deg,#10b981,#059669)', width:'100%' }}>📥 初期パスワードCSVダウンロード</button>
              </div>
            )}
            <button onClick={()=>setShowCsvModal(false)} style={{ ...btnNav, marginTop:'16px', width:'100%' }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagement;