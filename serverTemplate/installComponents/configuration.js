var utils = require('bt/utils')

var config = {
    gitWorkingDirectory: "git",

    forever: {
        logFile: "__logfile_here___", // the version of forever we're using doesn't handle absolute paths in windows, relative paths aren't put in the cwd, and the latest version is broken on windows : (
        pidFile: "__pidfile_here___"  // pidFile also doesn't handle absolute paths in windows
    },

    console: {
        out: "../logs/out.log",
        err: "../logs/err.log"
    },

    port: 80,

    logToConsole: false // change this for local development
}

config.elasticsearch = {
    read: {
        host: "__urlOfDatabase__",
        port: 9200,
        secure: false
    }
}
config.elasticsearch.write = config.elasticsearch.read


utils.merge(exports, config)