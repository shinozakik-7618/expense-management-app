const admin = require('firebase-admin');

const serviceAccount = {
  projectId: "expense-management-pcdepot"
};

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  ...serviceAccount
});

const db = admin.firestore();

db.collection('users').limit(1).get()
  .then(snapshot => {
    console.log('✅ Firestore接続成功！ドキュメント数:', snapshot.size);
    if (!snapshot.empty) {
      snapshot.forEach(doc => {
        console.log('ドキュメントID:', doc.id);
        console.log('データ:', doc.data());
      });
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Firestore接続失敗:', error.message);
    process.exit(1);
  });
