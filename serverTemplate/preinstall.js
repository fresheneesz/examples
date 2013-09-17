// This is a bootstrap script that copies necessary files into a non-versioned directory and installs 3rd party modules

var fs = require("fs")

// copy package.json and npm-shrinkwrap.json to the install directory (one below the repository root)
cp('installComponents/package.json', '../package.json')
cp('installComponents/npm-shrinkwrap.json', '../npm-shrinkwrap.json')

// run npm install there
var p = execAsync('npm install', {cwd: '../'})
p.on('exit', function(code, signal) {
    if(code === 0) {
        console.log("Finished successfully!")
    } else if(code !== null) {
        console.log("Finished unsuccessfully with code "+code+" : (")
    } else {
        console.log("Finished unsuccessfully with kill signal "+signal+" : (")
    }
})
p.stdout.on('data', onData)
p.stderr.on('data', onData)


function cp(source, destination) {
	var sourceContents = fs.readFileSync(source)
    fs.writeFileSync(destination, sourceContents)
}

// returns a ChildProcess event emitter object with:
//  on exit: code, signal
//  stdout.on data: data
//  stderr.on data: data
//  on error: error
function execAsync(command, options, after) {
    if(options===undefined) options = {}
    return require('child_process').exec(command, options)
}

function onData(data) {
    process.stdout.write(data)
}