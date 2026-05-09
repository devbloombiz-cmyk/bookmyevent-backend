import assert from "node:assert/strict";
import test from "node:test";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database";
import { env } from "../config/env";
import { UserModel } from "../models/user.model";
import { VendorModel } from "../models/vendor.model";
import { AccountSubscriptionModel } from "../models/account-subscription.model";
import { subscriptionService } from "../services/subscription.service";
import { ApiError } from "../utils/api-error";

const resolveRazorpaySecretForEnv = () => {
  if (env.RAZORPAY_ENV === "live") {
    return (env.RAZORPAY_KEY_SECRET_LIVE || env.RAZORPAY_KEY_SECRET || "").trim();
  }
  return (env.RAZORPAY_KEY_SECRET_TEST || env.RAZORPAY_KEY_SECRET || "").trim();
};

async function createVendorAuthFixture() {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const email = `razorpay-fixture-${unique}@bookmyevent.test`;
  const mobile = `9${String(Math.floor(100000000 + Math.random() * 899999999))}`;

  const user = await UserModel.create({
    name: "Razorpay Fixture Vendor",
    email,
    mobile,
    role: "vendor",
    isVerified: true,
    isActive: true,
  });

  const vendor = await VendorModel.create({
    userId: user._id,
    businessName: `Fixture Vendor ${unique}`,
    ownerName: "Fixture Owner",
    email,
    mobile,
    category: "Photography",
    subCategory: "Wedding Photography",
    city: "Kochi",
    approvalStatus: "active",
    isActive: true,
  });

  return {
    userId: String(user._id),
    vendorId: String(vendor._id),
    authUser: {
      id: String(user._id),
      role: "vendor" as const,
    },
  };
}

async function cleanupFixture(userId: string, vendorId: string) {
  await AccountSubscriptionModel.deleteMany({
    $or: [
      { actorType: "vendor", actorId: vendorId },
      { createdBy: userId },
      { updatedBy: userId },
    ],
  });

  await VendorModel.deleteOne({ _id: vendorId });
  await UserModel.deleteOne({ _id: userId });
}

test("confirm-razorpay rejects invalid signature", async () => {
  await connectToDatabase();

  const fixture = await createVendorAuthFixture();

  try {
    const intent = await subscriptionService.createCheckoutIntent(fixture.authUser, {
      planCode: "PRO_YEARLY_4999",
      paymentProvider: "razorpay",
    });

    const subscriptionId = String((intent.subscription as { _id?: unknown })._id || "");
    const orderId = String((intent.checkout as { orderId?: unknown } | null)?.orderId || "");

    await assert.rejects(
      () =>
        subscriptionService.confirmMyRazorpayPayment(fixture.authUser, {
          subscriptionId,
          razorpayOrderId: orderId,
          razorpayPaymentId: `pay_test_invalid_${Date.now()}`,
          razorpaySignature: "deadbeef",
        }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal((error as ApiError).statusCode, 401);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture.userId, fixture.vendorId);
    await mongoose.disconnect();
  }
});

test("confirm-razorpay is idempotent on repeated success callback", async () => {
  await connectToDatabase();

  const fixture = await createVendorAuthFixture();

  try {
    const intent = await subscriptionService.createCheckoutIntent(fixture.authUser, {
      planCode: "PRO_YEARLY_4999",
      paymentProvider: "razorpay",
    });

    const subscriptionId = String((intent.subscription as { _id?: unknown })._id || "");
    const orderId = String((intent.checkout as { orderId?: unknown } | null)?.orderId || "");
    const paymentId = `pay_test_${Date.now()}`;

    const secret = resolveRazorpaySecretForEnv();
    assert.ok(secret, "Razorpay key secret must be set for integration test");

    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const first = (await subscriptionService.confirmMyRazorpayPayment(fixture.authUser, {
      subscriptionId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })) as Record<string, unknown>;

    assert.equal(String(first.status || ""), "active");
    assert.equal(String(first.paymentStatus || ""), "confirmed");
    assert.equal(String(first.providerPaymentId || ""), paymentId);

    const second = (await subscriptionService.confirmMyRazorpayPayment(fixture.authUser, {
      subscriptionId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })) as Record<string, unknown>;

    assert.equal(String(second._id || ""), String(first._id || ""));
    assert.equal(String(second.status || ""), "active");
    assert.equal(String(second.paymentStatus || ""), "confirmed");
    assert.equal(String(second.providerPaymentId || ""), paymentId);
  } finally {
    await cleanupFixture(fixture.userId, fixture.vendorId);
    await mongoose.disconnect();
  }
});
