import Foundation
import UserNotifications

@Observable
final class NotificationService: NSObject {
    static let shared = NotificationService()

    enum Category {
        static let parkingDetected = "PARKING_DETECTED"
        static let parkingExpiring = "PARKING_EXPIRING"
    }

    enum Action {
        static let payNow          = "PAY_NOW"
        static let changeDuration  = "CHANGE_DURATION"
        static let extend1h        = "EXTEND_1H"
    }

    enum UserInfoKey {
        static let zoneId   = "zone_id"
        static let zoneCode = "zone_code"
        static let sessionId = "session_id"
    }

    private(set) var pendingAction: PendingNotificationAction?

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Setup

    func setup() {
        let payAction = UNNotificationAction(identifier: Action.payNow, title: "Pay Now", options: [.foreground])
        let changeAction = UNNotificationAction(identifier: Action.changeDuration, title: "Change Duration", options: [.foreground])
        let parkCategory = UNNotificationCategory(
            identifier: Category.parkingDetected,
            actions: [payAction, changeAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        let extendAction = UNNotificationAction(identifier: Action.extend1h, title: "Extend +1 hr", options: [.foreground])
        let expiryCategory = UNNotificationCategory(
            identifier: Category.parkingExpiring,
            actions: [extendAction],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([parkCategory, expiryCategory])
    }

    // MARK: - Authorization

    func requestAuthorization() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            print("[NotificationService] Auth error: \(error)")
            return false
        }
    }

    // MARK: - Scheduling

    func scheduleParkingDetected(zone: Zone) {
        let content = UNMutableNotificationContent()
        content.title = "Parked near \(zone.name)"
        content.body = buildDetectedBody(zone: zone)
        content.sound = .default
        content.categoryIdentifier = Category.parkingDetected
        content.userInfo = [
            UserInfoKey.zoneId: zone.id as Any,
            UserInfoKey.zoneCode: zone.zoneCode
        ]

        let request = UNNotificationRequest(
            identifier: "detected_\(zone.zoneCode)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }

    func scheduleExpiryWarning(session: ParkingSession, zone: Zone, warningMinutes: Int) {
        guard let expiry = session.expiresAt else { return }
        let fireDate = expiry.addingTimeInterval(-TimeInterval(warningMinutes * 60))
        let interval = fireDate.timeIntervalSinceNow
        guard interval > 0 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Parking expiring soon"
        content.body = "\(zone.name) expires in \(warningMinutes) min — tap to extend"
        content.sound = .default
        content.categoryIdentifier = Category.parkingExpiring
        content.userInfo = [UserInfoKey.sessionId: session.id as Any]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(
            identifier: "expiring_\(session.id ?? 0)",
            content: content,
            trigger: trigger
        )
        UNUserNotificationCenter.current().add(request)
    }

    func cancelExpiryWarning(sessionId: Int64) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: ["expiring_\(sessionId)"])
    }

    func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    func clearPendingAction() {
        pendingAction = nil
    }

    // MARK: - Helpers

    private func buildDetectedBody(zone: Zone) -> String {
        var parts = ["Zone \(zone.zoneCode)"]
        if let rate = zone.hourlyRate {
            parts.append(String(format: "£%.2f/hr", rate))
        }
        parts.append(zone.smsCapable ? "Tap to pay" : zone.provider.displayName)
        return parts.joined(separator: " · ")
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationService: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        handler([.banner, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler handler: @escaping () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        let actionId = response.actionIdentifier

        DispatchQueue.main.async {
            if let zoneId = info[UserInfoKey.zoneId] as? Int64,
               let zone = try? ZoneDatabase.shared.zone(id: zoneId) {
                switch actionId {
                case Action.payNow:
                    self.pendingAction = .payNow(zone: zone)
                case Action.changeDuration:
                    self.pendingAction = .changeDuration(zone: zone)
                default:
                    self.pendingAction = .openApp
                }
            } else if actionId == Action.extend1h {
                self.pendingAction = .extend
            }
        }

        handler()
    }
}

// MARK: - Pending Action

enum PendingNotificationAction {
    case payNow(zone: Zone)
    case changeDuration(zone: Zone)
    case extend
    case openApp
}
