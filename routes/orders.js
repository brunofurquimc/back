var express = require('express');
var router = express.Router();

/**
 * Importa funções auxiliares da pasta helpers
 */
const { addOrdersFromFile, validateAuth, formatOrders } = require('../helpers/utils');
const { validateUpdateFromFile } = require('../helpers/validate');

const ordersExportsDir = '../../RelatoriosKyte/Sales'
const path = require('path')
const mongoose = require('mongoose')

const Order = require('../models/order.js');
const Status = require('../models/status.js');
const User = require('../models/user.js');
const PaymentMethod = require('../models/payment_method.js')

router.post('/filter', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const { customer, vendor, date, status } = req.body;

  let query = {
    user_id: customer,
    vendor_id: vendor,
    status,
  }

  let startDate = `${date[0]}T00:00:00`
  let endDate = `${date[1]}T23:59:59`

  if (date !== undefined && date.length !== 0) {
    query.order_date = {
      $gte: startDate,
      $lte: endDate
    }
  }
  if (customer === undefined || customer === "") delete query.user_id
  if (vendor === undefined || vendor === '') delete query.vendor_id
  if (status === undefined || status === '') delete query.status

  const orders = await Order.find(query).lean()

  for (const order of orders) {
    const client = await User.findOne({ _id: order.user_id }).lean();

    delete client._id;
    delete client.__v;
    delete client.password;
    delete client.customer;
    delete client.createdAt;
    delete client.updatedAt;

    order.client = client;

    const payment_method = await PaymentMethod.findOne({ _id: order.payment_method_id }).lean();
    order.payment_method = payment_method.name;
  }
  console.log(orders)
  res.status(200).send({
    orders,
  })
})

router.post('/editStatus', async function(req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const order = await Order.findOne({
    _id: req.body.id
  })

  order.status = req.body.status
  await order.save(async err => {
    if (err) {
      res.status(400).send({
        message: 'Não foi possível alterar o status',
        error: err,
      })
    } else {
      res.status(200).send({
        message: 'Status alterado com sucesso',
        order,
      })
    }
  })
})

router.post('/add', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const newOrder = new Order({
    _id: mongoose.Types.ObjectId(),
    ...req.body,
  })

  await newOrder.save(async err => {
    if (err) {
      res.status(400).send({
        message: 'Não foi possível cadastrar a venda',
        error: err,
      })
    } else {
      res.status(200).send({
        message: 'Venda cadastrada com sucesso',
        order: newOrder
      })
    }
  })
  return;
})

router.get('/establishment', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  if (req.query.establishment === undefined) {
    res.status(400).send({
      error: true,
      message: 'Estabelecimento deve ser informado na consulta de vendas',
    })
    return;
  }
  const customer_id = req.query.customer
  const establishment_id = req.query.establishment
  let orders
  if (customer_id === undefined) {
    // pesquisar vendas do estabelecimento sem cliente
    orders = await Order.find({ establishment_id })
  } else {
    // pesquisar vendas do estabelecimento com cliente
    orders = await Order.find({ establishment_id, user_id: customer_id })
  }
  orders = await formatOrders(orders)
  res.status(200).send({
    message: 'Vendas encontradas',
    orders,
  })
})

/**
 * Requisição para atualizar a base de dados dos pedidos realizados pelo aplicativo
 * 
 * Recebe no corpo da requisição duas datas (start_date e end_date)
 */
router.post('/addOrdersFromFile', async function (req, res, next) {
  const validate = validateUpdateFromFile(req.body);
  if (validate.success) {
    const fileName = getFileName(req.body, 'Sales');
    const filePath = path.resolve(__dirname, `${ordersExportsDir}/${fileName}`)
    const exists = fileExists(filePath);

    if (exists.exists) {
      readFile(filePath, (json) => {
        addOrdersFromFile(json);
        res.status(200).send({
          message: `Arquivo lido com sucesso (${fileName})`,
          json
        })
      })
    } else {
      res.status(400).send({
        message: 'Não existe um arquivo para as datas informadas',
        error: exists.error,
      })
    }
  } else {
    res.status(400).send({
      message: 'Payload inválido',
      errors: validate.errors.errors
    })
  }
  return;
})
module.exports = router;
