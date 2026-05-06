// Fix Auth — create or reset Charlene's Firebase Auth user
// Usage: node fix-auth.mjs
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyDB_z2t6tpp31HXy2-u2JZNgyIyx9QZgK0",
  authDomain: "addlesberger-app.firebaseapp.com",
  projectId: "addlesberger-app",
  storageBucket: "addlesberger-app.firebasestorage.app",
  messagingSenderId: "697460116517",
  appId: "1:697460116517:web:40e997ac315c36dce503cc",
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

const EMAIL = 'rladdlesbergerroofing@gmail.com'
const PASSWORD = 'DEjockie3'

async function fixAuth() {
  console.log(`🔧 Setting up user: ${EMAIL} with password: ${PASSWORD}`)

  // First try to sign in (user might already exist with this password)
  try {
    const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
    console.log('✅ User already exists and password is correct!')
    console.log(`   UID: ${cred.user.uid}`)
    process.exit(0)
  } catch (err) {
    console.log(`   Sign-in failed: ${err.code}`)
  }

  // If sign-in failed, try creating the user
  try {
    const cred = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD)
    console.log('✅ User CREATED successfully!')
    console.log(`   UID: ${cred.user.uid}`)
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${PASSWORD}`)
    process.exit(0)
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('⚠️  User exists but has a DIFFERENT password.')
      console.log('')
      console.log('To fix this, you need to do ONE of these:')
      console.log('')
      console.log('OPTION 1: Reset via Firebase Console')
      console.log('  1. Go to https://console.firebase.google.com/project/addlesberger-app/authentication/users')
      console.log('  2. Find rladdlesbergerroofing@gmail.com')
      console.log('  3. Click the 3-dot menu → Reset password')
      console.log('')
      console.log('OPTION 2: Use the "Forgot Password" button on the login page')
      console.log('  1. Go to https://blueprintaiconsulting.github.io/addlesberger_app/')
      console.log('  2. Type "charleen" in the username field')
      console.log('  3. Click "Forgot Password?"')
      console.log('  4. Check rladdlesbergerroofing@gmail.com inbox for reset link')
      console.log('  5. Set new password to: DEjockie3')
      process.exit(1)
    } else {
      console.error(`❌ Create failed: ${err.code} — ${err.message}`)
      process.exit(1)
    }
  }
}

// Timeout
setTimeout(() => {
  console.error('❌ Timed out. Check network.')
  process.exit(1)
}, 15000)

fixAuth()
