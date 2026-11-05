"use strict";
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ id: userId, jti: crypto.randomUUID() }, process.env.REFRESH_TOKEN_SECRET);
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
    savedUser.refreshTokenHashes.push(hashToken(tokens.refreshToken));
    await savedUser.save();

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
    await User.updateOne({ _id: user._id }, { $push: { refreshTokenHashes: hashToken(tokens.refreshToken) } });

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

    // Previously issued refresh tokens expire after seven days. Continue to
    // accept them while their hash is still present, until the user logs out.
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, { ignoreExpiration: true });
    const user = await User.findById(decoded.id).select("+refreshTokenHash +refreshTokenHashes");

    const tokenHash = hashToken(refreshToken);
    if (!user || (user.refreshTokenHash !== tokenHash && !user.refreshTokenHashes.includes(tokenHash))) {
      return res.status(401).json({ message: "User tidak ditemukan" });
    }

    const tokens = { accessToken: generateTokens(user._id).accessToken, refreshToken };

    res.json({
      ...tokens,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    return res.status(500).json({ message: "Unable to refresh session" });
  }
};

exports.logout = async function (req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, { ignoreExpiration: true });
        await User.updateOne(
          { _id: decoded.id },
          { $pull: { refreshTokenHashes: hashToken(refreshToken) } }
        );
        await User.updateOne(
          { _id: decoded.id, refreshTokenHash: hashToken(refreshToken) },
          { $unset: { refreshTokenHash: 1 } }
        );
      } catch (_) {
        // Logout remains idempotent when the supplied token is stale or invalid.
      }
    }
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ message: "Logout error", error: error.message });
  }
};
