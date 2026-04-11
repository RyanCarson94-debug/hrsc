import XCTest

final class ParkMateTests: XCTestCase {

    // MARK: - SMSFormatter

    func testParkBodyFormat() {
        let body = SMSFormatter.parkBody(zoneCode: "4521", durationMinutes: 120, cvv: "867")
        XCTAssertEqual(body, "RingGo 4521 2h 867")
    }

    func testParkBodyWithRegistration() {
        let body = SMSFormatter.parkBody(
            zoneCode: "4521",
            durationMinutes: 90,
            cvv: "867",
            registration: "AB12CDE"
        )
        XCTAssertEqual(body, "RingGo 4521 90m 867 AB12CDE")
    }

    func testExtendBodyFormat() {
        let body = SMSFormatter.extendBody(durationMinutes: 60, cvv: "867")
        XCTAssertEqual(body, "RingGo extend 1h 867")
    }

    // MARK: - DurationFormatter

    func testDurationMinutes() {
        XCTAssertEqual(DurationFormatter.toRingGoUnit(minutes: 30), "30m")
        XCTAssertEqual(DurationFormatter.toRingGoUnit(minutes: 45), "45m")
    }

    func testDurationHours() {
        XCTAssertEqual(DurationFormatter.toRingGoUnit(minutes: 60), "1h")
        XCTAssertEqual(DurationFormatter.toRingGoUnit(minutes: 120), "2h")
    }

    func testDurationMixedFallsBackToMinutes() {
        XCTAssertEqual(DurationFormatter.toRingGoUnit(minutes: 90), "90m")
    }

    func testDisplayString() {
        XCTAssertEqual(DurationFormatter.displayString(minutes: 30), "30 min")
        XCTAssertEqual(DurationFormatter.displayString(minutes: 60), "1 hr")
        XCTAssertEqual(DurationFormatter.displayString(minutes: 90), "1 hr 30 min")
    }

    func testCountdownString() {
        XCTAssertEqual(DurationFormatter.countdownString(from: 3600), "1:00:00")
        XCTAssertEqual(DurationFormatter.countdownString(from: 65), "1:05")
    }

    // MARK: - HaversineDistance

    func testHaversineDistanceKnownPoints() {
        // Liverpool ONE to Mount Pleasant — roughly 800m
        let liverpoolOne = CLLocationCoordinate2D(latitude: 53.4024, longitude: -2.9884)
        let mountPleasant = CLLocationCoordinate2D(latitude: 53.4051, longitude: -2.9745)
        let distance = HaversineDistance.distance(from: liverpoolOne, to: mountPleasant)
        XCTAssertGreaterThan(distance, 500)
        XCTAssertLessThan(distance, 1500)
    }

    func testHaversineZeroDistance() {
        let coord = CLLocationCoordinate2D(latitude: 53.4, longitude: -2.99)
        let distance = HaversineDistance.distance(from: coord, to: coord)
        XCTAssertEqual(distance, 0, accuracy: 0.01)
    }

    // MARK: - Zone Model

    func testZoneJSONImport() throws {
        let json = """
        [{
            "zone_code": "TEST001",
            "name": "Test Zone",
            "latitude": 53.4,
            "longitude": -2.99,
            "provider": "RingGo",
            "sms_capable": true,
            "sms_number": "81025"
        }]
        """.data(using: .utf8)!

        let imports = try JSONDecoder().decode([Zone.JSONImport].self, from: json)
        XCTAssertEqual(imports.count, 1)
        let zone = imports[0].toZone()
        XCTAssertEqual(zone.zoneCode, "TEST001")
        XCTAssertEqual(zone.provider, .ringGo)
        XCTAssertTrue(zone.smsCapable)
    }

    // MARK: - ParkingSession

    func testSessionExpiryCalculation() {
        let session = ParkingSession(
            id: 1,
            zoneId: 1,
            vehicleId: 1,
            startedAt: ISO8601DateFormatter().string(from: Date()),
            durationMinutes: 60,
            cost: nil,
            smsBody: nil,
            status: .active,
            extendedAt: nil,
            extendedDurationMinutes: nil,
            latitude: nil,
            longitude: nil,
            createdAt: nil
        )
        XCTAssertNotNil(session.expiresAt)
        XCTAssertFalse(session.isExpired)
        XCTAssertEqual(session.totalDurationMinutes, 60)
    }

    func testSessionWithExtension() {
        var session = ParkingSession(
            id: 1,
            zoneId: 1,
            vehicleId: 1,
            startedAt: ISO8601DateFormatter().string(from: Date()),
            durationMinutes: 60,
            cost: nil,
            smsBody: nil,
            status: .extended,
            extendedAt: nil,
            extendedDurationMinutes: 30,
            latitude: nil,
            longitude: nil,
            createdAt: nil
        )
        XCTAssertEqual(session.totalDurationMinutes, 90)
    }
}

// Make CoreLocation available in tests
import CoreLocation
