const { Schema } = require('mongoose');
var { mongoose } = require('../database/db');

/**
 * Modelo de pedido realizado através do whatsapp
 */
const Order = mongoose.model('Order', Schema({
  _id: Schema.Types.ObjectId,
  products: [
    {
      _id: false,
      id: Schema.Types.ObjectId,
      quantity: Number,
    }
  ],
  value: Number,
  order_date: Date,
  payment_method_id: Schema.Types.ObjectId,
  user_id: Schema.Types.ObjectId,
  establishment_id: Schema.Types.ObjectId,
  vendor_id: Schema.Types.ObjectId,
  status: Schema.Types.ObjectId
}, { collection: 'orders' }))

module.exports = Order;