import { UserModel } from "../models/user.model";
import { UserRole } from "../types/domain";

type CreateUserPayload = {
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
  role: UserRole;
};

export const userRepository = {
  create: (payload: CreateUserPayload) => UserModel.create(payload),
  findByEmail: (email: string) => UserModel.findOne({ email: email.toLowerCase() }),
  findByMobile: (mobile: string) => UserModel.findOne({ mobile: mobile.trim() }),
  findById: (id: string) => UserModel.findById(id),
  findByRole: (role: UserRole) => UserModel.find({ role }).sort({ createdAt: -1 }),
  findAnyByRole: (role: UserRole) => UserModel.findOne({ role }),
  updateById: (
    id: string,
    update: Partial<CreateUserPayload> & { isActive?: boolean; role?: UserRole },
  ) => UserModel.findByIdAndUpdate(id, { $set: update }, { new: true }),
  upsertByEmail: (email: string, update: Partial<CreateUserPayload> & { isActive?: boolean }) =>
    UserModel.findOneAndUpdate({ email: email.toLowerCase() }, { $set: update }, { upsert: true, new: true }),
};
