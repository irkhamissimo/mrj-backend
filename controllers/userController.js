"use strict";
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
};

exports.register = async function (req, res) {
  try {
    const { username, password, email } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "nama, email, dan password tidak boleh kosong" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "username atau email sudah digunakan" });
    }

    const newUser = new User({
      username,
      email,
      password,
    });

    const savedUser = await newUser.save();
    const tokens = generateTokens(savedUser._id);

    res.status(201).json({
      ...tokens,
      user: {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "register gagal", error: error.message });
  }
};

exports.login = async function (req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email dan password tidak boleh kosong" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "user tidak ditemukan" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "username atau password salah" });
    }

    const tokens = generateTokens(user._id);

    res.json({
      ...tokens,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(400).json({ message: "Login error", error: error.message });
  }
};

exports.refreshToken = async function (req, res) {
  try {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token tidak ditemukan" });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User tidak ditemukan" });
    }

    const tokens = generateTokens(user._id);

    res.json({
      ...tokens,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};
