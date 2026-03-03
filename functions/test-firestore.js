const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'expense-management-pcdepot'
});

const db = admin.firestore();

console.log('Firestore接続テスト開始...');

db.collection('users').limit(1).get()
  .then(snapshot => {
    console.log('✅ Firestore接続成功！ドキュメント数:', snapshot.size);
    if (!snapshot.empty) {
      snapshot.forEach(doc => {
        console.log('ドキュメントID:', doc.id);
        const data = doc.data();
        console.log('Email:', data.email);
        console.log('DisplayName:', data.displayName);
      });
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Firestore接続失敗:', error.message);
    process.exit(1);
  });
