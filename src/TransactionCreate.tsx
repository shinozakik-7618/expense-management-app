import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

interface Category {
  id: string;
  name: string;
}

export default function TransactionCreate() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    transactionDate: '',
    amount: '',
    merchantName: '',
    categoryId: '',
    memo: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const q = query(collection(db, 'categories'), orderBy('displayOrder'));
      const snapshot = await getDocs(q);
      const data: Category[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, name: doc.data().name });
      });
      setCategories(data);
    } catch (error) {
      console.error('用途マスタの取得に失敗:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.transactionDate || !formData.amount || !formData.merchantName || !formData.categoryId) {
      alert('必須項目を入力してください');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        alert('ログインしてください');
        return;
      }

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        organizationId: 'org001',
        transactionDate: Timestamp.fromDate(new Date(formData.transactionDate)),
        amount: Number(formData.amount),
        merchantName: formData.merchantName,
        categoryId: formData.categoryId,
        memo: formData.memo,
        status: 'pending',
        approvalRoute: 'regional',
        receiptCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      alert('取引を登録しました');
      navigate('/transactions');
    } catch (error) {
      console.error('取引の登録に失敗:', error);
      alert('取引の登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>取引登録</h1>
        <button 
          onClick={() => navigate('/transactions')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          戻る
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            取引日 <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="date"
            value={formData.transactionDate}
            onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            金額（円） <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
            min="0"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            加盟店名 <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={formData.merchantName}
            onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            用途 <span style={{ color: 'red' }}>*</span>
          </label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          >
            <option value="">選択してください</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            メモ
          </label>
          <textarea
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: loading ? '#ccc' : '#007bff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '登録中...' : '登録'}
        </button>
      </form>
    </div>
  );
}
