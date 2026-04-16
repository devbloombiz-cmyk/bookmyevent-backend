import { Router } from "express";
import { bookingController } from "../controllers/booking.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { bookingCreateSchema } from "../validators/booking.validator";

const bookingRouter = Router();

bookingRouter.get(
  "/",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  bookingController.listBookings,
);
bookingRouter.post("/", requireAuth, validateRequest(bookingCreateSchema), bookingController.createBooking);

export { bookingRouter };
