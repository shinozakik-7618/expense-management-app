import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { auth, db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

interface ImportData {
  transactionDate: string;
  amount: string;
  merchantName: string;
  memo: string;
}

function TransactionImport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ImportData[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const data: ImportData[] = [];

    // ヘッダー行をスキップ
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      if (columns.length >= 4) {
        data.push({
          transactionDate: columns[0].trim(),
          amount: columns[1].trim(),
          merchantName: columns[2].trim(),
          memo: columns[3].trim()
        });
      }
    }

    setPreviewData(data);
    setShowPreview(true);
  };

  const handleImport = async () => {
    if (!auth.currentUser) {
      alert('ログインしてください');
      return;
    }

    setLoading(true);
    try {
      for (const item of previewData) {
        await addDoc(collection(db, 'transactions'), {
          userId: auth.currentUser.uid,
          organizationId: 'org001',
          transactionDate: Timestamp.fromDate(new Date(item.transactionDate)),
          amount: Number(item.amount),
          merchantName: item.merchantName,
          memo: item.memo,
          status: 'pending',
          approvalRoute: 'regional',
          receiptCount: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      alert(`${previewData.length}件のデータをインポートしました`);
      navigate('/transactions');
    } catch (error) {
      console.error('インポートエラー:', error);
      alert('インポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>取引データインポート</h1>

      <div style={{ background: '#f5f5f5', padding: '15px', marginBottom: '20px', borderRadius: '8px' }}>
        <h3>CSVフォーマット例</h3>
        <pre>
取引日,金額,加盟店名,メモ
2026-01-08,5000,セブンイレブン,朝食
2026-01-08,3000,ローソン,昼食
        </pre>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          CSVファイルを選択
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '100%'
          }}
        />
      </div>

      {showPreview && (
        <div style={{ marginTop: '20px' }}>
          <h3>プレビュー（{previewData.length}件）</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>取引日</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>金額</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>加盟店名</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>メモ</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((item, index) => (
                  <tr key={index}>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.transactionDate}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.amount}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.merchantName}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button
          onClick={() => navigate('/transactions')}
          style={{
            padding: '12px 24px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          キャンセル
        </button>
        <button
          onClick={handleImport}
          disabled={!showPreview || loading}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            background: showPreview && !loading ? '#2196F3' : '#ccc',
            color: 'white',
            cursor: showPreview && !loading ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? 'インポート中...' : 'インポート'}
        </button>
      </div>
    </div>
  );
}

export default TransactionImport;
