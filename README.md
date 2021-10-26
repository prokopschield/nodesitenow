# nodesitenow

Turns your current directory into a [NodeSite](https://nodesite.eu).

Hosts all files statically in nodesite-cdn, but doesn't register static routes. (nodesitenow acts as the router)

_If you need static routing, try [nStore](https://npmjs.com/package/@prokopschield/nstore)_

### cli usage

Installation: `[sudo] yarn global add nodesitenow`

Syntax: `nodesitenow [folder] [port] [name]`

folder: defaults to current directory

port: optional, creates http localhost

name: [name].nodesite.eu

### Node.js usage

Installation: `yarn add nodesitenow`

`import nodesitenow from 'nodesitenow'`

`nodesitenow(folder, name, port) // Promise<internals>`

The return value should not be relied upon; it may change in the future.

All the internal functions of nodesitenow are also exposed, feel free to play around with them.
