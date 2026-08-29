# Matchfix iOS — starter

This folder contains the first SwiftUI feature files. It is intentionally not checked in as a generated `.xcodeproj`: create that once on your Mac so its Team, bundle identifier and signing settings belong to you.

## Create the Xcode project

1. Open Xcode → **Create a new Xcode project** → **iOS / App**.
2. Set Product Name to `Matchfix`, Interface to `SwiftUI`, Language to `Swift`, minimum deployment target to **iOS 17**. Save it as `ios/Matchfix/Matchfix.xcodeproj`.
3. Delete Xcode’s generated `ContentView.swift` and the generated `MatchfixApp.swift`.
4. In Finder, drag the source folders `App`, `Core` and `Features` from `ios/Matchfix` into the yellow Matchfix group in Xcode. Select **Copy items if needed** only if Xcode asks; make sure the `Matchfix` target is ticked.
5. Add `Development.xcconfig` to the project after creating it from the example below. In the target’s **Build Settings**, set Debug’s **Configuration Settings File** to it.
6. In the target’s Info tab, add `MATCHFIX_API_BASE_URL` with value `$(MATCHFIX_API_BASE_URL)`.
7. Select an iPhone simulator and run with **⌘R**.

## Local configuration

Copy `Resources/Development.xcconfig.example` to `Resources/Development.xcconfig`, then set the API URL to a deployed HTTPS backend. This local file is ignored by Git.

Do not copy values from the web app’s `.env.local` into Xcode. In particular, never put `SUPABASE_SERVICE_ROLE_KEY`, Gemini keys, Creem keys, webhook secrets, or any server secret in the app.

## Next two implementation steps

1. Add `supabase-swift` through Xcode’s Swift Package Dependencies and implement Email + Sign in with Apple. The client holds only the Supabase URL and anon key.
2. Extract the current Next routes into versioned Bearer-token endpoints (`/v1/scans`, `/v1/enhancements`, `/v1/photos`, `/v1/credits`) and then wire the scanner’s `Analyze photos` button to the upload endpoint.

The API client in `Core/APIClient.swift` already attaches an access token when an auth provider is supplied; its default is intentionally unauthenticated until that integration is added.
