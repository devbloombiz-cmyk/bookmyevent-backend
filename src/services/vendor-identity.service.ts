import { userRepository } from "../repositories/user.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";

export async function resolveVendorIdForAuthUser(authUser: Pick<AuthenticatedUser, "id">) {
  const vendorByUserId = await vendorRepository.findByUserId(authUser.id);
  if (vendorByUserId) {
    return String(vendorByUserId._id);
  }

  const user = await userRepository.findById(authUser.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
  if (!vendor) {
    throw new ApiError(404, "Vendor profile not found");
  }

  // Auto-heal legacy records by linking userId once discovered.
  if (!vendor.userId) {
    await vendorRepository.updateById(String(vendor._id), {
      userId: authUser.id,
    });
  }

  return String(vendor._id);
}
