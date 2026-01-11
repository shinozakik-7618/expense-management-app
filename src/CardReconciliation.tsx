import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { auth, db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface CardTransaction {
  transactionDate: string;
  amount: number;
  merchantName: string;
  cardNumber?: string;
  accountHolderLastName?: string;
  accountHolderFirstName?: string;
  employeeId?: string;
}

interface SystemTransaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  userId: string;
  status: string;
}

interface Mismatch {
  type: 'not_registered' | 'date_mismatch' | 'amount_mismatch';
  cardData: CardTransaction;
  systemData?: SystemTransaction;
  message: string;
}

export default function CardReconciliation() {
  const navigate = useNavigate();
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciled, setReconciled] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const data: CardTransaction[] = [];

      console.log('📂 ファイル読み込み開始');
      console.log('総行数:', lines.length);

      if (lines.length > 0) {
        console.log('ヘッダー行:', lines[0].substring(0, 100));
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const separator = line.includes('\t') ? '\t' : ',';
        const columns = line.split(separator);

        if (i === 1) {
          console.log('区切り文字:', separator === '\t' ? 'タブ' : 'カンマ');
          console.log('列数:', columns.length);
        }

        if (columns.length < 10) continue;

        const transactionDate = columns[2]?.trim();
        const amountStr = columns[36]?.trim();
        const merchantName = columns[12]?.trim();
        const cardNumber = columns[3]?.trim();
        const accountHolderLastName = columns[7]?.trim();
        const accountHolderFirstName = columns[8]?.trim();
        const employeeId = columns[9]?.trim();

        if (!transactionDate || !amountStr) continue;

        const amount = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
        if (isNaN(amount)) continue;

        data.push({
          transactionDate,
          amount,
          merchantName: merchantName || '',
          cardNumber,
          accountHolderLastName,
          accountHolderFirstName,
          employeeId: employeeId !== '-' ? employeeId : undefined,
        });
      }

      console.log('✅ 読み込み完了:', data.length, '件');
      setCardTransactions(data);
      setReconciled(false);
      setMismatches([]);
    };

    reader.readAsText(file);
  };

  const handleReconcile = async () => {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('ログインしてください');
        setLoading(false);
        return;
      }

      const transactionsRef = collection(db, 'transactions');
      const snapshot = await getDocs(transactionsRef);
      
      const systemTransactions: SystemTransaction[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SystemTransaction));

      console.log('システム取引件数:', systemTransactions.length);
      console.log('カード請求件数:', cardTransactions.length);

      const newMismatches: Mismatch[] = [];

      for (const cardTx of cardTransactions) {
        const cardDateParts = cardTx.transactionDate.split('/');
        const cardDate = `${cardDateParts[0]}-${cardDateParts[1].padStart(2, '0')}-${cardDateParts[2].padStart(2, '0')}`;

        let dateMatch: SystemTransaction | undefined;
        let amountMatch: SystemTransaction | undefined;
        let perfectMatch: SystemTransaction | undefined;

        for (const sysTx of systemTransactions) {
          const sysDate = sysTx.transactionDate?.toDate();
          if (!sysDate) continue;

          const sysDateStr = `${sysDate.getFullYear()}-${String(sysDate.getMonth() + 1).padStart(2, '0')}-${String(sysDate.getDate()).padStart(2, '0')}`;

          const dateMatches = sysDateStr === cardDate;
          const amountMatches = Math.abs(sysTx.amount - cardTx.amount) < 1;

          if (dateMatches && amountMatches) {
            perfectMatch = sysTx;
            break;
          } else if (dateMatches && !dateMatch) {
            dateMatch = sysTx;
          } else if (amountMatches && !amountMatch) {
            amountMatch = sysTx;
          }
        }

        if (perfectMatch) {
          console.log('✅ 一致:', cardTx.merchantName);
        } else if (amountMatch) {
          newMismatches.push({
            type: 'date_mismatch',
            cardData: cardTx,
            systemData: amountMatch,
            message: '金額は一致していますが、取引日が異なります'
          });
        } else if (dateMatch) {
          newMismatches.push({
            type: 'amount_mismatch',
            cardData: cardTx,
            systemData: dateMatch,
            message: '取引日は一致していますが、金額が異なります'
          });
        } else {
          newMismatches.push({
            type: 'not_registered',
            cardData: cardTx,
            message: 'この取引はシステムに登録されていません'
          });
        }
      }

      setMismatches(newMismatches);
      setReconciled(true);

      console.log('突合完了:', {
        一致件数: cardTransactions.length - newMismatches.length,
        不一致件数: newMismatches.length
      });

    } catch (error) {
      console.error('突合エラー:', error);
      alert('突合処理中にエラーが発生しました');
    }

    setLoading(false);
  };

  const getMismatchBadge = (type: string) => {
    switch (type) {
      case 'not_registered':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">未登録</span>;
      case 'date_mismatch':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">日付不一致</span>;
      case 'amount_mismatch':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">金額不一致</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">💳 カード請求突合</h1>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ダッシュボード
              </button>
              <button
                onClick={() => navigate('/transactions')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                取引一覧
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📂 カード請求CSVをアップロード</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 font-semibold mb-2">📋 CSVフォーマット</p>
            <p className="text-xs text-blue-700 mb-2">タブ区切り（TSV）形式で、以下の列を含むファイルをアップロードしてください：</p>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>取引日付（列3）</li>
              <li>金額 JPY（列37）</li>
              <li>取引先（列13）</li>
              <li>アカウント保有者の名前（列8, 9）</li>
              <li>アカウント保有者従業員ID（列10）</li>
            </ul>
          </div>

          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          {cardTransactions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-700">
                📊 読み込み件数: <span className="font-semibold">{cardTransactions.length}件</span>
              </p>
            </div>
          )}

          {cardTransactions.length > 0 && !reconciled && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleReconcile}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? '突合中...' : '突合を実行'}
              </button>
              <button
                onClick={() => {
                  setCardTransactions([]);
                  setMismatches([]);
                  setReconciled(false);
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>

        {reconciled && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">
              {mismatches.length === 0 ? (
                <span className="text-green-600">✅ 突合完了: 不一致なし</span>
              ) : (
                <span className="text-orange-600">⚠️ 突合結果: {mismatches.length}件の不一致</span>
              )}
            </h2>

            {mismatches.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">取引日</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">加盟店名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">使用者</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">詳細</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mismatches.map((mismatch, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getMismatchBadge(mismatch.type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {mismatch.cardData.transactionDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ¥{mismatch.cardData.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {mismatch.cardData.merchantName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {mismatch.cardData.accountHolderLastName} {mismatch.cardData.accountHolderFirstName}
                          {mismatch.cardData.employeeId && (
                            <div className="text-xs text-gray-500">ID: {mismatch.cardData.employeeId}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {mismatch.message}
                          {mismatch.systemData && (
                            <div className="text-xs text-gray-500 mt-1">
                              システム: {mismatch.systemData.merchantName}
                              {mismatch.type === 'amount_mismatch' && (
                                <span> (¥{mismatch.systemData.amount.toLocaleString()})</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {mismatches.length === 0 && (
              <p className="text-sm text-gray-600">
                全ての取引が正常に突合されました。
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
