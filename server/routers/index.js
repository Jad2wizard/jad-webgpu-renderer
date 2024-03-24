const routers = require('koa-router')()
const { login, logout, register } = require('./../controllers/session')

routers.post('/login', login)
routers.post('/register', register)
routers.get('/logout', logout)

module.exports = routers
