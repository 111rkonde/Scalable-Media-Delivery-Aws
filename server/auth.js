const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Simple in-memory user store (in production, use a database)
const users = new Map();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

class Auth {
  // Hash password
  static hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Generate JWT token
  static generateToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Register new user
  static register(username, email, password) {
    // Check if user already exists
    for (let [id, user] of users.entries()) {
      if (user.email === email || user.username === username) {
        return { success: false, message: 'User already exists' };
      }
    }

    // Create new user
    const userId = crypto.randomUUID();
    const hashedPassword = this.hashPassword(password);
    
    const newUser = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.set(userId, newUser);
    
    return { 
      success: true, 
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    };
  }

  // Login user
  static login(email, password) {
    const hashedPassword = this.hashPassword(password);
    
    for (let [id, user] of users.entries()) {
      if (user.email === email && user.password === hashedPassword) {
        const token = this.generateToken(user);
        return {
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
          }
        };
      }
    }
    
    return { success: false, message: 'Invalid credentials' };
  }

  // Get user by ID
  static getUserById(userId) {
    const user = users.get(userId);
    if (user) {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      };
    }
    return null;
  }

  // Middleware to protect routes
  static authenticate(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = this.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = decoded;
    next();
  }

  // Get all users (for admin purposes)
  static getAllUsers() {
    const userList = [];
    for (let [id, user] of users.entries()) {
      userList.push({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      });
    }
    return userList;
  }
}

module.exports = Auth;
