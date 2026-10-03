# 8aPDF GOLD Android

Native Kotlin Android shell for the production 8aPDF website. The existing golden website remains the visual source of truth and is rendered in a hardware-accelerated WebView; native Android code handles downloads, sharing, notification permission, daily motivation, test reminders, FCM delivery, boot recovery and deep-link intents.

## Build

```bash
gradle assembleDebug
```

The GitHub Actions workflow builds `app-debug.apk` on pushes affecting `android/` or by manual dispatch.

## Notifications

- Android 13+ requests `POST_NOTIFICATIONS` once using the native runtime permission dialog.
- Daily motivation is scheduled for 4:00 PM in the device's local timezone (the app is intended for Asia/Kolkata), with an exact-alarm fallback when exact alarms are unavailable.
- 160 student-friendly quotes rotate persistently without early repeats.
- Test reminder sync reads published `announcements` and schedules qualifying test/exam notices for 4:00 PM on the preceding day when a trustworthy Firestore `eventDate` exists.
- `FirebaseMessagingService` displays secure server-sent PDF/announcement payloads on the content channel. The server-side FCM trigger must be deployed separately; service-account keys never belong in this project or APK.

## Website compatibility

The app loads `https://8apdf.vercel.app/?android=1`, keeps the website UI unchanged, opens external PDF links in the browser, routes downloads to Android DownloadManager, and supplies a native share fallback. The website's redundant web notification modal is suppressed only inside the Android WebView.

Do not commit signing keys, Firebase service-account credentials, or user secrets. A release build needs a separately managed signing configuration.
