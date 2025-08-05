const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

const saltRounds = 10;

// ✅ Email transporter using App Password (Not your Gmail login password)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,           // SSL port
  secure: true,        // Use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

                                                                                                                                                                                                                                                                                    

// ✅ Check if transporter is working
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ Email transporter error:', error);
  } else {
    console.log('✅ Email transporter is ready');
  }
});

// GET: Render login page
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if it's admin credentials (from .env)
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(
        { email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      res.cookie('jwt', token, { httpOnly: true });
      return res.redirect('/admin/dashboard');
    }

    // 2. If not admin, check regular users from the database
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) return res.render('login', { message: 'Invalid credentials!' });

    if (!user.is_verified) {
      return res.render('login', { message: 'Please verify your email first.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { message: 'Invalid credentials!' });

    // Debug: Log user information
    console.log('🔍 Login Debug Info:');
    console.log('User ID:', user.id);
    console.log('User Email:', user.email);
    console.log('Is Admin:', user.is_admin);
    console.log('Is Verified:', user.is_verified);

    // Determine user role based on is_admin field
    const userRole = user.is_admin ? 'admin' : 'user';
    console.log('Determined Role:', userRole);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('jwt', token, { httpOnly: true });

    // Redirect based on role
    if (user.is_admin) {
      console.log('🔄 Redirecting to admin dashboard...');
      return res.redirect('/admin/dashboard');
    } else {
      console.log('🔄 Redirecting to user dashboard...');
      return res.redirect('/user/dashboard');
    }

  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { message: 'Error during login.' });
  }
};

// GET: Login form
exports.getLogin = (req, res) => {
  const message = req.query.reset === 'success' 
    ? 'Password has been reset successfully. Please login with your new password.'
    : null;
  res.render('login', { message });
};

// GET: Render signup form
exports.getSignup = (req, res) => {
  res.render('signup', { message: null });
};

// Helper function to get base URL
const getBaseUrl = (req) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  console.log('Base URL:', baseUrl);
  return baseUrl;
};

// POST: Handle signup
exports.postSignup = async (req, res) => {
  const { name, email, password, confirmPassword, role } = req.body;

  try {
    // Basic validation
    if (!name || !email || !password || !role) {
      return res.render('signup', { 
        message: 'All fields are required',
        oldInput: { name, email, role }
      });
    }

    if (password !== confirmPassword) {
      return res.render('signup', {
        message: 'Passwords do not match',
        oldInput: { name, email, role }
      });
    }

    // Validate role
    if (role !== 'user' && role !== 'admin') {
      return res.render('signup', {
        message: 'Please select a valid account type',
        oldInput: { name, email, role }
      });
    }

    // Check if user already exists
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser) {
      return res.render('signup', { 
        message: 'Email already registered!',
        oldInput: { name, role }
      });
    }

    // Hash password and create verification token
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

    // Set is_admin based on role selection
    const isAdmin = role === 'admin';

    // Create new user
    await db.none(
      'INSERT INTO users (name, email, password, is_admin, verification_token) VALUES ($1, $2, $3, $4, $5)',
      [name, email, hashedPassword, isAdmin, verificationToken]
    );

    // Generate verification link
    const baseUrl = getBaseUrl(req);
    const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;
    console.log('Generated verification link:', verificationLink);

    // Send verification email
    await transporter.sendMail({
      from: `"NumkhorDruk" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a237e;">Verify Your Email</h2>
          <p>Hello ${name},</p>
          <p>Thank you for signing up as a ${role}! Please verify your email by clicking the button below:</p>
          <a href="${verificationLink}" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #1a237e;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          ">Verify Email</a>
          <p>If you can't click the button, copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #1a237e;">${verificationLink}</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
        </div>
      `
    });

    // Redirect to login with success message
    res.redirect('/login?signup=success');
  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', { 
      message: 'Error during signup. Please try again.',
      oldInput: { name, email, role }
    });
  }
};

// GET: Verify email
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    await db.none('UPDATE users SET is_verified = true, verification_token = NULL WHERE email = $1', [email]);

    res.send('✅ Email verified successfully. You can now log in.');
  } catch (error) {
    console.error(error);
    res.send('❌ Invalid or expired verification link.');
  }
};

// GET: Forgot password form
exports.getForgotPassword = (req, res) => {
  const data = {
    error: null,
    success: null,
    message: null,
    title: 'Forgot Password - NumkhorDruk'
  };
  res.render('forgot-password', data);
};

// POST: Forgot password logic
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);

    if (!user) {
      return res.render('forgot-password', {
        error: 'Email not found',
        success: null
      });
    }

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });
    await db.none('UPDATE users SET reset_token = $1 WHERE email = $2', [resetToken, email]);

    // Generate reset link
    const baseUrl = getBaseUrl(req);
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    console.log('Generated reset link:', resetLink);

    await transporter.sendMail({
      from: `"NumkhorDruk" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a237e;">Reset Your Password</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${resetLink}" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #1a237e;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          ">Reset Password</a>
          <p>If you can't click the button, copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #1a237e;">${resetLink}</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
        </div>
      `
    });

    return res.render('forgot-password', {
      success: 'Password reset link has been sent to your email.',
      error: null
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.render('forgot-password', {
      error: 'Something went wrong. Please try again.',
      success: null
    });
  }
};

// GET: Reset password form
exports.getResetPassword = (req, res) => {
  const { token } = req.query;
  res.render('reset-password', { token, message: null });
};

// POST: Reset password logic
exports.resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  try {
    // Validate password match
    if (newPassword !== confirmPassword) {
      return res.render('reset-password', { 
        token,
        message: 'Passwords do not match'
      });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.render('reset-password', {
        token,
        message: 'Password must be at least 6 characters long'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1 AND reset_token = $2', [email, token]);
    if (!user) {
      return res.render('reset-password', { 
        token,
        message: 'Invalid or expired reset token'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await db.none('UPDATE users SET password = $1, reset_token = NULL WHERE email = $2', [hashedPassword, email]);

    // Redirect to login with success message
    res.redirect('/auth/login?reset=success');
  } catch (error) {
    console.error('Reset password error:', error);
    res.render('reset-password', { 
      token,
      message: 'Invalid or expired reset token'
    });
  }
};
