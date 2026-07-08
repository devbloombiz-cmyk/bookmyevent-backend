const express = require('express');
const app = express();

app.set("trust proxy", "loopback, linklocal, uniquelocal, 1");
console.log("Setting compiled function:", app.get('trust proxy fn'));
console.log("Is function?", typeof app.get('trust proxy fn'));

try {
  const reqProto = Object.create(express.request);
  reqProto.app = app;
  reqProto.headers = {
    'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178'
  };
  reqProto.connection = { remoteAddress: '127.0.0.1' };
  reqProto.socket = reqProto.connection;
  
  console.log("IP:", reqProto.ip);
} catch (err) {
  console.error("Getter error:", err);
}
