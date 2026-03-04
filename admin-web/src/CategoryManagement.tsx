import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

interface Category { id: string; name: string; displayOrder: number; description?: string; isActive: boolean; }

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav: React.CSSProperties = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' };

export default function CategoryManagement() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'categories'), orderBy('displayOrder'));
      const snapshot = await getDocs(q);
      const data: Category[] = [];
      snapshot.forEach((doc) => { data.push({ id: doc.id, ...doc.data() } as Category); });
      setCategories(data);
    } catch (error) { console.error('用途マスタの取得に失敗:', error); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)' }}>
      <div style={{ fontSize:'1.5rem', fontWeight:'bold', color:'white' }}>✨ 読み込み中...</div>
    </div>
  );

  return (
    <div style={dark}>
      <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>📌 用途マスタ管理</h1>
            <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
          </div>
        </div>

        {/* テーブル */}
        <div style={{ ...card, padding:'1.5rem 2rem' }}>
          {categories.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'rgba(255,255,255,0.4)', fontSize:'1.1rem' }}>用途マスタが登録されていません</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.05)' }}>
                    {['表示順','用途名','説明','ステータス'].map(h => (
                      <th key={h} style={{ padding:'0.9rem 1rem', textAlign: h==='ステータス'?'center':'left', fontSize:'0.75rem', fontWeight:'700', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', transition:'background 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding:'0.9rem 1rem', color:'rgba(255,255,255,0.6)', fontSize:'0.9rem' }}>{category.displayOrder}</td>
                      <td style={{ padding:'0.9rem 1rem', color:'white', fontWeight:'600' }}>{category.name}</td>
                      <td style={{ padding:'0.9rem 1rem', color:'rgba(255,255,255,0.55)', fontSize:'0.9rem' }}>{category.description || '-'}</td>
                      <td style={{ padding:'0.9rem 1rem', textAlign:'center' }}>
                        <span style={{ padding:'4px 14px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:'700',
                          background: category.isActive ? 'rgba(79,172,254,0.15)' : 'rgba(239,68,68,0.15)',
                          color: category.isActive ? '#7dd3fc' : '#fca5a5',
                          border: `1px solid ${category.isActive ? 'rgba(79,172,254,0.4)' : 'rgba(239,68,68,0.3)'}` }}>
                          {category.isActive ? '有効' : '無効'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}