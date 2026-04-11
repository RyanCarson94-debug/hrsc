import SwiftUI

struct MainTabView: View {
    @Environment(SessionManager.self) private var sessionManager
    @Environment(NotificationService.self) private var notifications
    @Environment(ParkingDetectionEngine.self) private var detectionEngine

    @State private var selectedTab = 0
    @State private var showPaymentForDetectedZone = false
    @State private var paymentZone: Zone?

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                SessionTabView()
            }
            .tabItem { Label("Session", systemImage: "p.circle.fill") }
            .tag(0)

            NavigationStack {
                NearbyZonesView()
            }
            .tabItem { Label("Nearby", systemImage: "map.fill") }
            .tag(1)

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("Settings", systemImage: "gearshape.fill") }
            .tag(2)
        }
        .tint(Color.pmAccent)
        // Handle notification actions
        .onChange(of: notifications.pendingAction) { _, action in
            guard let action else { return }
            handleNotificationAction(action)
            notifications.clearPendingAction()
        }
        // Handle auto-detected zone banner taps
        .onChange(of: detectionEngine.detectedZone) { _, zone in
            if let zone, sessionManager.activeSession == nil {
                paymentZone = zone
                showPaymentForDetectedZone = true
                detectionEngine.clearDetectedZone()
            }
        }
        .sheet(isPresented: $showPaymentForDetectedZone) {
            if let zone = paymentZone {
                NavigationStack {
                    PaymentPreviewView(zone: zone)
                }
            }
        }
    }

    private func handleNotificationAction(_ action: PendingNotificationAction) {
        switch action {
        case .payNow(let zone):
            paymentZone = zone
            showPaymentForDetectedZone = true
        case .changeDuration(let zone):
            paymentZone = zone
            showPaymentForDetectedZone = true
        case .extend:
            selectedTab = 0
        case .openApp:
            selectedTab = 0
        }
    }
}

// MARK: - Session Tab Router

struct SessionTabView: View {
    @Environment(SessionManager.self) private var sessionManager

    var body: some View {
        Group {
            if let session = sessionManager.activeSession,
               let zone = sessionManager.activeZone {
                ActiveSessionView(
                    session: session,
                    zone: zone,
                    remainingSeconds: sessionManager.remainingSeconds
                )
            } else {
                NoSessionView()
            }
        }
        .navigationTitle("ParkMate")
        .navigationBarTitleDisplayMode(.large)
        .background(Color.pmBackground)
    }
}
