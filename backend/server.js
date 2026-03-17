require('dotenv').config()

const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("DB Error:", err))

const Key = mongoose.model("Key", {
  key: String,
  plan: String,
  days: Number,
  createdAt: { type: Date, default: Date.now }
})

const User = mongoose.model("User", {
  key: String,
  username: String,
  currency: { type: String, default: "USD" },
  tokens: Array,
  transactions: Array,
  balance: { type: Number, default: 0 }
})

app.post("/login", async (req, res) => {
  const { key } = req.body
  const found = await Key.findOne({ key })
  if (!found) return res.json({ success: false, message: "Invalid key" })

  if (found.plan !== "lifetime") {
    const expiry = new Date(found.createdAt)
    expiry.setDate(expiry.getDate() + found.days)
    if (new Date() > expiry) {
      return res.json({ success: false, message: "Key expired" })
    }
  }

  let user = await User.findOne({ key })
  if (!user) {
    user = await User.create({
      key,
      username: "My Wallet",
      tokens: [
        { symbol: "SOL", amount: 10 },
        { symbol: "BTC", amount: 1 }
      ],
      transactions: []
    })
  }

  const expiryDate = found.plan === "lifetime" ? null : (() => {
    const d = new Date(found.createdAt)
    d.setDate(d.getDate() + found.days)
    return d
  })()

  res.json({
    success: true,
    user,
    plan: found.plan,
    days: found.days,
    createdAt: found.createdAt,
    expiryDate
  })
})

app.post("/update", async (req, res) => {
  const { key, tokens, transactions, username, balance } = req.body
  await User.updateOne({ key }, { tokens, transactions, username, balance })
  res.json({ success: true })
})

app.post("/admin/keys", async (req, res) => {
  const { secret } = req.body
  if (secret !== process.env.ADMIN_SECRET) return res.json({ success: false, message: "Wrong secret" })

  const keys = await Key.find()
  const users = await User.find()

  const result = keys.map(k => {
    const user = users.find(u => u.key === k.key)
    let status = "active"
    let expiryDate = null

    if (k.plan !== "lifetime") {
      const expiry = new Date(k.createdAt)
      expiry.setDate(expiry.getDate() + k.days)
      expiryDate = expiry
      if (new Date() > expiry) status = "expired"
    }

    return {
      key: k.key,
      plan: k.plan,
      days: k.days,
      status,
      expiryDate,
      createdAt: k.createdAt,
      username: user?.username || "Never logged in"
    }
  })

  res.json({ success: true, keys: result })
})

app.post("/admin/delete", async (req, res) => {
  const { secret, key } = req.body
  if (secret !== process.env.ADMIN_SECRET) return res.json({ success: false, message: "Wrong secret" })
  await Key.deleteOne({ key })
  await User.deleteOne({ key })
  res.json({ success: true })
})

module.exports = app