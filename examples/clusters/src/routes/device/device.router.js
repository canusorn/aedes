const express = require('express');
const {  getEspIdByUser } = require('./device.controller');
const { tokenValidate } = require('../auth/auth.controller');

const deviceRouter = express.Router();

deviceRouter.get('/', tokenValidate, getEspIdByUser);

module.exports = deviceRouter;