import type { Request, Response } from "express";
import { vendorLeadActionService } from "../services/vendor-lead-action.service";
import {
  renderStatusPage,
  successIconSvg,
  errorIconSvg,
  warnIconSvg,
  renderLeadReviewPage,
} from "../utils/html-template";
import { logger } from "../config/logger";

function getClientDetails(req: Request) {
  const xForwardedFor = req.headers["x-forwarded-for"];
  const ipAddress =
    typeof xForwardedFor === "string"
      ? xForwardedFor
      : Array.isArray(xForwardedFor)
        ? xForwardedFor[0] || ""
        : req.ip || "";
  const rawUserAgent = req.headers["user-agent"];
  const userAgent = (Array.isArray(rawUserAgent) ? rawUserAgent[0] : rawUserAgent) || "";
  return { ipAddress, userAgent };
}

function handleControllerError(res: Response, error: unknown, token: string, actionName: string) {
  logger.warn(
    { error, token, action: actionName },
    `Failed vendor-lead-action during ${actionName}`,
  );

  let heading = "Link Invalid or Expired";
  let message = "This action link is no longer valid.";
  let iconClass: "icon-error" | "icon-warn" = "icon-error";
  let iconSvg = errorIconSvg;
  let bulletContent = `
    <li>Link expired</li>
    <li>Lead already processed</li>
    <li>Invalid token</li>
  `;

  const errMsg = error instanceof Error ? error.message : String(error);

  if (errMsg === "ALREADY_ACCEPTED") {
    heading = "Action Already Completed";
    message = "Lead already accepted and offer sent.";
    iconClass = "icon-warn";
    iconSvg = warnIconSvg;
    bulletContent = "";
  } else if (errMsg === "ALREADY_REJECTED") {
    heading = "Action Already Completed";
    message = "Lead already rejected/cancelled.";
    iconClass = "icon-warn";
    iconSvg = warnIconSvg;
    bulletContent = "";
  } else if (errMsg === "ALREADY_PROCESSED") {
    heading = "Action Already Completed";
    message = "Lead has already been processed.";
    iconClass = "icon-warn";
    iconSvg = warnIconSvg;
    bulletContent = "";
  }

  const html = renderStatusPage({
    title: heading,
    heading,
    message,
    iconClass,
    iconSvg,
    bulletContent: bulletContent || undefined,
  });

  res.status(400).send(html);
}

export const vendorLeadActionController = {
  acceptLead: async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const { ipAddress, userAgent } = getClientDetails(req);

    try {
      await vendorLeadActionService.acceptLead(token, ipAddress, userAgent);

      const html = renderStatusPage({
        title: "Booking Confirmed",
        heading: "✅ Booking Confirmed",
        message:
          "The booking has been successfully created. Customer has been notified and it is now visible in your Bookings panel.",
        iconClass: "icon-success",
        iconSvg: successIconSvg,
      });

      res.status(200).send(html);
    } catch (error) {
      handleControllerError(res, error, token, "acceptLead");
    }
  },

  rejectLead: async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const { ipAddress, userAgent } = getClientDetails(req);

    try {
      await vendorLeadActionService.rejectLead(token, ipAddress, userAgent);

      const html = renderStatusPage({
        title: "Lead Rejected Successfully",
        heading: "❌ Lead Rejected",
        message: "Customer has been notified. The lead is now marked as Rejected.",
        iconClass: "icon-success",
        iconSvg: errorIconSvg,
      });

      res.status(200).send(html);
    } catch (error) {
      handleControllerError(res, error, token, "rejectLead");
    }
  },

  reviewLead: async (req: Request, res: Response) => {
    const token = String(req.params.token);

    try {
      const { lead } = await vendorLeadActionService.getLeadAndPackagesForReview(token);
      const html = renderLeadReviewPage(lead);
      res.status(200).send(html);
    } catch (error) {
      handleControllerError(res, error, token, "reviewLead");
    }
  },

  acceptLeadWithReviewToken: async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const { ipAddress, userAgent } = getClientDetails(req);

    try {
      await vendorLeadActionService.acceptLeadWithReviewToken(token, ipAddress, userAgent);

      const html = renderStatusPage({
        title: "Booking Confirmed",
        heading: "✅ Booking Confirmed",
        message:
          "The booking has been successfully created. Customer has been notified and it is now visible in your Bookings panel.",
        iconClass: "icon-success",
        iconSvg: successIconSvg,
      });

      res.status(200).send(html);
    } catch (error) {
      handleControllerError(res, error, token, "acceptLeadWithReviewToken");
    }
  },

  rejectLeadWithReviewToken: async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const { ipAddress, userAgent } = getClientDetails(req);

    try {
      await vendorLeadActionService.rejectLeadWithReviewToken(token, ipAddress, userAgent);

      const html = renderStatusPage({
        title: "Lead Cancelled",
        heading: "❌ Lead Cancelled",
        message: "The lead has been rejected/cancelled. Customer has been notified.",
        iconClass: "icon-success",
        iconSvg: errorIconSvg,
      });

      res.status(200).send(html);
    } catch (error) {
      handleControllerError(res, error, token, "rejectLeadWithReviewToken");
    }
  },
};
