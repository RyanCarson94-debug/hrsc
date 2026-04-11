import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Register notification categories and actions
        NotificationService.shared.setup()

        // Request notification permission
        Task {
            let granted = await NotificationService.shared.requestAuthorization()
            print("[AppDelegate] Notification permission granted: \(granted)")
        }

        // Kick off location services (authorization request happens inside)
        LocationService.shared.requestAlwaysAuthorization()

        // Ensure the detection engine singleton is initialised
        _ = ParkingDetectionEngine.shared

        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        application.applicationIconBadgeNumber = 0
    }

    // Called when the app is launched from a background location event
    func application(
        _ application: UIApplication,
        performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        // Check for expired sessions
        if let session = SessionManager.shared.activeSession, session.isExpired {
            try? SessionManager.shared.endSession()
            completionHandler(.newData)
        } else {
            completionHandler(.noData)
        }
    }
}
