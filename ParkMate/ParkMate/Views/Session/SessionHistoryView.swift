import SwiftUI

struct SessionHistoryView: View {
    @State private var sessions: [(ParkingSession, Zone?)] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .tint(Color.pmAccent)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.pmBackground)
            } else if sessions.isEmpty {
                emptyState
            } else {
                list
            }
        }
        .background(Color.pmBackground)
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.large)
        .task { await loadSessions() }
    }

    // MARK: - Views

    private var list: some View {
        List {
            ForEach(sessions, id: \.0.id) { (session, zone) in
                SessionHistoryRow(session: session, zone: zone)
                    .listRowBackground(Color.pmCard)
                    .listRowSeparatorTint(Color.pmBorder)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.badge.xmark")
                .font(.system(size: 56))
                .foregroundStyle(Color.pmSecondary)
            Text("No parking history yet")
                .font(.pmHeadline)
                .foregroundStyle(Color.pmSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.pmBackground)
    }

    // MARK: - Data

    private func loadSessions() async {
        let result = (try? SessionManager.shared.recentSessions()) ?? []
        let paired = result.map { session in
            (session, try? ZoneDatabase.shared.zone(id: session.zoneId))
        }
        sessions = paired
        isLoading = false
    }
}

// MARK: - Row

struct SessionHistoryRow: View {
    let session: ParkingSession
    let zone: Zone?

    var body: some View {
        HStack(spacing: 12) {
            statusIndicator

            VStack(alignment: .leading, spacing: 4) {
                Text(zone?.name ?? "Unknown Zone")
                    .font(.pmHeadline)
                    .foregroundStyle(Color.pmPrimary)

                Text("Zone \(zone?.zoneCode ?? "—") · \(DurationFormatter.displayString(minutes: session.totalDurationMinutes))")
                    .font(.pmMono)
                    .foregroundStyle(Color.pmSecondary)

                if let date = session.startDate {
                    Text(date.formatted(date: .abbreviated, time: .shortened))
                        .font(.pmCaption)
                        .foregroundStyle(Color.pmSecondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if let cost = session.cost {
                    Text(String(format: "£%.2f", cost))
                        .font(.pmMonoLg)
                        .foregroundStyle(Color.pmPrimary)
                }
                Text(session.status.rawValue.capitalized)
                    .font(.pmCaption)
                    .foregroundStyle(statusColor)
            }
        }
        .padding(.vertical, 4)
    }

    private var statusIndicator: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 10, height: 10)
    }

    private var statusColor: Color {
        switch session.status {
        case .active:    return Color.pmAccent
        case .extended:  return Color.pmWarning
        case .expired:   return Color.pmSecondary
        case .cancelled: return Color.pmDanger
        }
    }
}
