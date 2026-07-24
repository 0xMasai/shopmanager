# Shop Manager (shopms)

A deliberately small POS for small shops (phone/electronics shops, boutiques, general shops).
It does four things well:

1. **Record sales** — big-button screen that works on a cheap Android phone.
2. **Track stock** — sales reduce it, deliveries increase it, every movement is logged.
3. **Close the day** — staff do a *blind* count of the cash box and the shelves
   (they never see what the system expects), then the report locks.
4. **Owner reports** — live sales from anywhere, plus the daily comparison:
   cash counted vs. cash expected, stock counted vs. stock expected.
   Shortfalls are highlighted in red.

Anti-theft is structural, not a feature bolted on:

- Sales can never be edited or deleted (enforced by Firestore security rules).
- Staff cannot change prices — only the owner can (also enforced by rules).
- Day reports are one per day and lock on submit.
- The day-close count is blind, so "adjusting the count to match" is impossible.

It is a PWA: installable from Chrome ("Add to Home screen"), no Play Store
needed, and it keeps working offline — sales queue on the phone and sync when
data comes back (Firestore offline persistence).

## Quick start (demo mode)

```bash
npm install
npm run dev
```

Open the printed URL. With no Firebase config the app runs in **demo mode**:
seeded electronics-shop items (phones and accessories), data stored on the device only.
Log in as **Owner** (PIN `1234`) or **Staff** (PIN `1111`).

Demo mode is also your sales pitch — install it on your phone and walk the
shop owner through a sale, a day close, and the owner report.

## Going live (per client)

Each client gets their own Firebase project (free Spark plan is enough to start).

1. **Create a Firebase project** at console.firebase.google.com.
2. **Add a Web app** (Project settings → Your apps) and copy the config object
   into [src/firebase-config.js](src/firebase-config.js).
3. **Enable Authentication** → Sign-in method → Email/Password.
4. **Create Firestore** (production mode), then publish the contents of
   [firestore.rules](firestore.rules) under Firestore → Rules.
5. **Create the users** under Authentication → Add user (owner + each staff
   member). For each one, create a Firestore document:

   ```
   users/{uid}:
     name:   "Sarah"
     role:   "owner"        // or "staff"
     shopId: "sarahs-electronics"
   ```

   The `shopId` is any slug you choose — all shop data lives under
   `shops/{shopId}/…`. One project per client keeps data fully separated.
6. **Deploy**: `npm run build`, then host `dist/` on Firebase Hosting
   (`npx firebase-cli deploy`) or any static host. On the phone, open the URL
   in Chrome → menu → **Add to Home screen**.

## Daily routine that makes it work

- Staff record every sale at the moment of sale (cash or mobile money).
- Deliveries are recorded under **Stock** when they arrive.
- Every evening, staff submit the **Close** report: cash box count + shelf
  counts for fast-moving items.
- The owner checks **Reports** each evening; red badges mean money or stock is
  missing, with the exact items and amounts.

## What is deliberately NOT here (yet)

Keep the pitch honest and the product small. Reasonable next steps, roughly in
order of client demand:

- Cost price & profit per item
- Expenses (rent, airtime) so the day close reconciles net cash
- Multiple shops per owner
- SMS/WhatsApp daily summary to the owner
- Receipt printing via Bluetooth printer

## Business model reminder

Charge a small setup fee plus a monthly support fee, per shop. The monthly fee
covers hosting (Firebase free tier will carry a single small shop comfortably),
WhatsApp support, and small tweaks. The recurring revenue is the business —
one-off sales are not.
