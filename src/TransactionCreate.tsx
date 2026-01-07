import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';

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
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;

    // すべてのファイルを受け入れる（HEIC含む）
    setFiles(prev => [...prev, ...selectedFiles]);

    // プレビュー生成
    for (const file of selectedFiles) {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('プレビュー生成エラー:', error);
        // エラーでもファイルは追加する
        setPreviews(prev => [...prev, '']);
      }
    }

    // input をリセット
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
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

      // 取引データを登録
      const transactionRef = await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        organizationId: 'org001',
        transactionDate: Timestamp.fromDate(new Date(formData.transactionDate)),
        amount: Number(formData.amount),
        merchantName: formData.merchantName,
        categoryId: formData.categoryId,
        memo: formData.memo,
        status: 'pending',
        approvalRoute: 'regional',
        receiptCount: files.length,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // 画像をアップロード
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const timestamp = Date.now();
        const fileName = `${timestamp}_${i}_${file.name}`;
        const storagePath = `receipts/${transactionRef.id}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        // 証憑データを登録
        await addDoc(collection(db, 'receipts'), {
          transactionId: transactionRef.id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          storagePath: storagePath,
          downloadURL: downloadURL,
          uploadedAt: Timestamp.now()
        });
      }

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
            金額（税込・円） <span style={{ color: 'red' }}>*</span>
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

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            証憑画像
          </label>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              📷 写真を撮る
            </button>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              📁 ファイル選択
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div style={{ fontSize: '12px', color: '#666' }}>
            ※ iPhone/iPad で撮影する場合は「📷 写真を撮る」をタップしてください<br/>
            ※ カメラ機能はスマートフォン・タブレットでのみ動作します
          </div>
        </div>

        {previews.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              選択中のファイル（{files.length}件）
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {files.map((file, index) => (
                <div key={index} style={{ position: 'relative', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
                  {previews[index] ? (
                    <img 
                      src={previews[index]} 
                      alt={file.name}
                      style={{ 
                        width: '100%', 
                        height: '150px', 
                        objectFit: 'cover', 
                        borderRadius: '4px',
                        marginBottom: '5px'
                      }} 
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '150px',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      marginBottom: '5px',
                      fontSize: '40px'
                    }}>
                      📷
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', wordBreak: 'break-all' }}>
                    {file.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
