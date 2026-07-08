const express = require("express");

// Set environment variables to valid values satisfying Zod constraints
process.env.API_RATE_LIMIT_WINDOW_MS = "60000"; // 60 seconds
process.env.API_RATE_LIMIT_MAX = "20"; // limit = 20 requests for writeLimiter

// Import the compiled rate-limiting middleware
const { writeLimiter } = require("../dist/middlewares/rate-limit.middleware");

function runTest() {
  const req = {
    path: "/api/v1/vendors",
    method: "POST",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "x-forwarded-for": "203.0.113.195",
    },
    ip: "203.0.113.195",
    ips: ["203.0.113.195"],
  };

  const res = {
    setHeader(name, value) {
      return this;
    },
    status(code) {
      return this;
    },
    json(body) {
      return this;
    }
  };

  let nextCalledCount = 0;
  const next = () => {
    nextCalledCount++;
  };

  console.log("--- Issuing 25 requests to exceed the limit of 20 ---");
  for (let i = 1; i <= 25; i++) {
    // Generate a fresh request object each time to avoid double count warnings
    const freshReq = { ...req };
    writeLimiter(freshReq, res, next);
  }
  console.log(`Allowed requests: ${nextCalledCount}`);

  // Wait 1.5 seconds before exiting to allow pino streams to flush
  setTimeout(() => {
    console.log("Test finished.");
  }, 1500);
}

runTest();
