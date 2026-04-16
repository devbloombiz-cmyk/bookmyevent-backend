import crypto from "crypto";
import { ApiError } from "../utils/api-error";
import { hashPassword } from "../utils/password";
import { userRepository } from "../repositories/user.repository";
import { UserRole } from "../types/domain";

type SubAdminRole = Extract<UserRole, "vendor_admin" | "accounts_admin">;

function fallbackEmailFromMobile(mobile: string) {
  const safeMobile = mobile.replace(/[^0-9+]/g, "");
  return `${safeMobile}@bookmyevent.local`;
}

export const userService = {
  listSystemUsers: async () => {
    const admins = await Promise.all([
      userRepository.findByRole("super_admin"),
      userRepository.findByRole("vendor_admin"),
      userRepository.findByRole("accounts_admin"),
    ]);

    return admins.flat().map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  },

  createSubAdmin: async (payload: {
    name: string;
    mobile: string;
    email?: string;
    role: SubAdminRole;
  }) => {
    const normalizedMobile = payload.mobile.trim();
    const normalizedEmail = (payload.email?.trim().toLowerCase() || fallbackEmailFromMobile(normalizedMobile));

    const mobileExists = await userRepository.findByMobile(normalizedMobile);
    if (mobileExists) {
      throw new ApiError(409, "Mobile number already registered");
    }

    const emailExists = await userRepository.findByEmail(normalizedEmail);
    if (emailExists) {
      throw new ApiError(409, "Email already registered");
    }

    const temporaryPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await userRepository.create({
      name: payload.name.trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      role: payload.role,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  },
};
