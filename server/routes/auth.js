const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// In-memory OTP rate limiter (max 3 requests per 15 minutes)
const otpRateLimits = new Map();
const checkOTPRateLimit = (identifier) => {
  const now = Date.now();
  const limitWindow = 15 * 60 * 1000;
  const maxRequests = 3;

  if (!otpRateLimits.has(identifier)) {
    otpRateLimits.set(identifier, [now]);
    return true;
  }

  const requests = otpRateLimits.get(identifier).filter(time => now - time < limitWindow);
  if (requests.length >= maxRequests) {
    return false;
  }

  requests.push(now);
  otpRateLimits.set(identifier, requests);
  return true;
};

// Helper: generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper: send email
const sendEmail = async (to, subject, text) => {
  // In dev mode without Gmail credentials, just log the OTP
  if (!process.env.GMAIL_USER || process.env.GMAIL_USER === 'your_gmail@gmail.com') {
    console.log(`[DEV MODE] Email to ${to}: ${subject} — ${text}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  await transporter.sendMail({ from: process.env.GMAIL_USER, to, subject, text });
};

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: 'Email already in use.' });

    const existingPhone = await User.findOne({ phoneNumber });
    if (existingPhone) return res.status(400).json({ message: 'Phone number already in use.' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ name, email, phoneNumber, passwordHash, role: 'student' });
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/login (password-based, email OR phone)
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier and password are required.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Use admin login for admin accounts.' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/otp/request
router.post('/otp/request', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Email or phone number is required.' });

    // Rate limit check
    if (!checkOTPRateLimit(identifier)) {
      return res.status(429).json({ message: 'Too many OTP requests. Please try again in 15 minutes.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    if (!user) return res.status(404).json({ message: 'No account found with that email or phone.' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Admin cannot use OTP login.' });

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    user.otp = { code: otpHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) }; // 10 min
    await user.save();

    await sendEmail(user.email, 'Your QuizApp OTP', `Your OTP is: ${otp}. It expires in 10 minutes.`);

    res.json({ message: 'OTP sent to your registered email.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) return res.status(400).json({ message: 'Identifier and OTP are required.' });

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
    }

    if (user.otp.expiresAt < new Date()) {
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp, user.otp.code);
    if (!isMatch) return res.status(400).json({ message: 'Invalid OTP.' });

    // Clear OTP
    user.otp = undefined;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/forgot-password/request
router.post('/forgot-password/request', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Email or phone number is required.' });

    // Rate limit check
    if (!checkOTPRateLimit(identifier)) {
      return res.status(429).json({ message: 'Too many OTP requests. Please try again in 15 minutes.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    const genericResponse = { message: 'If an account exists with this email or phone number, an OTP has been sent.' };

    if (!user) {
      return res.json(genericResponse);
    }
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot use this flow.' });
    }

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    user.otp = { code: otpHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) }; // 10 min
    await user.save();

    await sendEmail(user.email, 'Your QuizApp Password Reset OTP', `Your OTP to reset your password is: ${otp}. It expires in 10 minutes.`);

    res.json(genericResponse);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/forgot-password/verify
router.post('/forgot-password/verify', async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) return res.status(400).json({ message: 'Identifier and OTP are required.' });

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
    }

    if (user.otp.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp, user.otp.code);
    if (!isMatch) return res.status(400).json({ message: 'Invalid OTP.' });

    res.json({ message: 'OTP verified successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/forgot-password/verify-and-reset
router.post('/forgot-password/verify-and-reset', async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phoneNumber: identifier }]
    });

    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
    }

    if (user.otp.expiresAt < new Date()) {
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp, user.otp.code);
    if (!isMatch) return res.status(400).json({ message: 'Invalid OTP.' });

    // Hash new password and update user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = passwordHash;
    user.otp = undefined; // Invalidate OTP
    await user.save();

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
