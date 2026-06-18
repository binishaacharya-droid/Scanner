/*
  Product Barcode Scanner Backend
  --------------------------------
  What this server does:
  1. Serves index.html at http://localhost:3000
  2. Receives a barcode at /lookup/:barcode
  3. Searches product databases
  4. Sends product name/brand/category/image back to the browser
*/

const path = require("path");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Home page: http://localhost:3000
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

function cleanText(value, fallback = "Unknown") {
  if (!value) return fallback;
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || fallback;
  return String(value).trim() || fallback;
}

function notFoundProduct(barcode) {
  return {
    found: false,
    code: barcode,
    name: barcode,
    brand: "Unknown",
    category: "Unknown",
    image: "",
    source: "Not found"
  };
}

// Product lookup route: http://localhost:3000/lookup/737628064502
app.get("/lookup/:barcode", async (req, res) => {
  const barcode = String(req.params.barcode || "").replace(/\D/g, "");

  if (!barcode) {
    return res.status(400).json({
      found: false,
      error: "Invalid barcode",
      ...notFoundProduct("")
    });
  }

  // 1. Try Open Food Facts first. Good for grocery/food products.
  try {
    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
    const off = await axios.get(offUrl, { timeout: 8000 });

    if (off.data && off.data.status === 1 && off.data.product) {
      const p = off.data.product;

      return res.json({
        found: true,
        code: barcode,
        name: cleanText(p.product_name || p.product_name_en, barcode),
        brand: cleanText(p.brands),
        category: cleanText(p.categories),
        image: cleanText(p.image_front_url || p.image_url, ""),
        source: "Open Food Facts"
      });
    }
  } catch (error) {
    console.log("Open Food Facts lookup failed:", error.message);
  }

  // 2. Try UPCitemDB trial API. It may find more non-food products.
  try {
    const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`;
    const upc = await axios.get(upcUrl, { timeout: 8000 });

    if (upc.data && Array.isArray(upc.data.items) && upc.data.items.length > 0) {
      const p = upc.data.items[0];

      return res.json({
        found: true,
        code: barcode,
        name: cleanText(p.title, barcode),
        brand: cleanText(p.brand),
        category: cleanText(p.category),
        image: Array.isArray(p.images) && p.images.length ? p.images[0] : "",
        source: "UPCitemDB"
      });
    }
  } catch (error) {
    console.log("UPCitemDB lookup failed:", error.message);
  }

  // 3. If neither source finds it, return the barcode so user can manually rename it.
  return res.json(notFoundProduct(barcode));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
