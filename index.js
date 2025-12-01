const express = require('express')
const app = express()
const port = 3000
const mongoose = require('mongoose')
const multer = require('multer')
const axios = require('axios')
const FormData = require('form-data')
const Product = require('./models/Product')
const cors = require('cors')

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// MongoDB Connection
mongoose.connect('mongodb+srv://arnob1all_db_user:Trmaz3gmBbzwJhQR@cluster0.gdukj7w.mongodb.net/?appName=Cluster00')
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err))

// ⭐ Multer memory storage (Vercel compatible)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(file.originalname.toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) cb(null, true)
    else cb(new Error("Only image files allowed"))
  }
})

const IMGBB_API_KEY = "b8677abbae2ff97c1e283ac5225c6a02"

// ⭐ Upload buffer directly to IMGBB (no disk usage)
async function uploadToImgbbBuffer(buffer) {
  try {
    const formData = new FormData()
    formData.append("image", buffer.toString("base64"))
    formData.append("key", IMGBB_API_KEY)

    const response = await axios.post(
      "https://api.imgbb.com/1/upload",
      formData,
      { headers: formData.getHeaders() }
    )

    if (response.data.success) return response.data.data.url
    else throw new Error("IMGBB upload failed")
  } catch (err) {
    console.log("Error uploading:", err.message)
    throw err
  }
}

// ⭐ Create Product
app.post('/api/products', upload.array("images", 10), async (req, res) => {
  try {
    const { name, price } = req.body

    if (!name || !price)
      return res.status(400).json({ error: "Name & price required" })

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "At least one image required" })

    const imageUrls = []

    // Upload each file buffer to imgbb
    for (const file of req.files) {
      const url = await uploadToImgbbBuffer(file.buffer)
      imageUrls.push(url)
    }

    // Save product
    const product = new Product({
      name: name.trim(),
      price: parseFloat(price),
      images: imageUrls
    })

    const saved = await product.save()

    res.status(201).json({
      message: "Product created successfully",
      product: saved
    })

  } catch (err) {
    console.log(err)
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    })
  }
})

// ⭐ Get all products
app.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 })
    res.json({ count: products.length, products })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ⭐ Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params

    const product = await Product.findByIdAndDelete(id)

    if (!product)
      return res.status(404).json({ error: "Product not found" })

    res.json({ message: "Deleted successfully", product })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(port, () => console.log(`Server running on ${port}`))
