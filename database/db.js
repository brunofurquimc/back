// Importa o modulo do mongoose
const mongoose = require('mongoose');

//URI de conexao, pega as credencias do arquivo .env
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@tcc.mp6kf.mongodb.net/${process.env.DATABASE}?retryWrites=true&w=majority`;

// Conecta o mongoose ao banco de dados hospedado no MongoDB Atlas
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// seta a conexao para uma variavel
const db = mongoose.connection;

// joga o erro no console caso haja algum
db.on('error', console.error.bind(console, 'connection error: '));

// abre a conexao com o banco de dados e avisa no console
db.once('open', () => {
    console.log('CONECTOU')
})

// exporta a instancia do banco de dados para poder manipular
module.exports = { db, mongoose, Schema: mongoose.Schema };