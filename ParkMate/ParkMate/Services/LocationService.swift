import Foundation
import CoreLocation

@Observable
final class LocationService: NSObject {
    static let shared = LocationService()

    private let manager = CLLocationManager()

    private(set) var currentLocation: CLLocation?
    private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined
    private(set) var monitoredZoneCount: Int = 0

    // Callbacks to ParkingDetectionEngine
    var onParkingDetected: ((Zone) -> Void)?
    var onGeofenceExited: ((Zone) -> Void)?

    private var dwellTimer: Timer?
    private var candidateZone: Zone?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 15
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        authorizationStatus = manager.authorizationStatus
    }

    // MARK: - Authorization

    func requestAlwaysAuthorization() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse:
            manager.requestAlwaysAuthorization()
        default:
            break
        }
    }

    // MARK: - Location

    func startUpdating() {
        manager.startUpdatingLocation()
        manager.startMonitoringSignificantLocationChanges()
    }

    func stopUpdating() {
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
    }

    // MARK: - Geofencing

    func refreshGeofences(near location: CLLocation) {
        // Clear existing
        for region in manager.monitoredRegions {
            manager.stopMonitoring(for: region)
        }

        guard let nearest = try? ZoneDatabase.shared.nearestZones(to: location, limit: 20) else { return }
        let radius = AppSettings.shared.geofenceRadius

        for (zone, _) in nearest {
            guard let zoneId = zone.id else { continue }
            let region = CLCircularRegion(
                center: CLLocationCoordinate2D(latitude: zone.latitude, longitude: zone.longitude),
                radius: radius,
                identifier: "zone_\(zoneId)"
            )
            region.notifyOnEntry = true
            region.notifyOnExit  = true
            manager.startMonitoring(for: region)
        }

        monitoredZoneCount = nearest.count
    }

    // MARK: - Dwell Detection

    private func startDwellTimer(for zone: Zone) {
        dwellTimer?.invalidate()
        candidateZone = zone

        let delay = AppSettings.shared.dwellTimeSeconds
        dwellTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.confirmParking()
        }
        RunLoop.main.add(dwellTimer!, forMode: .common)
    }

    private func cancelDwellTimer() {
        dwellTimer?.invalidate()
        dwellTimer = nil
        candidateZone = nil
    }

    private func confirmParking() {
        guard let zone = candidateZone else { return }
        // Double-check speed: stationary = speed < 1.5 m/s (or -1 if unavailable)
        let speed = currentLocation?.speed ?? -1
        if speed < 1.5 {
            DispatchQueue.main.async { self.onParkingDetected?(zone) }
        }
        candidateZone = nil
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationService: CLLocationManagerDelegate {

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        DispatchQueue.main.async {
            self.authorizationStatus = manager.authorizationStatus
        }
        switch manager.authorizationStatus {
        case .authorizedWhenInUse:
            manager.requestAlwaysAuthorization()
            startUpdating()
        case .authorizedAlways:
            startUpdating()
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last, loc.horizontalAccuracy >= 0 else { return }
        DispatchQueue.main.async { self.currentLocation = loc }
        refreshGeofences(near: loc)
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let id = zoneId(from: region),
              let zone = try? ZoneDatabase.shared.zone(id: id) else { return }
        startDwellTimer(for: zone)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard let id = zoneId(from: region),
              let zone = try? ZoneDatabase.shared.zone(id: id) else { return }
        cancelDwellTimer()
        DispatchQueue.main.async { self.onGeofenceExited?(zone) }
    }

    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        print("[LocationService] Monitoring failed for \(region?.identifier ?? "?"): \(error)")
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[LocationService] Location error: \(error)")
    }

    // MARK: - Helpers

    private func zoneId(from region: CLRegion) -> Int64? {
        guard let circular = region as? CLCircularRegion else { return nil }
        let str = circular.identifier.replacingOccurrences(of: "zone_", with: "")
        return Int64(str)
    }
}
