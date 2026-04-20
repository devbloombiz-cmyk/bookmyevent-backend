import { userRepository } from "../repositories/user.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import type { UserRole } from "../types/domain";
import { ApiError } from "../utils/api-error";

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export async function resolveVendorIdForAuthUser(authUser: AuthUser) {
  const user = await userRepository.findById(authUser.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
  if (!vendor) {
    throw new ApiError(404, "Vendor profile not found");
  }

  return String(vendor._id);
}
