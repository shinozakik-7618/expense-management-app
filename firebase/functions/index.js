const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();
setGlobalOptions({ region: "us-central1" });

// ── analyzeReceipt (Gemini REST API) ───────────────────────
exports.analyzeReceipt = onCall({ timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "認証が必要です");
  const { image, mimeType = "image/jpeg" } = request.data;
  if (!image) throw new HttpsError("invalid-argument", "画像データが必要です");

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const prompt = `この領収書から情報を抽出してください。必ずJSON形式のみで返答してください。
例: {"amount": 26200, "date": "2026-02-12", "merchantName": "アパホテル博多駅筑紫口"}
- amount: 合計金額（税込、数値のみ）
- date: 取引日（YYYY-MM-DD形式）
- merchantName: 店舗名または会社名
JSON以外のテキストは絶対に含めないでください。`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: image } }
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
    });

    const text = await new Promise((resolve, reject) => {
      const options = {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        method: "POST",
        headers: { "Content-Type": "application/json" }
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const txt = parsed.candidates[0].content.parts[0].text.trim();
            resolve(txt);
          } catch(e) { reject(new Error("Gemini応答解析エラー: " + data.substring(0, 200))); }
        });
      });
      req.on("error", reject);
      req.write(requestBody);
      req.end();
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { success: false, error: "JSON解析エラー: " + text };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      data: {
        amount: parsed.amount || null,
        date: parsed.date || null,
        merchantName: parsed.merchantName || null
      }
    };
  } catch (error) {
    console.error("analyzeReceipt error:", error);
    return { success: false, error: error.message };
  }
});

// ── setUserRole ─────────────────────────────────────────────
exports.setUserRole = onRequest(async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: "email and role are required" });
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role });
    await admin.firestore().collection("users").doc(user.uid).update({ role });
    res.json({ success: true, message: `Role ${role} set for ${email}` });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ── syncAllUserRoles ────────────────────────────────────────
exports.syncAllUserRoles = onRequest(async (req, res) => {
  const db = admin.firestore();
  const snapshot = await db.collection("users").get();
  const results = { synced: 0, errors: [] };
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.email || !data.role) continue;
    try {
      const user = await admin.auth().getUserByEmail(data.email);
      await admin.auth().setCustomUserClaims(user.uid, { role: data.role });
      results.synced++;
    } catch (e) { results.errors.push({ email: data.email, error: e.message }); }
  }
  res.json({ success: true, message: "同期完了", ...results });
});

// ── migrateUsersToCorrectUID ────────────────────────────────
exports.migrateUsersToCorrectUID = onRequest(async (req, res) => {
  const db = admin.firestore();
  const snapshot = await db.collection("users").get();
  const results = { migrated: 0, alreadyCorrect: 0, errors: [] };
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.email) continue;
    try {
      const user = await admin.auth().getUserByEmail(data.email);
      if (doc.id === user.uid) { results.alreadyCorrect++; continue; }
      await db.collection("users").doc(user.uid).set(data);
      await db.collection("users").doc(doc.id).delete();
      results.migrated++;
    } catch (e) { results.errors.push({ email: data.email, error: e.message }); }
  }
  res.json({ success: true, message: "Migration completed", ...results });
});
