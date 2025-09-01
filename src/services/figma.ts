import axios from 'axios';


export function parseFileKey(urlOrKey: string) {
const m = urlOrKey.match(/figma\.com\/file\/([A-Za-z0-9]+)\//);
return m ? m[1] : urlOrKey;
}


export async function getFile(figmaToken: string, fileKeyOrUrl: string) {
const key = parseFileKey(fileKeyOrUrl);
const api = axios.create({
baseURL: 'https://api.figma.com/v1',
headers: { 'X-Figma-Token': figmaToken }
});
const res = await api.get(`/files/${key}`);
return res.data; // raw Figma JSON
}


export type MinimalNode = { id: string; name: string; type: string; children?: MinimalNode[] };


export function extractNodes(doc: any): MinimalNode[] {
const out: MinimalNode[] = [];
const walk = (n: any) => {
out.push({ id: n.id, name: n.name, type: n.type, children: n.children?.length ? n.children : undefined });
(n.children || []).forEach(walk);
};
walk(doc.document);
return out;
}