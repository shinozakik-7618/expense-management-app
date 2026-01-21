# データベース設計書

## 概要
Cloud Firestore を使用した NoSQL データベース設計

## コレクション一覧

### 1. users（ユーザー）
ユーザー情報を管理

```typescript
{
  uid: string;                    // Firebase Auth UID
  email: string;                  // メールアドレス
  displayName: string;            // 表示名
  role: string;                   // user | regional_manager | department_head | cfo | admin
  organizationId: string;         // 所属組織ID（ブロックまたは本社部署）
  organizationType: string;       // regional | headquarters
  cardNumber: string;             // 法人カード番号（下4桁のみ）
  status: string;                 // active | inactive
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**ロール定義**
- `user`: 一般利用者（法人カード保有者）
- `regional_manager`: 地域管理責任者
- `department_head`: 本社部署長
- `cfo`: 経理部長（最終承認者）
- `admin`: システム管理者

---

### 2. organizations（組織）
ブロックおよび本社部署の情報

```typescript
{
  id: string;                     // 組織ID
  name: string;                   // 組織名
  type: string;                   // regional | headquarters
  regionCode?: string;            // 地域コード（地域の場合）
  managerId?: string;             // 管理責任者のUID
  status: string;                 // active | inactive
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 3. transactions（取引）
法人カード取引の明細

```typescript
{
  id: string;                     // 取引ID（UUID）
  userId: string;                 // カード利用者のUID
  organizationId: string;         // 所属組織ID
  transactionDate: Timestamp;     // 利用日
  amount: number;                 // 金額（税込）
  merchantName: string;           // 加盟店名
  categoryId?: string;            // 用途ID（用途マスタ参照）
  memo?: string;                  // メモ・補足
  status: string;                 // pending | submitted | rejected | approved
  approvalRoute: string;          // regional | headquarters | headquarters_to_cfo
  receiptCount: number;           // 証憑添付数
  lastReminderSentAt?: Timestamp; // リマインド最終送信日時
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;        // 申請日時
  approvedAt?: Timestamp;         // 承認日時
}
```

**ステータス定義**
- `pending`: 未処理（用途・証憑が未完了）
- `submitted`: 申請中（承認待ち）
- `rejected`: 差戻し（修正が必要）
- `approved`: 承認済み

**承認ルート定義**
- `regional`: 地域ルート（利用者 → 地域管理責任者）
- `headquarters`: 本社ルート（利用者 → 部署長）
- `headquarters_to_cfo`: 部署長ルート（部署長 → 経理部長）

---

### 4. receipts（証憑）
領収書・カード控えなどの添付ファイル

```typescript
{
  id: string;                     // 証憑ID（UUID）
  transactionId: string;          // 取引ID
  type: string;                   // receipt | card_slip | other
  fileName: string;               // ファイル名
  fileSize: number;               // ファイルサイズ（bytes）
  fileType: string;               // image/jpeg | image/png | application/pdf
  storagePath: string;            // Storage パス
  uploadMethod: string;           // app_camera | app_gallery | email
  uploadedBy: string;             // アップロードしたユーザーのUID
  uploadedAt: Timestamp;          // アップロード日時
}
```

---

### 5. approval_history（承認履歴）
承認・差戻しの履歴

```typescript
{
  id: string;                     // 履歴ID（UUID）
  transactionId: string;          // 取引ID
  action: string;                 // approved | rejected
  approverUid: string;            // 承認者のUID
  approverName: string;           // 承認者名
  approverRole: string;           // 承認者のロール
  comment?: string;               // コメント（差戻し理由など）
  createdAt: Timestamp;           // 実行日時
}
```

---

### 6. categories（用途マスタ）
経費の用途分類

```typescript
{
  id: string;                     // 用途ID
  name: string;                   // 用途名
  displayOrder: number;           // 表示順
  description?: string;           // 補足説明
  isActive: boolean;              // 有効/無効
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**初期データ**
- 食事代
- 交通費
- ETC
- 消耗品購入代
- 家具購入代
- その他

---

### 7. audit_logs（監査ログ）
重要操作の履歴

```typescript
{
  id: string;                     // ログID
  userId: string;                 // 操作者のUID
  userName: string;               // 操作者名
  action: string;                 // login | approve | reject | update_settings | delete_receipt 等
  targetType: string;             // transaction | user | category | organization
  targetId: string;               // 対象のID
  details: object;                // 詳細情報（変更前後の値など）
  ipAddress?: string;             // IPアドレス
  userAgent?: string;             // ユーザーエージェント
  createdAt: Timestamp;
}
```

---

### 8. notifications（通知）
ユーザーへの通知メッセージ

```typescript
{
  id: string;                     // 通知ID
  userId: string;                 // 受信者のUID
  type: string;                   // reminder | approval | rejection
  title: string;                  // タイトル
  message: string;                // メッセージ本文
  relatedTransactionId?: string;  // 関連する取引ID
  isRead: boolean;                // 既読フラグ
  createdAt: Timestamp;
  readAt?: Timestamp;             // 既読日時
}
```

---

## インデックス戦略

### transactions コレクション
- `(userId, status, transactionDate)`: ユーザーごとの取引一覧
- `(organizationId, status, transactionDate)`: 組織ごとの取引一覧
- `(status, transactionDate)`: 全体の取引一覧（管理者用）
- `(categoryId, transactionDate)`: 用途別集計

### approval_history コレクション
- `(transactionId, createdAt)`: 取引ごとの承認履歴

---

## セキュリティルール

### アクセス制御の基本方針
1. **認証必須**: すべての操作に Firebase Authentication が必要
2. **ロールベース**: ユーザーのロールに応じてアクセス権限を制御
3. **自分のデータ優先**: 利用者は自分の取引のみ編集可能
4. **承認権限**: 承認者は担当範囲の取引を承認・差戻し可能
5. **管理者権限**: 管理者は全データの閲覧・編集が可能

詳細は `firestore.rules` および `storage.rules` を参照

---

## データ移行・初期データ

### 初期セットアップ時に必要なデータ
1. **管理者ユーザー**: 最初の管理者アカウント
2. **用途マスタ**: 6つの基本用途
3. **組織データ**: 約30ブロック + 本社部署

### CSV取込フォーマット（将来対応）
- カード明細CSVのインポート機能
- ユーザー一括登録CSV
- 組織一括登録CSV
