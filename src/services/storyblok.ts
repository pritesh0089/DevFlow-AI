import axios from 'axios';
import Bottleneck from 'bottleneck';
import { SBComponent, TSBComponent } from '../utils/types.js';


const baseURL = 'https://mapi.storyblok.com/v1';
const limiter = new Bottleneck({ minTime: Math.ceil(1000 / Number(process.env.DF_MAX_RPS || 3)) });


function client(token: string) {
return axios.create({ baseURL, headers: { Authorization: token, 'Content-Type': 'application/json' } });
}


export async function listSpaces(token: string) {
const res = await limiter.schedule(() => client(token).get('/spaces/'));
return res.data?.spaces ?? res.data;
}


export async function createSpace(token: string, name: string) {
const res = await limiter.schedule(() => client(token).post('/spaces/', { space: { name } }));
return res.data?.space ?? res.data;
}


export async function createComponent(token: string, spaceId: string | number, component: TSBComponent) {
const payload = { component: SBComponent.parse(component) };
const res = await limiter.schedule(() => client(token).post(`/spaces/${spaceId}/components/`, payload));
return res.data?.component ?? res.data;
}