// ユーザーロール
export type UserRole = 'user' | 'regional_manager' | 'department_head' | 'cfo' | 'admin';

// 組織タイプ
export type OrganizationType = 'regional' | 'headquarters';

// 取引ステータス
export type TransactionStatus = 'pending' | 'submitted' | 'rejected' | 'approved';

// 承認ルート
export type ApprovalRoute = 'regional' | 'headquarters' | 'headquarters_to_cfo';

// 承認アクション
export type ApprovalAction = 'approved' | 'rejected';

// ユーザー
export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
  organizationType: OrganizationType;
  cardNumber: string; // 下4桁のみ
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// 組織
export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  regionCode?: string;
  managerId?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// 取引
export interface Transaction {
  id: string;
  userId: string;
  organizationId: string;
  transactionDate: Date;
  amount: number;
  merchantName: string;
  categoryId?: string;
  memo?: string;
  status: TransactionStatus;
  approvalRoute: ApprovalRoute;
  receiptCount: number;
  lastReminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  approvedAt?: Date;
}

// 証憑
export interface Receipt {
  id: string;
  transactionId: string;
  type: 'receipt' | 'card_slip' | 'other';
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  uploadMethod: 'app_camera' | 'app_gallery' | 'email';
  uploadedBy: string;
  uploadedAt: Date;
}

// 承認履歴
export interface ApprovalHistory {
  id: string;
  transactionId: string;
  action: ApprovalAction;
  approverUid: string;
  approverName: string;
  approverRole: UserRole;
  comment?: string;
  createdAt: Date;
}

// 用途
export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 監査ログ
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// 通知
export interface Notification {
  id: string;
  userId: string;
  type: 'reminder' | 'approval' | 'rejection';
  title: string;
  message: string;
  relatedTransactionId?: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}
