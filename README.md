# 🏧 SecureATM — Fingerprint-Based ATM System

> A full-stack ATM simulation using an **ESP32 + fingerprint sensor** as hardware and a **React web dashboard** connected to **Firebase Realtime Database**.

---

## 🔗 Live Web UI

| Environment | URL |
|---|---|
| **Production (Live)** | *(https://preview--securefingerprintbasedatm.lovable.app/home)* |
| **Local Dev** | `http://localhost:5173` |

---

## 📁 Project Structure

```
Finger_Print_based ATM-System/
├── firmware/          # ESP32 Arduino sketch (SecureATM.ino)
├── web-ui/            # React + Vite + Firebase dashboard
├── database/          # Firebase JSON schema & seed data
├── documentation/     # Wiring diagrams, system docs
├── images/            # Project screenshots
└── testing/           # Test plans & QA notes
```

---

## 🔥 Firebase Setup — Seed Test Data

Go to **Firebase Console → Realtime Database → ⋮ menu → Import JSON** and paste the following:

```json
{
  "users": {
    "1": {
      "name": "Mohit",
      "balance": 25000,
      "pin": "5100",
      "verified": true,
      "email": "your-real-email@gmail.com"
    },
    "2": {
      "name": "sayali zagade",
      "balance": 8400,
      "pin": "5657",
      "verified": false
    },
    "3": {
      "name": "Zero Balance User",
      "balance": 0,
      "pin": "1111",
      "verified": true
    },
    "4": {
      "name": "Large Balance User",
      "balance": 150000,
      "pin": "4321",
      "verified": true
    }
  },
  "esp32": {
    "online": true,
    "lastSeen": 1798785600000
  },
  "atm": {
    "authenticated": false,
    "currentUser": 0,
    "loginType": "",
    "pinEntered": 0
  }
}
```

> ⚠️ **Important:** Replace `esp32/lastSeen` with the **current time in UNIX milliseconds**.
> Get it from [epochconverter.com](https://www.epochconverter.com/) → copy **"Milliseconds since epoch"**.
> If the value is more than **15 seconds old**, the dashboard will correctly show **ESP32 OFFLINE** — this is intended behaviour.

---

## 👤 Test Accounts

| # | Name | Fingerprint ID | PIN | Balance | Notes |
|---|---|---|---|---|---|
| 1 | **Mohit** | 1 | `5100` | ₹25,000 | Full-featured account, email set |
| 2 | **sayali zagade** | 2 | `5657` | ₹8,400 | PIN login only, unverified flag |
| 3 | **Zero Balance User** | 3 | `1111` | ₹0 | Withdrawal must be rejected |
| 4 | **Large Balance User** | 4 | `4321` | ₹1,50,000 | Statement pagination testing |

---

## 🧪 Test Scenarios

### 1. PIN Login

| Scenario | Expected Result |
|---|---|
| Enter **wrong PIN** 3 times | 30-second lockout with countdown timer |
| Enter **correct PIN** | Dashboard opens with live balance |

---

### 2. Withdraw — User 1 (Balance ₹25,000)

#### ✅ Valid withdrawals (receipt modal must appear after each)
| Amount | Should Succeed |
|---|---|
| `₹500` | ✅ Yes |
| `₹1,000` | ✅ Yes |
| `₹25,000` | ✅ Yes (full balance) |

#### ❌ Invalid withdrawals (must show error, no transaction)
| Amount | Rejection Reason |
|---|---|
| `₹250` | Not a multiple of ₹100 |
| `₹0` | Zero amount |
| `-₹500` | Negative amount |
| `₹30,000` | Exceeds available balance |

After each valid withdrawal, verify in Firebase:
- `users/1/balance` has decreased ✅
- A new entry has been pushed under `receipts/` ✅

---

### 3. Deposit

- Deposit **₹2,000** → balance increases
- Receipt modal appears
- New receipt entry created in Firebase under `receipts/`

---

### 4. ESP32 Online / Offline Detection

| Action | Expected Dashboard Status |
|---|---|
| `esp32/online: true` + fresh `lastSeen` | `● ESP32 ONLINE` within ~2 seconds (no page refresh) |
| Delete `lastSeen` field | `● ESP32 OFFLINE` |
| Set `lastSeen` to string `"ONLINE"` | `● ESP32 OFFLINE` |
| Set `online: false` | `● ESP32 OFFLINE` |
| Leave `lastSeen` stale (>15 s old) | `● ESP32 OFFLINE` |

---

### 5. Transaction Statement

| Test | Steps |
|---|---|
| **Filter by type** | Select "Deposit" → only deposit rows show |
| **Filter by date** | Type a date string in the search box |
| **Pagination** | Make 15+ transactions → use Prev/Next buttons |
| **Print Statement** | Click "Print Statement" → browser print dialog opens (white thermal-style receipt) |
| **Email Statement** | Requires `users/1/email` set to a real inbox → check inbox + spam for PDF attachment |

> 📧 If "Send to Registered Email" fails, check your **EmailJS template**:
> - *To Email* field must be set to `{{to_email}}`
> - PDF attachment content must be `{{pdf_attachment}}`
> - Dynamic attachments require a **paid EmailJS plan**

---

### 6. Session Inactivity Timeout

1. Log in with any account
2. Stay idle on the dashboard for **~60 seconds**
3. A 10-second countdown modal appears asking "Stay or Logout?"
4. Click **"Stay"** → session continues
5. Let countdown reach 0 → auto logout

---

## 🔧 Hardware — ESP32 Wiring

| ESP32 Pin | Connected To |
|---|---|
| GPIO 16 (RX2) | Fingerprint sensor TX |
| GPIO 17 (TX2) | Fingerprint sensor RX |
| GPIO 25 | Buzzer (+) |
| GPIO 26 | Logout button (INPUT_PULLUP) |
| GND | Common ground |
| 3.3V / 5V | Fingerprint sensor VCC |

---

## 📡 Firebase Realtime Database Structure

```
root/
├── atm/
│   ├── authenticated   boolean   ← Set by ESP32 on fingerprint match
│   ├── currentUser     number    ← Fingerprint ID (1–127), 0 = no session
│   ├── loginType       string    ← "fingerprint"
│   └── pinEntered      number    ← PIN attempt tracking
├── esp32/
│   ├── online          boolean   ← Heartbeat flag (set every 10 s)
│   └── lastSeen        number    ← UNIX ms timestamp of last heartbeat
├── users/
│   └── {id}/
│       ├── name         string
│       ├── balance      number
│       ├── pin          string
│       ├── verified     boolean
│       ├── email        string   ← Optional, for statement email
│       └── fingerprintId number
└── transactions/ (or receipts/)
    └── {pushId}/
        ├── userId       number
        ├── type         string   "withdrawal" | "deposit"
        ├── amount       number
        ├── balanceBefore number
        ├── balanceAfter  number
        ├── timestamp    string   ISO 8601
        └── status       string   "success" | "failed"
```

---

## 🛠 Local Development

```bash
# 1. Navigate to the web-ui folder
cd "web-ui"

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Start the dev server
npm run dev

# 4. Open in browser
# http://localhost:5173
```

---

## 🌐 Firebase Configuration

Edit `web-ui/src/lib/firebase.ts` and replace the placeholder values with your real Firebase project credentials from:

**Firebase Console → Project Settings → Your apps → SDK setup and configuration**

```ts
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "fingerprint-based-atm-1b834.firebaseapp.com",
  databaseURL:       "https://fingerprint-based-atm-1b834-default-rtdb.firebaseio.com",
  projectId:         "fingerprint-based-atm-1b834",
  storageBucket:     "fingerprint-based-atm-1b834.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

---

## 🔒 Firebase Security Rules (Recommended for Production)

```json
{
  "rules": {
    "atm":  { ".read": true, ".write": true },
    "esp32":{ ".read": true, ".write": true },
    "users":{
      ".read": true,
      "$uid": { ".write": "auth != null" }
    },
    "transactions": { ".read": true, ".write": true }
  }
}
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Hardware | ESP32 DevKit + R307 Fingerprint Sensor |
| Firmware | Arduino C++ (WiFi + HTTPClient + Adafruit_Fingerprint) |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Vanilla CSS (dark ATM theme) |
| Database | Firebase Realtime Database |
| Email | EmailJS (statement delivery) |
| PDF | jsPDF (receipt generation) |

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| ESP32 shows OFFLINE even when powered | Check `esp32/lastSeen` — must be current UNIX ms, not a string |
| Fingerprint not detected | Verify sensor wiring on GPIO 16/17, baud rate 57600 |
| Firebase writes failing | Check database rules allow `.write: true` |
| Balance not updating | Hard-refresh the browser; check Firebase console directly |
| Email not sending | Verify EmailJS template uses `{{to_email}}` and `{{pdf_attachment}}`; check paid plan |
| Wrong PIN lockout not resetting | Wait 30 seconds or clear `atm/pinEntered` in Firebase manually |

---

*Built with ❤️ — SecureATM Project*
