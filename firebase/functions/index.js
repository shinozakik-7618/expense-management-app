// Firebase Functions v2 - Vertex AI版
// Updated: 2026-03-05
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');

admin.initializeApp();

exports.setCustomClaims = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  try {
    const { uid, role } = req.body;
    if (!uid || !role) { res.status(400).json({ error: 'uid and role are required' }); return; }
    await admin.auth().setCustomUserClaims(uid, { role });
    res.json({ success: true });
  } catch (error) {
    console.error('setCustomClaims error:', error);
    res.status(500).json({ error: error.message });
  }
});

exports.analyzeReceipt = onCall(async (request) => {
  console.log('auth check:', request.auth ? 'VALID uid=' + request.auth.uid : 'NULL');
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証が必要です');
  }
  const imageBase64 = request.data.image;
  if (!imageBase64) {
    throw new HttpsError('invalid-argument', '画像データが必要です');
  }
  try {
    const vertexAI = new VertexAI({ project: 'expense-management-pcdepot', location: 'us-central1' });
    const model = vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: `この領収書を解析してください。
以下のJSON形式のみで返してください（説明文不要）:
{
  "merchantName": "領収書を発行した店舗・会社名（宛名ではなく発行元）",
  "date": "支払日をYYYY-MM-DD形式",
  "amount": 支払金額を整数の数値のみ（円記号・カンマ不要）,
  "description": "支払い内容・品目",
  "category": "交通費・食費・消耗品費・接待費・その他のいずれか"
}` }
        ]
      }]
    });
    const responseText = result.response.candidates[0].content.parts[0].text;
    console.log('Vertex AI response:', responseText);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new HttpsError('internal', 'JSONの解析に失敗しました: ' + responseText);
    }
    const receiptData = JSON.parse(jsonMatch[0]);
    // 金額を確実に数値に変換
    if (receiptData.amount !== undefined) {
      const amountStr = String(receiptData.amount).replace(/[^0-9]/g, '');
      receiptData.amount = amountStr ? parseInt(amountStr, 10) : 0;
    }
    console.log('Parsed receipt:', JSON.stringify(receiptData));
    return { success: true, data: receiptData };
  } catch (error) {
    console.error('Vertex AI error:', error);
    if (error instanceof HttpsError) { throw error; }
    throw new HttpsError('internal', String(error.message || error));
  }
});
