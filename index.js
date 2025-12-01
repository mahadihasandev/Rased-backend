const express = require('express')
const app = express()
const port = 3000
const mongoose = require('mongoose')
const multer = require('multer')
const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')
const Product = require('./models/Product')
  const cors = require('cors');
  const productSchema=require("./models/Product")

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// MongoDB Connection
mongoose.connect('mongodb+srv://arnob1all_db_user:Trmaz3gmBbzwJhQR@cluster0.gdukj7w.mongodb.net/?appName=Cluster00')
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err))

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'))
    }
  }
})

// IMGBB API Key - Get your free API key from https://api.imgbb.com/
// You can also set this as an environment variable: process.env.IMGBB_API_KEY
const IMGBB_API_KEY = 'b8677abbae2ff97c1e283ac5225c6a02' // Replace with your API key

// Function to upload image to imgbb
async function uploadToImgbb(imagePath) {
  try {
    const formData = new FormData()
    formData.append('image', fs.createReadStream(imagePath))
    formData.append('key', IMGBB_API_KEY)

    const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
      headers: formData.getHeaders()
    })

    if (response.data.success) {
      return response.data.data.url
    } else {
      throw new Error('Image upload failed')
    }
  } catch (error) {
    console.error('Error uploading to imgbb:', error.message)
    throw error
  }
}

// POST endpoint to create a product with multiple images
app.post('/api/products', upload.array('images', 10), async (req, res) => {
  try {
    const { name, price } = req.body

    // Validation
    if (!name || !price) {
      return res.status(400).json({ 
        error: 'Product name and price are required' 
      })
    }

    if (isNaN(price) || parseFloat(price) < 0) {
      return res.status(400).json({ 
        error: 'Price must be a valid positive number' 
      })
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'At least one image is required' 
      })
    }

    // Upload images to imgbb
    const imageUrls = []
    const uploadedFiles = []

    for (const file of req.files) {
      try {
        const imageUrl = await uploadToImgbb(file.path)
        imageUrls.push(imageUrl)
        uploadedFiles.push(file.path)
      } catch (error) {
        // Clean up uploaded files on error
        uploadedFiles.forEach(filePath => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        })
        return res.status(500).json({ 
          error: 'Failed to upload images. Please check your IMGBB_API_KEY.' 
        })
      }
    }

    // Clean up local files after successful upload
    uploadedFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    })

    // Create product in database
    const product =await new productSchema({
      name: name.trim(),
      price: parseFloat(price),
      images: imageUrls
    })

    const savedProduct = await product.save()

    res.status(201).json({
      message: 'Product created successfully',
      product: savedProduct
    })

  } catch (error) {
    console.error('Error creating product:', error)
    
    // Clean up any remaining files
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      })
    }

    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
})

// GET endpoint to retrieve all products
app.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 })
    
    res.status(200).json({
      count: products.length,
      products: products
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
})

// DELETE endpoint to delete a product by ID
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        error: 'Invalid product ID format' 
      })
    }

    // Find and delete the product
    const product = await Product.findByIdAndDelete(id)

    if (!product) {
      return res.status(404).json({ 
        error: 'Product not found' 
      })
    }

    res.status(200).json({
      message: 'Product deleted successfully',
      product: product
    })

  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})