import * as admin from 'firebase-admin';

let app: admin.app.App | undefined;

export function getFirestore(): admin.firestore.Firestore {
  if (!app) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const credential = serviceAccountJson
      ? admin.credential.cert(JSON.parse(serviceAccountJson) as admin.ServiceAccount)
      : admin.credential.applicationDefault();

    app = admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    console.log('✅ Firebase initialized');
  }
  return admin.firestore(app);
}
