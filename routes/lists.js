var express = require('express');
var router = express.Router();

const User = require('../models/user')
const Product = require('../models/product')
const Status = require('../models/status')
const PaymentMethod = require('../models/payment_method')

const { validateAuth } = require('../helpers/utils')

router.get('/paymentMethods', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const paymentMethods = await PaymentMethod.find({}).lean();
  res.status(200).send({
    paymentMethods,
    message: 'Métodos de pagamento buscados com sucesso'
  })
  return;
})

router.get('/status', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const status = await Status.find({}).lean();
  console.log(status)
  res.status(200).send({
    status,
    message: 'Status das vendas buscados com sucesso'
  })
  return;
})


router.get('/users', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const { establishment_id } = await User.findOne({ _id: req.headers.authorization }).lean();

  let customers = await User.find({
    establishment_id,
    customer: true,
  }).lean()

  customers = customers.map(customer => {
    return {
      text: customer.name,
      value: customer._id
    }
  })

  console.log(customers)
  res.status(200).send({
    customers,
  })
})

router.get('/vendors', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const { establishment_id } = await User.findOne({ _id: req.headers.authorization }).lean();

  let vendors = await User.find({
    establishment_id,
    customer: {
      $ne: true
    },
    _id: {
      $ne: req.headers.authorization
    }
  }).lean()

  console.log(vendors)
  vendors = vendors.map(vendor => {
    return {
      text: vendor.name,
      value: vendor._id
    }
  })
  res.status(200).send({
    vendors,
  })
})

router.get('/products', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const { establishment_id } = await User.findOne({ _id: req.headers.authorization }).lean();

  const products = await Product.find({
    establishment_id,
  }).lean()

  console.log(products)
  res.status(200).send({
    products,
  })
})

module.exports = router;