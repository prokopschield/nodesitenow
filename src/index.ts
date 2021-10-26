import fs from 'fs';
import {
	Listener,
	ListenerResponse,
	NodeSiteRequest,
	NodeSiteClient,
} from 'nodesite.eu';
import { listen } from 'nodesite.eu-local';
import nsblob from 'nsblob';
import path_real from 'path';
import { watch } from 'ts-hound';

export type Preprocessed = Map<string, ListenerResponse>;

export type State = {
	preprocessed: Preprocessed;
};

export function getRelativePathPart(rel: string) {
	return path_real.relative('/', path_real.resolve('/', rel));
}

export function getAbsolutePath(base: string, rel: string) {
	return path_real.resolve(base, getRelativePathPart(rel));
}

export function moveRootDeeper(root: string, rel: string) {
	const [add, ...nrel] = getRelativePathPart(rel).split(/[\\\/]+/g);
	return [path_real.resolve(root, add), nrel.join('/')];
}

export function getParentPath(p: string) {
	return path_real.resolve('/', p, '..');
}

export function invalidate(state: State, root: string = '/', rel: string = '') {
	let p = getAbsolutePath(root, rel);
	let np: string;
	do {
		state.preprocessed.delete(p);
		np = getParentPath(p);
	} while (p !== (p = np));
}

export async function preprocess(
	state: State,
	root: string,
	rel: string
): Promise<string | false> {
	try {
		const p = getAbsolutePath(root, rel);
		const pparts = path_real.parse(p);
		const stat = await fs.promises.stat(p);
		if (stat.isDirectory()) {
			const rd = await fs.promises.readdir(p);
			const hm = await Promise.all(
				rd.map(
					async (sub): Promise<[string, string | boolean]> => [
						sub,
						await preprocess(state, root, path_real.join(rel, sub)),
					]
				)
			);
			state.preprocessed.set(p, {
				statusCode: 302,
				head: { Location: `${pparts.base}/index` },
			});
			state.preprocessed.set(
				`${p}/index`,
				`<title>Index of ${rel}</title><h1>Index of ${rel}/</h1><ul>${hm
					.map(([sub, hash]) => {
						if (hash) {
							return `<li><a href="https://cdn.nodesite.eu/static/${hash}/${sub}">${sub}</a></li>`;
						} else {
							return `<li><a href="${sub}">${sub}</a></li>`;
						}
					})
					.join('')}</ul>`
			);
			return false;
		} else if (stat.isFile()) {
			const hash = await nsblob.store_file(p);
			if (hash) {
				state.preprocessed.set(p, {
					statusCode: 302,
					head: {
						Location: `https://cdn.nodesite.eu/static/${hash}/${pparts.base}`,
					},
				});
			}
			return hash;
		} else return false;
	} catch (error) {
		return false;
	}
}

export const PROCESS_REQUEST_ERROR = {
	statusCode: 302,
	head: { Location: '..' },
};

export async function process_request(
	state: State,
	req: NodeSiteRequest,
	root: string,
	rel: string
): Promise<ListenerResponse> {
	try {
		if (rel === '/') rel = '/index';
		let p = getAbsolutePath(root, rel);
		const { base: basename } = path_real.parse(p);
		if (state.preprocessed.has(p))
			return (
				state.preprocessed.get(p) ||
				process_request(state, req, root, rel)
			);
		let index = rel === '/';
		if (rel.endsWith('index')) {
			index = true;
			rel = getParentPath(rel);
			p = getAbsolutePath(root, rel);
		}
		const stat = await fs.promises.stat(p);
		if (stat.isFile()) {
			return {
				statusCode: 302,
				head: {
					Location: `https://cdn.nodesite.eu/static/${await nsblob.store_file(
						p
					)}/${basename}`,
				},
			};
		} else if (stat.isDirectory()) {
			if (index) {
				const rd = await fs.promises.readdir(p);
				return `<title>Index of ${rel}</title><h1>Index of ${rel}/</h1><ul>${rd
					.map((sub) => {
						return `<li><a href="${sub}">${sub}</a></li>`;
					})
					.join('')}</ul>`;
			} else
				return {
					statusCode: 302,
					head: {
						Location: rel === '/' ? 'index' : `${basename}/index`,
					},
				};
		} else return fs.promises.readFile(p);
	} catch (error) {
		return PROCESS_REQUEST_ERROR;
	}
}

export default async function nodesitenow(
	folder: string,
	name: string,
	port?: number
) {
	const base_url = new URL(`https://${name}.nodesite.eu`);
	const preprocessed: Preprocessed = new Map();
	const state: State = { preprocessed };
	const creator = port
		? listen({
				interface: 'http',
				name,
				port,
		  }).create
		: (p: string, cb: Listener, file?: string) =>
				NodeSiteClient.create(name, p, cb, file);
	creator('/', (req) =>
		process_request(state, req, folder, new URL(req.uri, base_url).pathname)
	);
	const hound = watch(folder);
	hound.on('change', (file) => {
		const rel = path_real.relative(folder, file);
		invalidate(state, folder, rel);
		if (rel.startsWith('..')) return;
		else preprocess(state, folder, rel);
	});
	return preprocess(state, folder, '').then(() => ({
		preprocessed,
		state,
		hound,
		creator,
	}));
}
