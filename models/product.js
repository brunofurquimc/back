const { Schema } = require('mongoose');
var { mongoose } = require('../database/db');

/**
 * Modelo de produto vendido através do aplicativo
 */
const Product = mongoose.model('Product', Schema({
  _id: Schema.Types.ObjectId,
  name: String,
  value: Number,
  cost: Number,
  category: String,
  code: String,
  establishment_id: Schema.Types.ObjectId,
}, { collection: 'products' }))

module.exports = Product;