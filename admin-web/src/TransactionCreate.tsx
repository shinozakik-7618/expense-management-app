import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { auth, db, storage, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, Timestamp, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Category { id: string; name: string; displayOrder: number; }

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'10px 14px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'white', fontSize:'15px', boxSizing:'border-box' };
const labelStyle: React.CSSProperties = { display:'block', marginBottom:'7px', color:'rgba(255,255,255,0.75)', fontWeight:'600', fontSize:'14px' };
const btnNav = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' as const };

function TransactionCreate() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    amount: '', merchantName: '', categoryId: '', memo: '', expenseDestination: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<'user'|'environment'>('environment');

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);

  const loadCategories = async () => {
    try {
      const q = query(collection(db, 'categories'), orderBy('displayOrder'));
      const snapshot = await getDocs(q);
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Category));
    } catch (error) { console.error('用途取得エラー:', error); }
  };

  const startCamera = async () => {
    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } });
        setFacingMode('user');
      }
      setStream(mediaStream); setShowCamera(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (error) { console.error('カメラ起動エラー:', error); alert('カメラの起動に失敗しました'); }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current; const canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
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

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null); }
    setShowCamera(false);
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    if (stream) stream.getTracks().forEach(track => track.stop());
    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: newMode }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        setFacingMode(newMode);
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } });
      }
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (error) { console.error('カメラ切り替えエラー:', error); alert('カメラの切り替えに失敗しました'); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setPreviewUrls(files.map(file => URL.createObjectURL(file)));
    if (files.length > 0) {
      setLoading(true);
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressedFile = await imageCompression(files[0], { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.9 });
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            const result: any = await httpsCallable(functions, 'analyzeReceipt')({ image: base64 });
            if (result.data.success) {
              const data = (result.data as any).data;
              setFormData(prev => ({ ...prev, amount: data.amount != null ? String(data.amount) : prev.amount, merchantName: data.merchantName || prev.merchantName, transactionDate: data.date || prev.transactionDate }));
              alert('領収書を自動認識しました！');
            } else { alert('認識失敗: ' + (result.data.error || '不明なエラー')); }
          } catch(e: any) { console.error('OCRエラー:', e.message); alert('OCRエラー: ' + e.message); }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) { console.error('OCRエラー:', error); alert('領収書の認識に失敗しました'); }
      finally { setLoading(false); }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
  };

  const handleAmountInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    let value = input.value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    value = value.replace(/[^\d]/g, '');
    setFormData({ ...formData, amount: value });
    if (value) input.value = Number(value).toLocaleString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) { alert('ログインしてください'); return; }
    if (!formData.amount || Number(formData.amount) === 0) { alert('金額を入力してください'); return; }
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      let userBlockId = null, userRegionId = null, userBaseId = null;
      if (userDoc.exists()) {
        const ud = userDoc.data();
        userBlockId = ud.blockId; userRegionId = ud.regionId; userBaseId = ud.baseId;
      }
      const transactionRef = await addDoc(collection(db, 'transactions'), {
        userId: auth.currentUser.uid, organizationId: 'org001',
        blockId: userBlockId || null, regionId: userRegionId || null, baseId: userBaseId || null,
        transactionDate: Timestamp.fromDate(new Date(formData.transactionDate)),
        amount: Number(String(formData.amount).replace(/[^0-9]/g, "")), merchantName: formData.merchantName,
        categoryId: formData.categoryId, memo: formData.memo, expenseDestination: formData.expenseDestination,
        status: 'pending', approvalRoute: 'regional', receiptCount: selectedFiles.length,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now()
      });
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileName = `${Date.now()}_${i}_${file.name}`;
        const storageRef = ref(storage, `receipts/${transactionRef.id}/${fileName}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        await addDoc(collection(db, 'receipts'), { transactionId: transactionRef.id, fileName: file.name, fileSize: file.size, fileType: file.type, storagePath: `receipts/${transactionRef.id}/${fileName}`, downloadURL, uploadedAt: Timestamp.now() });
      }
      alert('取引を登録しました'); navigate('/transactions');
    } catch (error) { console.error('登録エラー:', error); alert('登録に失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div style={dark}>
      <div style={{ maxWidth:'800px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>➕ 新規取引登録</h1>
            <div style={{ display:'flex', gap:'0.6rem' }}>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
            </div>
          </div>
        </div>

        {/* フォームカード */}
        <div style={{ ...card, padding:'2rem' }}>
          <form onSubmit={handleSubmit}>
            {/* 領収書 */}
            <div style={{ marginBottom:'22px' }}>
              <label style={labelStyle}>領収書（JPEG形式）</label>
              <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:'10px', marginBottom:'10px' }}>
                <label style={{ flex:1, padding:'11px', background:'rgba(33,150,243,0.2)', color:'#93c5fd', border:'1px solid rgba(33,150,243,0.4)', borderRadius:'8px', cursor:'pointer', textAlign:'center', fontWeight:'600' }}>
                  📁 ファイルを選択
                  <input type="file" accept="image/jpeg,image/jpg,image/png" multiple onChange={handleFileChange} style={{ display:'none' }} />
                </label>
                <button type="button" onClick={startCamera} style={{ flex:1, padding:'11px', background:'rgba(76,175,80,0.2)', color:'#86efac', border:'1px solid rgba(76,175,80,0.4)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' }}>📷 カメラで撮影</button>
              </div>
              {showCamera && (
                <div style={{ marginTop:'10px', background:'#000', borderRadius:'8px', padding:'10px' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', borderRadius:'6px' }} />
                  <canvas ref={canvasRef} style={{ display:'none' }} />
                  <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:'10px', marginTop:'10px' }}>
                    <button type="button" onClick={capturePhoto} style={{ flex:1, padding:'11px', background:'rgba(33,150,243,0.8)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600' }}>📸 撮影</button>
                    <button type="button" onClick={switchCamera} style={{ flex:1, padding:'11px', background:'rgba(255,152,0,0.8)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600' }}>🔄 カメラ切替</button>
                    <button type="button" onClick={stopCamera} style={{ flex:1, padding:'11px', background:'rgba(244,67,54,0.8)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600' }}>✕ キャンセル</button>
                  </div>
                </div>
              )}
              {loading && <div style={{ marginTop:'10px', padding:'10px 14px', background:'rgba(124,92,191,0.2)', border:'1px solid rgba(124,92,191,0.4)', borderRadius:'8px', color:'#c4b5fd', fontWeight:'600' }}>📄 領収書を解析中...</div>}
              {previewUrls.length > 0 && (
                <div style={{ marginTop:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'10px' }}>
                  {previewUrls.map((url, index) => (
                    <div key={index} style={{ position:'relative' }}>
                      <img src={url} alt={`preview-${index}`} style={{ width:'100%', height:'140px', objectFit:'cover', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.15)' }} />
                      <button type="button" onClick={() => removeFile(index)} style={{ position:'absolute', top:'5px', right:'5px', background:'rgba(220,38,38,0.85)', color:'white', border:'none', borderRadius:'50%', width:'24px', height:'24px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 取引日 */}
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>取引日 *</label>
              <input type="date" value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} style={inputStyle} required />
            </div>
            {/* 金額 */}
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>金額（税込・円） *</label>
              <input type="text" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} onInput={handleAmountInput} placeholder="3,000" style={inputStyle} required />
              <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', marginTop:'4px' }}>全角数字も自動で半角に変換されます</div>
            </div>
            {/* 店舗名 */}
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>店舗（会社）名 *</label>
              <input type="text" value={formData.merchantName} onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })} placeholder="セブンイレブン" style={inputStyle} required />
            </div>
            {/* 用途 */}
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>用途 *</label>
              <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} style={{ ...inputStyle, appearance:'none' }} required>
                <option value="" style={{ background:'#1e1b4b' }}>選択してください</option>
                {categories.map(cat => <option key={cat.id} value={cat.id} style={{ background:'#1e1b4b' }}>{cat.name}</option>)}
              </select>
            </div>
            {/* メモ */}
            <div style={{ marginBottom:'20px' }}>
              <label style={labelStyle}>メモ（目的、人数等）</label>
              <textarea value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} rows={3} style={{ ...inputStyle, resize:'vertical' }} />
            </div>
            {/* 経費計上先 */}
            <div style={{ marginBottom:'28px' }}>
              <label style={labelStyle}>経費計上先</label>
              <input type="text" value={formData.expenseDestination} onChange={(e) => setFormData({ ...formData, expenseDestination: e.target.value })} placeholder="拠点または部署" style={inputStyle} />
            </div>
            {/* ボタン */}
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
              <button type="submit" disabled={loading} style={{ padding:'12px 28px', background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color: loading ? 'rgba(255,255,255,0.4)' : 'white', border:'none', borderRadius:'8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight:'700', fontSize:'15px' }}>
                {loading ? '登録中...' : '✅ 登録'}
              </button>
              <button type="button" onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button type="button" onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
export default TransactionCreate;