const { Parser, transforms: { flatten } } = require('json2csv');

var express = require('express');
var router = express.Router();
const { isEqual } = require('lodash');

const User = require('../models/user.js');
const Order = require('../models/order.js');
const Product = require('../models/product');
const PaymentMethod = require('../models/payment_method');

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

router.post('/orders/info', async function (req, res, next) {
  if (!validateAuth(req.headers.authorization)) {
    res.status(403).send({
      error: true,
      message: 'Usuário não está autenticado'
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
        message: 'Payload inválido',
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
      label: 'Número de vendas',
      value: 'ordersCount'
    },
    {
      label: 'Número de produtos',
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
        message: 'Payload inválido',
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
      label: 'Método de pagamento',
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

router.post('/products', async function (req, res, next) {
  const fileName = req.body.file_name
  if (typeof fileName != 'undefined') delete req.body.file_name

  let products = await findProduct();
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
      label: 'Código',
      value: 'code'
    },
    {
      label: 'Número de vendas',
      value: 'numberOfOrders',
    }
  ];


  const json2csvParser = new Parser({ fields });
  var data = json2csvParser.parse(productsArray);
  res.attachment(typeof fileName != 'undefined' ? `${fileName}.csv` : 'products.csv').send(data);
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
    label: 'Endereço',
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
    label: 'Número de compras',
    value: 'salesCount'
  },
  {
    label: 'Número de produtos comprados',
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
module.exports = router;


