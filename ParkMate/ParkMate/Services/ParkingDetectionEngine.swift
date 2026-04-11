import Foundation

/// Bridges LocationService geofence events to notifications and UI state.
/// Views observe `detectedZone` to show the payment prompt.
@Observable
final class ParkingDetectionEngine {
    static let shared = ParkingDetectionEngine()

    private(set) var detectedZone: Zone?

    var isEnabled: Bool {
        get { AppSettings.shared.autoDetectEnabled }
        set { AppSettings.shared.autoDetectEnabled = newValue }
    }

    private init() {
        LocationService.shared.onParkingDetected = { [weak self] zone in
            self?.handleDetected(zone: zone)
        }
    }

    // MARK: - Detection Handler

    private func handleDetected(zone: Zone) {
        guard isEnabled else { return }
        guard SessionManager.shared.activeSession == nil else { return }

        detectedZone = zone
        NotificationService.shared.scheduleParkingDetected(zone: zone)
    }

    // MARK: - Public

    func clearDetectedZone() {
        detectedZone = nil
    }
}
