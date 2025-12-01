// index.js (root) - Vercel Serverless Compatible

const express = require('express')
const serverless = require('serverless-http')
const mongoose = require('mongoose')
const multer = require('multer')
const axios = require('axios')
const FormData = require('form-data')
const cors = require('cors')
const Product = require('./models/Product')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ---------- DB CONNECTION (REQUIRED FOR VERCEL) ----------
let cached = global.mongoose
async function connectDB() {
  if (cached) return cached

  cached = await mongoose.connect(process.env.MONGODB_URI || "YOUR_MONGO_URL")
  return cached
}

// ---------- MULTER MEMORY STORAGE ----------
const upload = multer({
  storage: multer.memoryStorage()
})

// ---------- UPLOAD IMAGE TO IMGBB ----------
async function uploadToImgbb(buffer) {
  const form = new FormData()
  form.append("key", process.env.IMGBB_API_KEY)
  form.append("image", buffer.toString("base64"))

  const res = await axios.post("https://api.imgbb.com/1/upload", form, {
    headers: form.getHeaders()
  })

  return res.data.data.url
}

// ---------- CREATE PRODUCT ----------
app.post('/api/products', upload.array("images", 10), async (req, res) => {
  try {
    await connectDB()

    const urls = []

    for (const file of req.files) {
      const url = await uploadToImgbb(file.buffer)
      urls.push(url)
    }

    const product = await Product.create({
      name: req.body.name,
      price: req.body.price,
      images: urls
    })

    res.json({ message: "Created", product })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------- GET ALL PRODUCTS ----------
app.get('/', async (req, res) => {
  try {
    await connectDB()
    const products = await Product.find().sort({ createdAt: -1 })
    res.json(products)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------- DELETE PRODUCT ----------
app.delete('/api/products/:id', async (req, res) => {
  try {
    await connectDB()

    const deleted = await Product.findByIdAndDelete(req.params.id)

    if (!deleted) return res.status(404).json({ error: "Not found" })

    res.json({ message: "Deleted", product: deleted })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------- EXPORT SERVERLESS HANDLER ----------
module.exports = serverless(app)
