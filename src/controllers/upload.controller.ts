import { Request, Response } from "express";
import { PermissionKeys } from "../config/permissions";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/api-response";
import { parseS3UploadFolder, uploadToS3 } from "../utils/s3";

export const uploadController = {
  uploadImage: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;

    if (!file) {
      throw new ApiError(400, "Image file is required in form-data field 'file'");
    }

    const isVendorScope = Boolean(req.authUser?.permissions.includes(PermissionKeys.ScopeVendorOwn));
    const defaultFolder = isVendorScope ? "vendors" : "services";
    const folder = parseS3UploadFolder(req.body?.folder, defaultFolder);
    const uploadedFile = await uploadToS3(file, folder);

    return sendSuccess(
      res,
      "Image uploaded",
      {
        file: {
          url: uploadedFile.url,
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          key: uploadedFile.key,
        },
      },
      201,
    );
  }),
};
