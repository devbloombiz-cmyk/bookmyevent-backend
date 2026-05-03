import { UserModel } from "../models/user.model";
import { UserRole } from "../types/domain";

type CreateUserPayload = {
  name: string;
  email?: string;
  mobile?: string;
  passwordHash?: string;
  role: UserRole;
};

function normalizeCreatePayload(payload: CreateUserPayload) {
  const normalized: Record<string, unknown> = {
    name: payload.name,
    role: payload.role,
  };

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (email) {
    normalized.email = email;
  }

  const mobile = typeof payload.mobile === "string" ? payload.mobile.trim() : "";
  if (mobile) {
    normalized.mobile = mobile;
  }

  if (typeof payload.passwordHash === "string" && payload.passwordHash) {
    normalized.passwordHash = payload.passwordHash;
  }

  return normalized;
}

export const userRepository = {
  create: (payload: CreateUserPayload) => UserModel.create(normalizeCreatePayload(payload)),
  findByEmail: (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return Promise.resolve(null);
    }
    return UserModel.findOne({ email: normalized });
  },
  findByMobile: (mobile: string) => {
    const normalized = mobile.trim();
    if (!normalized) {
      return Promise.resolve(null);
    }
    return UserModel.findOne({ mobile: normalized });
  },
  findByEmailOrMobile: (identifier: string) => {
    const normalizedIdentifier = identifier.trim();
    const isEmailIdentifier = normalizedIdentifier.includes("@");

    return isEmailIdentifier
      ? UserModel.findOne({ email: normalizedIdentifier.toLowerCase() })
      : UserModel.findOne({ mobile: normalizedIdentifier });
  },
  findById: (id: string) => UserModel.findById(id),
  findByRole: (role: UserRole) => UserModel.find({ role }).sort({ createdAt: -1 }),
  findAnyByRole: (role: UserRole) => UserModel.findOne({ role }),
  updateById: (
    id: string,
    update: Partial<CreateUserPayload> & { isActive?: boolean; role?: UserRole },
  ) => UserModel.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after" }),
  upsertByEmail: (email: string, update: Partial<CreateUserPayload> & { isActive?: boolean }) =>
    UserModel.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        $set: {
          ...update,
          email: typeof update.email === "string" ? update.email.trim().toLowerCase() : undefined,
          mobile: typeof update.mobile === "string" && update.mobile.trim() ? update.mobile.trim() : undefined,
        },
      },
      { upsert: true, returnDocument: "after" },
    ),
};
