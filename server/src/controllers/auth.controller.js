import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../middleware/auth.middleware.js';

const generateToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), { expiresIn: '7d' });

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'All fields required' } });
    if (String(username).trim().length < 3)
      return res.status(400).json({ success: false, error: { code: 'INVALID_USERNAME', message: 'Username must be at least 3 characters' } });
    if (String(password).length < 6)
      return res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters' } });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists)
      return res.status(409).json({ success: false, error: { code: 'USER_EXISTS', message: 'Username or email already taken' } });

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);
    res.status(201).json({ success: true, data: { user: user.toPublic(), token } });
  } catch (err) { next(err); }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password required' } });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });

    const token = generateToken(user._id);
    res.json({ success: true, data: { user: user.toPublic(), token } });
  } catch (err) { next(err); }
};

export const getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user.toPublic() } });
};
