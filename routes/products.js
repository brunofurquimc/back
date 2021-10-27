var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');

/**
 * Importa funções auxiliares da pasta helpers
 */
const { addProductsFromFile, validateAuth } = require('../helpers/utils');
const { validateUpdateFromFile } = require('../helpers/validate');

const productsExportsDir = '../../RelatoriosKyte/Products'
const path = require('path')

const Product = require('../models/product.js');

router.get('/getProducts', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  let products = await Product.find({}).lean();
  res.status(200).send({
    products,
  })
})

router.post('/addProduct', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado',
    })
    return;
  }
  let product = req.body.product
  console.log(product)
  let newProduct = new Product({
    _id: mongoose.Types.ObjectId(),
    ...product
  })

  let addProductCallback = function({error, id}) {
    if (error) {
      console.log(error)
      res.status(500).send({
        message: 'Erro no servidor, por favor tente novamente!',
        error: {
          message: error.message
        }
      })
    } else {
      res.status(200).send({
        message: 'Estabelecimento cadastrado com sucesso!',
        token: id,
      })
    }
  }

  newProduct.save((err) => {
    console.log(err)
    if (err !== null) addProductCallback({
      error: true,
      err,
    })
    else addProductCallback({
      error: false,
      id: newProduct._id
    })
  })
})

module.exports = router;
