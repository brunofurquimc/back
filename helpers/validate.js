const Validator = require('validatorjs');
const { isEqual } = require('lodash');
const { getISODate } = require('./utils');

const establishmentValidations = {
  validateEstablishmentSignUp: payload => {
    // Objeto contendo regras de validacao para cada campo do payload
    const validation = {
      name: 'required|string',
      phone: {
        area_code: 'required|string|size:2',
        number: 'required|string|size:9'
      },
      address: {
        zip_code: 'required|string|size:8',
        street: 'required|string',
        district: 'required|string',
        number: 'required',
        city: 'required|string',
        state: 'required|string|max:2',
      },
    }
    const establishmentSignUpValidator = new Validator(payload, validation);
    return {
      success: establishmentSignUpValidator.passes(),
      errors: establishmentSignUpValidator.errors,
    }
  },
}

/**
 * Objeto contendo funções de validação para as requisições do endpoint USERS
 * 
 */
const userValidations = {
  /**
   * Valida o payload vindo das requisicoes de update
   * 
   * @param {Object} payload 
   * @returns {Object}
   * Retorna um objeto informando se o payload está válido e, se não estiver, retorna os erros do objeto
   */
  validateUpdateFromFile: payload => {
    const validation = {
      start_date: 'required|date',
      end_date: `required|date|after_or_equal:start_date|beforeDate`
    }
    const updateFromFileValidator = new Validator(payload, validation);
    return {
      success: updateFromFileValidator.passes(),
      errors: updateFromFileValidator.errors,
    }
  },
  /**
   * Valida o payload da requisição de cadastro
   * 
   * @param {Object} payload 
   * @returns {Object}
   * Retorna um objeto informando se o payload de cadastro está válido e, se não estiver, retorna os erros do objeto
   */
  validateSignUp: payload => {
    // Objeto contendo regras de validacao para cada campo do payload
    const validation = {
      name: 'required|string',
      email: 'required|email',
      phone: {
        area_code: 'required|string|size:2',
        number: 'required|string|size:9'
      },
      address: {
        zip_code: 'required|string|size:8',
        street: 'required|string',
        district: 'required|string',
        number: 'required',
        city: 'required|string',
        state: 'required|string|max:2',
      },
      password: 'required|string|min:8',
      establishment: 'required|string'
    }
    const signUpValidator = new Validator(payload, validation);
    return {
      success: signUpValidator.passes(),
      errors: signUpValidator.errors,
    }
  },

  validateSignIn: payload => {
    const validation = {
      email: 'required|email',
      password: 'required|string|min:8'
    }

    const signInValidator = new Validator(payload, validation);
    return {
      success: signInValidator.passes(),
      errors: signInValidator.errors,
    }
  }
}

Validator.register('category', function (value) {
  return isEqual(value, 'Customer') || isEqual(value, 'Product') || isEqual(value, 'Sale');
}, `The informed :attribute is not a valid option [Customer, Product, Sale]`);

Validator.register('beforeDate', function (value) {
  const today = new Date(getISODate())
  today.setHours(23);
  today.setMinutes(59);
  today.setSeconds(59);
  return new Date(value) <= today;
}, "The informed :attribute can't be after today's date")

module.exports = {
  ...userValidations,
  ...establishmentValidations,
}