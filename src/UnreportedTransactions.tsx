import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getUserInfo, buildTransactionQuery } from './utils/userPermissions';

interface Transaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  categoryId: string;
  memo: string;
  status: string;
  reportStatus: string;
  userId: string;
  receiptCount: number;
}

export default function UnreportedTransactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    loadUnreportedTransactions();
  }, []);

  const loadUnreportedTransactions = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userInfo = await getUserInfo(currentUser.uid);
      if (userInfo) {
        setUserRole(userInfo.role);
      }

      const queryCondition = buildTransactionQuery(userInfo!);
      const transactionsRef = collection(db, 'transactions');
      
      let q;
      if (queryCondition.field && queryCondition.value) {
        q = query(
          transactionsRef,
          where(queryCondition.field, '==', queryCondition.value),
          where('reportStatus', '==', 'unreported')
        );
      } else {
        q = query(transactionsRef, where('reportStatus', '==', 'unreported'));
      }

      onSnapshot(q, (snapshot) => {
        const txList = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }) as Transaction)
          .sort((a, b) => {
            const dateA = a.transactionDate?.toDate() || new Date(0);
            const dateB = b.transactionDate?.toDate() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

        setTransactions(txList);
        setLoading(false);
      });
    } catch (error) {
      console.error('未報告取引読み込みエラー:', error);
      setLoading(false);
    }
  };

  const handleMarkAsReported = async (transactionId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('ログインしてください');
        return;
      }

      if (!confirm('この取引を「報告済み」にしますか？')) {
        return;
      }

      const transactionRef = doc(db, 'transactions', transactionId);
      await updateDoc(transactionRef, {
        reportStatus: 'reported',
        reportedAt: Timestamp.now(),
        reportedBy: currentUser.uid,
        updatedAt: Timestamp.now()
      });

      alert('報告済みにしました');
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      pending: { bg: 'bg-blue-100', text: 'text-blue-800', label: '未処理' },
      submitted: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '申請中' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: '差戻し' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: '承認済' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📋 未報告取引一覧</h1>
            <p className="mt-2 text-sm text-gray-600">
              使用報告が未提出の取引: {transactions.length}件
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
            >
              📊 ダッシュボード
            </button>
            <button
              onClick={() => navigate('/transactions')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              📝 取引一覧
            </button>
          </div>
        </div>

        {/* 未報告取引テーブル */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              🎉 未報告の取引はありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">取引日</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">加盟店名</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">メモ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">証憑</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.transactionDate?.toDate()?.toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.merchantName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        ¥{transaction.amount?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {transaction.memo || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {transaction.receiptCount > 0 ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            📎 {transaction.receiptCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">なし</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(transaction.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/transactions/${transaction.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            詳細
                          </button>
                          <button
                            onClick={() => handleMarkAsReported(transaction.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                          >
                            報告済みにする
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
