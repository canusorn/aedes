const express = require('express');
const { getLastData } = require('./timedata.controller');
const { tokenValidate} = require('../auth/auth.controller');

const timedataRouter = express.Router();

timedataRouter.get('/:espid/getlastdata',tokenValidate, getLastData);

module.exports = timedataRouter;