"use strict";

var Fiber = require('fibers')
var http = require('http')
var path = require("path")

var es = require("database").es
var config = require('config')

var Logger = require("logger")
var scriptPath = path.relative(require('rootpath')("."), __filename);
Logger.initialize(scriptPath, config.port)

var utils = require('utils')
var route = require("router")

var logger = Logger()

utils.async({try:function() {
    http.createServer(function (request, response) {
        Fiber(function() {
            try {
                route(request,response)
            } catch(e) {
                utils.log("Uncaught exception in request handler! ",e) // should never happen - errors should be caught in the router
            }
        }).run()
    }).listen(80)

}, catch: function(e) {
    utils.log("Uncaught exception! Dying : (", e)
    process.exit(1) // dying is the only safe thing to do here
}})

logger.info("Server is running on port "+config.port)
require('utils')
