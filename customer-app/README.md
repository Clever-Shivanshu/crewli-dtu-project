# Crewli (customer app)

Minimal scaffold that renders a "Welcome to Crewli" screen. Shares all the
worker-app packages so you can grow it into the customer experience without
re-auditing dependencies.

## One-time setup

```bash
cd customer-app
npm install
```

The Android build also needs a gradle-wrapper and launcher icons. Easiest is
to copy them from the sibling `workers-app/` project:

```bash
# From repo root
cp -r workers-app/android/gradle customer-app/android/
cp workers-app/android/gradlew customer-app/android/
cp workers-app/android/gradlew.bat customer-app/android/
chmod +x customer-app/android/gradlew
cp -r workers-app/android/app/src/main/res/mipmap-* customer-app/android/app/src/main/res/
```

> Want a dedicated customer icon? Drop `crewli.png` at `customer-app/crewli.png`
> and run the same sort of `cp` loop (see `workers-app/scripts/set-icon.sh`).

### Firebase

Firebase Console → add Android app with package `com.crewli` to the **same**
Firebase project used by the workers app → download `google-services.json` →
place it at:

```
customer-app/android/app/google-services.json
```

Because workers and customers both point at one Firebase project, push flows
(worker job offers, customer status updates) all share one FCM topic set.

## Run

```bash
cd customer-app
npm start          # Metro
npm run android    # new terminal
```
