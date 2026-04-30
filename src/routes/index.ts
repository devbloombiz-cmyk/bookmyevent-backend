import { Router } from "express";
import { authRouter } from "./auth.route";
import { availabilityRouter } from "./availability.route";
import { bookingRouter } from "./booking.route";
import { categoryRouter } from "./category.route";
import { galleryRouter } from "./gallery.route";
import { guruvayoorRequestRouter } from "./guruvayoor-request.route";
import { healthRouter } from "./health.route";
import { leadRouter } from "./lead.route";
import { locationRouter } from "./location.route";
import { packageRouter } from "./package.route";
import { uploadRouter } from "./upload.route";
import { userRouter } from "./user.route";
import { venueOwnerRouter } from "./venue-owner.route";
import { vendorRouter } from "./vendor.route";

const apiV1Router = Router();

apiV1Router.use(healthRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/vendors", vendorRouter);
apiV1Router.use("/categories", categoryRouter);
apiV1Router.use("/packages", packageRouter);
apiV1Router.use("/locations", locationRouter);
apiV1Router.use("/leads", leadRouter);
apiV1Router.use("/availability", availabilityRouter);
apiV1Router.use("/bookings", bookingRouter);
apiV1Router.use("/uploads", uploadRouter);
apiV1Router.use("/gallery", galleryRouter);
apiV1Router.use("/users", userRouter);
apiV1Router.use("/venue-owners", venueOwnerRouter);
apiV1Router.use("/guruvayoor-requests", guruvayoorRequestRouter);

export { apiV1Router };
