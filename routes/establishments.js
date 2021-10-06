var express = require('express');
var router = express.Router();

/**
 * Importa funções auxiliares da pasta helpers
 */
const { establishmentSignUp } = require('../helpers/utils');
const { validateEstablishmentSignUp } = require('../helpers/validate');

const Establishment = require('../models/establishment.js');

/**
 * Requisição para adicionar um único estabelecimento na base
 * 
 */
router.post('/signup', async function (req, res, next) {
  const validate = validateEstablishmentSignUp(req.body);
  // Se o payload estiver invalido, retorna status 400 e informa
  if (!validate.success) {
    res.statusCode = 400;
    res.send({
      message: 'Payload inválido',
      errors: validate.errors.errors
    });
  } else {
    // Procura estabelecimento pela 'chave primaria'
    const establishment = await Establishment.findOne({
      name: req.body.name,
      phone: req.body.phone,
    });

    console.log(establishment)

    // Se não achar nenhum usuario, tenta cadastrar
    if (establishment == null) {
      // Chama metodo de cadastro e passa um callback
      await establishmentSignUp(req.body, ({ error, id }) => {
        if (error) {
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
      });
    } else {
      // Caso ja esteja cadastrado, retorna status 400 e informa
      res.status(400).send({
        message: 'Estabelecimento já está cadastrado! Cadastre colaboradores'
      });
    }
  }
  return;
});
module.exports = router;
