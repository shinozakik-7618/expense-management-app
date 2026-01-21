# セットアップガイド

## 前提条件
- Node.js 18以上
- npm または yarn
- Firebaseアカウント
- Gitアカウント（GitHub連携用）

## 1. Firebaseプロジェクト作成

### 1.1 Firebase Console でプロジェクト作成
1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `expense-management-pcdepot`）
4. Google Analyticsは任意で設定
5. プロジェクトを作成

### 1.2 Authenticationの設定
1. Firebase Console > Authentication > 「始める」
2. 「メール/パスワード」を有効化
3. 必要に応じてその他の認証方法も有効化

### 1.3 Firestoreの設定
1. Firebase Console > Firestore Database > 「データベースを作成」
2. **本番モード**で開始（セキュリティルールは後で設定）
3. ロケーションを選択（例: `asia-northeast1` - 東京）

### 1.4 Storageの設定
1. Firebase Console > Storage > 「始める」
2. デフォルト設定で開始
3. ロケーションはFirestoreと同じ

### 1.5 Firebase設定情報の取得
1. Firebase Console > プロジェクト設定（⚙アイコン）
2. 「全般」タブ > 「マイアプリ」 > Webアプリを追加
3. アプリのニックネームを入力（例: `Admin Web`）
4. 表示される設定情報をコピー

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## 2. ローカル開発環境セットアップ

### 2.1 リポジトリのクローン
```bash
git clone <your-repository-url>
cd expense-management-app
```

### 2.2 管理者Web環境変数設定
```bash
cd admin-web
cp .env.example .env
```

`.env` ファイルを編集し、Firebase設定情報を入力：
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 2.3 依存パッケージのインストール
```bash
npm install
```

### 2.4 開発サーバーの起動
```bash
npm run dev
```

ブラウザで http://localhost:5173 にアクセス

## 3. Firebaseセキュリティルール・インデックスのデプロイ

### 3.1 Firebase CLIのインストール
```bash
npm install -g firebase-tools
```

### 3.2 Firebaseにログイン
```bash
firebase login
```

### 3.3 Firebaseプロジェクトの設定
`.firebaserc` ファイルを編集し、プロジェクトIDを設定：
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 3.4 セキュリティルールとインデックスのデプロイ
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 4. 初期データのセットアップ

### 4.1 管理者ユーザーの作成
Firebase Console > Authentication > ユーザータブ > 「ユーザーを追加」

- メールアドレス: admin@your-company.com
- パスワード: （強力なパスワードを設定）

### 4.2 Firestoreに管理者情報を追加
Firebase Console > Firestore Database > 「コレクションを開始」

**コレクションID**: `users`

**ドキュメントID**: （上記で作成したユーザーのUID）

**フィールド**:
```
uid: string = "（ユーザーのUID）"
email: string = "admin@your-company.com"
displayName: string = "システム管理者"
role: string = "admin"
organizationId: string = "headquarters"
organizationType: string = "headquarters"
cardNumber: string = "****"
status: string = "active"
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

### 4.3 用途マスタの初期データ追加
Firebase Console > Firestore Database > 「コレクションを開始」

**コレクションID**: `categories`

以下のドキュメントを追加（自動IDで作成）：

1. 食事代
```
name: string = "食事代"
displayOrder: number = 1
description: string = "会議や打ち合わせに伴う食事代"
isActive: boolean = true
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

2. 交通費
```
name: string = "交通費"
displayOrder: number = 2
description: string = "電車・バス・タクシー等の交通費"
isActive: boolean = true
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

3. ETC
```
name: string = "ETC"
displayOrder: number = 3
description: string = "高速道路料金"
isActive: boolean = true
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

4. 消耗品購入代
```
name: string = "消耗品購入代"
displayOrder: number = 4
description: string = "文房具・事務用品等の消耗品"
isActive: boolean = true
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

5. 家具購入代
```
name: string = "家具購入代"
displayOrder: number = 5
description: string = "オフィス家具等の購入"
isActive: boolean = true
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

6. その他
```
name: string = "その他"
displayOrder: number = 6
description: string = "上記に該当しない経費"
isActive: boolean = true
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

## 5. テストデータの追加（任意）

### 5.1 テスト用組織データ
**コレクションID**: `organizations`

```
id: string = "regional_kanto"
name: string = "関東ブロック"
type: string = "regional"
regionCode: string = "KANTO"
status: string = "active"
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

### 5.2 テスト用取引データ
**コレクションID**: `transactions`

```
userId: string = "（管理者ユーザーのUID）"
organizationId: string = "headquarters"
transactionDate: timestamp = （適当な日付）
amount: number = 5000
merchantName: string = "スターバックス 渋谷店"
categoryId: string = "（食事代のドキュメントID）"
memo: string = "顧客打ち合わせ"
status: string = "pending"
approvalRoute: string = "headquarters"
receiptCount: number = 0
createdAt: timestamp = （現在時刻）
updatedAt: timestamp = （現在時刻）
```

## 6. 動作確認

1. 管理者Webにアクセス（http://localhost:5173）
2. 管理者アカウントでログイン
3. ダッシュボードでステータスサマリーが表示されることを確認
4. 取引一覧でテストデータが表示されることを確認
5. 用途マスタで初期データが表示されることを確認

## 7. GitHub連携

### 7.1 GitHubリポジトリ作成
1. GitHubにログイン
2. 新しいプライベートリポジトリを作成
3. リポジトリ名: `expense-management-app`

### 7.2 ローカルリポジトリとの接続
```bash
cd /path/to/expense-management-app
git init
git add .
git commit -m "Initial commit: MVP phase 1"
git branch -M main
git remote add origin https://github.com/your-username/expense-management-app.git
git push -u origin main
```

## トラブルシューティング

### ログインできない
- Firebase Authenticationが有効になっているか確認
- `.env` ファイルの設定が正しいか確認
- ブラウザのコンソールでエラーを確認

### データが表示されない
- Firestore Databaseにデータが存在するか確認
- セキュリティルールがデプロイされているか確認
- ブラウザのコンソールでエラーを確認

### セキュリティルールエラー
- `firebase deploy --only firestore:rules` を再実行
- Firebase Consoleでルールが正しくデプロイされているか確認

## 次のステップ
- フェーズ2: 証憑アップロード機能の実装
- フェーズ2: 承認フロー機能の実装
- フェーズ2: 通知・リマインド機能の実装
- フェーズ3: スマホアプリ（Flutter）の開発

---

詳細な質問がある場合は、開発チームにお問い合わせください。
