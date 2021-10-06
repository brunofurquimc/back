var { mongoose, Schema } = require('../database/db');

/**
 * Modelo de estabelecimento
 */

const EstablishmentSchema = new mongoose.Schema({
    _id: Schema.Types.ObjectId,
    address: {
        zip_code: String,
        street: String,
        district: String,
        complement: String,
        city: String,
        state: String,
        number: Number,
    },
    name: String,
    phone: {
        area_code: String,
        number: String,
    },
}, {
    collection: 'establishments', timestamps: {
        created_at: 'created_at'
    }
})

const Establishment = mongoose.model('Establishment', EstablishmentSchema)

module.exports = Establishment;