import * as admin from 'firebase-admin';

export function getFirestore(): admin.firestore.Firestore {
  if (admin.apps.length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const credential = serviceAccountJson
      ? admin.credential.cert(JSON.parse(serviceAccountJson) as admin.ServiceAccount)
      : admin.credential.applicationDefault();

    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    console.log('✅ Firebase initialized');
  }
  return admin.firestore();
}
