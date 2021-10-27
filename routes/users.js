var express = require('express');
var router = express.Router();

const { isEqual } = require('lodash');
const path = require('path')


/**
 * Importa funções auxiliares da pasta helpers
 */
const { findUser, signUp, signIn, updateUsers, validateAuth } = require('../helpers/utils');
const { validateSignUp, validateSignIn, validateUpdateFromFile } = require('../helpers/validate');

const User = require('../models/user.js');
const Establishment = require('../models/establishment.js');

router.post('/deleteVendor', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const { id } = req.body
  try {
    const vendor = await User.findOneAndDelete({ _id: id })
    res.status(200).send({
      error: null,
      message: 'Vendedor deletado com sucesso!',
      vendor,
    })
  } catch (error) {
    res.status(500).send({
      error,
      message: 'Não foi possível deletar o vendedor'
    })
  }
  return;
})

router.post('/editVendor', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const payload = req.body;
  try {
    const vendor = await User.findOneAndUpdate({ _id: payload.id }, payload);
    res.status(200).send({
      error: null,
      message: 'Edição realizada com sucesso!',
      vendor
    })
  } catch (error) {
    res.status(500).send({
      error,
      message: 'Não foi possível realizar a edição do vendedor'
    })
  }
  return;
})

router.get('/vendor', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  console.log(req.query)
  if (req.query.vendor === undefined || req.query.vendor === null) {
    res.status(400).send({
      error: true,
      message: 'Vendedor não especificado'
    })
    return;
  }
  let vendor = await User.findOne({ _id: req.query.vendor })

  vendor = {
    address: vendor.address,
    email: vendor.email,
    name: vendor.name,
    phone: vendor.phone,
  }
  res.status(200).send({
    vendor
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
  if (req.query.establishment === undefined || req.query.establishment === null) {
    res.status(400).send({
      error: true,
      message: 'Estabelecimento não especificado'
    })
    return;
  }
  const token = req.headers.authorization;

  let vendors = await User.find({ establishment_id: req.query.establishment, _id: { $ne: token } });
  vendors = vendors.map(vendor => {
    return {
      id: vendor._id,
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email,
    }
  })
  res.status(200).send({
    vendors,
  });
})

router.post('/editCustomer', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }
  const payload = req.body;
  try {
    const customer = await User.findOneAndUpdate({ _id: payload.id }, payload);
    res.status(200).send({
      error: null,
      message: 'Edição realizada com sucesso!',
      customer,
    })
  } catch (error) {
    res.status(500).send({
      error,
      message: 'Não foi possível realizar a edição do cliente'
    })
  }
  return;
})

router.get('/customer', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
    })
    return;
  }

  if (req.query.customer === undefined || req.query.customer === null) {
    res.status(400).send({
      error: true,
      message: 'Cliente não especificado'
    })
    return;
  }

  let customer = await User.findOne({ _id: req.query.customer })
  
  customer = {
    address: customer.address,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
  }
  res.status(200).send({
    customer
  })
})

router.get('/customers', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado',
    })
    return;
  }
  if (req.query.establishment === undefined || req.query.establishment === null) {
    res.status(400).send({
      error: true,
      message: 'Estabelecimento não especificado'
    })
    return;
  }
  
  let customers = await User.find({ establishment_id: req.query.establisment, customer: true });
  customers = customers.map(customer => {
    return {
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    }
  })
  res.status(200).send({
    customers,
  })
})

/**
 * Requisição para acessar os usuários cadastrados na base de dados
 * 
 * Recebe na url uma query string contendo os campos pelos quais irá filtrar a base (condições da query)
 */
router.get('/', async function (req, res, next) {
  // Caso query esteja vazia, retorna todos os usuários
  if (isEqual(req.query, {})) {
    const all = await User.find();
    const users = {
      users: all,
      size: all.length,
    }
    res.send(users);
  } else {
    // Caso a query tenha campos, é utilizada para filtrar o resultado da consulta
    const user = await findUser(req.query);
    if (typeof user != 'undefined' && user.length != 0) res.send(user);
    else {
      res.status(404).send({
        message: 'Usuário não encontrado',
      })
    }
  }
  return;
});

router.post('/signin', async function (req, res, next) {
  const validate = validateSignIn(req.body);

  if (!validate.success) {
    res.status(400).send({
      message: 'Credenciais inválidas',
      errors: validate.errors.errors,
    })
  } else {
    await signIn(req.body, ({ error, exists, message, id, establishment, name }) => {
      if (error) {
        // tratar erro => se ja tiver cadastrado, falar que a senha esta incorreta
        // se nao estiver cadastrado, falar que nao esta cadastrado
        if (exists !== undefined && !exists) {
          res.status(409).send({
            message,
            error,
          })
        } else if (exists === undefined) {
          res.status(401).send({
            message,
            error,
          })
        } else {
          res.status(500).send({
            message: 'Erro no servidor, por favor tente novamente!',
            error,
          })
        }
      } else {
        res.status(200).send({
          message: 'Login realizado com sucesso!',
          token: id,
          name,
          establishment
        })
      }
    })
  }
})

/**
 * Requisição para adicionar um único usuário na base, em vez de adicionar vários de uma vez
 * como é feito no método acima (updateFromFile)
 * 
 * Caso já exista na base, não atualiza as informações.
 * 
 * Recebe no payload da requisição todos os dados descritos no modelo USER
 * 
 */
router.post('/signup', async function (req, res, next) {
  const validate = validateSignUp(req.body);
  // Se o payload estiver invalido, retorna status 400 e informa
  if (!validate.success) {
    res.statusCode = 400;
    res.send({
      message: 'Payload inválido',
      errors: validate.errors.errors
    });
  } else {
    // Procura usuario pela 'chave primaria'
    const user = await findUser({
      email: req.body.email
    });

    const establishment = await Establishment.findOne({
      name: req.body.establishment
    })

    // Se não achar nenhum usuario, tenta cadastrar
    if (typeof user != 'undefined' && user.length === 0 && establishment != null) {
      // Chama metodo de cadastro e passa um callback
      delete req.body.establishment
      req.body.establishment_id = establishment._id
      await signUp(req.body, ({ error, id, name, establishment }) => {
        if (error) {
          res.status(500).send({
            message: 'Erro no servidor, por favor tente novamente!',
            error: {
              message: error.message
            }
          })
        } else {
          res.status(200).send({
            message: 'Usuário cadastrado com sucesso!',
            token: id,
            establishment,
            name,
          })
        }
      });
    } else {
      if (establishment == null) {
        res.status(400).send({
          message: 'Estabelecimento não encontrado! Certifique-se de que está cadastrado'
        });
      } else {
        // Caso ja esteja cadastrado, retorna status 400 e informa
        res.status(400).send({
          message: 'Usuário já está cadastrado! Tente realizar o login'
        });
      }
    }
  }
  return;
});
module.exports = router;
