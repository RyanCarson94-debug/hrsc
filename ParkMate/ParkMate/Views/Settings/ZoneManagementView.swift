import SwiftUI
import UniformTypeIdentifiers

struct ZoneManagementView: View {
    @State private var zones: [Zone] = []
    @State private var showAddSheet = false
    @State private var showImportPicker = false
    @State private var importResult: String?
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                Button {
                    showImportPicker = true
                } label: {
                    Label("Import from JSON", systemImage: "square.and.arrow.down")
                        .foregroundStyle(Color.pmAccent)
                }
                .listRowBackground(Color.pmCard)

                Button {
                    showAddSheet = true
                } label: {
                    Label("Add Zone Manually", systemImage: "plus.circle")
                        .foregroundStyle(Color.pmAccent)
                }
                .listRowBackground(Color.pmCard)
            }

            Section("\(zones.count) Zones") {
                ForEach(zones) { zone in
                    ZoneManagementRow(zone: zone)
                        .listRowBackground(Color.pmCard)
                        .listRowSeparatorTint(Color.pmBorder)
                }
                .onDelete(perform: deleteZones)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .navigationTitle("Zones")
        .navigationBarTitleDisplayMode(.large)
        .onAppear(perform: loadZones)
        .sheet(isPresented: $showAddSheet, onDismiss: loadZones) {
            NavigationStack { AddZoneView() }
        }
        .fileImporter(
            isPresented: $showImportPicker,
            allowedContentTypes: [.json],
            allowsMultipleSelection: false
        ) { result in
            handleImport(result: result)
        }
        .alert("Import Result", isPresented: .init(
            get: { importResult != nil },
            set: { if !$0 { importResult = nil } }
        )) {
            Button("OK") { importResult = nil }
        } message: {
            Text(importResult ?? "")
        }
        .alert("Error", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func loadZones() {
        zones = (try? ZoneDatabase.shared.allZones()) ?? []
    }

    private func deleteZones(at offsets: IndexSet) {
        for index in offsets {
            if let id = zones[index].id {
                try? ZoneDatabase.shared.deleteZone(id: id)
            }
        }
        loadZones()
    }

    private func handleImport(result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            errorMessage = error.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                errorMessage = "Could not access file."
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }
            do {
                let data = try Data(contentsOf: url)
                let count = try ZoneDatabase.shared.importZones(from: data)
                importResult = "Imported \(count) zone(s) successfully."
                loadZones()
            } catch {
                errorMessage = "Import failed: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Zone Management Row

struct ZoneManagementRow: View {
    let zone: Zone

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(zone.name)
                    .font(.pmBody)
                    .foregroundStyle(Color.pmPrimary)
                HStack(spacing: 6) {
                    Text(zone.zoneCode)
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
            }
            Spacer()
            Circle()
                .fill(zone.smsCapable ? Color.pmAccent : Color.pmSecondary)
                .frame(width: 8, height: 8)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Add Zone View

struct AddZoneView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var zoneCode = ""
    @State private var name = ""
    @State private var address = ""
    @State private var postcode = ""
    @State private var latitude = ""
    @State private var longitude = ""
    @State private var provider = Provider.ringGo
    @State private var hourlyRate = ""
    @State private var maxStay = ""
    @State private var zoneType = ZoneType.carPark
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Zone Details") {
                TextField("Zone Code *", text: $zoneCode)
                    .font(.pmMono)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
                TextField("Name *", text: $name)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
                TextField("Address", text: $address)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
                TextField("Postcode", text: $postcode)
                    .foregroundStyle(Color.pmPrimary)
                    .textInputAutocapitalization(.characters)
                    .listRowBackground(Color.pmCard)
            }

            Section("Location") {
                TextField("Latitude *", text: $latitude)
                    .keyboardType(.decimalPad)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
                TextField("Longitude *", text: $longitude)
                    .keyboardType(.decimalPad)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
            }

            Section("Provider") {
                Picker("Provider", selection: $provider) {
                    ForEach(Provider.allCases) { p in
                        Text(p.displayName).tag(p)
                    }
                }
                .tint(Color.pmAccent)
                .listRowBackground(Color.pmCard)

                Picker("Type", selection: $zoneType) {
                    ForEach(ZoneType.allCases, id: \.self) { t in
                        Text(t.displayName).tag(t)
                    }
                }
                .tint(Color.pmAccent)
                .listRowBackground(Color.pmCard)
            }

            Section("Pricing") {
                TextField("Hourly Rate (£)", text: $hourlyRate)
                    .keyboardType(.decimalPad)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
                TextField("Max Stay (minutes)", text: $maxStay)
                    .keyboardType(.numberPad)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .navigationTitle("Add Zone")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
                    .foregroundStyle(Color.pmSecondary)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add") { saveZone() }
                    .foregroundStyle(Color.pmAccent)
                    .disabled(!canSave)
            }
        }
        .alert("Error", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var canSave: Bool {
        !zoneCode.isEmpty && !name.isEmpty
        && Double(latitude) != nil && Double(longitude) != nil
    }

    private func saveZone() {
        guard let lat = Double(latitude), let lon = Double(longitude) else { return }
        let zone = Zone(
            id: nil,
            zoneCode: zoneCode.trimmingCharacters(in: .whitespaces),
            name: name.trimmingCharacters(in: .whitespaces),
            address: address.isEmpty ? nil : address,
            postcode: postcode.isEmpty ? nil : postcode,
            latitude: lat,
            longitude: lon,
            provider: provider,
            smsCapable: provider.supportsInAppSMS,
            smsNumber: provider.smsNumber,
            hourlyRate: Double(hourlyRate),
            maxStayMinutes: Int(maxStay),
            spaces: nil,
            zoneType: zoneType,
            council: nil,
            notes: nil,
            createdAt: nil,
            updatedAt: nil
        )
        do {
            try ZoneDatabase.shared.insertZone(zone)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
