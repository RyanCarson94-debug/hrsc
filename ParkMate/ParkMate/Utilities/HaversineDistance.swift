import Foundation
import CoreLocation

enum HaversineDistance {
    static func distance(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let earthRadius = 6_371_000.0
        let lat1 = from.latitude * .pi / 180
        let lat2 = to.latitude * .pi / 180
        let dLat = (to.latitude - from.latitude) * .pi / 180
        let dLon = (to.longitude - from.longitude) * .pi / 180

        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadius * c
    }

    static func distance(from location: CLLocation, to zone: Zone) -> Double {
        distance(
            from: location.coordinate,
            to: CLLocationCoordinate2D(latitude: zone.latitude, longitude: zone.longitude)
        )
    }

    static func sortZones(_ zones: [Zone], from location: CLLocation) -> [(zone: Zone, distance: Double)] {
        zones
            .map { ($0, distance(from: location, to: $0)) }
            .sorted { $0.1 < $1.1 }
    }
}
