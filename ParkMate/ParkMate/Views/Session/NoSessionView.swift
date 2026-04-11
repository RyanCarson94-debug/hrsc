import SwiftUI

struct NoSessionView: View {
    @Environment(LocationService.self) private var locationService
    @Environment(ParkingDetectionEngine.self) private var detectionEngine

    @State private var lastSession: ParkingSession?
    @State private var lastZone: Zone?
    @State private var showHistory = false
    @State private var showManualPay = false
    @State private var selectedZone: Zone?

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                idleStateCard

                if let session = lastSession, let zone = lastZone {
                    lastSessionCard(session: session, zone: zone)
                }

                autoDetectCard
                quickActions
            }
            .padding()
        }
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .onAppear(perform: loadLastSession)
        .sheet(isPresented: $showHistory) {
            NavigationStack { SessionHistoryView() }
        }
        .sheet(isPresented: $showManualPay) {
            if let zone = selectedZone {
                NavigationStack { PaymentPreviewView(zone: zone) }
            } else {
                NavigationStack { NearbyZonesView(selectionMode: true) { zone in
                    selectedZone = zone
                    showManualPay = true
                }}
            }
        }
    }

    // MARK: - Subviews

    private var idleStateCard: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.pmCard)
                    .frame(width: 100, height: 100)
                Image(systemName: "car.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(Color.pmSecondary)
            }

            Text("No active session")
                .font(.pmTitle)
                .foregroundStyle(Color.pmPrimary)

            Text(locationService.authorizationStatus == .authorizedAlways
                 ? "Auto-detection is active. Drive to a car park to get started."
                 : "Enable Always location access for automatic parking detection.")
                .font(.pmBody)
                .foregroundStyle(Color.pmSecondary)
                .multilineTextAlignment(.center)

            if locationService.authorizationStatus != .authorizedAlways {
                Button("Open Settings") {
                    UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)
                }
                .buttonStyle(.pmSecondary)
                .padding(.horizontal, 32)
            }
        }
        .padding()
        .pmCard()
    }

    private func lastSessionCard(session: ParkingSession, zone: Zone) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Last Session")
                .font(.pmCaption)
                .foregroundStyle(Color.pmSecondary)
                .textCase(.uppercase)

            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(zone.name)
                        .font(.pmHeadline)
                        .foregroundStyle(Color.pmPrimary)
                    Text("Zone \(zone.zoneCode) · \(DurationFormatter.displayString(minutes: session.totalDurationMinutes))")
                        .font(.pmMono)
                        .foregroundStyle(Color.pmSecondary)
                    if let date = session.startDate {
                        Text(date.formatted(date: .abbreviated, time: .shortened))
                            .font(.pmCaption)
                            .foregroundStyle(Color.pmSecondary)
                    }
                }
                Spacer()
                if let cost = session.cost {
                    Text(String(format: "£%.2f", cost))
                        .font(.pmMonoLg)
                        .foregroundStyle(Color.pmAccent)
                }
            }

            Button("View History") { showHistory = true }
                .font(.pmCaption)
                .foregroundStyle(Color.pmAccent)
        }
        .padding()
        .pmCard()
    }

    private var autoDetectCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Auto-Detection")
                    .font(.pmHeadline)
                    .foregroundStyle(Color.pmPrimary)
                Text(detectionEngine.isEnabled
                     ? "On — monitoring \(locationService.monitoredZoneCount) nearby zones"
                     : "Off — tap to enable automatic parking detection")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
            }
            Spacer()
            Toggle("", isOn: Binding(
                get: { detectionEngine.isEnabled },
                set: { detectionEngine.isEnabled = $0 }
            ))
            .tint(Color.pmAccent)
            .labelsHidden()
        }
        .padding()
        .pmCard()
    }

    private var quickActions: some View {
        VStack(spacing: 12) {
            Text("Quick Actions")
                .font(.pmCaption)
                .foregroundStyle(Color.pmSecondary)
                .textCase(.uppercase)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                selectedZone = nil
                showManualPay = true
            } label: {
                Label("Pay for Parking", systemImage: "message.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.pmPrimary)

            Button {
                showHistory = true
            } label: {
                Label("Parking History", systemImage: "clock.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.pmSecondary)
        }
    }

    // MARK: - Data

    private func loadLastSession() {
        guard let sessions = try? SessionManager.shared.recentSessions(),
              let session = sessions.first else { return }
        lastSession = session
        lastZone = try? ZoneDatabase.shared.zone(id: session.zoneId)
    }
}
