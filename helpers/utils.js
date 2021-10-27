const mongoose = require('mongoose');
const { isEqual } = require('lodash');
const bcrypt = require('bcryptjs');

/**
 * Importação dos modelos
 */
const User = require('../models/user');
const Order = require('../models/order');
const PaymentMethod = require('../models/payment_method');
const Product = require('../models/product');
const Establishment = require('../models/establishment');

/**
 * Regex de validação do endereço e telefone dos clientes
 */
const addressRegex = /[a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ ]+, [0-9]+, [a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ ]+,[a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ ]+ - [a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ ]+, [0-9]+-[0-9]+, [a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ ]+/
const phoneRegex = /[0-9]{13}/

/**
 * Objeto com funções auxiliares para as requisições de relatórios
 */
const reportUtils = {
  /**
   * 
   * @param {Object} phone 
   * @returns {String} retorna uma string contendo os dados de telefone contidos no objetos
   */
  formatPhone(phone) {
    return `${phone.area_code} ${phone.number}`
  },
  /**
   * 
   * @param {Object} address 
   * @returns {String} retorna uma string contendo os dados de endereço contidos no objeto
   */
  formatAddress(address) {
    return `${address.street}, ${address.number} - ${address.district}, ${address.city} - ${address.state}, ${address.zip_code}`
  },
}

const requestUtils = {
  validateAuth: async token => {
    const user = await User.findOne({
      _id: token
    })
    return user != undefined && user != null
  }
}

/**
 * Objeto com funções auxiliares para as requisições de produtos
 */
const productUtils = {
  /**
   * Método para buscar produtos na base de dados filtrando-os pela query
   * 
   * @param {Object} query 
   * @returns { Array<Product> } retorna um arranjo de produtos sobre os quais a query se aplica
   */
  findProduct: async query => {
    const product = await Product.find(query)
    // Retorna um arranjo de produtos sobre os quais a query se aplica
    return product;
  },
  /**
   * Método para inserir produto na base de dados de produtos
   * 
   * @param {Object} product 
   * @param {Function} callback 
   */
  addProduct: (product, callback) => {
    // Cria instancia do modelo Product
    const newProduct = new Product({
      _id: mongoose.Types.ObjectId(),
      ...product
    });

    // Salva instancia no BD
    newProduct.save((err) => {
      callback(err);
    })
  },
  /** 
   * Método que realiza o parse de dados vindos do relatórios de produtos do Kyte
   * e transforma em um JSON
   * 
   * @param {Object} product
   * 
  */
  parseProduct(product) {
    const newProduct = {
      name: product['Nome'],
      value: product['Preço de Venda'],
      cost: product['Preço de Custo'],
      category: product['Categoria'],
      code: product['Código'],
    }

    return newProduct;
  },
  /**
   * Método que recebe arranjo de produtos do relatório de produtos da Kyte
   * e os adiciona na base de dados
   * 
   * Caso já exista, atualiza suas informações e salva na base
   * Caso contrário, insere o produto na base
   * 
   * @param {Array<Product>} products 
   */
  async addProductsFromFile(products) {
    for (product of products) {
      product = productUtils.parseProduct(product);
      const dbProduct = await productUtils.findProduct({ code: product.code });
      if (dbProduct.length != 0) {
        const savedProduct = dbProduct[0];

        savedProduct.name = product.name;
        savedProduct.value = product.value;
        savedProduct.cost = product.cost;
        savedProduct.category = product.category;

        await savedProduct.save((err) => {
          if (err) console.log('ERRO AO DAR UPDATE');
          else console.log('UPDATE FEITO COM SUCESSO');
        });
      } else {
        productUtils.addProduct(product, (err) => {
          if (err) console.log('ERRO SALVANDO');
          else console.log('Produto salvo com sucesso');
        })
      }
    }
  }
}

const dateUtils = {
  getISODate: () => {
    const date = new Date();

    let day = date.getDate();
    if (day < 10) day = `0${day}`;

    let month = date.getMonth() + 1;
    if (month < 10) month = `0${month}`;

    return `${date.getFullYear()}-${month}-${day}`
  },
  getBrazilianDate: (data) => {
    const date = typeof data == 'undefined' ? new Date() : new Date(data);

    let day = date.getDate();
    if (day < 10) day = `0${day}`;

    let month = date.getMonth() + 1;
    if (month < 10) month = `0${month}`;

    return `${day}/${month}/${date.getFullYear()}${typeof data == 'undefined' ? '' : ` ${date.getHours()}:${date.getMinutes()}`}`
  },
  convertFromCSV(date) {
    const dataHora = date.split(' ')
    let dataArray = dataHora[0].split('/')

    let data = new Date();
    data.setDate(+dataArray[0]);
    data.setMonth(+dataArray[1] - 1);
    data.setFullYear(+dataArray[2]);

    data.setHours(+dataHora[1].split(':')[0] - 3);
    data.setMinutes(+dataHora[1].split(':')[1]);
    data.setSeconds(0);

    return data;
  },
}

const establishmentUtils = {
  establishmentSignUp: (establishment, callback) => {
    // Cria instancia do modelo establishment
    const newEstablishment = new Establishment({
      _id: mongoose.Types.ObjectId(),
      ...establishment,
    });

    // Salva instancia no BD
    newEstablishment.save((err) => {
      if (err !== null) callback({
        error: true,
        err,
      })
      else callback({
        error: false,
        id: newEstablishment._id
      })
    })
  },
}

const userUtils = {
  // Procura usuario usando um objeto com chaves e valores
  findUser: async query => {
    const user = await User.find(query)
    // Retorna um arranjo de usuarios sobre os quais a query se aplica
    return user;
  },
  comparePasswords: async (user, password, callback) => {
    bcrypt.compare(password, user.password, async function (err, res) {
      if (err) {
        return callback({
          error: true,
          message: err,
        })
      }
      if (res) {
        const establishment = await Establishment.findOne({
          _id: user.establishment_id
        })
        let returnEstablishment = {
          id: establishment._id,
          name: establishment.name,
          address: establishment.address,
          phone: establishment.phone,
        }
        return callback({
          error: false,
          id: user._id,
          name: user.name,
          establishment: returnEstablishment,
        })
      }
      return callback({
        error: true,
        message: 'Credenciais inválidas',
      })
    })
  },
  // Recebe payload de cadastro do usuario e um callback (em caso de erro)
  signUp: async (user, callback) => {
    // Cria instancia do modelo User
    const newUser = new User({
      _id: mongoose.Types.ObjectId(),
      ...user,
      // inserir campo para diferenciar usuarios da interface de clientes
    });

    // Salva instancia no BD
    newUser.save(async (err) => {
      const establishment = await Establishment.findOne({
        _id: user.establishment_id
      })
      let returnEstablishment = {
        id: establishment._id,
        name: establishment.name,
        address: establishment.address,
        phone: establishment.phone,
      }
      if (err !== null) callback({
        error: true,
        err,
      })
      else callback({
        error: false,
        id: newUser._id,
        name: newUser.name,
        establishment: returnEstablishment,
      })
    })
  },
  signIn: async (user, callback) => {
    const dbUser = await User.findOne({
      email: user.email,
    })
    console.log(dbUser.establishment_id)

    if ((dbUser == null || dbUser == undefined) || dbUser.establishment_id == undefined) {
      callback({
        error: true,
        exists: false,
        message: 'Colaborador não está cadastrado.'
      })
    } else {
      const { password } = user;
      console.log(password, dbUser.establishment_id, dbUser)
      await userUtils.comparePasswords(dbUser, password, callback)
      return;
    }
  },
  /**
   * 
   * @param {Object} address - String vinda do .csv contendo o endereço do usuário
   * @param {String} complement (Não é obrigatório) - Complemento do endereço do usuário 
   * @returns 
   */
  parseAddress(address, complement = '') {
    if (!addressRegex.test(address)) return false;
    let street = address.split(', ')[0]
    let number = +address.split(', ')[1]
    let district = address.split(', ')[2]
    let city = address.split(', ')[3]
    let zip_code = address.split(', ')[4]

    const parsedAddress = {
      street,
      number,
      district,
      city: city.split(' - ')[0],
      state: city.split(' - ')[1],
      zip_code,
      complement
    }
    return parsedAddress;
  },
  parseUser(user) {
    const newUser = {
      address: userUtils.parseAddress(user['Endereço'], user.Complemento),
      email: user.Email,
      phone: userUtils.parsePhone(user.Telefone),
      name: user.Nome,
    }

    if (!newUser.address || !newUser.phone) return undefined
    return newUser;
  },
  /**
   * 
   * @param {String} phone - String vinda do .csv contendo codigo de area e numero de telefone
   * @returns { Object } Objeto parseado e convertido para um objeto (como no modelo de User)
   */
  parsePhone(phone) {
    // Verifica se o telefone vindo do csv está no formato correto
    if (!phoneRegex.test(phone) || phone.length !== 13) return false;
    const parsedPhone = {
      area_code: phone.substring(2, 4),
      number: phone.substring(4, phone.length)
    }
    return parsedPhone;
  },
  /**
   * 
   * @param { Object(User) } user1 - Objeto vindo do .csv
   * @param { Object(User) } user2 - Objeto vindo da base de dados
   * @param { Array<String> } data - Arranjo com as chaves das propriedades a serem verificadas
   * @returns { Boolean } true se forem iguais, false caso contrário
   */
  equalUsers(user1, user2, data) {
    let equals = true;
    for (const prop of data) {
      equals = equals && isEqual(user1[prop], user2[prop])
    }
    return equals;
  },
  /**
   * 
   * @param { Array<User> } users - Arranjo de usuário vindos do .csv
   * Roda pelo arranjo de usuarios, realiza o parse de cada um deles e os procura na base de dados usando o email
   * Se já existe um usuário com o email buscado, atualiza as informações dele
   * Se não existe, insere na base 
   */
  async updateUsers(users) {
    for (user of users) {
      user = userUtils.parseUser(user)
      if (user != undefined) {
        user.customer = true
        const dbUser = await userUtils.findUser({
          email: user.email,
        })
        // Usuário já existe na base
        if (dbUser.length != 0) {
          const savedUser = dbUser[0];
          // Verifica se os dados mutáveis do usuário (nome, telefone e endereço) foram alterados
          if (!userUtils.equalUsers(savedUser.toJSON(), user, ['name', 'phone', 'address', 'customer'])) {
            // Atualiza os campos do usuário com os novos dados vindos do .csv
            savedUser.name = user.name;
            savedUser.phone = user.phone;
            savedUser.address = user.address;
            savedUser.customer = true

            // Salva o usuário atualizado
            await savedUser.save((err) => {
              if (err) console.log('ERRO AO DAR UPDATE');
              else console.log('UPDATE FEITO COM SUCESSO');
            });
          } else {
            // Caso nenhum dos dados tenha sido atualizado, não faz nada e segue para a próxima iteração
            console.log('SEM DADOS A SEREM ATUALIZADOS');
          }
        } else {
          // Insere usuário na base
          userUtils.signUp(user, (err) => {
            if (err) console.log('ERRO SALVANDO')
            else console.log('Usuário salvo com sucesso')
          })
        }
      } else {
        console.log('DADOS DO USUÁRIO ESTÃO NO FORMATO INVÁLIDO')
      }
    }
  },
}

const orderUtils = {
  formatOrders: async orders => {
    let formattedOrders = []
    for (const order of orders) {
      let formattedProducts = []
      const { _id, value, order_date, products, status } = order

      for (const product of products) {
        const prod = await Product.findOne({ _id: product.id }).lean();
        delete prod._id;
        delete prod.__v;
        prod.quantity = product.quantity;
        formattedProducts.push(prod);
      }
      const payment_method = await PaymentMethod.findOne({ _id: order.payment_method_id }).lean();
      const client = await User.findOne({ _id: order.user_id }).lean();
      console.log(order)
      let vendor = undefined
      if (order.vendor_id != undefined) {
        vendor = await User.findOne({ _id: order.vendor_id }).lean();
        delete vendor._id;
        delete vendor.__v;
        delete vendor.password;
        delete vendor.customer;
        delete vendor.createdAt;
        delete vendor.updatedAt;
      }

      delete client._id;
      delete client.__v;
      delete client.password;
      delete client.customer;
      delete client.createdAt;
      delete client.updatedAt;

      const newOrder = {
        _id,
        value,
        payment_method: payment_method.name,
        order_date,
        products: formattedProducts,
        client,
        status,
      }
      if (vendor != undefined) newOrder.vendor = vendor;
      formattedOrders.push(newOrder);
    }
    return formattedOrders;
  },
  // Procura um pedido usando um objeto com chaves e valores
  findOrder: async query => {
    const order = await Order.find(query)
    // Retorna um arranjo de pedidos sobre os quais a query se aplica
    return order;
  },
  // Recebe payload de cadastro do pedido e um callback (em caso de erro)
  addOrder: async (order, callback) => {
    const dbOrder = await orderUtils.findOrder({
      value: order.value,
      payment_method_id: order.payment_method_id,
      user_id: order.user_id,
      products: order.products,
    });
    if (dbOrder.length == 0) {
      const newOrder = new Order({
        _id: mongoose.Types.ObjectId(),
        ...order
      });

      // Salva instancia no BD
      await newOrder.save((err) => {
        callback(err);
      })
    } else {
      if (dbOrder[0].order_date.toString().split('.')[0] != order.order_date.toString().split('.')[0]) {
        const newOrder = new Order({
          _id: mongoose.Types.ObjectId(),
          ...order
        });

        // Salva instancia no BD
        await newOrder.save((err) => {
          callback(err);
        })
      } else {
        console.log('Pedido já contabilizado');
      }
    }
  },
  async parseOrder(order) {
    const paymentMethod = await PaymentMethod.find({ name: order['Meios de Pagamento'] });
    const user = await userUtils.findUser({ name: order['Cliente'] });
    if (paymentMethod.length == 0 || user.length == 0) return;

    let productString = order['Descri'][' itens'];
    let products = productString.split(', ');

    let orderProducts = []

    for (const product of products) {
      const name = product.split('x')[1];
      const produto = await productUtils.findProduct({ name });
      if (produto.length != 0) {
        orderProducts.push({
          id: mongoose.Types.ObjectId(produto[0].id),
          quantity: +product.split('x')[0],
        })
      }
    }
    const newOrder = {
      value: +order['Total'],
      profit: +order['Lucro'],
      payment_method_id: mongoose.Types.ObjectId(paymentMethod[0].id),
      user_id: mongoose.Types.ObjectId(user[0].id),
      order_date: dateUtils.convertFromCSV(order['Data/Hora']),
      products: orderProducts,
    }
    return newOrder;
  },
  /**
   * 
   * @param { Array<Order> } orders - Arranjo de pedidos vindos do .csv
   * Roda pelo arranjo de pedidos, realiza o parse de cada um deles e os insere na base de dados
   */
  async addOrdersFromFile(orders) {
    for (order of orders) {
      const newOrder = await orderUtils.parseOrder(order)
      if (typeof newOrder != 'undefined') {
        await orderUtils.addOrder(newOrder, (err) => {
          if (err) console.log('ERRO AO SALVAR PEDIDO');
          else console.log('PEDIDO ADICIONADO COM SUCESSO');
        });
      }
    }
  },
}

module.exports = {
  ...userUtils,
  ...dateUtils,
  ...orderUtils,
  ...productUtils,
  ...reportUtils,
  ...requestUtils,
  ...establishmentUtils,
}