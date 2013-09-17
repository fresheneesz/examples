var Fiber = require('fibers')
var Future = require('fibers/future')
var utils = require('bt/utils')
var config = require('./configuration.js')

new Fiber(function() {
    utils.log(utils.exec('forever '
                        +'-al "'+config.forever.logFile+'" '
                        +'-ao "'+config.console.out+'" '
                        +'-ae "'+config.console.err+'" '
                        +'--pidFile "'+config.forever.pidFile+'" '
                        +'start '+config.gitWorkingDirectory+'/main.js'
    ).wait())
}).run()