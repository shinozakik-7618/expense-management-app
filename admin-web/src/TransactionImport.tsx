import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { auth, db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

interface ImportData { transactionDate: string; amount: string; merchantName: string; memo: string; }

const dark = { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d2b55 100%)', padding:'2rem' };
const card = { background:'rgba(255,255,255,0.07)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'16px' };
const btnNav: React.CSSProperties = { padding:'10px 18px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', cursor:'pointer', fontWeight:'600' };
const btnPrimary: React.CSSProperties = { padding:'12px 28px', background:'linear-gradient(135deg,#7c5cbf 0%,#a855f7 100%)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'15px' };

function TransactionImport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ImportData[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { const text = event.target?.result as string; parseCSV(text); };
    reader.readAsText(file, 'UTF-8');
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const data: ImportData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      if (columns.length >= 4) {
        data.push({ transactionDate: columns[0].trim(), amount: columns[1].trim(), merchantName: columns[2].trim(), memo: columns[3].trim() });
      }
    }
    setPreviewData(data);
    setShowPreview(true);
  };

  const handleImport = async () => {
    if (!auth.currentUser) { alert('ログインしてください'); return; }
    setLoading(true);
    try {
      for (const item of previewData) {
        await addDoc(collection(db, 'transactions'), {
          userId: auth.currentUser.uid, organizationId: 'org001',
          transactionDate: Timestamp.fromDate(new Date(item.transactionDate)),
          amount: Number(item.amount), merchantName: item.merchantName, memo: item.memo,
          status: 'pending', approvalRoute: 'regional', receiptCount: 0,
          createdAt: Timestamp.now(), updatedAt: Timestamp.now()
        });
      }
      alert(`${previewData.length}件のデータをインポートしました`);
      navigate('/transactions');
    } catch (error) { console.error('インポートエラー:', error); alert('インポートに失敗しました'); }
    finally { setLoading(false); }
  };

  return (
    <div style={dark}>
      <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
        {/* ヘッダー */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
            <h1 style={{ fontSize:'2rem', fontWeight:'800', color:'white', margin:0 }}>📥 取引データインポート</h1>
            <div style={{ display:'flex', gap:'0.6rem' }}>
              <button onClick={() => navigate('/dashboard')} style={btnNav}>📊 ダッシュボード</button>
              <button onClick={() => navigate('/transactions')} style={btnNav}>📝 取引一覧</button>
            </div>
          </div>
        </div>

        {/* CSVフォーマット説明 */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <h3 style={{ color:'rgba(255,255,255,0.8)', fontSize:'1rem', fontWeight:'700', marginTop:0, marginBottom:'12px' }}>📋 CSVフォーマット例</h3>
          <pre style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'14px 18px', color:'rgba(255,255,255,0.7)', fontSize:'13px', overflowX:'auto', margin:0 }}>
{`取引日,金額,加盟店名,メモ
2026-01-08,5000,セブンイレブン,朝食
2026-01-08,3000,ローソン,昼食`}
          </pre>
        </div>

        {/* ファイル選択 */}
        <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem' }}>
          <h3 style={{ color:'rgba(255,255,255,0.8)', fontSize:'1rem', fontWeight:'700', marginTop:0, marginBottom:'14px' }}>CSVファイルを選択</h3>
          <input type="file" accept=".csv" onChange={handleFileUpload}
            style={{ display:'block', width:'100%', padding:'10px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'rgba(255,255,255,0.7)', cursor:'pointer', boxSizing:'border-box' }} />
          {showPreview && (
            <div style={{ marginTop:'14px', padding:'12px 16px', background:'rgba(79,172,254,0.12)', border:'1px solid rgba(79,172,254,0.3)', borderRadius:'8px', color:'#7dd3fc', fontWeight:'600' }}>
              ✅ {previewData.length}件のデータを読み込みました
            </div>
          )}
        </div>

        {/* プレビューテーブル */}
        {showPreview && (
          <div style={{ ...card, padding:'1.5rem 2rem', marginBottom:'1.5rem', overflowX:'auto' }}>
            <h3 style={{ color:'white', fontSize:'1rem', fontWeight:'700', marginTop:0, marginBottom:'14px' }}>プレビュー（{previewData.length}件）</h3>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(255,255,255,0.05)' }}>
                  {['取引日','金額','加盟店名','メモ'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'0.75rem', fontWeight:'700', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((item, index) => (
                  <tr key={index} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.7)' }}>{item.transactionDate}</td>
                    <td style={{ padding:'10px 14px', color:'white', fontWeight:'600' }}>¥{Number(item.amount).toLocaleString()}</td>
                    <td style={{ padding:'10px 14px', color:'white' }}>{item.merchantName}</td>
                    <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.6)' }}>{item.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ボタン */}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button onClick={() => navigate('/transactions')} style={btnNav}>キャンセル</button>
          <button onClick={handleImport} disabled={!showPreview || loading}
            style={{ ...btnPrimary, opacity: (!showPreview || loading) ? 0.5 : 1, cursor: (!showPreview || loading) ? 'not-allowed' : 'pointer' }}>
            {loading ? 'インポート中...' : '📥 インポート実行'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default TransactionImport;