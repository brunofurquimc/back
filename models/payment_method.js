const { Schema } = require('mongoose');
var { mongoose } = require('../database/db');

/**
 * Modelo de método de pagamento
 */
const PaymentMethod = mongoose.model('PaymentMethod', Schema({
  _id: Schema.Types.ObjectId,
  name: String,
}, { collection: 'payment_methods' }))

module.exports = PaymentMethod;