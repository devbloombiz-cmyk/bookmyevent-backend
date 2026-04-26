import dotenv from "dotenv";
import { connectToDatabase } from "../config/database";
import { locationService } from "../services/location.service";

dotenv.config();

const keralaDistrictCityMap: Array<{ district: string; cities: string[] }> = [
  {
    district: "Thiruvananthapuram",
    cities: ["Thiruvananthapuram (Capital)", "Neyyattinkara", "Varkala", "Attingal"],
  },
  {
    district: "Kollam",
    cities: ["Kollam", "Karunagappally", "Punalur", "Paravur"],
  },
  {
    district: "Pathanamthitta",
    cities: ["Pathanamthitta", "Adoor", "Thiruvalla", "Ranni"],
  },
  {
    district: "Alappuzha",
    cities: ["Alappuzha", "Cherthala", "Kayamkulam", "Haripad"],
  },
  {
    district: "Kottayam",
    cities: ["Kottayam", "Changanassery", "Pala", "Vaikom"],
  },
  {
    district: "Idukki",
    cities: ["Thodupuzha", "Munnar", "Kattappana", "Adimali"],
  },
  {
    district: "Ernakulam",
    cities: ["Kochi (Cochin)", "Aluva", "Perumbavoor", "Angamaly"],
  },
  {
    district: "Thrissur",
    cities: ["Thrissur", "Guruvayur", "Kodungallur", "Chalakudy"],
  },
  {
    district: "Palakkad",
    cities: ["Palakkad", "Ottapalam", "Mannarkkad", "Chittur"],
  },
  {
    district: "Malappuram",
    cities: ["Malappuram", "Manjeri", "Tirur", "Perinthalmanna"],
  },
  {
    district: "Kozhikode",
    cities: ["Kozhikode", "Vadakara", "Koyilandy", "Ramanattukara"],
  },
  {
    district: "Wayanad",
    cities: ["Kalpetta", "Mananthavady", "Sulthan Bathery", "Panamaram"],
  },
  {
    district: "Kannur",
    cities: ["Kannur", "Thalassery", "Taliparamba", "Payyannur"],
  },
  {
    district: "Kasaragod",
    cities: ["Kasaragod", "Kanhangad", "Nileshwar", "Uppala"],
  },
];

async function seedLocations() {
  await connectToDatabase();

  for (const districtRow of keralaDistrictCityMap) {
    for (const city of districtRow.cities) {
      await locationService.createLocation({
        state: "Kerala",
        district: districtRow.district,
        city,
      });
    }
  }

  console.warn(`Location master seeded for Kerala: ${keralaDistrictCityMap.length} districts`);
  process.exit(0);
}

seedLocations().catch((error) => {
  console.error("Failed to seed location master", error);
  process.exit(1);
});
