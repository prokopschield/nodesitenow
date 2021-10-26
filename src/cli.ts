#!/usr/bin/env node

import fs from 'fs';
import nodesitenow from '.';

async function main() {
	const state = {
		name: 'nodesitenow',
		folder: '.',
		port: 0,
	};

	for (const arg of process.argv.slice(2)) {
		if (+arg) state.port = +arg;
		else if (fs.existsSync(arg)) state.folder = arg;
		else if (arg.match(/^[a-z0-9]+$/g)) state.name = arg;
		else return console.error(`Bad argument: ${arg}`);
	}

	return nodesitenow(state.folder, state.name, state.port).then(() => {
		console.log('/** Files finished loading. **/');
		return new Promise(() => {});
	});
}

main().then(() => {
	if (process.argv[1].includes('nsmt')) return;
	else process.exit();
});
