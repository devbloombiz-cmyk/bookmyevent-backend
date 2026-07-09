import axios from "axios";

async function main() {
  const url = "http://localhost:5000/api/v1/gallery?vendorId=6a48c18db8bc0bbba2de3a88&limit=40";
  console.log("Querying API URL:", url);

  try {
    const res = await axios.get(url, {
      headers: {
        "X-BME-Internal-Secret": "9f8d2a1b",
      },
    });
    console.log("API response status:", res.status);
    console.log("API response data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("API error:", err.status, err.response?.data);
    } else {
      console.error("Error:", err);
    }
  }
}

main();
