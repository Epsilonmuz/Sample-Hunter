import AVFoundation
import UIKit
import WebKit

/// The audio session: playback (ignores the silent switch) most of the time, play-and-record while hunting.
enum AudioSession {
    static func usePlayback() {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default, options: [])
        try? s.setActive(true)
    }
    static func useRecording() throws {
        let s = AVAudioSession.sharedInstance()
        try s.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetoothA2DP])
        try s.setActive(true)
    }
}

/// Messages from the page (window.webkit.messageHandlers.hunter.postMessage({cmd: ...})):
///   record            start a hunt with the iPhone microphone
///   stop              stop it; the recording goes back to the page as base64 (window.__nativeRecorded)
///   save {name, b64}  a ZIP for FL Studio: opens the share sheet (Save to Files, AirDrop to the Mac...)
///   haptic {style}    a tap on the pads
final class NativeBridge: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, AVAudioRecorderDelegate {
    weak var webView: WKWebView?
    private var recorder: AVAudioRecorder?
    private var meter: Timer?
    private var recordURL: URL { FileManager.default.temporaryDirectory.appendingPathComponent("hunt.m4a") }
    private let light = UIImpactFeedbackGenerator(style: .light), medium = UIImpactFeedbackGenerator(style: .medium), heavy = UIImpactFeedbackGenerator(style: .heavy)

    // MARK: page -> app
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
        switch cmd {
        case "record": startRecording()
        case "stop": stopRecording()
        case "save": save(name: body["name"] as? String ?? "Sample Hunter.zip", base64: body["b64"] as? String ?? "")
        case "haptic":
            switch body["style"] as? String {
            case "heavy": heavy.impactOccurred()
            case "medium": medium.impactOccurred()
            default: light.impactOccurred()
            }
        default: break
        }
    }

    private func js(_ script: String) {
        DispatchQueue.main.async { self.webView?.evaluateJavaScript(script, completionHandler: nil) }
    }

    // MARK: recording
    private func startRecording() {
        let begin = { [weak self] in
            guard let self else { return }
            do {
                try AudioSession.useRecording()
                let settings: [String: Any] = [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 1,
                                               AVEncoderAudioQualityKey: AVAudioQuality.max.rawValue, AVEncoderBitRateKey: 256000]
                try? FileManager.default.removeItem(at: self.recordURL)
                let r = try AVAudioRecorder(url: self.recordURL, settings: settings)
                r.delegate = self
                r.isMeteringEnabled = true
                guard r.record(forDuration: 30) else { throw NSError(domain: "SampleHunter", code: 1) }
                self.recorder = r
                self.js("window.__nativeRecStarted && window.__nativeRecStarted()")
                self.meter = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
                    guard let self, let r = self.recorder else { return }
                    r.updateMeters()
                    let level = pow(10, r.averagePower(forChannel: 0) / 20)        // 0..1
                    self.js("window.__nativeLevel && window.__nativeLevel(\(level), \(r.currentTime))")
                }
            } catch {
                AudioSession.usePlayback()
                self.js("window.__nativeRecError && window.__nativeRecError('Couldn\\'t start the microphone')")
            }
        }
        let denied = { [weak self] in
            self?.js("window.__nativeRecError && window.__nativeRecError('Microphone is off for Sample Hunter: turn it on in Settings > Sample Hunter')")
        }
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission { ok in DispatchQueue.main.async { ok ? begin() : denied() } }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { ok in DispatchQueue.main.async { ok ? begin() : denied() } }
        }
    }

    private func stopRecording() {
        recorder?.stop()   // the delegate sends the result
    }

    func audioRecorderDidFinishRecording(_ r: AVAudioRecorder, successfully ok: Bool) {
        meter?.invalidate(); meter = nil
        recorder = nil
        AudioSession.usePlayback()
        guard ok, let data = try? Data(contentsOf: recordURL), !data.isEmpty else {
            js("window.__nativeRecError && window.__nativeRecError('Nothing was recorded')")
            return
        }
        js("window.__nativeRecorded && window.__nativeRecorded('\(data.base64EncodedString())')")
    }

    // MARK: saving: the share sheet (Save to Files, AirDrop to your Mac, Messages...)
    private func save(name: String, base64: String) {
        guard let data = Data(base64Encoded: base64), !data.isEmpty else { return }
        let safe = name.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
        do { try data.write(to: url, options: .atomic) } catch { return }
        DispatchQueue.main.async {
            guard let root = self.webView?.window?.rootViewController else { return }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = self.webView                // iPad
            sheet.popoverPresentationController?.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.midY, width: 1, height: 1)
            sheet.completionWithItemsHandler = { [weak self] _, done, _, _ in
                self?.js("window.__nativeSaved && window.__nativeSaved(\(done ? "true" : "false"))")
            }
            var top = root; while let p = top.presentedViewController { top = p }
            top.present(sheet, animated: true)
        }
    }

    // MARK: web view housekeeping
    // a web page asking for the microphone (fallback path): allowed, the app already asked iOS
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    // links to other sites open in Safari
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, ["http", "https"].contains(url.scheme ?? ""), action.navigationType == .linkActivated {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }
}
