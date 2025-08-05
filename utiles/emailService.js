const nodemailer = require("nodemailer");
require('dotenv').config();

let transporter;

try {
  // Check if email credentials are provided
  const emailUser = process.env.EMAIL_USER || "your_email@gmail.com";
  const emailPass = process.env.EMAIL_PASS || "your_app_password_here";
  
  if (emailUser === "your_email@gmail.com" || emailPass === "your_app_password_here" || 
      emailUser === "your-email@gmail.com" || emailPass === "your-app-password") {
    // Create a mock transporter for development
    transporter = {
      sendMail: (options) => {
        console.log('📧 Mock email sent:', options);
        return Promise.resolve({ messageId: 'mock-message-id' });
      }
    };
    console.log('⚠️  Using mock email service for development');
  } else {
    // Create real transporter
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
    
    // Test the connection
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email authentication failed:', error.message);
        console.log('⚠️  Falling back to mock email service');
        // Replace with mock transporter
        transporter = {
          sendMail: (options) => {
            console.log('📧 Mock email sent:', options);
            return Promise.resolve({ messageId: 'mock-message-id' });
          }
        };
      } else {
        console.log('✅ Email service configured successfully');
      }
    });
  }
} catch (error) {
  console.error('❌ Email transporter error:', error.message);
  // Create mock transporter as fallback
  transporter = {
    sendMail: (options) => {
      console.log('📧 Mock email sent:', options);
      return Promise.resolve({ messageId: 'mock-message-id' });
    }
  };
  console.log('⚠️  Using mock email service due to configuration error');
}

module.exports = transporter;