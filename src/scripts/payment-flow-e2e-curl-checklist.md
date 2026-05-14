# Payment Flow E2E Curl Checklist (Windows PowerShell)

This checklist validates the full production flow:
1. create offer/payment link
2. send link to customer
3. process webhook payment
4. auto move lead to PAYMENT_DONE
5. vendor marks BOOKED and booking is created

## 0) Pre-checks

- Backend is running on http://localhost:5000
- Razorpay keys and webhook secret are configured for current RAZORPAY_ENV
- You have valid cookies and CSRF token from an authenticated vendor/venue-owner session

Set variables first:

```powershell
$BASE = "http://localhost:5000"
$LEAD_ID = "REPLACE_LEAD_ID"
$VENDOR_ID = "REPLACE_VENDOR_ID"
$PACKAGE_ID = "REPLACE_PACKAGE_ID"
$PACKAGE_NAME = "Bridal Glow Basic"
$FINAL_AMOUNT = 18000
$ADVANCE_AMOUNT = 5000

# Keep your real auth cookies exactly as browser sent them.
$COOKIE = "bme_access=...; bme_refresh=...; bme_csrf=..."
$CSRF = "REPLACE_CSRF_TOKEN"
```

## 1) Create offer and payment link

```powershell
$offerBody = @{
  packageId    = $PACKAGE_ID
  packageName  = $PACKAGE_NAME
  finalAmount  = $FINAL_AMOUNT
  advanceAmount= $ADVANCE_AMOUNT
  notes        = "E2E test offer"
  sendWhatsApp = $false
} | ConvertTo-Json -Depth 5

$offerRes = curl.exe -s -X POST "$BASE/api/v1/leads/$LEAD_ID/offers" `
  -H "Content-Type: application/json" `
  -H "Accept: application/json" `
  -H "x-csrf-token: $CSRF" `
  -b "$COOKIE" `
  --data-raw "$offerBody"

$offerObj = $offerRes | ConvertFrom-Json
$paymentRequestId = $offerObj.data.paymentRequest._id
$paymentLinkId = $offerObj.data.paymentRequest.razorpayPaymentLinkId
$paymentReferenceId = $offerObj.data.paymentRequest.razorpayReferenceId
$paymentLinkUrl = $offerObj.data.paymentRequest.paymentLinkUrl

"paymentRequestId=$paymentRequestId"
"paymentLinkId=$paymentLinkId"
"paymentReferenceId=$paymentReferenceId"
"paymentLinkUrl=$paymentLinkUrl"
```

Expected:
- HTTP success true
- paymentRequestId exists
- razorpayPaymentLinkId is non-empty
- paymentLinkUrl is non-empty

## 2) Send generated link to customer (UltraMsg path)

```powershell
$sendBody = @{ notes = "E2E send link" } | ConvertTo-Json -Depth 5

$sendRes = curl.exe -s -X POST "$BASE/api/v1/leads/$LEAD_ID/offers/$paymentRequestId/send" `
  -H "Content-Type: application/json" `
  -H "Accept: application/json" `
  -H "x-csrf-token: $CSRF" `
  -b "$COOKIE" `
  --data-raw "$sendBody"

$sendObj = $sendRes | ConvertFrom-Json
$sendObj
```

Expected:
- HTTP success true
- data.paymentRequest.sentToWhatsapp is true when UltraMsg is enabled

## 3) Simulate Razorpay webhook for payment success

Use the exact webhook secret for current environment:
- test mode: RAZORPAY_WEBHOOK_SECRET_TEST (fallback RAZORPAY_WEBHOOK_SECRET)
- live mode: RAZORPAY_WEBHOOK_SECRET_LIVE (fallback RAZORPAY_WEBHOOK_SECRET)

```powershell
$WEBHOOK_SECRET = "REPLACE_WEBHOOK_SECRET"

$webhookBody = @"
{
  "event": "payment_link.paid",
  "created_at": 1778736000,
  "payload": {
    "payment_link": {
      "entity": {
        "id": "$paymentLinkId",
        "reference_id": "$paymentReferenceId",
        "amount_paid": 500000,
        "payment_id": "pay_e2e_$(Get-Random)"
      }
    },
    "payment": {
      "entity": {
        "id": "pay_e2e_$(Get-Random)",
        "amount": 500000,
        "notes": {
          "paymentRequestId": "$paymentRequestId"
        }
      }
    }
  }
}
"@

$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($WEBHOOK_SECRET)
$signature = [System.BitConverter]::ToString(
  $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($webhookBody))
).Replace("-", "").ToLower()

$webhookRes = curl.exe -s -X POST "$BASE/webhooks/razorpay" `
  -H "Content-Type: application/json" `
  -H "x-razorpay-signature: $signature" `
  --data-raw "$webhookBody"

$webhookObj = $webhookRes | ConvertFrom-Json
$webhookObj
```

Expected:
- success true
- data.result.handled true
- data.result.paymentRequestId equals $paymentRequestId

## 4) Verify lead moved to PAYMENT_DONE automatically

```powershell
$leadsRes = curl.exe -s "$BASE/api/v1/leads?vendorId=$VENDOR_ID&status=PAYMENT_DONE" `
  -H "Accept: application/json" `
  -H "x-csrf-token: $CSRF" `
  -b "$COOKIE"

$leadsObj = $leadsRes | ConvertFrom-Json
$matched = $leadsObj.data.leads | Where-Object { $_._id -eq $LEAD_ID }
$matched
```

Expected:
- lead appears in PAYMENT_DONE list
- lead.paymentStatus is paid

## 5) Mark lead BOOKED and verify booking creation

```powershell
$bookBody = @{ status = "BOOKED" } | ConvertTo-Json -Depth 5

$bookRes = curl.exe -s -X PUT "$BASE/api/v1/leads/$LEAD_ID" `
  -H "Content-Type: application/json" `
  -H "Accept: application/json" `
  -H "x-csrf-token: $CSRF" `
  -b "$COOKIE" `
  --data-raw "$bookBody"

$bookObj = $bookRes | ConvertFrom-Json
$bookObj

$bookingsRes = curl.exe -s "$BASE/api/v1/bookings" `
  -H "Accept: application/json" `
  -H "x-csrf-token: $CSRF" `
  -b "$COOKIE"

$bookingsObj = $bookingsRes | ConvertFrom-Json
$booking = $bookingsObj.data.bookings | Where-Object { $_.leadId -eq $LEAD_ID }
$booking
```

Expected:
- lead status is BOOKED
- a booking exists with leadId == LEAD_ID
- booking has advance/paid reflected

## 6) Optional idempotency checks (risk control)

### 6.1 Replay same webhook payload
Run Step 3 again with the exact same webhook body and signature.
Expected:
- success true
- duplicate handled gracefully (no double payment effect)

### 6.2 Try send endpoint before link exists
Use a paymentRequestId with empty paymentLinkUrl.
Expected:
- HTTP 400 with clear validation message

## 7) Pass criteria (Go/No-Go)

Go only if all pass:
- Offer creation returns non-empty razorpayPaymentLinkId and paymentLinkUrl
- Send endpoint succeeds
- Webhook transitions payment request to paid
- Lead auto transitions to PAYMENT_DONE
- BOOKED transition creates/uses booking correctly
- No duplicate or conflicting index errors in logs
