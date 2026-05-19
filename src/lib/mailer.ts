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
