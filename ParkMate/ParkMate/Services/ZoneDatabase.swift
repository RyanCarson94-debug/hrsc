import Foundation
import GRDB
import CoreLocation

final class ZoneDatabase {
    static let shared = ZoneDatabase()

    private var pool: DatabasePool!
    private(set) var isReady = false

    private init() {
        do {
            let path = try Self.dbPath()
            pool = try DatabasePool(path: path)
            try runMigrations()
            try seedIfNeeded()
            isReady = true
        } catch {
            print("[ZoneDatabase] Init failed: \(error)")
        }
    }

    private static func dbPath() throws -> String {
        let dir = try FileManager.default.url(
            for: .documentDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true
        )
        return dir.appendingPathComponent("parkmate.sqlite").path
    }

    // MARK: - Migrations

    private func runMigrations() throws {
        var migrator = DatabaseMigrator()

        migrator.registerMigration("v1_initial") { db in
            try db.execute(sql: """
                CREATE TABLE IF NOT EXISTS zones (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    zone_code        TEXT NOT NULL UNIQUE,
                    name             TEXT NOT NULL,
                    address          TEXT,
                    postcode         TEXT,
                    latitude         REAL NOT NULL,
                    longitude        REAL NOT NULL,
                    provider         TEXT NOT NULL DEFAULT 'RingGo',
                    sms_capable      INTEGER NOT NULL DEFAULT 0,
                    sms_number       TEXT,
                    hourly_rate      REAL,
                    max_stay_minutes INTEGER,
                    spaces           INTEGER,
                    zone_type        TEXT NOT NULL DEFAULT 'car_park',
                    council          TEXT,
                    notes            TEXT,
                    created_at       TEXT DEFAULT (datetime('now')),
                    updated_at       TEXT DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_zones_location ON zones(latitude, longitude);
                CREATE INDEX IF NOT EXISTS idx_zones_provider  ON zones(provider);

                CREATE TABLE IF NOT EXISTS vehicles (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    registration TEXT NOT NULL,
                    make         TEXT,
                    model        TEXT,
                    is_default   INTEGER NOT NULL DEFAULT 0,
                    created_at   TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
                    zone_id                  INTEGER NOT NULL REFERENCES zones(id),
                    vehicle_id               INTEGER NOT NULL REFERENCES vehicles(id),
                    started_at               TEXT NOT NULL,
                    duration_minutes         INTEGER NOT NULL,
                    cost                     REAL,
                    sms_body                 TEXT,
                    status                   TEXT NOT NULL DEFAULT 'active',
                    extended_at              TEXT,
                    extended_duration_minutes INTEGER,
                    latitude                 REAL,
                    longitude                REAL,
                    created_at               TEXT DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
            """)
        }

        try migrator.migrate(pool)
    }

    // MARK: - Seed

    private func seedIfNeeded() throws {
        let count = try pool.read { try Zone.fetchCount($0) }
        guard count == 0 else { return }
        guard let url = Bundle.main.url(forResource: "seed_zones", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return }
        let imports = try JSONDecoder().decode([Zone.JSONImport].self, from: data)
        try pool.write { db in
            for imp in imports {
                var zone = imp.toZone()
                try zone.insert(db)
            }
        }
        print("[ZoneDatabase] Seeded \(imports.count) zones")
    }

    // MARK: - Zone Queries

    func allZones() throws -> [Zone] {
        try pool.read { try Zone.fetchAll($0) }
    }

    func zone(id: Int64) throws -> Zone? {
        try pool.read { try Zone.fetchOne($0, key: id) }
    }

    func zone(code: String) throws -> Zone? {
        try pool.read { db in
            try Zone.filter(Column("zone_code") == code).fetchOne(db)
        }
    }

    func nearestZones(to location: CLLocation, limit: Int = 20) throws -> [(zone: Zone, distance: Double)] {
        let all = try allZones()
        return Array(HaversineDistance.sortZones(all, from: location).prefix(limit))
    }

    func insertZone(_ zone: Zone) throws {
        var z = zone
        try pool.write { try z.insert($0) }
    }

    func updateZone(_ zone: Zone) throws {
        try pool.write { try zone.update($0) }
    }

    func deleteZone(id: Int64) throws {
        try pool.write { try Zone.deleteOne($0, key: id) }
    }

    func importZones(from data: Data) throws -> Int {
        let imports = try JSONDecoder().decode([Zone.JSONImport].self, from: data)
        var inserted = 0
        try pool.write { db in
            for imp in imports {
                var zone = imp.toZone()
                if (try? zone.insert(db)) != nil { inserted += 1 }
            }
        }
        return inserted
    }

    // MARK: - Vehicle Queries

    func allVehicles() throws -> [Vehicle] {
        try pool.read { try Vehicle.fetchAll($0) }
    }

    func defaultVehicle() throws -> Vehicle? {
        try pool.read { try Vehicle.filter(Column("is_default") == 1).fetchOne($0) }
    }

    func insertVehicle(_ vehicle: Vehicle) throws {
        var v = vehicle
        try pool.write { try v.insert($0) }
    }

    func updateVehicle(_ vehicle: Vehicle) throws {
        try pool.write { try vehicle.update($0) }
    }

    func setDefaultVehicle(id: Int64) throws {
        try pool.write { db in
            try db.execute(sql: "UPDATE vehicles SET is_default = 0")
            try db.execute(sql: "UPDATE vehicles SET is_default = 1 WHERE id = ?", arguments: [id])
        }
    }

    func deleteVehicle(id: Int64) throws {
        try pool.write { try Vehicle.deleteOne($0, key: id) }
    }

    // MARK: - Session Queries

    func insertSession(_ session: ParkingSession) throws -> ParkingSession {
        var s = session
        try pool.write { try s.insert($0) }
        return s
    }

    func updateSession(_ session: ParkingSession) throws {
        try pool.write { try session.update($0) }
    }

    func activeSession() throws -> ParkingSession? {
        try pool.read { db in
            try ParkingSession.filter(Column("status") == SessionStatus.active.rawValue).fetchOne(db)
        }
    }

    func recentSessions(limit: Int = 50) throws -> [ParkingSession] {
        try pool.read { db in
            try ParkingSession.order(Column("started_at").desc).limit(limit).fetchAll(db)
        }
    }
}
