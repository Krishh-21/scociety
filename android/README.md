# JODO Android test app

JODO opens the private hosted demo in an Android Custom Tab or the default browser. The browser handles the Vercel sign-in, then JODO accepts its demo accounts. The app requires internet access and Android 6.0 or later.

From the repository root on Windows, set `JAVA_HOME` to a JDK 17 or later and `ANDROID_HOME` to an Android SDK containing Android 36 and Build Tools 36.0.0. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\android\build.ps1
```

The script verifies the signed APK and puts it in `android/build/JODO.apk`. Keep the local test keystore in `android/build` to sign updates that can install over this version. The APK is intended for sideloaded testing.
