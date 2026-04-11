import SwiftUI

struct VehicleSettingsView: View {
    @State private var vehicles: [Vehicle] = []
    @State private var showAddSheet = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            ForEach(vehicles) { vehicle in
                VehicleRow(vehicle: vehicle) {
                    setDefault(vehicle: vehicle)
                }
                .listRowBackground(Color.pmCard)
                .listRowSeparatorTint(Color.pmBorder)
            }
            .onDelete(perform: deleteVehicles)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .navigationTitle("Vehicles")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(Color.pmAccent)
                }
            }
        }
        .onAppear(perform: loadVehicles)
        .sheet(isPresented: $showAddSheet, onDismiss: loadVehicles) {
            NavigationStack { AddVehicleView() }
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

    private func loadVehicles() {
        vehicles = (try? ZoneDatabase.shared.allVehicles()) ?? []
    }

    private func setDefault(vehicle: Vehicle) {
        guard let id = vehicle.id else { return }
        do {
            try ZoneDatabase.shared.setDefaultVehicle(id: id)
            loadVehicles()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteVehicles(at offsets: IndexSet) {
        for index in offsets {
            if let id = vehicles[index].id {
                try? ZoneDatabase.shared.deleteVehicle(id: id)
            }
        }
        loadVehicles()
    }
}

// MARK: - Row

struct VehicleRow: View {
    let vehicle: Vehicle
    let onSetDefault: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "car.fill")
                .foregroundStyle(vehicle.isDefault ? Color.pmAccent : Color.pmSecondary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(vehicle.registration)
                        .font(.pmMono)
                        .foregroundStyle(Color.pmPrimary)
                    if vehicle.isDefault {
                        Text("Default")
                            .font(.pmCaption)
                            .foregroundStyle(Color.pmAccent)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.pmAccent.opacity(0.15))
                            .clipShape(Capsule())
                    }
                }
                if let make = vehicle.make, let model = vehicle.model {
                    Text("\(make) \(model)")
                        .font(.pmCaption)
                        .foregroundStyle(Color.pmSecondary)
                }
            }

            Spacer()

            if !vehicle.isDefault {
                Button("Set Default") { onSetDefault() }
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmAccent)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Add Vehicle

struct AddVehicleView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var registration = ""
    @State private var make = ""
    @State private var model = ""
    @State private var setAsDefault = true
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Registration") {
                TextField("e.g. AB12 CDE", text: $registration)
                    .font(.pmMono)
                    .foregroundStyle(Color.pmPrimary)
                    .textInputAutocapitalization(.characters)
                    .listRowBackground(Color.pmCard)
            }

            Section("Details (optional)") {
                TextField("Make (e.g. Toyota)", text: $make)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
                TextField("Model (e.g. Yaris)", text: $model)
                    .foregroundStyle(Color.pmPrimary)
                    .listRowBackground(Color.pmCard)
            }

            Section {
                Toggle("Set as default vehicle", isOn: $setAsDefault)
                    .tint(Color.pmAccent)
                    .listRowBackground(Color.pmCard)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .navigationTitle("Add Vehicle")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
                    .foregroundStyle(Color.pmSecondary)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add") { saveVehicle() }
                    .foregroundStyle(Color.pmAccent)
                    .disabled(registration.trimmingCharacters(in: .whitespaces).isEmpty)
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

    private func saveVehicle() {
        let reg = registration.trimmingCharacters(in: .whitespaces).uppercased()
        guard !reg.isEmpty else { return }

        let vehicle = Vehicle(
            id: nil,
            registration: reg,
            make: make.isEmpty ? nil : make,
            model: model.isEmpty ? nil : model,
            isDefault: setAsDefault,
            createdAt: nil
        )
        do {
            if setAsDefault {
                let existing = (try? ZoneDatabase.shared.allVehicles()) ?? []
                if !existing.isEmpty {
                    try ZoneDatabase.shared.updateVehicle(
                        Vehicle(id: existing.first?.id, registration: existing.first?.registration ?? "", make: existing.first?.make, model: existing.first?.model, isDefault: false, createdAt: existing.first?.createdAt)
                    )
                }
            }
            try ZoneDatabase.shared.insertVehicle(vehicle)
            if setAsDefault, let id = (try? ZoneDatabase.shared.allVehicles().last?.id) {
                try? ZoneDatabase.shared.setDefaultVehicle(id: id)
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
