const { Schema } = require('mongoose');
var { mongoose } = require('../database/db');

/**
 * Modelo de status de uma venda
 */
const Status = mongoose.model('Status', Schema({
  _id: Schema.Types.ObjectId,
  value: String,
}, { collection: 'status' }))

module.exports = Status;