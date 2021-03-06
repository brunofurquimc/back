const { Parser, transforms: { flatten } } = require('json2csv');

var express = require('express');
var router = express.Router();
const { isEqual } = require('lodash');

const User = require('../models/user.js');
const Order = require('../models/order.js');
const Product = require('../models/product');
const PaymentMethod = require('../models/payment_method');
const Establishment = require('../models/establishment');
const Status = require('../models/status.js');

const { formatAddress, formatPhone, findUser, getBrazilianDate, findProduct, findOrder, validateAuth } = require('../helpers/utils');
const { validateUpdateFromFile } = require('../helpers/validate');

const valorFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

async function getProfitFromProducts(products) {
  let totalProfit = 0;
  for (const product of products) {
    let prod = await Product.find({ _id: product.id });
    if (prod.length != 0) totalProfit += product.quantity * (prod[0].value - prod[0].cost);
  }
  return totalProfit;
}

function getProductCount(products) {
  let productCount = 0;
  products.forEach(product => productCount += product.quantity);
  return productCount;
}

async function getNumberOfOrders(product_id) {
  let count = 0;
  const orders = await findOrder();

  for (const order of orders) {
    const prod = order.products.find(product => product.id == product_id);
    if (typeof prod != 'undefined') count += prod.quantity
  }
  return count;
}

function getFavoriteProduct(orders) {
  const products = {}
  for (const order of orders) {
    for (const product of order.products) {
      if (products[product.id] == undefined) products[product.id] = 0;
      products[product.id] += product.quantity;
    }
  }
  const keys = Object.keys(products);
  let maxID
  let max
  if (keys.length != 0) {
    max = products[keys[0]];
    keys.forEach(key => {
      let value = products[key];
      if (value >= max) {
        max = value;
        maxID = key;
      }
    })
  }
  return {
    id: maxID,
    count: max,
  }
}

router.post('/orders/filter', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usu??rio n??o est?? autenticado'
    })
  }
  let orders;
  let user_id = req.headers.authorization;

  let vendor = await User.findOne({ _id: user_id }).lean();

  let query = {
    establishment_id: vendor.establishment_id,
  }

  if (req.body.date !== undefined && req.body.date.length == 2) {
    query.order_date = {
      $gte: req.body.date[0],
      $lte: req.body.date[1],
    }
  }

  const products = await Product.find({}).lean()
  console.log(products)
  const productsCount = products.length;

  let totalValueSold = 0;
  let totalCost = 0;
  orders = await Order.find(query).sort({ order_date: 'asc' }).lean();

  const ordersCount = orders.length;

  let preferredPaymentMethods = {}

  for (const order of orders) {
    if (preferredPaymentMethods[order.payment_method_id] === undefined) {
      preferredPaymentMethods[order.payment_method_id] = 1
    } else preferredPaymentMethods[order.payment_method_id] += 1;

    for (const orderProduct of order.products) {
      let product = products.find(p => isEqual(p._id, orderProduct.id));
      totalValueSold += orderProduct.quantity * product.value;
      totalCost += orderProduct.quantity * product.cost;
    }
  }

  console.log(totalValueSold, totalCost)

  let max = Number.NEGATIVE_INFINITY;
  let maxKey = undefined;
  console.log(max, maxKey, preferredPaymentMethods)
  for (const [key, value] of Object.entries(preferredPaymentMethods)) {
    console.log(key, value)
    if (value > max) {
      max = value;
      maxKey = key;
    }
  }

  let preferredPaymentMethod;
  if (maxKey !== undefined) {
    preferredPaymentMethod = await PaymentMethod.findOne({ _id: maxKey }).lean();
  }

  let favoriteProductInfo = getFavoriteProduct(orders);
  let favoriteProduct;
  if (typeof favoriteProductInfo.id != 'undefined') {
    const prod = await Product.find({ _id: favoriteProductInfo.id });
    if (prod.length != 0) {
      favoriteProduct = {
        name: prod[0].name,
        quantity: favoriteProductInfo.count,
      }
    }
  }
  console.log(preferredPaymentMethod)
  return res.status(200).send({
    orders,
    paymentMethod: preferredPaymentMethod !== undefined ? preferredPaymentMethod.name : '',
    totalValueSold,
    totalCost,
    productsCount,
    ordersCount,
    favoriteProduct: favoriteProduct !== undefined ? favoriteProduct.name : ''
  })
})

router.post('/orders/info', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usu??rio n??o est?? autenticado'
    })
  }
  let orders;
  let user_id = req.headers.authorization

  const fileName = req.body.file_name
  if (typeof fileName != 'undefined') delete req.body.file_name

  if (isEqual(req.body, {})) {
    orders = await Order.find({
      user_id
    });
  } else {
    const validate = validateUpdateFromFile(req.body);
    if (!validate.success) {
      res.status(400).send({
        message: 'Payload inv??lido',
        errors: validate.errors.errors
      });
      return;
    }
    const end_date = new Date(req.body.end_date);
    end_date.setUTCHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    orders = await Order.find({
      user_id,
      order_date: {
        $gte: req.body.start_date,
        $lte: end_date
      }
    }).sort({ order_date: 'asc' });
  }

  let ordersCount = 0;
  let productsCount = 0;
  let totalSales = 0;
  let totalProfit = 0;
  let productsSold = 0;

  let products = await Product.find({});
  productsCount = products.length;

  for (const order of orders) {
    ordersCount++;
    order.products.forEach(product => {
      productsSold += product.quantity;
    });
    totalSales += order.value;
    totalProfit += await getProfitFromProducts(order.products);
  }

  let favoriteProductInfo = getFavoriteProduct(orders);
  let favoriteProduct;
  if (typeof favoriteProductInfo.id != 'undefined') {
    const prod = await Product.find({ _id: favoriteProductInfo.id });
    if (prod.length != 0) {
      favoriteProduct = {
        name: prod[0].name,
        quantity: favoriteProductInfo.count,
      }
    }
  }

  // if (orders.length == 0) {
  //   res.status(200).attachment(typeof fileName != 'undefined' ? `${fileName}.text` : 'order-info.text').send({ message: 'Sem dados para as datas informadas' })
  //   return;
  // }

  let info = [
    {
      ordersCount,
      productsCount,
      productsSold,
      totalSales,
      totalProfit,
    }
  ]
  if (typeof favoriteProductInfo.id != 'undefined') info[0].highestSellingProduct = `${favoriteProduct.name}`

  var fields = [
    {
      label: 'N??mero de vendas',
      value: 'ordersCount'
    },
    {
      label: 'N??mero de produtos',
      value: 'productsCount'
    },
    {
      label: 'Valor total vendido',
      value: 'totalSales'
    },
    {
      label: 'Valor total lucrado',
      value: 'totalProfit'
    },
    {
      label: 'Produto mais vendido',
      value: 'highestSellingProduct'
    }
  ];

  const json2csvParser = new Parser({ fields });
  var data = json2csvParser.parse(info);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.send(info[0]);
  // res.attachment(typeof fileName != 'undefined' ? `${fileName}.csv` : 'order-info.csv').send(data);
  return;
})

router.post('/orders', async function (req, res, next) {
  let orders;

  const fileName = req.body.file_name
  if (typeof fileName != 'undefined') delete req.body.file_name

  if (isEqual(req.body, {})) {
    orders = await Order.find().sort({ order_date: 'asc' });
  } else {
    const validate = validateUpdateFromFile(req.body);
    if (!validate.success) {
      res.status(400).send({
        message: 'Payload inv??lido',
        errors: validate.errors.errors
      });
      return;
    }
    const end_date = new Date(req.body.end_date);
    end_date.setUTCHours(23);
    end_date.setMinutes(59);
    end_date.setSeconds(59);
    orders = await Order.find({
      order_date: {
        $gte: req.body.start_date,
        $lte: end_date,
      }
    }).sort({ order_date: 'asc' });
  }


  const ordersArray = []

  for (const order of orders) {
    const paymentMethod = await PaymentMethod.find({ _id: order.payment_method_id });
    const user = await findUser({ _id: order.user_id });
    const obj = {
      value: valorFormatter.format(order.value),
      payment_method: paymentMethod[0].name,
      client: `${user[0].name} (${formatPhone(user[0].phone)})`,
      order_date: getBrazilianDate(order.order_date),
      product_count: getProductCount(order.products),
      products: '',
    }

    for (const product of order.products) {
      const prod = await findProduct({ _id: product.id });
      obj.products += `${prod[0].name} (${valorFormatter.format(prod[0].value)} X ${product.quantity}); `
    }

    ordersArray.push(obj);
  }

  var fields = [
    {
      label: 'Valor',
      value: 'value'
    },
    {
      label: 'M??todo de pagamento',
      value: 'payment_method'
    },
    {
      label: 'Cliente',
      value: 'client'
    },
    {
      label: 'Data da venda',
      value: 'order_date'
    },
    {
      label: 'Quantidade de produtos',
      value: 'product_count'
    },
    {
      label: 'Produtos',
      value: 'products'
    }
  ];


  const json2csvParser = new Parser({ fields });
  var data = json2csvParser.parse(ordersArray);
  res.attachment(typeof fileName != 'undefined' ? `${fileName}.csv` : 'orders.csv').send(data);
  return;
});

router.post('/clients', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usu??rio n??o est?? autenticado'
    })
  }
  const vendor = await User.findOne({ _id: req.headers.authorization }).lean()
  const { establishment_id } = vendor;

  const clients = await User.find({ establishment_id, customer: true }).lean()

  const fileName = 'RelatorioClientes.csv';
  
  const clientsArray = [];
  for (const client of clients) {
    const clientOrders = await Order.find({ user_id: client._id }).lean()
    const favProdInfo = getFavoriteProduct(clientOrders);
    let favoriteProduct = ''
    if (favProdInfo.id != undefined) {
      const prod = await Product.findOne({ _id: favProdInfo.id }).lean();
      if (prod != undefined ) favoriteProduct = `${prod.name} (x${favProdInfo.count})`
    }
    const obj = {
      signUp_date: getBrazilianDate(client.createdAt),
      email: client.email,
      name: client.name,
      id: client._id,
      phone: formatPhone(client.phone),
      address: formatAddress(client.address),
      order_count: clientOrders.length,
      favoriteProduct,
    }

    clientsArray.push(obj)
  }
  var fields = [
    {
      label: 'Identificador',
      value: 'id',
    },
    {
      label: 'Data de cadastro',
      value: 'signUp_date',
    },
    {
      label: 'Nome',
      value: 'name'
    },
    {
      label: 'E-mail',
      value: 'email'
    },
    {
      label: 'Celular',
      value: 'phone'
    },
    {
      label: 'Endere??o de entrega',
      value: 'address'
    },
    {
      label: 'N??mero de compras',
      value: 'order_count'
    },
    {
      label: 'Produto mais pedido',
      value: 'favoriteProduct',
    }
  ];


  const json2csvParser = new Parser({ fields });
  var data = json2csvParser.parse(clientsArray);
  res.attachment(fileName).send(data);
  return;
});

router.post('/sales', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usu??rio n??o est?? autenticado'
    })
  }
  const vendor = await User.findOne({ _id: req.headers.authorization }).lean()
  const { establishment_id } = vendor;

  const orders = await Order.find({ establishment_id }).lean()

  const fileName = 'RelatorioVendas.csv';
  
  const ordersArray = [];
  for (const order of orders) {
    const status = await Status.findOne({ _id: order.status }).lean();
    const user = await User.findOne({ _id: order.user_id }).lean();
    const paymentMethod = await PaymentMethod.findOne({ _id: order.payment_method_id }).lean();
    let productsString = '';

    for (const product of order.products) {
      const prod = await Product.findOne({ _id: product.id }).lean();
      productsString += `${prod.name} (${valorFormatter.format(prod.value)} X ${product.quantity}); `
    }
    const obj = {
      value: valorFormatter.format(order.value),
      status: status.value,
      consumerName: user.name,
      consumerPhone: formatPhone(user.phone),
      productCount: order.products.length,
      paymentMethod: paymentMethod.name,
      order_date: getBrazilianDate(order.order_date),
      products: productsString,
    }

    ordersArray.push(obj);
  }
  var fields = [
    {
      label: 'Data de cadastro',
      value: 'order_date',
    },
    {
      label: 'Valor',
      value: 'value'
    },
    {
      label: 'Status',
      value: 'status'
    },
    {
      label: 'Nome do cliente',
      value: 'consumerName'
    },
    {
      label: 'Celular do cliente',
      value: 'consumerPhone'
    },
    {
      label: 'M??todo de pagamento',
      value: 'paymentMethod'
    },
    {
      label: 'N??mero de produtos',
      value: 'productCount',
    },
    {
      label: 'Descri????o dos produtos',
      value: 'products',
    }
  ];


  const json2csvParser = new Parser({ fields });
  var data = json2csvParser.parse(ordersArray);
  res.attachment(fileName).send(data);
  return;
});

router.post('/products', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usu??rio n??o est?? autenticado'
    })
  }
  const vendor = await User.findOne({ _id: req.headers.authorization }).lean()
  const { establishment_id } = vendor;

  const products = await Product.find({ establishment_id }).lean()

  const fileName = 'RelatorioProdutos.csv';

  const productsArray = [];
  for (const product of products) {
    const obj = {
      name: product.name,
      value: valorFormatter.format(product.value),
      cost: valorFormatter.format(product.cost),
      profit: valorFormatter.format(product.value - product.cost),
      category: product.category,
      code: product.code,
      numberOfOrders: await getNumberOfOrders(product.id),
    }

    productsArray.push(obj);
  }
  var fields = [
    {
      label: 'Nome',
      value: 'name'
    },
    {
      label: 'Valor',
      value: 'value'
    },
    {
      label: 'Custo',
      value: 'cost'
    },
    {
      label: 'Lucro',
      value: 'profit'
    },
    {
      label: 'Categoria',
      value: 'category'
    },
    {
      label: 'C??digo',
      value: 'code'
    },
    {
      label: 'N??mero de vendas',
      value: 'numberOfOrders',
    }
  ];


  const json2csvParser = new Parser({ fields });
  var data = json2csvParser.parse(productsArray);
  res.attachment(fileName).send(data);
  return;
});

router.get('/users', async function (req, res, next) {
  const usersJSON = [];
  const users = await User.find();
  for (const user of users) {
    let salesCount = 0;
    let productsCount = 0;
    let totalFromSales = 0;
    let totalFromProfit = 0;

    const orders = await Order.find({ user_id: user.id });
    for (const order of orders) {
      salesCount++;
      totalFromSales += order.value;
      totalFromProfit += await getProfitFromProducts(order.products);
      productsCount += getProductCount(order.products);
    }

    let favoriteProductInfo = getFavoriteProduct(orders);
    let favoriteProduct;
    if (favoriteProductInfo.id != undefined) {
      const prod = await Product.find({ _id: favoriteProductInfo.id });
      if (prod.length != 0) {
        favoriteProduct = {
          name: prod[0].name,
          quantity: favoriteProductInfo.count,
        }
      }
    }

    let newUser = {
      name: user.name,
      address: formatAddress(user.address),
      email: user.email,
      phone: formatPhone(user.phone),
      salesCount,
      productsCount,
      totalFromProfit,
      totalFromSales,
      favoriteProduct,
    }
    for (const [chave, valor] of Object.entries(newUser)) {
      if (valor == undefined) delete newUser[chave];
    }
    usersJSON.push(newUser);
  }
  var fields = [{ label: 'Nome completo', value: 'name' },
  {
    label: 'Endere??o',
    value: 'address'
  },
  {
    label: 'E-mail',
    value: 'email'
  },
  {
    label: 'Celular',
    value: 'phone'
  },
  {
    label: 'N??mero de compras',
    value: 'salesCount'
  },
  {
    label: 'N??mero de produtos comprados',
    value: 'productsCount'
  },
  {
    label: 'Lucro total',
    value: 'totalFromProfit'
  },
  {
    label: 'Valor total vendido',
    value: 'totalFromSales'
  }];
  const json2csvParser = new Parser({ fields });
  var data = json2csvParser.parse(usersJSON);
  res.attachment('users.csv');
  res.send(data);
  return;
});

router.get('/establishment', async function (req, res) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usu??rio n??o est?? autenticado'
    })
  }
  const vendor = await User.findOne({ _id: req.headers.authorization }).lean()
  const { establishment_id } = vendor;

  const products = await Product.find({ establishment_id }).lean()

  const fileName = 'RelatorioOperacao.csv'
})
module.exports = router;


