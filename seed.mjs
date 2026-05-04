// Seed script — run once to create the company doc in Firestore
// Usage: node seed.mjs
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

// Validate config before connecting
for (const [key, val] of Object.entries(firebaseConfig)) {
  if (!val) {
    console.error(`❌ Missing Firebase config: ${key}`)
    process.exit(1)
  }
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function seed() {
  console.log('🔧 Connecting to Firestore...')

  // Timeout after 15 seconds
  const timeout = setTimeout(() => {
    console.error('❌ Timed out after 15s. Check your network connection.')
    process.exit(1)
  }, 15000)

  try {
    await setDoc(doc(db, 'companies', 'default-company'), {
      name: "Addlesberger Roofing",
      phone: "",
      email: "",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    clearTimeout(timeout)
    console.log('✅ Company doc created: companies/default-company')
    console.log('Done! You can update the name, phone, and email in Settings after logging in.')
    process.exit(0)
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
