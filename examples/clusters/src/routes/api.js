const express = require('express');

const timedataRouter = require('./timedata/timedata.router');
const authRouter = require('./auth/auth.router');
const deviceRouter = require('./device/device.router');

const api = express.Router();

api.use('/auth',authRouter);
api.use('/timedata',timedataRouter);
api.use('/device',deviceRouter);

module.exports = api;