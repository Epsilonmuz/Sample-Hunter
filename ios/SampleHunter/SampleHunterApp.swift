// Sample Hunter for iPhone · Epsilon Sounds
// Record any sound, get a drum kit, an 808, keys and a beat. The sound engine and screens are the tested web
// engine (bundled in Web/, works offline); recording, the audio session, haptics and saving are native.
import SwiftUI

@main
struct SampleHunterApp: App {
    init() {
        AudioSession.usePlayback()   // plays with the silent switch on
    }

    var body: some Scene {
        WindowGroup {
            HunterWebView()
                .ignoresSafeArea()
                .background(Color(red: 0.086, green: 0.090, blue: 0.102))   // Epsilon graphite #16171a
                .preferredColorScheme(.dark)
        }
    }
}
