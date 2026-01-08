import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db, storage } from './firebase';
import { collection, addDoc, Timestamp, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Category {
  id: string;
  name: string;
  displayOrder: number;
}

function TransactionCreate() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    amount: '',
    merchantName: '',
    categoryId: '',
    memo: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const q = query(collection(db, 'categories'), orderBy('displayOrder'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Category));
      setCategories(data);
    } catch (error) {
      console.error('用途取得エラー:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
  };

  const handleAmountInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    let value = input.value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    value = value.replace(/[^\d]/g, '');
    setFormData({ ...formData, amount: value });
    if (value) {
      input.value = Number(value).toLocaleString();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert('ログインしてください');
      return;
    }
    
    if (!formData.amount || Number(formData.amount) === 0) {
      alert('金額を入力してください');
      return;
    }
    
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      let userBlockId = null;
      let userRegionId = null;
      let userBaseId = null;
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userBlockId = userData.blockId;
        userRegionId = userData.regionId;
        userBaseId = userData.baseId;
      }
      const transactionRef = await addDoc(collection(db, 'transactions'), {
        userId: auth.currentUser.uid,
        organizationId: 'org001',
        blockId: userBlockId,
        regionId: userRegionId,
        baseId: userBaseId,
        transactionDate: Timestamp.fromDate(new Date(formData.transactionDate)),
        amount: Number(formData.amount),
        merchantName: formData.merchantName,
        categoryId: formData.categoryId,
        memo: formData.memo,
        status: 'pending',
        approvalRoute: 'regional',
        receiptCount: selectedFiles.length,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const timestamp = Date.now();
        const fileName = `${timestamp}_${i}_${file.name}`;
        const storageRef = ref(storage, `receipts/${transactionRef.id}/${fileName}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        await addDoc(collection(db, 'receipts'), {
          transactionId: transactionRef.id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          storagePath: `receipts/${transactionRef.id}/${fileName}`,
          downloadURL: downloadURL,
          uploadedAt: Timestamp.now()
        });
      }
      alert('取引を登録しました');
      navigate('/transactions');
    } catch (error) {
      console.error('登録エラー:', error);
      alert('登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>新規取引登録</h1>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>取引日 *</label>
          <input type="date" value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>金額（税込・円） *</label>
          <input 
            type="text" 
            onInput={handleAmountInput}
            placeholder="3,000" 
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
            required 
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            全角数字も自動で半角に変換されます
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>加盟店名 *</label>
          <input type="text" value={formData.merchantName} onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })} placeholder="セブンイレブン" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>用途 *</label>
          <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required>
            <option value="">選択してください</option>
            {categories.map(category => (<option key={category.id} value={category.id}>{category.name}</option>))}
          </select>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>メモ</label>
          <textarea value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} rows={3} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>証憑画像（JPEG形式）</label>
          <input type="file" accept="image/jpeg,image/jpg,image/png" multiple onChange={handleFileChange} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          {previewUrls.length > 0 && (
            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {previewUrls.map((url, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <img src={url} alt={`preview-${index}`} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }} />
                  <button type="button" onClick={() => removeFile(index)} style={{ position: 'absolute', top: '5px', right: '5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={() => navigate('/transactions')} style={{ padding: '12px 24px', background: '#9E9E9E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>戻る</button>
          <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: loading ? '#ccc' : '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>{loading ? '登録中...' : '登録'}</button>
        </div>
      </form>
    </div>
  );
}

export default TransactionCreate;
