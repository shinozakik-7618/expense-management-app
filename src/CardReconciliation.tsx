import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { auth, db } from './firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

interface CardTransaction {
  transactionDate: string;
  amount: number;
  merchantName: string;
  cardNumber?: string;
}

interface Mismatch {
  type: 'not_registered' | 'amount_mismatch' | 'merchant_mismatch';
  cardData: CardTransaction;
  systemData?: any;
  message: string;
}

export default function CardReconciliation() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciled, setReconciled] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const data: CardTransaction[] = [];

      // ヘッダー行をスキップ
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = line.split(',');
        if (columns.length >= 3) {
          data.push({
            transactionDate: columns[0].trim(),
            amount: Number(columns[1].trim()),
            merchantName: columns[2].trim(),
            cardNumber: columns[3]?.trim() || ''
          });
        }
      }

      setCardTransactions(data);
      setReconciled(false);
      setMismatches([]);
    };
    reader.readAsText(file);
  };

  const handleReconcile = async () => {
    if (cardTransactions.length === 0) {
      alert('CSVファイルを選択してください');
      return;
    }

    setLoading(true);
    const foundMismatches: Mismatch[] = [];

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('ログインしてください');
        setLoading(false);
        return;
      }

      // システムの全取引を取得
      const transactionsRef = collection(db, 'transactions');
      const snapshot = await getDocs(query(transactionsRef));
      const systemTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 各カード請求データを照合
      for (const cardTx of cardTransactions) {
        const cardDate = new Date(cardTx.transactionDate);
        
        // 同じ日付・同じ金額の取引を検索
        const matchingTx = systemTransactions.find(sysTx => {
          const sysDate = sysTx.transactionDate?.toDate();
          if (!sysDate) return false;

          const isSameDate = 
            sysDate.getFullYear() === cardDate.getFullYear() &&
            sysDate.getMonth() === cardDate.getMonth() &&
            sysDate.getDate() === cardDate.getDate();

          return isSameDate && sysTx.amount === cardTx.amount;
        });

        if (!matchingTx) {
          // 未登録
          foundMismatches.push({
            type: 'not_registered',
            cardData: cardTx,
            message: `この取引はシステムに登録されていません`
          });
        } else {
          // 金額は一致しているが、加盟店名が異なる場合
          if (matchingTx.merchantName !== cardTx.merchantName) {
            foundMismatches.push({
              type: 'merchant_mismatch',
              cardData: cardTx,
              systemData: matchingTx,
              message: `加盟店名が異なります（システム: ${matchingTx.merchantName}）`
            });
          }
        }
      }

      setMismatches(foundMismatches);
      setReconciled(true);
    } catch (error) {
      console.error('突合エラー:', error);
      alert('突合処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getMismatchBadge = (type: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      not_registered: { bg: 'bg-red-500', text: 'text-white', label: '未登録' },
      amount_mismatch: { bg: 'bg-orange-500', text: 'text-white', label: '金額不一致' },
      merchant_mismatch: { bg: 'bg-yellow-500', text: 'text-white', label: '加盟店名不一致' }
    };
    const badge = badges[type] || badges.not_registered;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">💳 カード請求突合</h1>
            <p className="mt-2 text-sm text-gray-600">
              カード会社の請求データとシステムの取引データを照合します
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
            >
              ダッシュボード
            </button>
            <button
              onClick={() => navigate('/transactions')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              取引一覧
            </button>
          </div>
        </div>

        {/* CSVアップロードエリア */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">カード請求CSVをアップロード</h2>
          
          {/* フォーマット説明 */}
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">📋 CSVフォーマット</h3>
            <pre className="text-xs text-blue-800 font-mono">
取引日,金額,加盟店名,カード番号
2026-01-08,5000,セブンイレブン,****1234
2026-01-08,3000,ローソン,****1234
2026-01-07,2000,ファミリーマート,****1234
            </pre>
          </div>

          {/* ファイル選択 */}
          <div className="mb-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* プレビュー */}
          {cardTransactions.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                📊 読み込み件数: <span className="font-bold">{cardTransactions.length}件</span>
              </p>
            </div>
          )}

          {/* 突合ボタン */}
          <div className="flex gap-4">
            <button
              onClick={handleReconcile}
              disabled={cardTransactions.length === 0 || loading}
              className={`px-6 py-2 rounded-lg font-semibold ${
                cardTransactions.length === 0 || loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {loading ? '突合中...' : '突合を実行'}
            </button>
            <button
              onClick={() => navigate('/transactions')}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              キャンセル
            </button>
          </div>
        </div>

        {/* 突合結果 */}
        {reconciled && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                突合結果
                {mismatches.length === 0 ? (
                  <span className="ml-3 text-green-600">✅ 不一致なし</span>
                ) : (
                  <span className="ml-3 text-red-600">⚠️ {mismatches.length}件の不一致</span>
                )}
              </h2>
            </div>

            {mismatches.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                🎉 すべての取引が一致しています
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">取引日</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">加盟店名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">詳細</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mismatches.map((mismatch, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getMismatchBadge(mismatch.type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {mismatch.cardData.transactionDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          ¥{mismatch.cardData.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {mismatch.cardData.merchantName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {mismatch.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
