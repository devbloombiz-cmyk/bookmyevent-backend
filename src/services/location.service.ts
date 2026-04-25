import { locationRepository } from "../repositories/location.repository";
import { ApiError } from "../utils/api-error";

type DistrictRecord = {
  name: string;
  cities: string[];
  imageUrl?: string;
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
  imageUrl?: string;
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
    const districtImageUrl = normalizeLabel(String(payload.districtImageUrl ?? ""));

    const stateDoc = await locationRepository.findByState(state);

    if (!stateDoc) {
      return locationRepository.create({
        state,
        districts: [{ name: district, cities: [city], imageUrl: districtImageUrl, isActive: true }],
        isActive: true,
      });
    }

    const districtNode = stateDoc.districts.find((item) => item.name === district);
    if (!districtNode) {
      stateDoc.districts.push({
        name: district,
        cities: [city],
        imageUrl: districtImageUrl,
        isActive: true,
      });
      await locationRepository.save(stateDoc);
      return stateDoc;
    }

    if (districtImageUrl) {
      districtNode.imageUrl = districtImageUrl;
    }

    if (!districtNode.cities.includes(city)) {
      districtNode.cities.push(city);
      districtNode.cities.sort((a, b) => a.localeCompare(b));
      await locationRepository.save(stateDoc);
    }

    return stateDoc;
  },
  listLocations: async (includeInactive = false) => {
    const rows = (await locationRepository.findAll(includeInactive)) as unknown as LocationRecord[];

    const locations: StateNode[] = rows.map((row) => ({
      state: normalizeLabel(row.state),
      districts: (row.districts ?? [])
        .filter((district) => district.isActive !== false)
        .map((district) => ({
          name: normalizeLabel(district.name),
          cities: [...new Set((district.cities ?? []).map(normalizeLabel))].sort((a, b) =>
            a.localeCompare(b),
          ),
          imageUrl: normalizeLabel(district.imageUrl ?? ""),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return locations.sort((a, b) => a.state.localeCompare(b.state));
  },
  updateLocationEntry: async (payload: Record<string, unknown>) => {
    const state = normalizeLabel(String(payload.state ?? ""));
    const district = normalizeLabel(String(payload.district ?? ""));
    const city = normalizeLabel(String(payload.city ?? ""));

    const nextState = normalizeLabel(String(payload.nextState ?? ""));
    const nextDistrict = normalizeLabel(String(payload.nextDistrict ?? ""));
    const nextCity = normalizeLabel(String(payload.nextCity ?? ""));
    const districtImageUrl = normalizeLabel(String(payload.districtImageUrl ?? ""));

    const sourceDoc = await locationRepository.findByState(state, true);
    if (!sourceDoc) {
      throw new ApiError(404, "Source state not found");
    }

    const sourceDistrict = sourceDoc.districts.find((item) => item.name === district);
    if (!sourceDistrict) {
      throw new ApiError(404, "Source district not found");
    }

    if (!sourceDistrict.cities.includes(city)) {
      throw new ApiError(404, "Source city not found");
    }

    sourceDistrict.cities = sourceDistrict.cities.filter((item) => item !== city);
    if (!sourceDistrict.cities.length) {
      const districtIndex = sourceDoc.districts.findIndex((item) => item.name === district);
      if (districtIndex >= 0) {
        sourceDoc.districts.splice(districtIndex, 1);
      }
    }
    await locationRepository.save(sourceDoc);

    const targetDoc = await locationRepository.findByState(nextState, true);
    if (!targetDoc) {
      return locationRepository.create({
        state: nextState,
        districts: [
          {
            name: nextDistrict,
            cities: [nextCity],
            imageUrl: districtImageUrl,
            isActive: true,
          },
        ],
        isActive: true,
      });
    }

    const targetDistrict = targetDoc.districts.find((item) => item.name === nextDistrict);
    if (!targetDistrict) {
      targetDoc.districts.push({
        name: nextDistrict,
        cities: [nextCity],
        imageUrl: districtImageUrl,
        isActive: true,
      });
    } else if (!targetDistrict.cities.includes(nextCity)) {
      targetDistrict.cities.push(nextCity);
      targetDistrict.cities.sort((a, b) => a.localeCompare(b));
    }

    if (districtImageUrl && targetDistrict) {
      targetDistrict.imageUrl = districtImageUrl;
    }

    await locationRepository.save(targetDoc);
    return targetDoc;
  },
  deleteLocationEntry: async (payload: Record<string, unknown>) => {
    const state = normalizeLabel(String(payload.state ?? ""));
    const district = normalizeLabel(String(payload.district ?? ""));
    const city = normalizeLabel(String(payload.city ?? ""));

    const doc = await locationRepository.findByState(state, true);
    if (!doc) {
      throw new ApiError(404, "State not found");
    }

    const districtNode = doc.districts.find((item) => item.name === district);
    if (!districtNode) {
      throw new ApiError(404, "District not found");
    }

    if (!districtNode.cities.includes(city)) {
      throw new ApiError(404, "City not found");
    }

    districtNode.cities = districtNode.cities.filter((item) => item !== city);
    if (!districtNode.cities.length) {
      const districtIndex = doc.districts.findIndex((item) => item.name === district);
      if (districtIndex >= 0) {
        doc.districts.splice(districtIndex, 1);
      }
    }

    if (!doc.districts.length) {
      await locationRepository.deleteById(String(doc._id));
      return { state, deleted: true };
    }

    await locationRepository.save(doc);
    return doc;
  },
};
