const nodemailer = require('nodemailer');

const requiredEmailConfig = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM_EMAIL'
];

let transporter;

const getMissingEmailConfig = () => {
  return requiredEmailConfig.filter((key) => !process.env[key]);
};

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const smtpFamily = process.env.SMTP_FAMILY ? parseInt(process.env.SMTP_FAMILY, 10) : undefined;
  
  const transporterConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    
    connectionTimeout: 10000,  
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // Retry settings
    maxConnections: 5,
    maxMessages: 100
  };

  
  if (smtpFamily === 4 || smtpFamily === 6) {
    transporterConfig.family = smtpFamily;
    console.log(`📧 SMTP using IPv${smtpFamily}`);
  }


  if (process.env.NODE_ENV !== 'production') {
    transporterConfig.debug = true;
    transporterConfig.logger = true;
  }

  transporter = nodemailer.createTransport(transporterConfig);

  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP Connection Error:', error.message);
      console.error('   Please check your email configuration in .env');
    } else {
      console.log('✅ SMTP Server ready to send emails');
    }
  });

  return transporter;
};

const getFromAddress = () => {
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'ACLMS';

  return `"${fromName}" <${fromEmail}>`;
};

const sendPasswordResetEmail = async ({ toEmail, toName, resetUrl, expiresInMinutes }) => {
  
  const missingConfig = getMissingEmailConfig();

  if (missingConfig.length > 0) {
    const error = new Error(`Missing email configuration: ${missingConfig.join(', ')}`);
    error.code = 'EMAIL_NOT_CONFIGURED';
    error.missingConfig = missingConfig;
    throw error;
  }

  if (!toEmail) {
    const error = new Error('Recipient email is required');
    error.code = 'MISSING_RECIPIENT';
    throw error;
  }

  if (!resetUrl) {
    const error = new Error('Reset URL is required');
    error.code = 'MISSING_RESET_URL';
    throw error;
  }

  const appName = process.env.APP_NAME || 'ACLMS';
  const recipient = toName ? `"${toName}" <${toEmail}>` : toEmail;
  const subject = `${appName} - Password Reset Request`;
  
  const text = [
    `Hello${toName ? ` ${toName}` : ''},`,
    '',
    'We received a request to reset your password for your ACLMS account.',
    '',
    `Use this link to set a new password: ${resetUrl}`,
    '',
    `This link will expire in ${expiresInMinutes} minutes.`,
    '',
    'If you did not request this password reset, please ignore this email.',
    '',
    'Best regards,',
    `The ${appName} Team`
  ].join('\n');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: #1d4ed8; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${appName}</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hello${toName ? ` ${toName}` : ''},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">We received a request to reset your password for your ${appName} account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a
              href="${resetUrl}"
              style="display: inline-block; padding: 12px 30px; background: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;"
            >
              Reset Password
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 12px; color: #6b7280; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">
            <a href="${resetUrl}" style="color: #1d4ed8;">${resetUrl}</a>
          </p>
          <p style="font-size: 14px; color: #ef4444; margin: 20px 0;">
            ⏰ This link will expire in ${expiresInMinutes} minutes.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #9ca3af; margin-bottom: 10px;">
            If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
          </p>
          <p style="font-size: 12px; color: #9ca3af;">
            Best regards,<br>
            The ${appName} Support Team
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
   
    const transporter = getTransporter();
    
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: recipient,
      subject: subject,
      text: text,
      html: html
    });

    console.log(`✅ Password reset email sent to ${toEmail}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   Message ID: ${info.messageId}`);
    }

    return info;
  } catch (error) {
    
    console.error('❌ Failed to send password reset email:');
    console.error(`   Recipient: ${toEmail}`);
    console.error(`   Error code: ${error.code || 'unknown'}`);
    console.error(`   Error message: ${error.message}`);
    
  
    if (error.code === 'ESOCKET' || error.code === 'ENETUNREACH') {
      console.error('   ⚠️ Network error detected. Check your SMTP configuration.');
      console.error('   Ensure SMTP_FAMILY=4 is set in .env to force IPv4.');
    } else if (error.code === 'EAUTH') {
      console.error('   ⚠️ Authentication failed. Check SMTP_USER and SMTP_PASS.');
      console.error('   For Gmail, use an App Password, not your regular password.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   ⚠️ Connection refused. Check SMTP_HOST and SMTP_PORT.');
    }
    
    throw error;
  }
};

const testEmailConfig = async () => {
  const missingConfig = getMissingEmailConfig();
  if (missingConfig.length > 0) {
    console.error('❌ Missing configuration:', missingConfig.join(', '));
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    return false;
  }
};

module.exports = {
  getMissingEmailConfig,
  sendPasswordResetEmail,
  testEmailConfig  
};