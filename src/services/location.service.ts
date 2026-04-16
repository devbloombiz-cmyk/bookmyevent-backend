import { locationRepository } from "../repositories/location.repository";

type DistrictRecord = {
  name: string;
  cities: string[];
  isActive?: boolean;
};

type LocationRecord = {
  state: string;
  districts: DistrictRecord[];
  isActive?: boolean;
};

type DistrictNode = {
  name: string;
  cities: string[];
};

type StateNode = {
  state: string;
  districts: DistrictNode[];
};

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, " ");

export const locationService = {
  createLocation: async (payload: Record<string, unknown>) => {
    const state = normalizeLabel(String(payload.state ?? "Kerala"));
    const district = normalizeLabel(String(payload.district ?? ""));
    const city = normalizeLabel(String(payload.city ?? ""));

    const stateDoc = await locationRepository.findByState(state);

    if (!stateDoc) {
      return locationRepository.create({
        state,
        districts: [{ name: district, cities: [city], isActive: true }],
        isActive: true,
      });
    }

    const districtNode = stateDoc.districts.find((item) => item.name === district);
    if (!districtNode) {
      stateDoc.districts.push({ name: district, cities: [city], isActive: true });
      await locationRepository.save(stateDoc);
      return stateDoc;
    }

    if (!districtNode.cities.includes(city)) {
      districtNode.cities.push(city);
      districtNode.cities.sort((a, b) => a.localeCompare(b));
      await locationRepository.save(stateDoc);
    }

    return stateDoc;
  },
  listLocations: async () => {
    const rows = (await locationRepository.findAll()) as unknown as LocationRecord[];

    const locations: StateNode[] = rows.map((row) => ({
      state: normalizeLabel(row.state),
      districts: (row.districts ?? [])
        .filter((district) => district.isActive !== false)
        .map((district) => ({
          name: normalizeLabel(district.name),
          cities: [...new Set((district.cities ?? []).map(normalizeLabel))].sort((a, b) =>
            a.localeCompare(b),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return locations.sort((a, b) => a.state.localeCompare(b.state));
  },
};
