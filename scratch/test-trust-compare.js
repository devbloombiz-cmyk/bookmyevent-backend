const express = require('express');

function test(trustSetting, xff, remoteIp) {
  const app = express();
  app.set("trust proxy", trustSetting);
  
  const reqProto = Object.create(express.request);
  reqProto.app = app;
  reqProto.headers = { 'x-forwarded-for': xff };
  reqProto.connection = { remoteAddress: remoteIp };
  reqProto.socket = reqProto.connection;
  
  return reqProto.ip;
}

const xffSingle = '203.0.113.195';
const xffDouble = '203.0.113.195, 127.0.0.1'; // e.g. client -> nginx -> nextjs -> express
const xffTriple = '203.0.113.195, 10.0.0.5, 127.0.0.1';

console.log("Using string 'loopback, linklocal, uniquelocal, 1':");
console.log("  Single:", test("loopback, linklocal, uniquelocal, 1", xffSingle, '127.0.0.1'));
console.log("  Double:", test("loopback, linklocal, uniquelocal, 1", xffDouble, '127.0.0.1'));
console.log("  Triple:", test("loopback, linklocal, uniquelocal, 1", xffTriple, '127.0.0.1'));

console.log("\nUsing number 1:");
console.log("  Single:", test(1, xffSingle, '127.0.0.1'));
console.log("  Double:", test(1, xffDouble, '127.0.0.1'));
console.log("  Triple:", test(1, xffTriple, '127.0.0.1'));

console.log("\nUsing number 2:");
console.log("  Single:", test(2, xffSingle, '127.0.0.1'));
console.log("  Double:", test(2, xffDouble, '127.0.0.1'));
console.log("  Triple:", test(2, xffTriple, '127.0.0.1'));
