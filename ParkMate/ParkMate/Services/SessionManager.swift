import Foundation
import CoreLocation

@Observable
final class SessionManager {
    static let shared = SessionManager()

    private(set) var activeSession: ParkingSession?
    private(set) var activeZone: Zone?
    private(set) var remainingSeconds: TimeInterval = 0

    private var timer: Timer?

    private init() {
        loadActiveSession()
        if activeSession != nil { startTimer() }
    }

    // MARK: - Start

    func startSession(
        zone: Zone,
        vehicle: Vehicle,
        durationMinutes: Int,
        cvv: String,
        coordinate: CLLocationCoordinate2D? = nil
    ) throws -> ParkingSession {
        guard let zoneId = zone.id, let vehicleId = vehicle.id else {
            throw SessionError.missingIdentifiers
        }

        let smsBody = SMSFormatter.parkBody(
            zoneCode: zone.zoneCode,
            durationMinutes: durationMinutes,
            cvv: cvv,
            registration: vehicle.registration
        )

        var session = ParkingSession(
            id: nil,
            zoneId: zoneId,
            vehicleId: vehicleId,
            startedAt: ISO8601DateFormatter().string(from: Date()),
            durationMinutes: durationMinutes,
            cost: zone.hourlyRate.map { $0 * Double(durationMinutes) / 60.0 },
            smsBody: smsBody,
            status: .active,
            extendedAt: nil,
            extendedDurationMinutes: nil,
            latitude: coordinate?.latitude,
            longitude: coordinate?.longitude,
            createdAt: nil
        )

        session = try ZoneDatabase.shared.insertSession(session)
        activeSession = session
        activeZone = zone
        startTimer()

        scheduleExpiryWarning(session: session, zone: zone)

        return session
    }

    // MARK: - Extend

    func extendSession(additionalMinutes: Int, cvv: String) throws {
        guard var session = activeSession, let zone = activeZone else {
            throw SessionError.noActiveSession
        }

        session.status = .extended
        session.extendedAt = ISO8601DateFormatter().string(from: Date())
        session.extendedDurationMinutes = (session.extendedDurationMinutes ?? 0) + additionalMinutes

        try ZoneDatabase.shared.updateSession(session)
        activeSession = session

        if let sid = session.id {
            NotificationService.shared.cancelExpiryWarning(sessionId: sid)
        }
        scheduleExpiryWarning(session: session, zone: zone)
    }

    // MARK: - End

    func endSession() throws {
        guard var session = activeSession else { return }
        session.status = .expired
        try ZoneDatabase.shared.updateSession(session)

        if let sid = session.id {
            NotificationService.shared.cancelExpiryWarning(sessionId: sid)
        }

        stopTimer()
        activeSession = nil
        activeZone = nil
        remainingSeconds = 0
    }

    func cancelSession() throws {
        guard var session = activeSession else { return }
        session.status = .cancelled
        try ZoneDatabase.shared.updateSession(session)

        if let sid = session.id {
            NotificationService.shared.cancelExpiryWarning(sessionId: sid)
        }

        stopTimer()
        activeSession = nil
        activeZone = nil
        remainingSeconds = 0
    }

    // MARK: - Timer

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            DispatchQueue.main.async { self?.tick() }
        }
        RunLoop.main.add(timer!, forMode: .common)
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        guard let session = activeSession else { stopTimer(); return }
        let remaining = session.remainingSeconds ?? 0
        remainingSeconds = remaining
        if remaining <= 0 {
            try? endSession()
        }
    }

    // MARK: - History

    func recentSessions() throws -> [ParkingSession] {
        try ZoneDatabase.shared.recentSessions()
    }

    // MARK: - Private Helpers

    private func loadActiveSession() {
        guard let session = try? ZoneDatabase.shared.activeSession() else { return }
        if session.isExpired {
            var expired = session
            expired.status = .expired
            try? ZoneDatabase.shared.updateSession(expired)
            return
        }
        activeSession = session
        activeZone = try? ZoneDatabase.shared.zone(id: session.zoneId)
        remainingSeconds = session.remainingSeconds ?? 0
    }

    private func scheduleExpiryWarning(session: ParkingSession, zone: Zone) {
        let minutes = AppSettings.shared.expiryWarningMinutes
        NotificationService.shared.scheduleExpiryWarning(
            session: session, zone: zone, warningMinutes: minutes
        )
    }
}

// MARK: - Error

enum SessionError: LocalizedError {
    case noActiveSession
    case missingIdentifiers

    var errorDescription: String? {
        switch self {
        case .noActiveSession:    return "No active parking session"
        case .missingIdentifiers: return "Zone or vehicle ID is missing"
        }
    }
}
