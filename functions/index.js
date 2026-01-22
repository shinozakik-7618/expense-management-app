const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.setUserRole = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {uid, role} = req.body;

    if (!uid || !role) {
      res.status(400).send({error: "uid and role are required"});
      return;
    }

    await admin.auth().setCustomUserClaims(uid, {role});

    res.status(200).send({success: true, message: "Role set successfully"});
  } catch (error) {
    console.error("Error setting custom claims:", error);
    res.status(500).send({error: error.message});
  }
});

exports.syncAllUserRoles = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const usersSnapshot = await admin.firestore().collection("users").get();
    const results = [];
    const errors = [];

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const email = userData.email;
      const role = userData.role || "user";

      if (!email) {
        errors.push({docId: doc.id, error: "No email found"});
        continue;
      }

      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(userRecord.uid, {role});
        results.push({email, role, uid: userRecord.uid});
      } catch (error) {
        errors.push({email, error: error.message});
      }
    }

    res.status(200).send({
      success: true,
      message: "Sync completed",
      synced: results.length,
      errors: errors.length,
      results: results,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("Error syncing roles:", error);
    res.status(500).send({error: error.message});
  }
});
