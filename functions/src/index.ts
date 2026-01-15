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

    console.log("認識されたテキスト:", fullText);
    // 金額を抽出
    const amountMatch = fullText.match(/[¥￥]\s*([0-9,]+)/);
    let amount: number | undefined;
    if (amountMatch) {
      amount = parseInt(amountMatch[1].replace(/,/g, ""), 10);
    }

    // 日付を抽出
    const dateMatch = fullText.match(
      /(\d{4})[/-](\d{1,2})[/-](\d{1,2})|(\d{1,2})[/-](\d{1,2})/
    );
    let date: string | undefined;
    if (dateMatch) {
      if (dateMatch[1]) {
        date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      } else if (dateMatch[4]) {
        const year = new Date().getFullYear();
        date = `${year}-${dateMatch[4].padStart(2, "0")}-${dateMatch[5].padStart(2, "0")}`;
      }
    }

    // 店舗名を抽出
    const lines = fullText.split("\n").filter((line) => line.trim());
    const merchantName = lines[0] || undefined;

    const receiptData: ReceiptData = {
      amount,
      merchantName,
      date,
      rawText: fullText,
    };

    return {success: true, data: receiptData};
  } catch (error) {
    console.error("領収書解析エラー:", error);
    throw new HttpsError("internal", "領収書の解析に失敗しました");
  }
});
