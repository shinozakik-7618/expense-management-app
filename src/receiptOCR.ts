import { ImageAnnotatorClient } from '@google-cloud/vision';

// 注意: ブラウザでは直接使えないため、Firebase Functionsで実装する必要があります
// このファイルは参考用です

interface ReceiptData {
  amount?: number;
  merchantName?: string;
  date?: string;
}

export async function extractReceiptData(imageBase64: string): Promise<ReceiptData> {
  // この関数は実際にはFirebase Functionsで実装する必要があります
  // ブラウザからは直接Cloud Vision APIを呼べないため
  
  // 代わりに、フロントエンドからFirebase Functionsを呼び出します
  const response = await fetch('YOUR_CLOUD_FUNCTION_URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 })
  });
  
  return await response.json();
}
