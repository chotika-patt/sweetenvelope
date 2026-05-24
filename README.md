# 💌 SweetEnvelope — Next.js + Firebase + Vercel

## วิธี setup ทีละขั้น

---

### 1. สร้าง Firebase Project

1. ไปที่ https://console.firebase.google.com
2. คลิก **Add project** → ตั้งชื่อ (เช่น `sweetenvelope`)
3. เปิด Firestore:
   - ซ้ายมือ → **Firestore Database** → Create database
   - เลือก **Start in test mode** (ปรับ rules ทีหลัง)
   - เลือก region ใกล้ไทย เช่น `asia-southeast1`

---

### 2. เอา Firebase Config (Client SDK)

1. **Project settings** (⚙️ บนซ้าย) → **General** tab
2. เลื่อนลงมา **Your apps** → คลิก `</>` (Web)
3. ตั้งชื่อ app → Register app
4. Copy ค่าจาก `firebaseConfig` ไปใส่ใน env

---

### 3. เอา Service Account Key (Admin SDK)

1. **Project settings** → **Service accounts** tab
2. คลิก **Generate new private key** → Download JSON
3. เปิดไฟล์ JSON แล้วเอาค่าเหล่านี้:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`

---

### 4. ตั้งค่า .env.local (รันในเครื่อง)

```
cp .env.example .env.local
```

แล้วเปิด `.env.local` ใส่ค่าจริง:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sweetenvelope.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sweetenvelope
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sweetenvelope.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:123...:web:abc...

FIREBASE_ADMIN_PROJECT_ID=sweetenvelope
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxx@sweetenvelope.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIB...\n-----END PRIVATE KEY-----\n"
```

> ⚠️ `FIREBASE_ADMIN_PRIVATE_KEY` ต้องอยู่ใน `"..."` (double quotes) และ newline เป็น `\n`

---

### 5. รันในเครื่อง

```bash
npm install
npm run dev
```

เปิด http://localhost:3000

---

### 6. Deploy บน Vercel

1. Push โค้ดขึ้น GitHub (อย่า push `.env.local`)
2. ไปที่ https://vercel.com → Import repository
3. **Settings → Environment Variables** ใส่ค่าเดียวกับ `.env.local` ทุกตัว
4. Deploy!

---

### Firestore Security Rules (production)

ไปที่ Firestore → Rules แล้วแทนที่ด้วย:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /letters/{letterId} {
      // อ่าน/เขียนผ่าน API Route เท่านั้น (Admin SDK bypass rules)
      allow read, write: if false;
    }
  }
}
```

เพราะเราใช้ Admin SDK ใน API Routes ซึ่ง bypass rules อยู่แล้ว — ปลอดภัยดี

---

### เพิ่ม/แก้รายชื่อ

แก้ที่ `lib/data.ts`:

```ts
export const PEOPLE = [
  { id: 1, name: 'ชื่อ', emoji: '🌸', tag: '🏷️ tag' },
  // ...ได้ถึง 44 คน
];

export const ACCOUNTS = [
  { username: 'user01', password: 'pass01', personId: 1 },
  // ...
];
```
