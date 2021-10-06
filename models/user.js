var { mongoose, Schema } = require('../database/db');
const bcrypt = require('bcryptjs');

/**
 * Modelo de usuário (cliente e usuário do aplicativo)
 */

const UserSchema = new mongoose.Schema({
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
    email: String,
    name: String,
    phone: {
        area_code: String,
        number: String,
    },
    password: String,
    customer: Boolean,
    establishment_id: Schema.Types.ObjectId,
}, {
    collection: 'users', timestamps: {
        created_at: 'created_at'
    }
})

UserSchema.pre("save", function (next) {
    const user = this

    if (this.isModified("password") || this.isNew) {
        bcrypt.genSalt(10, function (saltError, salt) {
            if (saltError) {
                return next(saltError)
            } else {
                bcrypt.hash(user.password, salt, function (hashError, hash) {
                    if (hashError) {
                        return next(hashError)
                    }

                    user.password = hash
                    next()
                })
            }
        })
    } else {
        return next()
    }
})

const User = mongoose.model('User', UserSchema)

module.exports = User;