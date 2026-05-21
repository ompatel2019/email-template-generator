import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendNotificationEmail({
  campaignName,
  campaignAdminUrl,
  submissionType,
}: {
  campaignName: string;
  campaignAdminUrl: string;
  submissionType: "from lines" | "subject lines" | "email body" | "full email";
}) {
  const recipients = (process.env.NOTIFY_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) return;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipients.join(", "),
    subject: `New Suggestion Submitted on ${campaignName}`,
    html: `
      <p>Hello,</p>
      <p>Someone submitted new ${submissionType} for the <strong>${campaignName}</strong> campaign.</p>
      <p>
        <a href="${campaignAdminUrl}" style="display:inline-block;padding:10px 20px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
          Take a look
        </a>
      </p>
      <p>Thanks!</p>
      <p style="color:#888;font-size:12px;">Email Template Generator · goodlabgroup.com</p>
    `,
  });
}

export async function sendSubmissionReviewNotification({
  recipients,
  campaignName,
  status,
  rejectionReason,
  submission,
}: {
  recipients: { email: string; name: string }[];
  campaignName: string;
  status: "accepted" | "rejected";
  rejectionReason?: string;
  submission: { fromLine?: string; subjectLine?: string; body?: string };
}) {
  if (recipients.length === 0) return;

  const statusLabel = status === "accepted" ? "Accepted" : "Rejected";
  const statusColor = status === "accepted" ? "#2e7d32" : "#c62828";

  const submissionDetails = [
    submission.fromLine ? `<p><strong>From:</strong> ${submission.fromLine}</p>` : "",
    submission.subjectLine ? `<p><strong>Subject Line:</strong> ${submission.subjectLine}</p>` : "",
    submission.body
      ? `<p><strong>Body:</strong></p><pre style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:13px;">${submission.body}</pre>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const rejectionBlock =
    status === "rejected" && rejectionReason
      ? `<p><strong>Reason:</strong> ${rejectionReason}</p>`
      : "";

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipients.map((r) => r.email).join(", "),
    subject: `Submission ${statusLabel} — ${campaignName}`,
    html: `
      <p>Hello,</p>
      <p>A submission for <strong>${campaignName}</strong> has been <span style="color:${statusColor};font-weight:bold;">${statusLabel.toLowerCase()}</span>.</p>
      ${rejectionBlock}
      <div style="margin:16px 0;padding:16px;border:1px solid #e0e0e0;border-radius:8px;">
        ${submissionDetails || "<p><em>No content details available.</em></p>"}
      </div>
      <p>Thanks!</p>
      <p style="color:#888;font-size:12px;">Email Template Generator · goodlabgroup.com</p>
    `,
  });
}
