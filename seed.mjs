// Seed script — run once to create the company doc in Firestore
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDB_z2t6tpp31HXy2-u2JZNgyIyx9QZgK0",
  authDomain: "addlesberger-app.firebaseapp.com",
  projectId: "addlesberger-app",
  storageBucket: "addlesberger-app.firebasestorage.app",
  messagingSenderId: "697460116517",
  appId: "1:697460116517:web:40e997ac315c36dce503cc",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function seed() {
  console.log('Seeding company doc...')
  await setDoc(doc(db, 'companies', 'default-company'), {
    name: "Addlesberger Roofing",
    phone: "",
    email: "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  console.log('✅ Company doc created: companies/default-company')
  console.log('Done! You can update the name in Settings after logging in.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
