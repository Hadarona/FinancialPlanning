# Android installation and checks

## Install on Galaxy S23 / S24

1. Finish the HTTPS server setup in [personal deployment](personal-deployment.md).
2. Transfer `budget-together.apk` to the phone or download the APK from the successful GitHub Actions Android artifact.
3. Open it in My Files and temporarily allow that app to install unknown apps when Android asks. The personal-use APK is debug-signed, not a Play Store release. Install only your own build or the reviewed project artifact.
4. Open **Budget Together**, enter your server's HTTPS origin and tap **Connect**. Sign in with **Remember me** checked.
5. Install and connect Tailscale on the phone if your server uses the private Tailscale arrangement.

The locally delivered APK and a GitHub Actions APK can use different debug signing keys. To update an existing installation without reinstalling, build with the same key. Reinstalling clears the saved server and session on the phone; budget data remains on the server. A Play Store release would require your own persistent release-signing key and publishing setup.

## Build on PC

Requirements: Java 17, Android SDK platform 35/build-tools 35.0.0, and network access for Gradle dependencies. Set `ANDROID_HOME` to your SDK. The included Gradle wrapper pins Gradle 8.11.1.

```powershell
cd android
./gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

Result: `android/app/build/outputs/apk/debug/app-debug.apk`. Minimum Android is 11 (API 30). Target/compile SDK is 35. GitHub Actions runs the same tasks on Linux.

## Automated checks

Unit tests verify HTTPS-origin validation, rejection of credentials/query/path injection, first-run setup, invalid saved addresses, persisted server loading, return to setup, JavaScript/DOM storage settings, disabled local-file access and blocked mixed content. Browser journeys test the shared responsive frontend, imports, sharing and Hebrew mobile layout. Android lint must pass. This does not replace testing Samsung's installed WebView and document picker on a real device.

## Phone checklist

- Install and launch on both phones; configure the HTTPS address and sign in.
- Close/reopen the app and restart the phone; Remember me should retain your session.
- Switch to Hebrew; check right-to-left navigation, amount entry, keyboard, scrolling and charts. Rotate the phone and increase system text size.
- Add an expense, edit a plan from a selected month, then verify the earlier month is unchanged.
- Pick an Excel file using My Files; preview, map and import it. Import again and verify duplicates are skipped.
- Use owner/editor/viewer accounts. Check that changes appear after revisiting or refreshing the month, viewers cannot edit, and removed members lose access.
- Disable connectivity or stop the server, then use the retry screen after reconnecting.
- Use Android Back through app pages; change the server and verify the old session is cleared. Invalid certificates and plain HTTP are intentionally rejected.

The app is online-only. It saves the server address, language and session, not an offline copy of your financial database. No JavaScript-to-native bridge is exposed.
