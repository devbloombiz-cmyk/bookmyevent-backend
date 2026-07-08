const ipaddr = require('ipaddr.js');
console.log("isValid('1'):", ipaddr.isValid('1'));
try {
  console.log("parse('1'):", ipaddr.parse('1'));
} catch (e) {
  console.error("parse('1') failed:", e.message);
}
