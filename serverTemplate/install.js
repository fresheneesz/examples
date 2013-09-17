
// If this is modified, modify the equivalent in installUtils.js
// separate from exec so it can be more simply pulled out to bootstrap loading this module
var execAsync = function(command, options, after) {
    if(options===undefined) options = {}
    require('child_process').exec(command, options, function (error, stdout, stderr) {
        after(error, {out:stdout, err:stderr})
    })
}

var nodejsUtilsRevision = "b3ca5f0c69b608c64efe9ed7512e9b0868bdc31a" // change this if you want to update the nodejsUtils version (you don't need to change the bootstrap revision number below)
var nodeUtilitiesModuleName = 'nodejsUtils'
var utilsUrl = getNodejsUtilsModule(nodejsUtilsRevision)
var logError = function(e) {console.log(e+"\n"+ e.stack)}
var path = require('path')

var installUtils = 'install'
var installUtilsPath = nodeUtilitiesModuleName+'/'+installUtils

var basePath = path.resolve(__dirname)+path.sep
var installDirectory = basePath+'../'
console.log(installDirectory)
var bootstrap = function(after) {
    try {
        require(installUtilsPath)
    } catch(e) {
        var err = e
    }

    if(err === undefined) {
        after()
    } else {
        console.log("Bootstrapping because of: "+err)

        var nodejsUtilsRevision_bootstrap = "7520a304a6cbb691100a1dd8c590d9566092e620" // the version to use when bootstrapping (shouldn't change much)
        execAsync('npm install '+getNodejsUtilsModule(nodejsUtilsRevision_bootstrap), {cwd:installDirectory}, function (err, data) {
            console.log(data)
            if(err) after(err)
            // else

            // Unfortunately this must be done separately from to prevent fibers from getting confused and vomiting (see https://github.com/laverdet/node-fibers/issues/102 )
            execAsync('npm install fibers', {cwd:installDirectory}, function (err, data) {
                console.log(data)
                if(err) after(err)
                // else
                after()
            })
        })
    }
}

function getNodejsUtilsModule(revision) {
    return 'https://github.com/fresheneesz/'+nodeUtilitiesModuleName+'/tarball/'+revision
}

bootstrap(function(err) {
    if(err) {
        console.log("-\nError bootstrapping\n-")
        logError(err)
        return
    }
    // else

    var fs = require('fs')
    var install = require(installUtilsPath)
    var utils = require('nodejsUtils/utils')
    var Fiber = require('fibers')
    var Future = require('fibers/future')
    var os = require('os')


    utils.log("-\nsuccessfully bootstrapped\n-")

    var installComponents = basePath+"installComponents/"

    Fiber(function() {
        var shrinkwrapFile = "npm-shrinkwrap.json"

        var jobs = [
            overwriteComponent("package.json"),
            overwriteComponent("perfund.js"),
            overwriteComponent(shrinkwrapFile),
            installComponentAndLog("configuration.js")
        ]

        if(!fs.existsSync(installDirectory+"node_modules/bt"))
            jobs.push(install.symlink(installDirectory+"node_modules/nodejsUtils", installDirectory+"node_modules/bt"))

        jobs.push(installGlobalModule(moduleLocation("forever", true), /*version*/'0.10.0'))

        jobs.push(installTarball(nodeUtilitiesModuleName, installDirectory, utilsUrl))

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
            utils.log(JSON.stringify(utils.exec("npm shrinkwrap", {cwd:installDirectory}).wait()))   // ensure consistent versions of the installed modules

            var source =      installDirectory +shrinkwrapFile
            var destination = installComponents+shrinkwrapFile
            utils.log(JSON.stringify(install.cp(source, destination).wait()))   // copy the new shrinkwrap to the installComponents directory
        }


        // \/functions\/

        function installGlobalModule(location, version) {
            if(!fs.existsSync(location) || JSON.parse(fs.readFileSync(location+'package.json')).version !== version) {
                utils.log('Couldn\'t find '+location+' or not the right version - installing it..')
                return utils.exec("npm install -g forever@"+version)
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
            var shrinkwrap = utils.exec("npm install", {cwd:location}).wait()

            // ensure that all dependencies exist
            var dependencies = getDependencies(installDirectory)
            for(var n=0; n<dependencies.length; n++) { var module = dependencies[n]
                utils.log("Installing "+module)

                var packagePath = location+"node_modules/"+module+"/package.json"
                var packageExists = fs.existsSync(packagePath)
                if(!packageExists) {
                    utils.exec("npm install "+module, {cwd:location}).wait()
                    somethingWasInstalled = true
                }
            }

            return somethingWasInstalled
        }

        function moduleLocation(module, global) {
			if(global) {
                var results = utils.exec("npm config get prefix").wait()
                var prefix = results.out.trim()
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

        function installTarball(moduleName, location, url) {
            var packagePath = location+"node_modules/"+moduleName+"/package.json"
            var packageExists = fs.existsSync(packagePath)
            if(packageExists && JSON.parse(fs.readFileSync(packagePath))._from === url) { // if already installed
                utils.log('Skipping '+url+' since it already exists with correct version');
                return undefined
            } else
                return utils.exec('npm install '+url, {cwd:location})
        }

        utils.log("done!")
    }).run()
})

