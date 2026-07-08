const express = require('express');
const app = express();

try {
  app.set("trust proxy", "loopback, linklocal, uniquelocal, 1");
  console.log("trust proxy set successfully!");
  
  // Create a mock request to trigger the proxy-addr compilation
  const req = {
    headers: {
      'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178'
    },
    connection: {
      remoteAddress: '127.0.0.1'
    }
  };
  
  // In Express, req.ip getter triggers compilation of trust proxy
  // Let's invoke the getter manually by binding to app
  Object.defineProperty(req, 'app', { value: app });
  
  // Express req.ip implementation (simplified or direct access):
  // Let's boot a minimal server and query it or use Express request prototype
  const reqProto = Object.create(express.request);
  reqProto.app = app;
  reqProto.headers = req.headers;
  reqProto.connection = req.connection;
  reqProto.socket = req.connection;
  
  console.log("Client IP resolved to:", reqProto.ip);
} catch (err) {
  console.error("Error occurred:", err);
}
