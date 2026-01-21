export interface Receipt {
  id: string;
  transactionId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  downloadURL: string;
  uploadedAt: any;
}

export interface Transaction {
  id: string;
  userId: string;
  organizationId: string;
  transactionDate: any;
  amount: number;
  merchantName: string;
  categoryId?: string;
  memo?: string;
  status: string;
  approvalRoute: string;
  receiptCount: number;
  createdAt: any;
  updatedAt: any;
}
