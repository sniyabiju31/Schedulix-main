const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK (uses default credentials when deployed)
admin.initializeApp();

// Callable function that returns the list of users from Realtime Database
// Only allows callers whose uid exists under /admins/{uid} in the RTDB
exports.listUsersForAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const uid = context.auth.uid;

  // Check admins node to confirm this caller is an admin
  const adminSnap = await admin.database().ref(`admins/${uid}`).get();
  if (!adminSnap.exists()) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins are allowed to list users.');
  }

  const usersSnap = await admin.database().ref('users').get();
  const users = [];
  if (usersSnap.exists()) {
    usersSnap.forEach(child => {
      users.push({ uid: child.key, ...child.val() });
    });
  }

  return { users };
});