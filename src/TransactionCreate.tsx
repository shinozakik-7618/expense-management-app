import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { auth, db, storage, functions } from './firebase';
import { httpsCallable } from "firebase/functions";
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
    memo: '',
    expenseDestination: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  useEffect(() => {
    loadCategories();
  }, []);


  // videoタグにストリームを設定
  useEffect(() => {
    if (videoRef.current && stream) {
      console.log("useEffect: videoタグにストリームを設定");
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
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


  // カメラを起動
  const startCamera = async () => {
    try {
      // まずバックカメラを試す
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
      } catch (backError) {
        console.log("バックカメラ失敗、フロントカメラにフォールバック");
        // バックカメラが使えない場合、フロントカメラを使用
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        setFacingMode("user"); // フロントカメラに設定
      }
      
      console.log("カメラストリーム:", mediaStream);
      console.log("ビデオトラック:", mediaStream.getVideoTracks());
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        console.log("videoRef.current存在:", !!videoRef.current);
        console.log("ストリーム設定完了");
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('カメラ起動エラー:', error);
      alert('カメラの起動に失敗しました');
    }
  };
  // 写真を撮影
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
    console.log("capturePhoto呼び出し");
    console.log("videoRef.current:", videoRef.current);
    console.log("canvasRef.current:", canvasRef.current);
      const video = videoRef.current;
      console.log("video.videoWidth:", video.videoWidth);
      console.log("video.videoHeight:", video.videoHeight);
      console.log("video.readyState:", video.readyState);
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
            await handleFileChange({ target: { files: [file] } } as any);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  // カメラを停止
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  // カメラを切り替え
  const switchCamera = async () => {
    const newFacingMode = facingMode === "environment" ? "user" : "environment";
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: newFacingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        setFacingMode(newFacingMode);
      } catch (error) {
        console.log("カメラ切替失敗、利用可能なカメラを使用");
        // 切り替えが失敗した場合、利用可能なカメラを使用
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
      }
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("カメラ切り替えエラー:", error);
      alert("カメラの切り替えに失敗しました");
    }
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);

    // 最初の画像でOCR実行
    if (files.length > 0) {
      setLoading(true);
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        
        const file = files[0];
        
        // 画像圧縮オプション（品質90%、最大幅1920px）
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          initialQuality: 0.9
        };
        
        // 画像を圧縮
        const compressedFile = await imageCompression(file, options);
        
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const analyzeReceipt = httpsCallable(functions, 'analyzeReceipt');
          const result: any = await analyzeReceipt({ image: base64 });
          
          if (result.data.success) {
            const data = result.data.data;
            setFormData(prev => ({
              ...prev,
              amount: data.amount ? data.amount.toLocaleString() : prev.amount,
              merchantName: data.merchantName || prev.merchantName,
              transactionDate: data.date || prev.transactionDate
            }));
            alert('領収書を自動認識しました！');
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('OCRエラー:', error);
        alert('領収書の認識に失敗しました');
      } finally {
        setLoading(false);
      }
    }
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
        blockId: userBlockId || null,
        regionId: userRegionId || null,
        baseId: userBaseId || null,
        transactionDate: Timestamp.fromDate(new Date(formData.transactionDate)),
        amount: Number(formData.amount),
        merchantName: formData.merchantName,
        categoryId: formData.categoryId,
        memo: formData.memo,
        expenseDestination: formData.expenseDestination,
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>新規取引登録</h1>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {/* 1. 領収書（JPEG形式） */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>領収書（JPEG形式）</label>
          
          {/* ボタン */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <label style={{ flex: 1, padding: '12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold' }}>
              📁 ファイルを選択
              <input type="file" accept="image/jpeg,image/jpg,image/png" multiple onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
            <button type="button" onClick={startCamera} style={{ flex: 1, padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              📷 カメラで撮影
            </button>
          </div>

          {/* カメラプレビュー */}
          {showCamera && (
            <div style={{ marginTop: '10px', background: '#000', borderRadius: '4px', padding: '10px' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: '4px' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={capturePhoto} style={{ flex: 1, padding: '12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  📸 撮影
                </button>
                <button type="button" onClick={switchCamera} style={{ flex: 1, padding: '12px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🔄 カメラ切替
                </button>
                <button type="button" onClick={stopCamera} style={{ flex: 1, padding: '12px', background: '#F44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ✕ キャンセル
                </button>
              </div>
            </div>
          )}

          {loading && <div style={{ marginTop: "10px", padding: "10px", background: "#E3F2FD", borderRadius: "4px", color: "#1976D2", fontWeight: "bold" }}>📄 領収書を解析中...</div>}
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
        {/* 2. 取引日 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>取引日 *</label>
          <input type="date" value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required />
        </div>
        
        {/* 3. 金額（税込・円） */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>金額（税込・円） *</label>
          <input 
            type="text" 
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            onInput={handleAmountInput}
            placeholder="3,000" 
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} 
            required 
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            全角数字も自動で半角に変換されます
          </div>
        </div>
        
        {/* 4. 店舗（会社）名 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>店舗（会社）名 *</label>
          <input type="text" value={formData.merchantName} onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })} placeholder="セブンイレブン" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required />
        </div>
        
        {/* 5. 用途 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>用途 *</label>
          <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required>
            <option value="">選択してください</option>
            {categories.map(category => (<option key={category.id} value={category.id}>{category.name}</option>))}
          </select>
        </div>
        
        {/* 6. メモ（目的、人数等） */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>メモ（目的、人数等）</label>
          <textarea value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} rows={3} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        
        {/* 7. 経費計上先 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>経費計上先</label>
          <input type="text" value={formData.expenseDestination} onChange={(e) => setFormData({ ...formData, expenseDestination: e.target.value })} placeholder="拠点または部署" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        
        {/* 8. ボタン */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" disabled={loading} style={{ padding: "12px 24px", background: loading ? "#ccc" : "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold" }}>{loading ? "登録中..." : "登録"}</button>
          <button type="button" onClick={() => navigate("/dashboard")} style={{ padding: "12px 24px", background: "#6B7280", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>📊 ダッシュボード</button>
          <button type="button" onClick={() => navigate("/transactions")} style={{ padding: "12px 24px", background: "#6B7280", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>📝 取引一覧</button>
        </div>
      </form>
        </div>
      </div>
  );
}
export default TransactionCreate;
