import SwiftUI
import WebKit

/// The app's screens: the bundled Sample Hunter page in a full-screen web view, wired to the native bridge.
struct HunterWebView: UIViewRepresentable {
    func makeCoordinator() -> NativeBridge { NativeBridge() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "hunter")
        // tells the page it runs inside the app, before any of its scripts
        controller.addUserScript(WKUserScript(source: "window.__hunterNative = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = controller

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.086, green: 0.090, blue: 0.102, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never   // the page handles the safe areas itself
        web.scrollView.bounces = false
        web.uiDelegate = context.coordinator
        web.navigationDelegate = context.coordinator
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }   // Safari > Develop, for debugging
        #endif
        context.coordinator.webView = web

        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            web.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
