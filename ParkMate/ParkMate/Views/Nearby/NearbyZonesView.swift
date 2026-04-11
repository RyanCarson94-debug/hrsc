import SwiftUI
import CoreLocation

struct NearbyZonesView: View {
    /// When true, acts as a zone picker (tapping selects rather than navigates).
    var selectionMode: Bool = false
    var onSelect: ((Zone) -> Void)? = nil

    @Environment(LocationService.self) private var locationService
    @State private var nearbyZones: [(zone: Zone, distance: Double)] = []
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var selectedZone: Zone?
    @State private var showPayment = false

    private var filteredZones: [(zone: Zone, distance: Double)] {
        if searchText.isEmpty { return nearbyZones }
        return nearbyZones.filter {
            $0.zone.name.localizedCaseInsensitiveContains(searchText)
            || $0.zone.zoneCode.localizedCaseInsensitiveContains(searchText)
            || ($0.zone.postcode?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    var body: some View {
        Group {
            if isLoading {
                loadingView
            } else if filteredZones.isEmpty {
                emptyView
            } else {
                zoneList
            }
        }
        .background(Color.pmBackground)
        .navigationTitle(selectionMode ? "Select Zone" : "Nearby Zones")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $searchText, prompt: "Search zones…")
        .task { await loadZones() }
        .onChange(of: locationService.currentLocation) { _, _ in
            Task { await loadZones() }
        }
        .sheet(isPresented: $showPayment) {
            if let zone = selectedZone {
                NavigationStack { PaymentPreviewView(zone: zone) }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await loadZones() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundStyle(Color.pmAccent)
                }
            }
        }
    }

    // MARK: - Subviews

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView().tint(Color.pmAccent)
            Text("Finding nearby zones…")
                .font(.pmBody)
                .foregroundStyle(Color.pmSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "map.circle")
                .font(.system(size: 56))
                .foregroundStyle(Color.pmSecondary)
            Text(searchText.isEmpty ? "No zones nearby" : "No results for \"\(searchText)\"")
                .font(.pmHeadline)
                .foregroundStyle(Color.pmSecondary)
            if locationService.authorizationStatus != .authorizedAlways {
                Text("Enable location access for accurate nearby results.")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var zoneList: some View {
        List(filteredZones, id: \.zone.id) { item in
            ZoneRow(zone: item.zone, distance: item.distance)
                .listRowBackground(Color.pmCard)
                .listRowSeparatorTint(Color.pmBorder)
                .onTapGesture {
                    if selectionMode {
                        onSelect?(item.zone)
                    } else {
                        selectedZone = item.zone
                        showPayment = true
                    }
                }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Data

    private func loadZones() async {
        if let location = locationService.currentLocation {
            let result = (try? ZoneDatabase.shared.nearestZones(to: location, limit: 30)) ?? []
            nearbyZones = result
        } else {
            // No location — show all zones sorted alphabetically
            let all = (try? ZoneDatabase.shared.allZones()) ?? []
            nearbyZones = all.map { ($0, 0) }
        }
        isLoading = false
    }
}

// MARK: - Zone Row

struct ZoneRow: View {
    let zone: Zone
    let distance: Double

    var body: some View {
        HStack(spacing: 12) {
            providerDot

            VStack(alignment: .leading, spacing: 4) {
                Text(zone.name)
                    .font(.pmHeadline)
                    .foregroundStyle(Color.pmPrimary)

                HStack(spacing: 8) {
                    Text("Zone \(zone.zoneCode)")
                        .font(.pmMono)
                        .foregroundStyle(Color.pmSecondary)

                    Text("·")
                        .foregroundStyle(Color.pmBorder)

                    Text(zone.provider.displayName)
                        .font(.pmCaption)
                        .foregroundStyle(Color.pmSecondary)

                    if !zone.smsCapable {
                        Text("No SMS")
                            .font(.pmCaption)
                            .foregroundStyle(Color.pmWarning)
                    }
                }

                if let rate = zone.hourlyRate {
                    Text(String(format: "£%.2f/hr", rate))
                        .font(.pmCaption)
                        .foregroundStyle(Color.pmAccent)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if distance > 0 {
                    Text(formattedDistance)
                        .font(.pmMono)
                        .foregroundStyle(Color.pmSecondary)
                }
                Image(systemName: "chevron.right")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmBorder)
            }
        }
        .padding(.vertical, 4)
    }

    private var providerDot: some View {
        Circle()
            .fill(Color(hex: zone.provider.accentHex))
            .frame(width: 10, height: 10)
    }

    private var formattedDistance: String {
        if distance < 1000 {
            return String(format: "%.0fm", distance)
        }
        return String(format: "%.1fkm", distance / 1000)
    }
}
