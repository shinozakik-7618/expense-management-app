import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

interface Category {
  id: string;
  name: string;
  displayOrder: number;
  description?: string;
  isActive: boolean;
}

export default function CategoryManagement() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'categories'), orderBy('displayOrder'));
      const snapshot = await getDocs(q);
      
      const data: Category[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Category);
      });
      
      setCategories(data);
    } catch (error) {
      console.error('用途マスタの取得に失敗:', error);
    } finally {
      setLoading(false);
    }
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
        <h1>用途マスタ管理</h1>
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

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>表示順</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>用途名</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>説明</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{category.displayOrder}</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{category.name}</td>
                <td style={{ padding: '12px', color: '#666' }}>{category.description || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: category.isActive ? '#d4edda' : '#f8d7da',
                    color: category.isActive ? '#155724' : '#721c24'
                  }}>
                    {category.isActive ? '有効' : '無効'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {categories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          用途マスタが登録されていません
        </div>
      )}
    </div>
  );
}
