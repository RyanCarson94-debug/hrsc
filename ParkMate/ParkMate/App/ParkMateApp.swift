import SwiftUI

@main
struct ParkMateApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    // Top-level observable singletons — passed via environment so
    // SwiftUI tracks their @Observable properties automatically.
    private var sessionManager    = SessionManager.shared
    private var locationService   = LocationService.shared
    private var detectionEngine   = ParkingDetectionEngine.shared
    private var notificationService = NotificationService.shared

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environment(sessionManager)
                .environment(locationService)
                .environment(detectionEngine)
                .environment(notificationService)
                .preferredColorScheme(.dark)
        }
    }
}
