import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

interface Category { id: string; name: string; }

const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'10px 14px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'white', fontSize:'15px', boxSizing:'border-box' };
const labelStyle: React.CSSProperties = { display:'block', marginBottom:'7px', color:'rgba(255,255,255,0.75)', fontWeight:'600', fontSize:'14px' };

export default function TransactionEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({ transactionDate:'', amount:'', merchantName:'', categoryId:'', memo:'' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const formatAmount = (value: string) => { const n = value.replace(/[^0-9]/g,''); return n ? Number(n).toLocaleString() : ''; };
  const parseAmount  = (value: string) => value.replace(/,/g,'');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try { await Promise.all([loadCategories(), id ? loadTransaction(id) : Promise.resolve()]); }
      finally { setLoading(false); }
    };
    loadData();
  }, [id]);

  const loadCategories = async () => {
    try {
      const q = query(collection(db, 'categories'), orderBy('displayOrder'));
      const snapshot = await getDocs(q);
      const data: Category[] = [];
      snapshot.forEach((doc) => { data.push({ id: doc.id, name: doc.data().name }); });
      setCategories(data);
    } catch (error) { console.error('用途マスタの取得に失敗:', error); }
  };

  const loadTransaction = async (transactionId: string) => {
    try {
      const docSnap = await getDoc(doc(db, 'transactions', transactionId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          transactionDate: data.transactionDate?.toDate?.()?.toISOString().split('T')[0] || '',
          amount: data.amount?.toString() || '', merchantName: data.merchantName || '',
          categoryId: data.categoryId || '', memo: data.memo || ''
        });
      } else { alert('取引が見つかりません'); navigate('/transactions'); }
    } catch (error) { console.error('取引の取得に失敗:', error); alert('取引の取得に失敗しました'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !formData.transactionDate || !formData.amount || !formData.merchantName || !formData.categoryId) {
      alert('必須項目を入力してください'); return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'transactions', id), {
        transactionDate: Timestamp.fromDate(new Date(formData.transactionDate)),
        amount: Number(formData.amount), merchantName: formData.merchantName,
        categoryId: formData.categoryId, memo: formData.memo, updatedAt: Timestamp.now()
      });
      alert('取引を更新しました'); navigate('/transactions');
    } catch (error) { console.error('取引の更新に失敗:', error); alert('取引の更新に失敗しました'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' }}>
      <div style={{ maxWidth:'800px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>✏️ 取引編集</h1>
            <button onClick={() => navigate('/transactions')} style={{ padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' }}>← 戻る</button>
          </div>
        </div>

        {/* フォームカード */}
        <div style={{ ...card, padding:'2rem' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>取引日 <span style={{ color:'#f87171' }}>*</span></label>
              <input type="date" value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} required style={inputStyle} />
            </div>
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>金額（税込・円） <span style={{ color:'#f87171' }}>*</span></label>
              <input type="text" value={formatAmount(formData.amount)} onChange={(e) => setFormData({ ...formData, amount: parseAmount(e.target.value) })} required style={inputStyle} />
            </div>
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>加盟店名 <span style={{ color:'#f87171' }}>*</span></label>
              <input type="text" value={formData.merchantName} onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })} required style={inputStyle} />
            </div>
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>用途 <span style={{ color:'#f87171' }}>*</span></label>
              <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} required style={{ ...inputStyle, appearance:'none' }}>
                <option value="" style={{ background:'#1e1b4b' }}>選択してください</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id} style={{ background:'#1e1b4b' }}>{cat.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>メモ</label>
              <textarea value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} rows={3} style={{ ...inputStyle, resize:'vertical' }} />
            </div>
            <div style={{ padding:'12px 16px', background:'rgba(255,165,0,0.12)', border:'1px solid rgba(255,165,0,0.3)', borderRadius:'8px', marginBottom:'22px', fontSize:'13px', color:'#fcd34d' }}>
              ⚠️ 証憑画像の編集は「詳細」画面から行ってください
            </div>
            <button type="submit" disabled={saving} style={{ width:'100%', padding:'13px', fontSize:'15px', fontWeight:'700', color: saving ? 'rgba(255,255,255,0.4)' : 'white', background: saving ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', border:'none', borderRadius:'8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '更新中...' : '✅ 更新'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}