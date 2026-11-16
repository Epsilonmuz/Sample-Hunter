# Sample Hunter on your iPhone

The iPhone app is a native app: it records with the iPhone microphone, plays with the silent switch on,
saves through the iOS share sheet (Save to Files, AirDrop to your Mac) and buzzes on the pads.

## What you need
- Your Mac with **Xcode** (free, App Store). Xcode 16 runs on your 2019 MacBook Pro with macOS Sequoia.
- Your iPhone and its cable.
- Your **Apple ID**. A free one works; see "7 days" below.

## Install it (about 5 minutes, the first time)
1. Double-click **SampleHunter.xcodeproj**. Xcode opens with everything in.
2. Xcode: **Settings → Accounts → +** and sign in with your Apple ID (once).
3. Click **SampleHunter** at the top of the left sidebar → target **SampleHunter** → **Signing & Capabilities** → **Team**: pick your name.
   If Xcode says the bundle ID is taken, change `com.epsilonsounds.samplehunter` to something of yours, e.g. `com.epsilonsounds.samplehunter.edison`.
4. Plug in the iPhone and unlock it. Pick it at the top of the Xcode window (next to the ▶ button).
   First time only: on the iPhone, **Settings → Privacy & Security → Developer Mode → On** (it restarts).
5. Press **▶ (Run)**. Sample Hunter installs and opens.
   First time only, if the iPhone says "Untrusted Developer": **Settings → General → VPN & Device Management** → your Apple ID → **Trust**.
6. Tap **HUNT**, allow the microphone, and record something.

## 7 days (free Apple ID) or forever ($99/year)
- With a **free Apple ID**, Apple lets an app you install yourself run for **7 days**. Then plug in and press ▶ again (your hunts stay).
- With the **Apple Developer Program** ($99/year) it lasts a year, you can put it on **TestFlight** for friends, and you can publish it on the **App Store** (Product → Archive → Distribute App).

## Getting your beats into FL Studio
Export tab → **Save kit + beat (ZIP)** → the share sheet opens → **AirDrop** to your MacBook (or **Save to Files**).
Unzip on the Mac: `Beat 4 bars.wav` to the Playlist, `One-shots` into FPC, `Pattern.mid` into the Piano roll.

## Updating the app
The screens and sound engine live in `SampleHunter/Web/index.html`, built from the repo (`python3 build.py`).
After an update, open the project and press ▶ again.
