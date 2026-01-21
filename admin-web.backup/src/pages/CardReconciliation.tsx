import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';

interface CardTransaction {
  transactionDate: string;
  amount: number;
  merchantName: string;
  cardNumber: string;
  accountHolderLastName: string;
  accountHolderFirstName: string;
  employeeId: string;
}

interface SystemTransaction {
  id: string;
  transactionDate: string;
  amount: number;
  merchantName: string;
  userId: string;
}

interface Mismatch {
  type: 'not_registered' | 'date_mismatch' | 'amount_mismatch';
  cardTransaction: CardTransaction;
  systemTransaction?: SystemTransaction;
}

const CardReconciliation: React.FC = () => {
  const navigate = useNavigate();
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciled, setReconciled] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    console.log('📄 ファイル読み込み開始');
    const lines = text.split('\n');
    console.log('📊 総行数:', lines.length);

    const transactions: CardTransaction[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const separator = line.includes('\t') ? '\t' : ',';
      const columns = line.split(separator);

      if (columns.length < 10) {
        console.log(`⚠️ 行${i}: 列数不足 (${columns.length}列)`);
        continue;
      }

      const transactionDate = columns[2]?.trim();
      const amountStr = columns[36]?.trim();
      const merchantName = columns[12]?.trim();
      const cardNumber = columns[3]?.trim();
      const accountHolderLastName = columns[7]?.trim();
      const accountHolderFirstName = columns[8]?.trim();
      const employeeId = columns[9]?.trim();

      const amount = parseFloat(amountStr?.replace(/[^0-9.-]/g, '') || '0');

      if (!transactionDate || !amount || !merchantName) {
        console.log(`⚠️ 行${i}: 必須データ不足`);
        continue;
      }

      transactions.push({
        transactionDate,
        amount,
        merchantName,
        cardNumber: cardNumber || '',
        accountHolderLastName: accountHolderLastName || '',
        accountHolderFirstName: accountHolderFirstName || '',
        employeeId: employeeId || ''
      });
    }

    console.log('✅ 読み込み完了:', transactions.length, '件');
    setCardTransactions(transactions);
  };

  const handleReconcile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('ログインしてください');
      return;
    }

    if (cardTransactions.length === 0) {
      alert('カード取引データを読み込んでください');
      return;
    }

    setLoading(true);
    console.log('🔍 突合開始:', cardTransactions.length, '件');

    try {
      const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
      const systemTransactions: SystemTransaction[] = [];
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        systemTransactions.push({
          id: doc.id,
          transactionDate: data.transactionDate,
          amount: data.amount,
          merchantName: data.merchantName,
          userId: data.userId
        });
      });

      console.log('📊 システム取引:', systemTransactions.length, '件');

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const employeeIdToUserId: { [key: string]: string } = {};
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.employeeId) {
          employeeIdToUserId[data.employeeId] = doc.id;
        }
      });

      const newMismatches: Mismatch[] = [];
      const notificationsToCreate: any[] = [];

      for (const cardTx of cardTransactions) {
        const cardDate = cardTx.transactionDate.replace(/\//g, '-');
        const cardAmount = cardTx.amount;

        const perfectMatch = systemTransactions.find(sysTx => {
          const sysDate = sysTx.transactionDate;
          const sysAmount = sysTx.amount;
          return sysDate === cardDate && Math.abs(sysAmount - cardAmount) < 1;
        });

        if (perfectMatch) {
          console.log('✅ 一致:', cardDate, cardAmount);
          continue;
        }

        const dateMismatch = systemTransactions.find(sysTx => {
          const sysDate = sysTx.transactionDate;
          const sysAmount = sysTx.amount;
          return sysDate !== cardDate && Math.abs(sysAmount - cardAmount) < 1;
        });

        if (dateMismatch) {
          console.log('⚠️ 日付不一致:', cardDate, dateMismatch.transactionDate, cardAmount);
          newMismatches.push({
            type: 'date_mismatch',
            cardTransaction: cardTx,
            systemTransaction: dateMismatch
          });
          continue;
        }

        const amountMismatch = systemTransactions.find(sysTx => {
          const sysDate = sysTx.transactionDate;
          const sysAmount = sysTx.amount;
          return sysDate === cardDate && Math.abs(sysAmount - cardAmount) >= 1;
        });

        if (amountMismatch) {
          console.log('⚠️ 金額不一致:', cardDate, cardAmount, amountMismatch.amount);
          newMismatches.push({
            type: 'amount_mismatch',
            cardTransaction: cardTx,
            systemTransaction: amountMismatch
          });
          continue;
        }

        console.log('❌ 未登録:', cardDate, cardAmount, cardTx.merchantName);
        newMismatches.push({
          type: 'not_registered',
          cardTransaction: cardTx
        });

        const userId = employeeIdToUserId[cardTx.employeeId];
        if (userId) {
          notificationsToCreate.push({
            userId: userId,
            type: 'card_mismatch',
            title: '未登録の経費取引があります',
            message: `取引日: ${cardTx.transactionDate}, 金額: ${cardTx.amount.toLocaleString()}円, 加盟店: ${cardTx.merchantName}`,
            data: {
              transactionDate: cardTx.transactionDate,
              amount: cardTx.amount,
              merchantName: cardTx.merchantName,
              mismatchType: 'not_registered'
            },
            read: false,
            createdAt: new Date()
          });
        }
      }

      console.log('📧 通知作成開始:', notificationsToCreate.length, '件');
      for (const notification of notificationsToCreate) {
        await addDoc(collection(db, 'notifications'), notification);
      }
      console.log('✅ 通知作成完了');

      console.log('📊 突合結果: 不一致', newMismatches.length, '件');
      setMismatches(newMismatches);
      setReconciled(true);
      alert(`突合完了\n不一致: ${newMismatches.length}件\n通知作成: ${notificationsToCreate.length}件`);
    } catch (error) {
      console.error('❌ 突合エラー:', error);
      alert('突合処理でエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const getMismatchBadge = (type: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      not_registered: { label: '未登録', className: 'bg-red-100 text-red-800' },
      date_mismatch: { label: '日付不一致', className: 'bg-yellow-100 text-yellow-800' },
      amount_mismatch: { label: '金額不一致', className: 'bg-orange-100 text-orange-800' }
    };
    const badge = badges[type] || { label: type, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">💳 カード請求突合</h1>
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                📊 ダッシュボード
              </button>
              <button
                onClick={() => navigate('/transactions')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                📝 取引一覧
              </button>
            </div>
          </div>
        </div>

        {/* CSVアップロード */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">カード請求CSVをアップロード</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                💡 CSVファイル形式: TSV（タブ区切り）またはカンマ区切り
              </p>
              <p className="text-sm text-gray-600 mb-4">
                必須列: 取引日付（列3）、金額 JPY（列37）、取引先（列13）、<br />
                アカウント保有者の名前（列8,9）、従業員ID（列10）
              </p>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            {cardTransactions.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="text-green-800">
                  ✅ {cardTransactions.length}件の取引を読み込みました
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 突合実行ボタン */}
        {cardTransactions.length > 0 && !reconciled && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex gap-4">
              <button
                onClick={handleReconcile}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '突合実行中...' : '🔍 突合を実行'}
              </button>
              <button
                onClick={() => {
                  setCardTransactions([]);
                  setMismatches([]);
                  setReconciled(false);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* 突合結果 */}
        {reconciled && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              {mismatches.length === 0 ? (
                <span className="text-green-600">✅ 突合完了: 不一致なし</span>
              ) : (
                <span className="text-red-600">⚠️ 突合結果: {mismatches.length}件の不一致</span>
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
                          {mismatch.cardTransaction.transactionDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ¥{mismatch.cardTransaction.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {mismatch.cardTransaction.merchantName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {mismatch.cardTransaction.accountHolderLastName} {mismatch.cardTransaction.accountHolderFirstName}
                          {mismatch.cardTransaction.employeeId && (
                            <div className="text-xs text-gray-500">ID: {mismatch.cardTransaction.employeeId}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {mismatch.systemTransaction && (
                            <div>
                              <div>システム: {mismatch.systemTransaction.transactionDate}</div>
                              <div>金額: ¥{mismatch.systemTransaction.amount.toLocaleString()}</div>
                              <div>加盟店: {mismatch.systemTransaction.merchantName}</div>
                            </div>
                          )}
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
};

export default CardReconciliation;
