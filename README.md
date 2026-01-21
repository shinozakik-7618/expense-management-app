# 法人カード経費精算アプリ

## プロジェクト概要
全国約140店舗、約100名の法人カード利用者向けの経費精算管理システム

## システム構成

### フロントエンド
- **管理者Web**: React + TypeScript + Vite
- **スマホアプリ**: Flutter（iOS・Android）※次フェーズ

### バックエンド
- **Firebase**
  - Authentication: ユーザー認証・SSO
  - Cloud Firestore: データベース
  - Cloud Storage: 証憑画像保管
  - Cloud Functions: サーバーレスロジック
  - Cloud Messaging: プッシュ通知

## ディレクトリ構成
```
expense-management-app/
├── admin-web/           # 管理者Webアプリ（React）
├── mobile-app/          # スマホアプリ（Flutter）※次フェーズ
├── firebase/            # Firebase設定・Functions
├── docs/                # ドキュメント
└── README.md
```

## 開発フェーズ

### フェーズ1: MVP（最小限の動作版）✅ 進行中
- [x] プロジェクト構成
- [x] Firebase設定
- [x] 管理者Web基本画面
- [ ] ログイン機能
- [ ] 取引CRUD機能
- [ ] 基本的な承認フロー

### フェーズ2: 機能拡張
- [ ] 証憑画像アップロード
- [ ] 用途マスタ管理
- [ ] 通知・リマインド機能
- [ ] 検索・フィルター機能
- [ ] CSV出力

### フェーズ3: スマホアプリ
- [ ] Flutter アプリ開発
- [ ] カメラ撮影機能
- [ ] プッシュ通知連携

### フェーズ4: 最適化
- [ ] 監査ログ
- [ ] レポート・集計機能
- [ ] パフォーマンス最適化

## セットアップ手順

### 1. Firebaseプロジェクト作成
1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 新規プロジェクト作成
3. Authentication、Firestore、Storageを有効化
4. 設定から設定ファイルをダウンロード

### 2. 環境変数設定
```bash
cd admin-web
cp .env.example .env
# .env に Firebase設定を記入
```

### 3. 管理者Web起動
```bash
cd admin-web
npm install
npm run dev
```

### 4. Firebase Functions デプロイ
```bash
cd firebase/functions
npm install
firebase deploy --only functions
```

## 主要機能

### ユーザーロール
- **利用者**: 法人カード保有者（約100名）
- **承認者（地域）**: ブロック管理責任者（約30名）
- **承認者（本社）**: 本社部署長
- **最終承認者**: 経理部長
- **管理者**: 全社横断管理権限

### 承認フロー
1. 地域所属: 利用者 → 地域管理責任者
2. 本社所属: 利用者 → 部署長
3. 部署長本人: 部署長 → 経理部長

### ステータス
- 未処理: 用途・証憑が未完了
- 申請中: 承認待ち
- 差戻し: 修正が必要
- 承認済み: 承認完了

## ライセンス
Private - PCDEPOT Internal Use Only
