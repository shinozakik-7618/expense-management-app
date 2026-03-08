import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const setUserPassword = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "ログインが必要です");
    }

    const callerUid = context.auth.uid;
    const callerDoc = await admin.firestore().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "管理者権限が必要です");
    }

    const { uid, newPassword } = data;
    if (!uid || !newPassword) {
      throw new functions.https.HttpsError("invalid-argument", "uid と newPassword が必要です");
    }

    await admin.auth().updateUser(uid, { password: newPassword });

    return { success: true };
  });
