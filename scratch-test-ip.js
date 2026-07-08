const { ipKeyGenerator } = require("express-rate-limit");

console.log("ipKeyGenerator type:", typeof ipKeyGenerator);
try {
  const result = ipKeyGenerator({ ip: "192.168.1.1" });
  console.log("ipKeyGenerator({ ip: '192.168.1.1' }) result:", result);
} catch (e) {
  console.log("Error passing request object:", e.message);
}

try {
  const result = ipKeyGenerator("192.168.1.1");
  console.log("ipKeyGenerator('192.168.1.1') result:", result);
} catch (e) {
  console.log("Error passing string:", e.message);
}
