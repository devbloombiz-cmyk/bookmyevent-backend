# Auth Module Notes

## What was created
- Signup and login for customer and vendor flows.
- Access token + refresh token rotation lifecycle.
- Logout with refresh-token revocation and forgot-password placeholder endpoint.

## Why it was created
- To provide secure identity boundaries before core lead, booking, and payment orchestration.

## Scalability purpose
- Token persistence layer is abstracted to repository/service for Redis token cache or token-family expansion later.
