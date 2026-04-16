# Availability Module Notes

## What was created
- Availability schema with unique composite index on vendorId + date + slot.

## Why it was created
- Preventing double booking is a hard reliability requirement.

## Scalability purpose
- Current index structure can be extended to calendar sync jobs and conflict-resolution services.
