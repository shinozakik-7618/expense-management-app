import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import vision from "@google-cloud/vision";

admin.initializeApp();

const client = new vision.ImageAnnotatorClient();

interface ReceiptData {
  amount?: number;
  merchantName?: string;
  date?: string;
  rawText?: string;
}

export const analyzeReceipt = onCall({ invoker: "public" }, async (request) => {
  try {
    const imageBase64 = request.data.image;

    if (!imageBase64) {
      throw new HttpsError("invalid-argument", "画像データが必要です");
    }

    // Cloud Vision APIで画像を解析
    const [result] = await client.textDetection({
      image: {content: imageBase64},
    });

    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      return {success: false, message: "テキストが検出できませんでした"};
    }

    const fullText = detections[0].description || "";
    console.log("=== 認識されたテキスト ===");
    console.log(fullText);
    console.log("=========================");

    // 金額を抽出（改善版）
    let amount: number | undefined;
    // パターン1: 金8,650円 のような形式（全角・半角両対応）
    let amountMatch = fullText.match(/金\s*([0-9０-９,，]+)\s*円/);
    if (amountMatch) {
      // 全角数字を半角に変換
      const numStr = amountMatch[1]
        .replace(/０/g, '0').replace(/１/g, '1').replace(/２/g, '2')
        .replace(/３/g, '3').replace(/４/g, '4').replace(/５/g, '5')
        .replace(/６/g, '6').replace(/７/g, '7').replace(/８/g, '8')
        .replace(/９/g, '9').replace(/，/g, ',').replace(/,/g, '');
      amount = parseInt(numStr, 10);
    }
    // パターン2: ¥記号付き
    if (!amount) {
      amountMatch = fullText.match(/[¥￥]\s*([0-9,]+)/);
      if (amountMatch) {
        amount = parseInt(amountMatch[1].replace(/,/g, ""), 10);
      }
    }

    // 日付を抽出（改善版）
    let date: string | undefined;
    // パターン1: 2026年 1月 7日 のような形式
    let dateMatch = fullText.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
    }
    // パターン2: YYYY/MM/DD または YYYY-MM-DD
    if (!date) {
      dateMatch = fullText.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        if (year >= 2000 && year <= 2100) {
          date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
        }
      }
    }

    // 店舗名を抽出（改善版）
    let merchantName: string | undefined;
    const lines = fullText.split("\n").filter((line) => line.trim());
    
    // パターン1: 「株式会社」「会社」を含む行で、「様」を含まない行
    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.includes("株式会社") || trimmed.includes("会社")) && 
          !trimmed.includes("様") && 
          !trimmed.includes("(株)ピーシーデポ")) {
        merchantName = trimmed;
        break;
      }
    }
    
    // パターン2: 見つからない場合は、除外ワードを避けて最初の有効な行
    if (!merchantName) {
      const excludeWords = ["領収書", "領収証", "receipt", "レシート", "お買い上げ", "ありがとう", "様", "2026年", "金"];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length >= 4 && !excludeWords.some(word => trimmed.includes(word))) {
          merchantName = trimmed;
          break;
        }
      }
    }

    const receiptData: ReceiptData = {
      amount,
      merchantName,
      date,
      rawText: fullText,
    };

    console.log("=== 抽出結果 ===");
    console.log("金額:", amount);
    console.log("店舗名:", merchantName);
    console.log("日付:", date);
    console.log("================");

    return {success: true, data: receiptData};
  } catch (error) {
    console.error("領収書解析エラー:", error);
    throw new HttpsError("internal", "領収書の解析に失敗しました");
  }
});
