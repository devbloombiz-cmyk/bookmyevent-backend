import { Request, Response } from "express";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/api-response";

export const uploadController = {
  uploadImage: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;

    if (!file) {
      throw new ApiError(400, "Image file is required in form-data field 'file'");
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/images/${file.filename}`;

    return sendSuccess(
      res,
      "Image uploaded",
      {
        file: {
          url: fileUrl,
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
      },
      201,
    );
  }),
};
