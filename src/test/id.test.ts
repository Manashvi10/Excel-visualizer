import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from '../core/id';

const cryptoApi=globalThis.crypto;
afterEach(()=>vi.unstubAllGlobals());
describe('browser-compatible IDs',()=>{
 it('uses native randomUUID when available',()=>{
  const randomUUID=vi.fn(()=> '6ba7b810-9dad-41d1-80b4-00c04fd430c8');
  vi.stubGlobal('crypto',{randomUUID});
  expect(createId()).toBe('6ba7b810-9dad-41d1-80b4-00c04fd430c8');
  expect(randomUUID).toHaveBeenCalledOnce();
 });
 it('creates version 4 UUIDs using secure random bytes on public HTTP',()=>{
  const getRandomValues=vi.fn((bytes:Uint8Array)=>cryptoApi.getRandomValues(bytes));
  vi.stubGlobal('crypto',{getRandomValues});
  const ids=Array.from({length:1000},()=>createId());
  expect(getRandomValues).toHaveBeenCalledTimes(1000);
  expect(new Set(ids).size).toBe(1000);
  for(const id of ids)expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 });
 it('sets UUID version and variant bits explicitly',()=>{
  vi.stubGlobal('crypto',{getRandomValues:(bytes:Uint8Array)=>bytes.fill(255)});
  expect(createId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
 });
});
