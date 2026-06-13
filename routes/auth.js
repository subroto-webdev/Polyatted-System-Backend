const express = require('express');
const router = express.Router();

const {
    login,
    getMe,
    register,
    registerPublic,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification
} = require('../controllers/authController');

const { protect, authorize } = require('../middleware/auth');

router.post('/login', login);
router.post('/register-public', registerPublic);
router.get('/me', protect, getMe);
router.post('/register', protect, authorize('admin'), register);
router.put('/change-password', protect, changePassword);

// Password Reset & Verification Routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

module.exports = router;