var path = require('path')
var fs = require('fs')
var os = require('os')

var utils = require('nodejsUtils/utils')
var Fiber = require('fibers')
var Future = require('fibers/future')

var install = require('nodejsUtils/install')


var getNpmPrefix = function() {
    var p = utils.exec("npm config get prefix")

    var results = ''
    p.stdout.on('data', function(data) {
        results += data
    })

    p.wait()
    return results
}.future()

Fiber(function() {
    var basePath = path.resolve(__dirname)+path.sep
    var installDirectory = basePath+'../'
    var installComponents = basePath+"installComponents/"
    var shrinkwrapFile = "npm-shrinkwrap.json"

    var jobs = [
        //overwriteComponent("package.json"), //...
        //overwriteComponent(shrinkwrapFile), //already done in preinstall.js
        installComponentAndLog("configuration.js")
    ]

    // create symlink shortcut for nodejsUtils ('bt' for short)
    if(!fs.existsSync(installDirectory+"node_modules/bt"))
        jobs.push(install.symlink(installDirectory+"node_modules/nodejsUtils", installDirectory+"node_modules/bt"))

    jobs.push(installGlobalModule(moduleLocation("forever", true), /*version*/'0.10.8'))

    jobs.push(install.folder(installDirectory+'log'))

    // output results as they come in
    for(var n in jobs) { var v = jobs[n]
        if(v)
            v.resolve(function(err, x) {
               utils.log(JSON.stringify(x))
            })
    }

    // wait for the results
    for(var n in jobs) { var v = jobs[n]
        if(v) v.wait()
    }

    if(npmInstallNew(installDirectory)) {
        utils.log("executing npm shrinkwrap")
        execAndPrint("npm shrinkwrap", installDirectory).wait()   // ensure consistent versions of the installed modules

        var source =      installDirectory +shrinkwrapFile
        var destination = installComponents+shrinkwrapFile
        utils.log(JSON.stringify(install.cp(source, destination).wait()))   // copy the new shrinkwrap to the installComponents directory
    }


    // \/functions\/

    function installGlobalModule(location, version) {
        if(!fs.existsSync(location) || JSON.parse(fs.readFileSync(location+'package.json')).version !== version) {
            utils.log('Couldn\'t find '+location+' or not the right version - installing it..')
            return execAndPrint("npm install -g forever@"+version)
        } else {
            utils.log('skipping installing '+location+' because it already exists with the correct version')
        }
    }

    function overwriteComponent(file) {
        var source = installComponents+file, destination= installDirectory+file
        if(fs.existsSync(destination))
            utils.log(JSON.stringify(install.rm(destination).wait()))
        return install.cp(source, destination)
    }

    // does an npm install, then installs new dependencies that aren't shrinkwrapped
    // returns true if something new was installed
    function npmInstallNew(location) {
        var somethingWasInstalled = false

        // ensure that all dependencies exist
        var dependencies = getDependencies(installDirectory)
        for(var module in dependencies) {
            var packagePath = location+"node_modules/"+module+"/package.json"
            var packageExists = fs.existsSync(packagePath)
            if(!packageExists) {
                var moduleInstallName = dependencies[module]
                if(moduleInstallName === '') moduleInstallName = module

                console.log("Installing: "+moduleInstallName)
                execAndPrint("npm install "+moduleInstallName, location).wait()
                somethingWasInstalled = true
            }
        }

        return somethingWasInstalled
    }

    function moduleLocation(module, global) {
        if(global) {
            var prefix = getNpmPrefix().wait()
            if(['win32','win64'].indexOf(os.platform()) === -1) { // if not windows
                prefix = path.join(prefix, 'lib/')
            }
            return path.join(prefix,'node_modules/',module+"/")
        } else {
            var modulePath = require.resolve(module)
            if(module === modulePath)
                throw new Error("module "+module+" doesn't exist")

            return path.dirname(modulePath)
        }
    }

    function installComponentAndLog(file) {
        var source = installComponents+file, destination= installDirectory+file

        var f = install.file(source, destination)
        f.resolve(f, function(result) {
            if(!result) {
                utils.log('Skipping installing '+destination+' since it already exists.')
            }
        })
        return f
    }

    function getDependencies(location) {
        var fullPath = location+"package.json"
        if(fs.existsSync(fullPath)) {
            return JSON.parse(fs.readFileSync(fullPath)).dependencies
        } else {
            throw new Error("No package.json found (this should have been copied from git/installComponents")
        }
    }

    // returns a future when done
    function execAndPrint(command, cwd) {
        var p = utils.exec(command, {cwd: cwd})
        p.stdout.on('data', onData)
        p.stderr.on('data', onData)

        function onData(data) {
            process.stdout.write(data)
        }

        return p
    }

    utils.log("done!")
}).run()
