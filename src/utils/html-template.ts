export function renderStatusPage(options: {
  title: string;
  heading: string;
  message: string;
  iconClass: "icon-success" | "icon-error" | "icon-warn";
  iconSvg: string;
  bulletContent?: string;
}): string {
  const bulletHtml = options.bulletContent
    ? `<ul class="bullets">${options.bulletContent}</ul>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Outfit', sans-serif;
      background: linear-gradient(135deg, #0b0f19 0%, #111827 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      background: rgba(17, 24, 39, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon-container {
      width: 72px;
      height: 72px;
      margin: 0 auto 24px auto;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 50%;
    }
    .icon-success {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    .icon-error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }
    .icon-warn {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 12px 0;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 15px;
      color: #9ca3af;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .bullets {
      text-align: left;
      margin: 0 auto 24px auto;
      max-width: 280px;
      color: #9ca3af;
      font-size: 14px;
      padding-left: 20px;
    }
    .bullets li {
      margin-bottom: 8px;
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 24px 0;
    }
    .footer-text {
      font-size: 12px;
      color: #4b5563;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-container ${options.iconClass}">
      ${options.iconSvg}
    </div>
    <h1>${options.heading}</h1>
    <p>${options.message}</p>
    ${bulletHtml}
    <div class="divider"></div>
    <div class="footer-text">BookMyEvent Secure Magic Link Service</div>
  </div>
</body>
</html>`;
}

export const successIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 32px; height: 32px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
</svg>
`;

export const errorIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 32px; height: 32px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
</svg>
`;

export const warnIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 32px; height: 32px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.03L3.07 19.5a1.125 1.125 0 00.97 1.68h17.9c.55 0 1-.45 1-1 0-.25-.09-.5-.26-.68L12.97 2.72a1.125 1.125 0 00-1.97 0zM12 17.25h.007v.008H12v-.008z" />
</svg>
`;

interface ReviewLeadInput {
  eventDate?: string | Date | null;
  customerName?: string | null;
  customerMobile?: string | null;
  customerEmail?: string | null;
  eventSlot?: string | null;
  location?: string | null;
  message?: string | null;
}

export function renderLeadReviewPage(lead: ReviewLeadInput): string {
  const eventDateStr = lead.eventDate
    ? new Date(lead.eventDate).toISOString().slice(0, 10)
    : "Not specified";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Review Booking Enquiry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-primary: #e5204c;
      --color-primary-hover: #cb1b41;
      --color-bg: #0b0f19;
      --color-card: rgba(17, 24, 39, 0.75);
      --color-border: rgba(255, 255, 255, 0.08);
      --color-text: #f8fafc;
      --color-muted: #9ca3af;
      --color-success: #10b981;
      --color-error: #ef4444;
    }
    body {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Outfit', sans-serif;
      background: linear-gradient(135deg, var(--color-bg) 0%, #111827 100%);
      color: var(--color-text);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 600px;
      animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(to right, #ffffff, #9ca3af);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 14px;
      color: var(--color-muted);
    }
    .card {
      background: var(--color-card);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--color-border);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 10px;
    }
    .grid-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 480px) {
      .grid-info {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 12px;
      color: var(--color-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 14px;
      font-weight: 500;
    }
    .info-value a {
      color: var(--color-primary);
      text-decoration: none;
    }
    .info-value a:hover {
      text-decoration: underline;
    }
    .message-box {
      grid-column: 1 / -1;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 10px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13.5px;
      line-height: 1.5;
      white-space: pre-line;
      margin-top: 8px;
    }
    .form-group {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
    }
    .form-group label {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #e2e8f0;
    }
    .form-control {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 12px;
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-control:focus {
      border-color: var(--color-primary);
    }
    .form-control::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
    .btn {
      width: 100%;
      padding: 14px;
      border-radius: 10px;
      border: none;
      font-family: inherit;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
    }
    .btn-primary {
      background: var(--color-primary);
      color: #fff;
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    .btn-outline {
      background: transparent;
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--color-error);
      margin-top: 10px;
    }
    .btn-outline:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.08);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .footer-text {
      text-align: center;
      font-size: 11px;
      color: #4b5563;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 600;
      margin-top: 24px;
    }

    /* Custom Confirm Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }
    .modal-card {
      background: rgba(30, 41, 59, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 30px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      transform: scale(0.9);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .modal-overlay.active .modal-card {
      transform: scale(1);
    }
    .modal-card h3 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 12px 0;
      color: var(--color-text);
    }
    .modal-card p {
      font-size: 14.5px;
      color: var(--color-muted);
      margin: 0 0 24px 0;
      line-height: 1.5;
    }
    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
    }
    .modal-actions button {
      flex: 1;
      padding: 12px;
      font-size: 14.5px;
      border-radius: 10px;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--color-text);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>BookMyEvent</h2>
      <p>Lead Action Panel</p>
    </div>

    <!-- Lead Info Card -->
    <div class="card">
      <div class="card-title">
        <svg style="width: 18px; height: 18px;" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        Lead Details
      </div>
      <div class="grid-info">
        <div class="info-item">
          <span class="info-label">Customer</span>
          <span class="info-value">${lead.customerName || "Customer"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Contact Mobile</span>
          <span class="info-value">
            <a href="tel:${lead.customerMobile}">${lead.customerMobile || "Not provided"}</a>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Email</span>
          <span class="info-value">
            ${lead.customerEmail ? `<a href="mailto:${lead.customerEmail}">${lead.customerEmail}</a>` : "Not provided"}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Event Date & Slot</span>
          <span class="info-value">${eventDateStr} | ${lead.eventSlot || "Full Day"}</span>
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <span class="info-label">Location</span>
          <span class="info-value">${lead.location || "Not specified"}</span>
        </div>
        ${
          lead.message
            ? `
        <div class="info-item" style="grid-column: 1 / -1;">
          <span class="info-label">Customer Notes / Message</span>
          <div class="message-box">${lead.message}</div>
        </div>
        `
            : ""
        }
      </div>
    </div>

    <!-- Action Card -->
    <div class="card">
      <div class="card-title">
        <svg style="width: 18px; height: 18px;" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Review & Action
      </div>

      <button id="approveBtn" class="btn btn-primary">
        Confirm Booking
      </button>

      <button id="rejectBtn" class="btn btn-outline">
        Cancel Lead
      </button>
    </div>

    <div class="footer-text">
      Secure Magic Link Panel • BookMyEvent
    </div>
  </div>

  <!-- Custom Confirmation Modal -->
  <div id="confirmModal" class="modal-overlay">
    <div class="modal-card">
      <p id="modalDescription">Are you sure you want to proceed?</p>
      <div class="modal-actions">
        <button id="modalCancelBtn" class="btn btn-secondary">Cancel</button>
        <button id="modalConfirmBtn" class="btn btn-primary">Confirm</button>
      </div>
    </div>
  </div>

  <script>
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');

    const confirmModal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');

    let modalResolve = null;

    function showConfirmModal(title, message, confirmText = 'Confirm', isDanger = false) {
      modalTitle.innerText = title;
      modalDescription.innerText = message;
      modalConfirmBtn.innerText = confirmText;
      modalCancelBtn.style.display = 'inline-flex';

      if (isDanger) {
        modalConfirmBtn.className = 'btn btn-primary';
        modalConfirmBtn.style.background = 'var(--color-error)';
      } else {
        modalConfirmBtn.className = 'btn btn-primary';
        modalConfirmBtn.style.background = 'var(--color-primary)';
      }

      confirmModal.classList.add('active');

      return new Promise((resolve) => {
        modalResolve = resolve;
      });
    }

    function showCustomAlert(title, message) {
      modalTitle.innerText = title;
      modalDescription.innerText = message;
      modalConfirmBtn.innerText = 'OK';
      modalConfirmBtn.className = 'btn btn-primary';
      modalConfirmBtn.style.background = 'var(--color-primary)';
      modalCancelBtn.style.display = 'none';

      confirmModal.classList.add('active');

      return new Promise((resolve) => {
        modalResolve = resolve;
      });
    }

    modalConfirmBtn.addEventListener('click', () => {
      confirmModal.classList.remove('active');
      if (modalResolve) modalResolve(true);
    });

    modalCancelBtn.addEventListener('click', () => {
      confirmModal.classList.remove('active');
      if (modalResolve) modalResolve(false);
    });

    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        confirmModal.classList.remove('active');
        if (modalResolve) modalResolve(false);
      }
    });

    approveBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmModal(
        'Confirm Booking',
        'Are you sure you want to accept this lead request and confirm the booking?',
        'Confirm Booking',
        false
      );
      if (!confirmed) {
        return;
      }

      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      approveBtn.innerText = 'Accepting Lead...';

      try {
        let cleanPath = window.location.pathname;
        while (cleanPath.endsWith('/')) {
          cleanPath = cleanPath.slice(0, -1);
        }
        const response = await fetch(cleanPath + '/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        const html = await response.text();
        document.open();
        document.write(html);
        document.close();
      } catch (err) {
        await showCustomAlert('Error', 'An error occurred during submission. Please try again.');
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        approveBtn.innerText = 'Confirm Booking';
      }
    });

    rejectBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmModal(
        'Cancel Lead',
        'Are you sure you want to reject/cancel this lead?',
        'Cancel Lead',
        true
      );
      if (!confirmed) {
        return;
      }

      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      rejectBtn.innerText = 'Cancelling Lead...';

      try {
        let cleanPath = window.location.pathname;
        while (cleanPath.endsWith('/')) {
          cleanPath = cleanPath.slice(0, -1);
        }
        const response = await fetch(cleanPath + '/reject', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        const html = await response.text();
        document.open();
        document.write(html);
        document.close();
      } catch (err) {
        await showCustomAlert('Error', 'An error occurred during rejection. Please try again.');
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        rejectBtn.innerText = 'Cancel Lead';
      }
    });
  </script>
</body>
</html>`;
}
