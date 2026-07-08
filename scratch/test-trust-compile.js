const proxyaddr = require('proxy-addr');

try {
  // Let's compile the trust setting and inspect the internal structure or compile function
  const trustStr = "loopback, linklocal, uniquelocal, 1";
  const trustFn = proxyaddr.compile(trustStr);
  
  // Let's test different IPs against the compiled trust function
  console.log("Trust ::1:", trustFn('::1'));
  console.log("Trust 127.0.0.1:", trustFn('127.0.0.1'));
  console.log("Trust 10.0.0.1:", trustFn('10.0.0.1'));
  console.log("Trust 1.0.0.1:", trustFn('1.0.0.1'));
  console.log("Trust 1.1.1.1:", trustFn('1.1.1.1'));
  console.log("Trust 0.0.0.1:", trustFn('0.0.0.1'));
  console.log("Trust 8.8.8.8:", trustFn('8.8.8.8'));
} catch (err) {
  console.error("Compilation error:", err);
}
