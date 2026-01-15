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

    // 金額を抽出（複数パターン対応）
    let amount: number | undefined;
    // パターン1: ¥記号付き
    let amountMatch = fullText.match(/[¥￥円]\s*([0-9,]+)/);
    if (amountMatch) {
      amount = parseInt(amountMatch[1].replace(/,/g, ""), 10);
    }
    // パターン2: 合計・小計の後の数字
    if (!amount) {
      amountMatch = fullText.match(/(?:合計|小計|total|Total)[:\s]*[¥￥]?\s*([0-9,]+)/i);
      if (amountMatch) {
        amount = parseInt(amountMatch[1].replace(/,/g, ""), 10);
      }
    }
    // パターン3: 最後に出てくる大きな数字
    if (!amount) {
      const numbers = fullText.match(/([0-9,]+)/g);
      if (numbers && numbers.length > 0) {
        // 最も大きい数字を抽出
        const nums = numbers.map(n => parseInt(n.replace(/,/g, ""), 10));
        amount = Math.max(...nums);
      }
    }

    // 日付を抽出（複数パターン対応）
    let date: string | undefined;
    // パターン1: YYYY/MM/DD または YYYY-MM-DD
    let dateMatch = fullText.match(/(\d{4})[/-年](\d{1,2})[/-月](\d{1,2})[日]?/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
    }
    // パターン2: MM/DD（年は今年と仮定）
    if (!date) {
      dateMatch = fullText.match(/(\d{1,2})[/-月](\d{1,2})[日]?/);
      if (dateMatch) {
        const year = new Date().getFullYear();
        date = `${year}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
      }
    }

    // 店舗名を抽出（最初の有効な行、"領収書"などの単語を除外）
    const lines = fullText.split("\n").filter((line) => line.trim());
    let merchantName: string | undefined;
    const excludeWords = ["領収書", "receipt", "レシート", "お買い上げ", "ありがとう"];
    for (const line of lines) {
      const trimmed = line.trim();
      // 除外ワードが含まれていない、かつ3文字以上の行を店舗名とする
      if (trimmed.length >= 2 && !excludeWords.some(word => trimmed.includes(word))) {
        merchantName = trimmed;
        break;
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
