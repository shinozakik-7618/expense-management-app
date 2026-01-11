import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { getUserInfo, buildTransactionQuery } from './utils/userPermissions';

interface Transaction {
  id: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  categoryId: string;
  memo: string;
  status: string;
  receiptCount: number;
}

export default function TransactionList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
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
        q = query(transactionsRef, where(queryCondition.field, '==', queryCondition.value));
      } else {
        q = query(transactionsRef);
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
      console.error('取引一覧読み込みエラー:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm('この取引を削除しますか？')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'transactions', transactionId));
      alert('削除しました');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
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
          <h1 className="text-3xl font-bold text-gray-900">取引一覧</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/reconciliation/card')}
              className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700"
            >
              💳 カード請求突合
            </button>
            <button
              onClick={() => navigate('/reports/unreported')}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
            >
              📋 未報告取引
            </button>
            <button
              onClick={() => navigate('/transactions/import')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              📥 CSVインポート
            </button>
            <button
              onClick={() => navigate('/transactions/create')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              + 新規登録
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
            >
              📊 ダッシュボード
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
            >
              🔓 ログアウト
            </button>
          </div>
        </div>

        {/* 取引テーブル */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              取引データがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">取引日</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">加盟店名</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        ¥{transaction.amount?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.merchantName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {transaction.memo || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {transaction.receiptCount > 0 ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
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
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            詳細
                          </button>
                          <button
                            onClick={() => navigate(`/transactions/${transaction.id}/edit`)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            削除
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
